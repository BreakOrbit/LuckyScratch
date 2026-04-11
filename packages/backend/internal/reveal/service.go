package reveal

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/apperrors"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/chain"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/models"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/zama"
)

const revealReconcileBatchSize = 100

type Service struct {
	cfg     config.Config
	queries *db.Queries
	chain   *chain.Client
	zama    zama.Client
}

type RevealAuthRequest struct {
	Address string `json:"address"`
}

type RevealAuthResponse struct {
	TicketID    string         `json:"ticketId"`
	AuthPayload map[string]any `json:"authPayload"`
	Claim       ClaimInfo      `json:"claim"`
	ExpiresAt   time.Time      `json:"expiresAt"`
}

type ClaimInfo struct {
	RequiresClearRewardAmount bool   `json:"requiresClearRewardAmount"`
	RequiresDecryptionProof   bool   `json:"requiresDecryptionProof"`
	ClaimMethod               string `json:"claimMethod"`
}

type ClaimPrecheckResponse struct {
	TicketID          string `json:"ticketId"`
	Owner             string `json:"owner"`
	Status            string `json:"status"`
	RevealAuthorized  bool   `json:"revealAuthorized"`
	ClaimMethod       string `json:"claimMethod"`
	SourceOfTruthHint string `json:"sourceOfTruthHint"`
}

type storedRevealPayload struct {
	Owner   string `json:"owner"`
	ChainID int64  `json:"chainId"`
	Binding struct {
		RevealRequestRef string `json:"revealRequestRef"`
	} `json:"binding"`
	Zama *struct {
		UserDecrypt struct {
			HandleContractPairs []zama.HandleContractPair `json:"handleContractPairs"`
			ContractAddresses   []string                  `json:"contractAddresses"`
			StartTimestamp      string                    `json:"startTimestamp"`
			DurationDays        string                    `json:"durationDays"`
			ExpectedSigner      string                    `json:"expectedSigner"`
		} `json:"userDecrypt"`
	} `json:"zama"`
}

type relayerQueuedResponse struct {
	Status    string `json:"status"`
	RequestID string `json:"requestId"`
	Result    struct {
		JobID string `json:"jobId"`
	} `json:"result"`
}

func NewService(cfg config.Config, queries *db.Queries, chainClient *chain.Client, zamaClient zama.Client) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
		chain:   chainClient,
		zama:    zamaClient,
	}
}

func (s Service) BuildRevealAuth(ctx context.Context, ticketID uint64, userAddress string, backendBaseURL string) (RevealAuthResponse, error) {
	owner, status, revealAuthorized, _, handle, err := s.ticketAccessState(ctx, ticketID)
	if err != nil {
		return RevealAuthResponse{}, err
	}
	if normalizeAddress(owner) != normalizeAddress(userAddress) {
		return RevealAuthResponse{}, apperrors.Forbidden("request address is not the current owner", errors.New("request address is not the current owner"))
	}
	if status != models.TicketStatusScratched {
		return RevealAuthResponse{}, apperrors.Conflict("ticket is not scratched onchain", errors.New("ticket is not scratched onchain"))
	}
	if !revealAuthorized {
		return RevealAuthResponse{}, apperrors.Conflict("ticket is not reveal-authorized onchain", errors.New("ticket is not reveal-authorized onchain"))
	}

	expiresAt := time.Now().Add(s.cfg.Reveal.AuthTTL).UTC()
	requestRef := shortRevealRef(ticketID, owner, expiresAt)
	proxyRelayerURL := s.ticketProxyRelayerURL(ticketID, backendBaseURL)
	if s.zama.Enabled() && proxyRelayerURL == "" {
		return RevealAuthResponse{}, errors.New("unable to build public Zama proxy URL; configure API_PUBLIC_BASE_URL or forwarded host headers")
	}
	authPayload, err := s.zama.BuildRevealPayload(zama.RevealInput{
		ChainID:           s.cfg.Chain.ID,
		TicketID:          ticketID,
		Owner:             owner,
		CoreContract:      s.chain.CoreAddress().Hex(),
		TicketContract:    s.chain.TicketAddress().Hex(),
		EncryptedPrize:    fmt.Sprintf("0x%x", handle),
		ExpiresAt:         expiresAt,
		BackendRequestRef: requestRef,
		ClaimMethod:       "claimReward(ticketId, clearRewardAmount, decryptionProof)",
		ProxyRelayerURL:   proxyRelayerURL,
	})
	if err != nil {
		return RevealAuthResponse{}, err
	}

	authJSON, err := json.Marshal(authPayload)
	if err != nil {
		return RevealAuthResponse{}, err
	}

	_, err = s.queries.InsertRevealRequest(ctx, db.InsertRevealRequestParams{
		ChainID:                  s.cfg.Chain.ID,
		TicketID:                 int64(ticketID),
		RequestUser:              userAddress,
		OwnerSnapshot:            owner,
		RequestStatus:            "issued",
		ZamaRequestRef:           requestRef,
		TicketStatusSnapshot:     status,
		RevealAuthorizedSnapshot: revealAuthorized,
		AuthPayload:              authJSON,
		ClaimClearRewardAmount:   pgtype.Int8{},
		ClaimProofRef:            "",
		ExpiresAt:                store.Timestamptz(expiresAt),
	})
	if err != nil {
		return RevealAuthResponse{}, err
	}

	return RevealAuthResponse{
		TicketID:    fmt.Sprintf("%d", ticketID),
		AuthPayload: authPayload,
		Claim: ClaimInfo{
			RequiresClearRewardAmount: true,
			RequiresDecryptionProof:   true,
			ClaimMethod:               "claimReward(ticketId, clearRewardAmount, decryptionProof)",
		},
		ExpiresAt: expiresAt,
	}, nil
}

func (s Service) BuildClaimPrecheck(ctx context.Context, ticketID uint64) (ClaimPrecheckResponse, error) {
	owner, status, revealAuthorized, _, _, err := s.ticketAccessState(ctx, ticketID)
	if err != nil {
		return ClaimPrecheckResponse{}, err
	}

	return ClaimPrecheckResponse{
		TicketID:          fmt.Sprintf("%d", ticketID),
		Owner:             owner,
		Status:            status,
		RevealAuthorized:  revealAuthorized,
		ClaimMethod:       "claimReward(ticketId, clearRewardAmount, decryptionProof)",
		SourceOfTruthHint: "must read ownerOf + getTicketRevealState onchain",
	}, nil
}

func (s Service) ProxyKeyURL(ctx context.Context, _ uint64) (zama.ProxyResponse, error) {
	resp, err := s.zama.KeyURL(ctx)
	if err != nil {
		return s.internalProxyFailure("failed to reach upstream Zama relayer"), nil
	}
	return resp, nil
}

func (s Service) ProxyUserDecryptSubmit(ctx context.Context, ticketID uint64, payload zama.UserDecryptPayload) (zama.ProxyResponse, error) {
	payload = sanitizeUserDecryptPayload(payload)
	if !s.zama.Enabled() {
		return zama.NewFailedResponse(http.StatusNotFound, "not_found", "zama relayer proxy is not enabled", nil), nil
	}
	if normalizeAddress(payload.UserAddress) == "" {
		return s.validationProxyFailure("validation_failed", "missing user decryption fields", []zama.ErrorDetail{{Field: "userAddress", Issue: "required"}}), nil
	}

	revealRequest, err := s.queries.GetLatestRevealRequest(ctx, db.GetLatestRevealRequestParams{
		ChainID:  s.cfg.Chain.ID,
		TicketID: int64(ticketID),
		Lower:    payload.UserAddress,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return s.notFoundProxyFailure(ticketID, "no active reveal authorization found for this ticket and user"), nil
		}
		return s.internalProxyFailure("failed to load reveal authorization"), nil
	}
	if revealRequest.ExpiresAt.Valid && revealRequest.ExpiresAt.Time.Before(time.Now().UTC()) {
		return s.validationProxyFailure("request_error", "reveal authorization has expired", []zama.ErrorDetail{{Field: "expiresAt", Issue: "expired"}}), nil
	}

	owner, status, revealAuthorized, ticketData, _, err := s.ticketAccessState(ctx, ticketID)
	if err != nil {
		return s.internalProxyFailure("failed to validate ticket ownership onchain"), nil
	}
	if status != models.TicketStatusScratched || !revealAuthorized {
		return s.validationProxyFailure("not_ready_for_decryption", "ticket is not ready for user decryption", []zama.ErrorDetail{{Field: "ticketId", Issue: "not_ready_for_decryption"}}), nil
	}
	if normalizeAddress(owner) != normalizeAddress(payload.UserAddress) {
		return zama.NewFailedResponse(http.StatusUnauthorized, "unauthorized", "request address is not the current owner", nil), nil
	}

	expected, err := parseStoredRevealPayload(revealRequest.AuthPayload)
	if err != nil {
		return s.internalProxyFailure("stored reveal authorization is malformed"), nil
	}
	if expected.Zama == nil {
		return s.validationProxyFailure("request_error", "ticket reveal authorization does not include Zama relayer context", nil), nil
	}

	if validationErrors := validateUserDecryptPayload(expected, payload, s.cfg.Chain.ID, owner); len(validationErrors) > 0 {
		return s.validationProxyFailure("validation_failed", "user decrypt payload does not match the issued reveal authorization", validationErrors), nil
	}

	localJobID := strings.TrimSpace(revealRequest.ZamaRequestRef)
	if localJobID == "" {
		return s.internalProxyFailure("stored reveal authorization is missing a request reference"), nil
	}
	switch revealRequest.RequestStatus {
	case "failed":
		return s.revealRequestFailureResponse("request_failed", "decryption request failed; request a new reveal authorization"), nil
	case "submitting", "submitted", "completed":
		return s.ProxyUserDecryptStatus(ctx, ticketID, localJobID)
	}

	if _, err := s.queries.UpdateRevealRequestProxyState(ctx, db.UpdateRevealRequestProxyStateParams{
		ID:            revealRequest.ID,
		RequestStatus: "submitting",
		ClaimProofRef: revealRequest.ClaimProofRef,
	}); err != nil {
		return s.internalProxyFailure("failed to persist local decryption submit state"), nil
	}

	resp, err := s.zama.SubmitUserDecrypt(ctx, payload)
	if err != nil {
		return s.internalProxyFailure("failed to reach upstream Zama relayer"), nil
	}

	jobID := ""
	nextStatus := nextProxyRequestStatus(revealRequest.RequestStatus, resp.StatusCode)
	if resp.StatusCode == http.StatusAccepted {
		jobID, err = jobIDFromQueuedResponse(resp.Body)
		if err != nil {
			return s.internalProxyFailure("upstream Zama relayer returned an invalid queued response"), nil
		}
	}

	if _, err := s.queries.UpdateRevealRequestProxyState(ctx, db.UpdateRevealRequestProxyStateParams{
		ID:            revealRequest.ID,
		RequestStatus: nextStatus,
		ClaimProofRef: jobID,
	}); err != nil {
		return s.internalProxyFailure("failed to persist Zama decryption state"), nil
	}

	if (resp.StatusCode == http.StatusAccepted || resp.StatusCode == http.StatusOK) && s.cfg.Risk.RevealUnitCostWei > 0 {
		s.recordRevealInfraCost(ctx, ticketData, revealRequest.ZamaRequestRef, payload)
	}

	return rewriteProxyResponseJobID(resp, localJobID), nil
}

func (s Service) ProxyUserDecryptStatus(ctx context.Context, ticketID uint64, jobID string) (zama.ProxyResponse, error) {
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return s.notFoundProxyFailure(ticketID, "missing decryption job id"), nil
	}

	revealRequest, localJobID, err := s.revealRequestForJobID(ctx, ticketID, jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return s.notFoundProxyFailure(ticketID, "unknown decryption job for this ticket"), nil
		}
		return s.internalProxyFailure("failed to load decryption job state"), nil
	}
	if localJobID == "" {
		localJobID = jobID
	}
	if revealRequest.RequestStatus == "failed" {
		return s.revealRequestFailureResponse("request_failed", "decryption request failed; request a new reveal authorization"), nil
	}
	if revealRequest.RequestStatus == "submitting" {
		return localQueuedProxyResponse(localJobID), nil
	}
	upstreamJobID := strings.TrimSpace(revealRequest.ClaimProofRef)
	if upstreamJobID == "" {
		if revealRequest.RequestStatus == "completed" {
			return zama.NewFailedResponse(http.StatusConflict, "already_completed", "decryption already completed for this reveal authorization", nil), nil
		}
		return localQueuedProxyResponse(localJobID), nil
	}

	resp, err := s.syncRevealRequestStatus(ctx, revealRequest)
	if err != nil {
		return s.internalProxyFailure("failed to reach upstream Zama relayer"), nil
	}

	return rewriteProxyResponseJobID(resp, localJobID), nil
}

func (s Service) ReconcileProxyJobs(ctx context.Context) error {
	if !s.zama.Enabled() {
		return nil
	}

	if err := s.failStaleSubmittingRequests(ctx); err != nil {
		return err
	}
	return s.syncSubmittedRequests(ctx)
}

func (s Service) ticketAccessState(ctx context.Context, ticketID uint64) (string, string, bool, chainTicketData, [32]byte, error) {
	owner, err := s.chain.OwnerOf(ctx, ticketID)
	if err != nil {
		if isMissingOwnerOfTokenError(err) {
			return "", "", false, chainTicketData{}, [32]byte{}, apperrors.NotFound("ticket not found", err)
		}
		return "", "", false, chainTicketData{}, [32]byte{}, err
	}

	statusValue, revealAuthorized, err := s.chain.TicketRevealState(ctx, ticketID)
	if err != nil {
		return "", "", false, chainTicketData{}, [32]byte{}, err
	}

	ticketData, err := s.chain.TicketData(ctx, ticketID)
	if err != nil {
		return "", "", false, chainTicketData{}, [32]byte{}, err
	}

	handle, err := s.chain.TicketPrizeHandle(ctx, ticketID)
	if err != nil {
		return "", "", false, chainTicketData{}, [32]byte{}, err
	}

	return owner.Hex(), models.TicketStatusName(statusValue), revealAuthorized, chainTicketData{
		PoolID:  ticketData.PoolID,
		RoundID: ticketData.RoundID,
	}, handle, nil
}

type chainTicketData struct {
	PoolID  uint64
	RoundID uint64
}

func shortRevealRef(ticketID uint64, owner string, expiresAt time.Time) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d:%s:%s", ticketID, owner, expiresAt.Format(time.RFC3339Nano))))
	return hex.EncodeToString(sum[:16])
}

func normalizeAddress(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isMissingOwnerOfTokenError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "erc721nonexistenttoken") ||
		strings.Contains(message, "erc721: invalid token id") ||
		strings.Contains(message, "owner query for nonexistent token")
}

func sanitizeUserDecryptPayload(payload zama.UserDecryptPayload) zama.UserDecryptPayload {
	payload.UserAddress = strings.TrimSpace(payload.UserAddress)
	payload.Signature = strings.TrimPrefix(strings.TrimSpace(payload.Signature), "0x")
	payload.PublicKey = strings.TrimPrefix(strings.TrimSpace(payload.PublicKey), "0x")
	if strings.TrimSpace(payload.ExtraData) == "" {
		payload.ExtraData = "0x00"
	}
	return payload
}

func parseStoredRevealPayload(raw []byte) (storedRevealPayload, error) {
	var payload storedRevealPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return storedRevealPayload{}, err
	}
	return payload, nil
}

func validateUserDecryptPayload(expected storedRevealPayload, actual zama.UserDecryptPayload, chainID int64, owner string) []zama.ErrorDetail {
	var details []zama.ErrorDetail
	expectedChainID := strconv.FormatInt(chainID, 10)
	if strings.TrimSpace(actual.ContractsChainID) != expectedChainID {
		details = append(details, zama.ErrorDetail{Field: "contractsChainId", Issue: "must match issued reveal authorization"})
	}
	if normalizeAddress(actual.UserAddress) != normalizeAddress(owner) {
		details = append(details, zama.ErrorDetail{Field: "userAddress", Issue: "must match current ticket owner"})
	}
	if expected.Zama != nil {
		if !equalHandleContractPairs(expected.Zama.UserDecrypt.HandleContractPairs, actual.HandleContractPairs) {
			details = append(details, zama.ErrorDetail{Field: "handleContractPairs", Issue: "must match issued reveal authorization"})
		}
		if !equalAddressLists(expected.Zama.UserDecrypt.ContractAddresses, actual.ContractAddresses) {
			details = append(details, zama.ErrorDetail{Field: "contractAddresses", Issue: "must match issued reveal authorization"})
		}
		if strings.TrimSpace(actual.RequestValidity.StartTimestamp) != expected.Zama.UserDecrypt.StartTimestamp {
			details = append(details, zama.ErrorDetail{Field: "requestValidity.startTimestamp", Issue: "must match issued reveal authorization"})
		}
		if strings.TrimSpace(actual.RequestValidity.DurationDays) != expected.Zama.UserDecrypt.DurationDays {
			details = append(details, zama.ErrorDetail{Field: "requestValidity.durationDays", Issue: "must match issued reveal authorization"})
		}
		if normalizeAddress(actual.UserAddress) != normalizeAddress(expected.Zama.UserDecrypt.ExpectedSigner) {
			details = append(details, zama.ErrorDetail{Field: "userAddress", Issue: "must match expected signer"})
		}
	}
	if strings.TrimSpace(actual.Signature) == "" {
		details = append(details, zama.ErrorDetail{Field: "signature", Issue: "required"})
	}
	if strings.TrimSpace(actual.PublicKey) == "" {
		details = append(details, zama.ErrorDetail{Field: "publicKey", Issue: "required"})
	}
	if strings.TrimSpace(actual.ExtraData) != "0x00" {
		details = append(details, zama.ErrorDetail{Field: "extraData", Issue: "must be 0x00"})
	}
	return details
}

func equalHandleContractPairs(expected []zama.HandleContractPair, actual []zama.HandleContractPair) bool {
	if len(expected) != len(actual) {
		return false
	}
	for idx := range expected {
		if strings.TrimSpace(expected[idx].Handle) != strings.TrimSpace(actual[idx].Handle) {
			return false
		}
		if normalizeAddress(expected[idx].ContractAddress) != normalizeAddress(actual[idx].ContractAddress) {
			return false
		}
	}
	return true
}

func equalAddressLists(expected []string, actual []string) bool {
	if len(expected) != len(actual) {
		return false
	}
	for idx := range expected {
		if normalizeAddress(expected[idx]) != normalizeAddress(actual[idx]) {
			return false
		}
	}
	return true
}

func jobIDFromQueuedResponse(body []byte) (string, error) {
	var response relayerQueuedResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}
	jobID := strings.TrimSpace(response.Result.JobID)
	if response.Status != "queued" || jobID == "" {
		return "", errors.New("queued response missing jobId")
	}
	return jobID, nil
}

func (s Service) syncRevealRequestStatus(ctx context.Context, revealRequest db.RevealRequest) (zama.ProxyResponse, error) {
	upstreamJobID := strings.TrimSpace(revealRequest.ClaimProofRef)
	if upstreamJobID == "" {
		return zama.ProxyResponse{}, errors.New("missing upstream decryption job id")
	}

	resp, err := s.zama.UserDecryptStatus(ctx, upstreamJobID)
	if err != nil {
		return zama.ProxyResponse{}, err
	}

	nextStatus := nextProxyRequestStatus(revealRequest.RequestStatus, resp.StatusCode)
	if nextStatus != revealRequest.RequestStatus {
		if _, err := s.queries.UpdateRevealRequestProxyState(ctx, db.UpdateRevealRequestProxyStateParams{
			ID:            revealRequest.ID,
			RequestStatus: nextStatus,
			ClaimProofRef: revealRequest.ClaimProofRef,
		}); err != nil {
			return zama.ProxyResponse{}, err
		}
	}

	return resp, nil
}

func nextProxyRequestStatus(current string, statusCode int) string {
	switch {
	case statusCode == http.StatusAccepted:
		return "submitted"
	case statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices:
		return "completed"
	case statusCode >= http.StatusBadRequest:
		return "failed"
	default:
		return current
	}
}

func localQueuedProxyResponse(localJobID string) zama.ProxyResponse {
	body, _ := json.Marshal(relayerQueuedResponse{
		Status:    "queued",
		RequestID: localJobID,
		Result: struct {
			JobID string `json:"jobId"`
		}{
			JobID: localJobID,
		},
	})
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	return zama.ProxyResponse{
		StatusCode: http.StatusAccepted,
		Body:       body,
		Headers:    headers,
	}
}

func (s Service) revealRequestFailureResponse(label string, message string) zama.ProxyResponse {
	return zama.NewFailedResponse(http.StatusConflict, label, message, nil)
}

func rewriteProxyResponseJobID(resp zama.ProxyResponse, localJobID string) zama.ProxyResponse {
	if strings.TrimSpace(localJobID) == "" || len(resp.Body) == 0 {
		return resp
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body, &payload); err != nil {
		return resp
	}

	payload["requestId"] = localJobID
	status, _ := payload["status"].(string)
	result, _ := payload["result"].(map[string]any)
	if result == nil && status == "queued" {
		result = map[string]any{}
	}
	if result != nil {
		if _, exists := result["jobId"]; exists || status == "queued" {
			result["jobId"] = localJobID
		}
		payload["result"] = result
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return resp
	}
	resp.Body = body
	if resp.Headers == nil {
		resp.Headers = make(http.Header)
	}
	resp.Headers.Set("Content-Type", "application/json")
	return resp
}

func (s Service) failStaleSubmittingRequests(ctx context.Context) error {
	requests, err := s.queries.ListStaleSubmittingRevealRequests(ctx, db.ListStaleSubmittingRevealRequestsParams{
		ChainID:   s.cfg.Chain.ID,
		UpdatedAt: store.Timestamptz(time.Now().UTC().Add(-s.cfg.Reveal.SubmitTimeout)),
		Limit:     revealReconcileBatchSize,
	})
	if err != nil {
		return err
	}

	for _, revealRequest := range requests {
		if strings.TrimSpace(revealRequest.ClaimProofRef) != "" {
			if _, err := s.syncRevealRequestStatus(ctx, revealRequest); err != nil {
				return err
			}
			continue
		}

		if _, err := s.queries.UpdateRevealRequestProxyState(ctx, db.UpdateRevealRequestProxyStateParams{
			ID:            revealRequest.ID,
			RequestStatus: "failed",
			ClaimProofRef: revealRequest.ClaimProofRef,
		}); err != nil {
			return err
		}
	}

	return nil
}

func (s Service) syncSubmittedRequests(ctx context.Context) error {
	requests, err := s.queries.ListSubmittedRevealRequests(ctx, db.ListSubmittedRevealRequestsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   revealReconcileBatchSize,
	})
	if err != nil {
		return err
	}

	for _, revealRequest := range requests {
		if _, err := s.syncRevealRequestStatus(ctx, revealRequest); err != nil {
			return err
		}
	}

	return nil
}

func (s Service) revealRequestForJobID(ctx context.Context, ticketID uint64, jobID string) (db.RevealRequest, string, error) {
	revealRequest, err := s.queries.GetRevealRequestByZamaRequestRef(ctx, db.GetRevealRequestByZamaRequestRefParams{
		ChainID:        s.cfg.Chain.ID,
		TicketID:       int64(ticketID),
		ZamaRequestRef: jobID,
	})
	if err == nil {
		return revealRequest, strings.TrimSpace(revealRequest.ZamaRequestRef), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.RevealRequest{}, "", err
	}

	revealRequest, err = s.queries.GetRevealRequestByJobRef(ctx, db.GetRevealRequestByJobRefParams{
		ChainID:       s.cfg.Chain.ID,
		TicketID:      int64(ticketID),
		ClaimProofRef: jobID,
	})
	if err != nil {
		return db.RevealRequest{}, "", err
	}
	return revealRequest, strings.TrimSpace(revealRequest.ZamaRequestRef), nil
}

func (s Service) ticketProxyRelayerURL(ticketID uint64, backendBaseURL string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(backendBaseURL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(s.cfg.API.PublicBaseURL), "/")
	}
	if baseURL == "" {
		return ""
	}
	return fmt.Sprintf("%s/api/v1/tickets/%d/zama/relayer/v2", baseURL, ticketID)
}

func (s Service) recordRevealInfraCost(ctx context.Context, ticketData chainTicketData, requestRef string, payload zama.UserDecryptPayload) {
	if requestRef == "" {
		return
	}
	metadata, err := json.Marshal(map[string]any{
		"userAddress":         payload.UserAddress,
		"contractsChainId":    payload.ContractsChainID,
		"handleContractPairs": payload.HandleContractPairs,
	})
	if err != nil {
		return
	}
	_, _ = s.queries.InsertPoolCostLedger(ctx, db.InsertPoolCostLedgerParams{
		ChainID:  s.cfg.Chain.ID,
		PoolID:   int64(ticketData.PoolID),
		RoundID:  store.Int8(int64(ticketData.RoundID)),
		CostType: "ZAMA_INFRA",
		Amount:   s.cfg.Risk.RevealUnitCostWei,
		TxHash:   "",
		RefType:  "reveal_request",
		RefID:    requestRef,
		Metadata: metadata,
	})
}

func (s Service) validationProxyFailure(label string, message string, details []zama.ErrorDetail) zama.ProxyResponse {
	return zama.NewFailedResponse(http.StatusBadRequest, label, message, details)
}

func (s Service) notFoundProxyFailure(ticketID uint64, message string) zama.ProxyResponse {
	return zama.NewFailedResponse(http.StatusNotFound, "not_found", message, []zama.ErrorDetail{{Field: "ticketId", Issue: fmt.Sprintf("%d", ticketID)}})
}

func (s Service) internalProxyFailure(message string) zama.ProxyResponse {
	return zama.NewFailedResponse(http.StatusInternalServerError, "internal_server_error", message, nil)
}
