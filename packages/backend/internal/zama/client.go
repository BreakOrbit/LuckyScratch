package zama

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
)

const (
	ModeFrontendLocalProof = "frontend-local-proof"
	ModeRelayerSDK         = "zama-relayer-sdk"
)

type Client struct {
	cfg                config.ZamaConfig
	httpClient         *http.Client
	resolvedRelayerURL string
}

type RevealInput struct {
	ChainID           int64
	TicketID          uint64
	Owner             string
	CoreContract      string
	TicketContract    string
	EncryptedPrize    string
	ExpiresAt         time.Time
	BackendRequestRef string
	ClaimMethod       string
	ProxyRelayerURL   string
}

type ProxyResponse struct {
	StatusCode int
	Body       []byte
	Headers    http.Header
}

type ErrorDetail struct {
	Field string `json:"field"`
	Issue string `json:"issue"`
}

type HandleContractPair struct {
	Handle          string `json:"handle"`
	ContractAddress string `json:"contractAddress"`
}

type UserDecryptRequestValidity struct {
	StartTimestamp string `json:"startTimestamp"`
	DurationDays   string `json:"durationDays"`
}

type UserDecryptPayload struct {
	HandleContractPairs []HandleContractPair       `json:"handleContractPairs"`
	RequestValidity     UserDecryptRequestValidity `json:"requestValidity"`
	ContractsChainID    string                     `json:"contractsChainId"`
	ContractAddresses   []string                   `json:"contractAddresses"`
	UserAddress         string                     `json:"userAddress"`
	Signature           string                     `json:"signature"`
	PublicKey           string                     `json:"publicKey"`
	ExtraData           string                     `json:"extraData"`
}

type revealAuthPayload struct {
	Mode                 string                 `json:"mode"`
	ChainID              int64                  `json:"chainId"`
	TicketID             uint64                 `json:"ticketId"`
	Owner                string                 `json:"owner"`
	CoreContract         string                 `json:"coreContract"`
	TicketContract       string                 `json:"ticketContract"`
	EncryptedPrizeHandle string                 `json:"encryptedPrizeHandle"`
	Binding              revealBinding          `json:"binding"`
	Zama                 *zamaRelayerAuthConfig `json:"zama,omitempty"`
}

type revealBinding struct {
	TicketID         uint64 `json:"ticketId"`
	Owner            string `json:"owner"`
	ChainID          int64  `json:"chainId"`
	ExpiresAt        string `json:"expiresAt"`
	RevealRequestRef string `json:"revealRequestRef,omitempty"`
}

type zamaRelayerAuthConfig struct {
	IntegrationMode string              `json:"integrationMode"`
	BillingMode     string              `json:"billingMode"`
	SDKConfig       sdkConfig           `json:"sdkConfig"`
	UserDecrypt     userDecryptTemplate `json:"userDecrypt"`
	ClaimProof      claimProofTemplate  `json:"claimProof"`
	Notes           []string            `json:"notes,omitempty"`
}

type sdkConfig struct {
	RelayerURL                                string `json:"relayerUrl"`
	UpstreamRelayerURL                        string `json:"upstreamRelayerUrl,omitempty"`
	UsesBackendProxy                          bool   `json:"usesBackendProxy"`
	GatewayChainID                            int64  `json:"gatewayChainId"`
	FhevmExecutorContractAddress              string `json:"fhevmExecutorContractAddress,omitempty"`
	AclContractAddress                        string `json:"aclContractAddress"`
	HCUContractAddress                        string `json:"hcuContractAddress,omitempty"`
	KMSVerifierContractAddress                string `json:"kmsVerifierContractAddress"`
	InputVerifierContractAddress              string `json:"inputVerifierContractAddress"`
	VerifyingContractAddressDecryption        string `json:"verifyingContractAddressDecryption"`
	VerifyingContractAddressInputVerification string `json:"verifyingContractAddressInputVerification"`
	APIKeyRequired                            bool   `json:"apiKeyRequired"`
}

type userDecryptTemplate struct {
	HandleContractPairs []HandleContractPair `json:"handleContractPairs"`
	ContractAddresses   []string             `json:"contractAddresses"`
	StartTimestamp      string               `json:"startTimestamp"`
	DurationDays        string               `json:"durationDays"`
	MaxTotalBits        int                  `json:"maxTotalBits"`
	ExpectedSigner      string               `json:"expectedSigner"`
}

type claimProofTemplate struct {
	Handles             []string             `json:"handles"`
	HandleContractPairs []HandleContractPair `json:"handleContractPairs"`
	ABIEncoding         string               `json:"abiEncoding"`
	ProofType           string               `json:"proofType"`
	VerifyOnchainWith   string               `json:"verifyOnchainWith"`
	BatchOrderMatters   bool                 `json:"batchOrderMatters"`
}

type relayerFailedResponse struct {
	Status string          `json:"status"`
	Error  relayerAPIError `json:"error"`
}

type relayerAPIError struct {
	Label   string        `json:"label"`
	Message string        `json:"message"`
	Details []ErrorDetail `json:"details,omitempty"`
}

func NewClient(cfg config.ZamaConfig) (Client, error) {
	client := Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: cfg.HTTPTimeout,
		},
	}
	if !cfg.Enabled() {
		return client, nil
	}
	resolvedRelayerURL, err := resolveRelayerURL(cfg.RelayerURL)
	if err != nil {
		return Client{}, err
	}
	client.resolvedRelayerURL = resolvedRelayerURL
	return client, client.Validate()
}

func (c Client) Enabled() bool {
	return c.cfg.Enabled()
}

func (c Client) Validate() error {
	if !c.cfg.Enabled() {
		return nil
	}

	required := map[string]string{
		"ZAMA_RELAYER_URL":                     c.cfg.RelayerURL,
		"ZAMA_GATEWAY_CHAIN_ID":                strconv.FormatInt(c.cfg.GatewayChainID, 10),
		"ZAMA_ACL_CONTRACT_ADDRESS":            c.cfg.AclContractAddress,
		"ZAMA_KMS_VERIFIER_CONTRACT_ADDRESS":   c.cfg.KMSVerifierContractAddress,
		"ZAMA_INPUT_VERIFIER_CONTRACT_ADDRESS": c.cfg.InputVerifierContractAddress,
		"ZAMA_DECRYPTION_ADDRESS":              c.cfg.VerifyingContractAddressDecryption,
		"ZAMA_INPUT_VERIFICATION_ADDRESS":      c.cfg.VerifyingContractAddressInputVerification,
	}
	for key, value := range required {
		if strings.TrimSpace(value) == "" || value == "0" {
			return errors.New(key + " is required when ZAMA_MODE=zama-relayer-sdk")
		}
	}
	if c.cfg.UserDecryptDurationDays <= 0 {
		return errors.New("ZAMA_USER_DECRYPT_DURATION_DAYS must be greater than zero")
	}
	if c.cfg.MaxUserDecryptBits <= 0 {
		return errors.New("ZAMA_MAX_USER_DECRYPT_BITS must be greater than zero")
	}
	if c.cfg.HTTPTimeout <= 0 {
		return errors.New("ZAMA_HTTP_TIMEOUT must be greater than zero")
	}
	if c.resolvedRelayerURL == "" {
		return errors.New("ZAMA_RELAYER_URL could not be resolved")
	}
	return nil
}

func (c Client) BuildRevealPayload(input RevealInput) (map[string]any, error) {
	payload := revealAuthPayload{
		Mode:                 ModeFrontendLocalProof,
		ChainID:              input.ChainID,
		TicketID:             input.TicketID,
		Owner:                input.Owner,
		CoreContract:         input.CoreContract,
		TicketContract:       input.TicketContract,
		EncryptedPrizeHandle: input.EncryptedPrize,
		Binding: revealBinding{
			TicketID:         input.TicketID,
			Owner:            input.Owner,
			ChainID:          input.ChainID,
			ExpiresAt:        input.ExpiresAt.Format(time.RFC3339),
			RevealRequestRef: input.BackendRequestRef,
		},
	}

	if c.cfg.Enabled() {
		handleContract := HandleContractPair{
			Handle:          input.EncryptedPrize,
			ContractAddress: input.CoreContract,
		}
		startTimestamp := strconv.FormatInt(time.Now().UTC().Unix(), 10)
		proxyRelayerURL := strings.TrimSpace(input.ProxyRelayerURL)
		usesBackendProxy := proxyRelayerURL != ""
		relayerURL := proxyRelayerURL
		if relayerURL == "" {
			relayerURL = c.resolvedRelayerURL
		}
		payload.Mode = ModeRelayerSDK
		payload.Zama = &zamaRelayerAuthConfig{
			IntegrationMode: integrationMode(c.cfg, usesBackendProxy),
			BillingMode:     "protocol-sponsored",
			SDKConfig: sdkConfig{
				RelayerURL:                                relayerURL,
				UpstreamRelayerURL:                        c.resolvedRelayerURL,
				UsesBackendProxy:                          usesBackendProxy,
				GatewayChainID:                            c.cfg.GatewayChainID,
				FhevmExecutorContractAddress:              c.cfg.FhevmExecutorContractAddress,
				AclContractAddress:                        c.cfg.AclContractAddress,
				HCUContractAddress:                        c.cfg.HCUContractAddress,
				KMSVerifierContractAddress:                c.cfg.KMSVerifierContractAddress,
				InputVerifierContractAddress:              c.cfg.InputVerifierContractAddress,
				VerifyingContractAddressDecryption:        c.cfg.VerifyingContractAddressDecryption,
				VerifyingContractAddressInputVerification: c.cfg.VerifyingContractAddressInputVerification,
				APIKeyRequired:                            false,
			},
			UserDecrypt: userDecryptTemplate{
				HandleContractPairs: []HandleContractPair{handleContract},
				ContractAddresses:   []string{input.CoreContract},
				StartTimestamp:      startTimestamp,
				DurationDays:        strconv.Itoa(c.cfg.UserDecryptDurationDays),
				MaxTotalBits:        c.cfg.MaxUserDecryptBits,
				ExpectedSigner:      input.Owner,
			},
			ClaimProof: claimProofTemplate{
				Handles:             []string{input.EncryptedPrize},
				HandleContractPairs: []HandleContractPair{handleContract},
				ABIEncoding:         "abi.encode(uint64 clearRewardAmount)",
				ProofType:           "kms-signatures",
				VerifyOnchainWith:   input.ClaimMethod,
				BatchOrderMatters:   true,
			},
			Notes: []string{
				"userDecrypt is proxied through the LuckyScratch backend so frontend code does not call the Zama relayer directly",
				"claimReward still needs clearRewardAmount plus a KMS decryption proof for the same handle order",
				"the reveal request ref is the idempotency key used for backend-side audit and infra cost accounting",
			},
		}
	}

	return toMap(payload)
}

func (c Client) KeyURL(ctx context.Context) (ProxyResponse, error) {
	return c.doRequest(ctx, http.MethodGet, "/keyurl", nil)
}

func (c Client) SubmitUserDecrypt(ctx context.Context, payload UserDecryptPayload) (ProxyResponse, error) {
	return c.doJSON(ctx, http.MethodPost, "/user-decrypt", payload)
}

func (c Client) UserDecryptStatus(ctx context.Context, jobID string) (ProxyResponse, error) {
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return NewFailedResponse(http.StatusNotFound, "not_found", "missing decryption job id", []ErrorDetail{{Field: "jobId", Issue: "required"}}), nil
	}
	return c.doRequest(ctx, http.MethodGet, "/user-decrypt/"+url.PathEscape(jobID), nil)
}

func NewFailedResponse(statusCode int, label string, message string, details []ErrorDetail) ProxyResponse {
	body, _ := json.Marshal(relayerFailedResponse{
		Status: "failed",
		Error: relayerAPIError{
			Label:   label,
			Message: message,
			Details: details,
		},
	})
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	return ProxyResponse{
		StatusCode: statusCode,
		Body:       body,
		Headers:    headers,
	}
}

func resolveRelayerURL(raw string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return "", errors.New("ZAMA_RELAYER_URL is required when ZAMA_MODE=zama-relayer-sdk")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid ZAMA_RELAYER_URL: %w", err)
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("ZAMA_RELAYER_URL must be an absolute URL")
	}
	if strings.HasSuffix(parsed.Path, "/v1") || strings.HasSuffix(parsed.Path, "/v2") {
		return parsed.String(), nil
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/v2"
	return parsed.String(), nil
}

func integrationMode(cfg config.ZamaConfig, usesBackendProxy bool) string {
	if usesBackendProxy {
		if strings.TrimSpace(cfg.APIKey) != "" {
			return "backend-proxy-required"
		}
		return "backend-proxy"
	}
	if strings.TrimSpace(cfg.APIKey) != "" {
		return "backend-proxy-required"
	}
	return "client-sdk-direct"
}

func (c Client) doJSON(ctx context.Context, method string, endpoint string, payload any) (ProxyResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return ProxyResponse{}, err
	}
	return c.doRequest(ctx, method, endpoint, body)
}

func (c Client) doRequest(ctx context.Context, method string, endpoint string, body []byte) (ProxyResponse, error) {
	if !c.cfg.Enabled() {
		return NewFailedResponse(http.StatusNotFound, "not_found", "zama relayer proxy is not enabled", nil), nil
	}
	targetURL := strings.TrimRight(c.resolvedRelayerURL, "/") + "/" + strings.TrimLeft(endpoint, "/")
	request, err := http.NewRequestWithContext(ctx, method, targetURL, bytes.NewReader(body))
	if err != nil {
		return ProxyResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("ZAMA-SDK-NAME", "lucky-scratch-backend-proxy")
	request.Header.Set("ZAMA-SDK-VERSION", "1")
	if len(body) > 0 {
		request.Header.Set("Content-Type", "application/json")
	}
	if apiKey := strings.TrimSpace(c.cfg.APIKey); apiKey != "" {
		request.Header.Set("x-api-key", apiKey)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return ProxyResponse{}, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return ProxyResponse{}, err
	}

	return ProxyResponse{
		StatusCode: response.StatusCode,
		Body:       responseBody,
		Headers:    cloneProxyHeaders(response.Header),
	}, nil
}

func cloneProxyHeaders(src http.Header) http.Header {
	dst := make(http.Header)
	for _, key := range []string{"Content-Type", "Retry-After"} {
		if value := strings.TrimSpace(src.Get(key)); value != "" {
			dst.Set(key, value)
		}
	}
	if dst.Get("Content-Type") == "" {
		dst.Set("Content-Type", "application/json")
	}
	return dst
}

func toMap(value any) (map[string]any, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
