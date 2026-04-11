package reveal

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/zama"
)

func TestValidateUserDecryptPayloadRejectsMismatchedAuthorization(t *testing.T) {
	t.Parallel()

	expected := storedRevealPayload{
		Owner:   "0xOwner",
		ChainID: 11155111,
	}
	expected.Zama = &struct {
		UserDecrypt struct {
			HandleContractPairs []zama.HandleContractPair `json:"handleContractPairs"`
			ContractAddresses   []string                  `json:"contractAddresses"`
			StartTimestamp      string                    `json:"startTimestamp"`
			DurationDays        string                    `json:"durationDays"`
			ExpectedSigner      string                    `json:"expectedSigner"`
		} `json:"userDecrypt"`
	}{}
	expected.Zama.UserDecrypt.HandleContractPairs = []zama.HandleContractPair{{Handle: "0xhandle", ContractAddress: "0xcore"}}
	expected.Zama.UserDecrypt.ContractAddresses = []string{"0xcore"}
	expected.Zama.UserDecrypt.StartTimestamp = "100"
	expected.Zama.UserDecrypt.DurationDays = "1"
	expected.Zama.UserDecrypt.ExpectedSigner = "0xOwner"

	details := validateUserDecryptPayload(expected, zama.UserDecryptPayload{
		HandleContractPairs: []zama.HandleContractPair{{Handle: "0xwrong", ContractAddress: "0xcore"}},
		RequestValidity: zama.UserDecryptRequestValidity{
			StartTimestamp: "200",
			DurationDays:   "2",
		},
		ContractsChainID:  "1",
		ContractAddresses: []string{"0xother"},
		UserAddress:       "0xother",
		Signature:         "",
		PublicKey:         "",
		ExtraData:         "0x01",
	}, 11155111, "0xOwner")
	if len(details) == 0 {
		t.Fatal("expected validation errors")
	}
}

func TestJobIDFromQueuedResponseExtractsJobID(t *testing.T) {
	t.Parallel()

	jobID, err := jobIDFromQueuedResponse([]byte(`{"status":"queued","result":{"jobId":"job-1"}}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if jobID != "job-1" {
		t.Fatalf("unexpected job id %q", jobID)
	}
}

func TestLocalQueuedProxyResponseUsesStableLocalJobID(t *testing.T) {
	t.Parallel()

	resp := localQueuedProxyResponse("req-1")
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("unexpected status %d", resp.StatusCode)
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body, &body); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}
	if body["requestId"] != "req-1" {
		t.Fatalf("unexpected request id %#v", body["requestId"])
	}
	result, ok := body["result"].(map[string]any)
	if !ok {
		t.Fatal("expected result object")
	}
	if result["jobId"] != "req-1" {
		t.Fatalf("unexpected job id %#v", result["jobId"])
	}
}

func TestRewriteProxyResponseJobIDRewritesQueuedBodyToLocalReference(t *testing.T) {
	t.Parallel()

	resp := rewriteProxyResponseJobID(zama.ProxyResponse{
		StatusCode: http.StatusAccepted,
		Body: []byte(`{
			"status":"queued",
			"requestId":"upstream-1",
			"result":{"jobId":"job-1"}
		}`),
	}, "req-1")

	var body map[string]any
	if err := json.Unmarshal(resp.Body, &body); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}
	if body["requestId"] != "req-1" {
		t.Fatalf("unexpected request id %#v", body["requestId"])
	}
	result, ok := body["result"].(map[string]any)
	if !ok {
		t.Fatal("expected result object")
	}
	if result["jobId"] != "req-1" {
		t.Fatalf("unexpected job id %#v", result["jobId"])
	}
}
