package zama

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
)

func TestBuildRevealPayloadUsesBackendProxyWhenProvided(t *testing.T) {
	t.Parallel()

	client, err := NewClient(config.ZamaConfig{
		Mode:                               ModeRelayerSDK,
		RelayerURL:                         "https://relayer.testnet.zama.org",
		HTTPTimeout:                        time.Second,
		GatewayChainID:                     10901,
		AclContractAddress:                 "0xacl",
		KMSVerifierContractAddress:         "0xkms",
		InputVerifierContractAddress:       "0xinput",
		VerifyingContractAddressDecryption: "0xdecrypt",
		VerifyingContractAddressInputVerification: "0xverify",
		UserDecryptDurationDays:                   1,
		MaxUserDecryptBits:                        2048,
	})
	if err != nil {
		t.Fatalf("unexpected client error: %v", err)
	}

	payload, err := client.BuildRevealPayload(RevealInput{
		ChainID:           11155111,
		TicketID:          42,
		Owner:             "0xowner",
		CoreContract:      "0xcore",
		TicketContract:    "0xticket",
		EncryptedPrize:    "0xhandle",
		ExpiresAt:         time.Unix(1_700_000_000, 0).UTC(),
		BackendRequestRef: "req-1",
		ClaimMethod:       "claimReward(ticketId, clearRewardAmount, decryptionProof)",
		ProxyRelayerURL:   "https://backend.example/api/v1/tickets/42/zama/relayer/v2",
	})
	if err != nil {
		t.Fatalf("unexpected payload error: %v", err)
	}

	if payload["mode"] != ModeRelayerSDK {
		t.Fatalf("expected mode %q, got %#v", ModeRelayerSDK, payload["mode"])
	}
	zamaPayload, ok := payload["zama"].(map[string]any)
	if !ok {
		t.Fatal("expected zama payload map")
	}
	if zamaPayload["integrationMode"] != "backend-proxy" {
		t.Fatalf("unexpected integration mode %#v", zamaPayload["integrationMode"])
	}
	sdkConfig, ok := zamaPayload["sdkConfig"].(map[string]any)
	if !ok {
		t.Fatal("expected sdkConfig map")
	}
	if sdkConfig["relayerUrl"] != "https://backend.example/api/v1/tickets/42/zama/relayer/v2" {
		t.Fatalf("unexpected relayerUrl %#v", sdkConfig["relayerUrl"])
	}
	if sdkConfig["upstreamRelayerUrl"] != "https://relayer.testnet.zama.org/v2" {
		t.Fatalf("unexpected upstream relayer url %#v", sdkConfig["upstreamRelayerUrl"])
	}
}

func TestResolveRelayerURLAppendsV2WhenVersionMissing(t *testing.T) {
	t.Parallel()

	got, err := resolveRelayerURL("https://relayer.testnet.zama.org")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://relayer.testnet.zama.org/v2" {
		t.Fatalf("unexpected resolved relayer url %q", got)
	}
}

func TestSubmitUserDecryptUsesAPIKeyHeader(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/user-decrypt" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if got := r.Header.Get("x-api-key"); got != "secret" {
			t.Fatalf("unexpected api key header %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":    "queued",
			"requestId": "req-1",
			"result": map[string]any{
				"jobId": "job-1",
			},
		})
	}))
	defer server.Close()

	client, err := NewClient(config.ZamaConfig{
		Mode:                               ModeRelayerSDK,
		RelayerURL:                         server.URL,
		APIKey:                             "secret",
		HTTPTimeout:                        time.Second,
		GatewayChainID:                     10901,
		AclContractAddress:                 "0xacl",
		KMSVerifierContractAddress:         "0xkms",
		InputVerifierContractAddress:       "0xinput",
		VerifyingContractAddressDecryption: "0xdecrypt",
		VerifyingContractAddressInputVerification: "0xverify",
		UserDecryptDurationDays:                   1,
		MaxUserDecryptBits:                        2048,
	})
	if err != nil {
		t.Fatalf("unexpected client error: %v", err)
	}

	resp, err := client.SubmitUserDecrypt(t.Context(), UserDecryptPayload{
		HandleContractPairs: []HandleContractPair{{Handle: "0xhandle", ContractAddress: "0xcore"}},
		RequestValidity: UserDecryptRequestValidity{
			StartTimestamp: "1",
			DurationDays:   "1",
		},
		ContractsChainID:  "11155111",
		ContractAddresses: []string{"0xcore"},
		UserAddress:       "0xuser",
		Signature:         "abc",
		PublicKey:         "def",
		ExtraData:         "0x00",
	})
	if err != nil {
		t.Fatalf("unexpected proxy error: %v", err)
	}
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("unexpected status %d", resp.StatusCode)
	}
}

func TestValidateRequiresRelayerFieldsWhenEnabled(t *testing.T) {
	t.Parallel()

	_, err := NewClient(config.ZamaConfig{
		Mode:                    ModeRelayerSDK,
		HTTPTimeout:             time.Second,
		UserDecryptDurationDays: 1,
		MaxUserDecryptBits:      2048,
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
}
