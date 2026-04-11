package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/admin"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/apperrors"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/gasless"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/reveal"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/zama"
)

type Server struct {
	cfg            config.Config
	queries        *db.Queries
	gaslessService gasless.Service
	revealService  reveal.Service
	adminService   admin.Service
}

func NewServer(cfg config.Config, queries *db.Queries, gaslessService gasless.Service, revealService reveal.Service, adminService admin.Service) *Server {
	return &Server{
		cfg:            cfg,
		queries:        queries,
		gaslessService: gaslessService,
		revealService:  revealService,
		adminService:   adminService,
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/api/v1/pools", s.handlePools)
	mux.HandleFunc("/api/v1/pools/", s.handlePoolRoutes)
	mux.HandleFunc("/api/v1/users/", s.handleUserRoutes)
	mux.HandleFunc("/api/v1/gasless/nonce/", s.handleGaslessNonce)
	mux.HandleFunc("/api/v1/gasless/purchase", s.handleGaslessPurchase)
	mux.HandleFunc("/api/v1/gasless/purchase-selection", s.handleGaslessPurchaseSelection)
	mux.HandleFunc("/api/v1/gasless/scratch", s.handleGaslessScratch)
	mux.HandleFunc("/api/v1/gasless/batch-scratch", s.handleGaslessBatchScratch)
	mux.HandleFunc("/api/v1/gasless/requests/", s.handleGaslessRequest)
	mux.HandleFunc("/api/v1/tickets/", s.handleTickets)
	mux.HandleFunc("/api/v1/admin/jobs", s.requireAdmin(s.handleAdminJobs))
	mux.HandleFunc("/api/v1/admin/jobs/", s.requireAdmin(s.handleAdminJobRoutes))
	mux.HandleFunc("/api/v1/admin/relayer/health", s.requireAdmin(s.handleAdminRelayerHealth))
	mux.HandleFunc("/api/v1/admin/pools/", s.requireAdmin(s.handleAdminPoolRoutes))
	mux.HandleFunc("/api/v1/admin/gasless/pools/", s.requireAdmin(s.handleAdminGaslessPoolRoutes))
	mux.HandleFunc("/api/v1/admin/gasless/users/", s.requireAdmin(s.handleAdminGaslessUserRoutes))

	return mux
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"chain":  s.cfg.Chain.Name,
	})
}

func (s *Server) handlePools(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	limit, offset := listParams(r)
	rows, err := s.queries.ListPools(r.Context(), db.ListPoolsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, poolResponse(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handlePoolRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/pools/")
	parts := splitPath(path)
	if len(parts) == 0 {
		writeError(w, http.StatusNotFound, errors.New("pool id required"))
		return
	}

	poolID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	if len(parts) == 1 {
		s.handlePool(w, r, poolID)
		return
	}

	if len(parts) == 3 && parts[1] == "rounds" {
		roundID, parseErr := strconv.ParseUint(parts[2], 10, 64)
		if parseErr != nil {
			writeError(w, http.StatusBadRequest, parseErr)
			return
		}
		s.handleRound(w, r, poolID, roundID)
		return
	}

	writeError(w, http.StatusNotFound, errors.New("route not found"))
}

func (s *Server) handlePool(w http.ResponseWriter, r *http.Request, poolID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	row, err := s.queries.GetPool(r.Context(), db.GetPoolParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, poolResponse(row))
}

func (s *Server) handleRound(w http.ResponseWriter, r *http.Request, poolID uint64, roundID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	row, err := s.queries.GetRound(r.Context(), db.GetRoundParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		RoundID: int64(roundID),
	})
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, roundResponse(row))
}

func (s *Server) handleUserRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	parts := splitPath(path)
	if len(parts) < 2 {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}

	address := parts[0]
	switch parts[1] {
	case "tickets":
		s.handleUserTickets(w, r, address)
	case "wins":
		s.handleUserWins(w, r, address)
	default:
		writeError(w, http.StatusNotFound, errors.New("route not found"))
	}
}

func (s *Server) handleUserTickets(w http.ResponseWriter, r *http.Request, address string) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	limit, offset := listParams(r)
	rows, err := s.queries.ListTicketsByOwner(r.Context(), db.ListTicketsByOwnerParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   strings.ToLower(address),
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, ticketResponse(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleUserWins(w http.ResponseWriter, r *http.Request, address string) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	limit, offset := listParams(r)
	rows, err := s.queries.ListWinsByUser(r.Context(), db.ListWinsByUserParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   strings.ToLower(address),
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, ticketResponse(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleGaslessNonce(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	address := strings.TrimPrefix(r.URL.Path, "/api/v1/gasless/nonce/")
	resp, err := s.gaslessService.Nonce(r.Context(), address)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleGaslessPurchase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req gasless.PurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.gaslessService.SubmitPurchase(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleGaslessPurchaseSelection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req gasless.PurchaseSelectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.gaslessService.SubmitPurchaseSelection(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleGaslessScratch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req gasless.ScratchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.gaslessService.SubmitScratch(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleGaslessBatchScratch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req gasless.BatchScratchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.gaslessService.SubmitBatchScratch(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, resp)
}

func (s *Server) handleGaslessRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	digest := strings.TrimPrefix(r.URL.Path, "/api/v1/gasless/requests/")
	resp, err := s.gaslessService.GetRequest(r.Context(), digest)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleTickets(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/tickets/")
	parts := splitPath(path)
	if len(parts) == 0 {
		writeError(w, http.StatusNotFound, errors.New("ticket id required"))
		return
	}

	ticketID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	if len(parts) == 1 {
		s.handleTicket(w, r, ticketID)
		return
	}

	switch parts[1] {
	case "reveal-auth":
		s.handleRevealAuth(w, r, ticketID)
	case "claim-precheck":
		s.handleClaimPrecheck(w, r, ticketID)
	case "zama":
		s.handleTicketZamaRoutes(w, r, ticketID, parts[2:])
	default:
		writeError(w, http.StatusNotFound, errors.New("route not found"))
	}
}

func (s *Server) handleTicket(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	row, err := s.queries.GetTicket(r.Context(), db.GetTicketParams{
		ChainID:  s.cfg.Chain.ID,
		TicketID: int64(ticketID),
	})
	if err != nil {
		writeLookupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ticketResponse(row))
}

func (s *Server) handleRevealAuth(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req reveal.RevealAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.revealService.BuildRevealAuth(r.Context(), ticketID, req.Address, s.backendBaseURL(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleClaimPrecheck(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.revealService.BuildClaimPrecheck(r.Context(), ticketID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleTicketZamaRoutes(w http.ResponseWriter, r *http.Request, ticketID uint64, parts []string) {
	if len(parts) < 3 || parts[0] != "relayer" || parts[1] != "v2" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}

	switch parts[2] {
	case "keyurl":
		if len(parts) != 3 {
			writeError(w, http.StatusNotFound, errors.New("route not found"))
			return
		}
		s.handleTicketZamaKeyURL(w, r, ticketID)
	case "user-decrypt":
		if len(parts) == 3 {
			s.handleTicketZamaUserDecryptSubmit(w, r, ticketID)
			return
		}
		if len(parts) == 4 {
			s.handleTicketZamaUserDecryptStatus(w, r, ticketID, parts[3])
			return
		}
		writeError(w, http.StatusNotFound, errors.New("route not found"))
	default:
		writeError(w, http.StatusNotFound, errors.New("route not found"))
	}
}

func (s *Server) handleTicketZamaKeyURL(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.revealService.ProxyKeyURL(r.Context(), ticketID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeProxyResponse(w, resp)
}

func (s *Server) handleTicketZamaUserDecryptSubmit(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req zama.UserDecryptPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeProxyResponse(w, zama.NewFailedResponse(http.StatusBadRequest, "malformed_json", "invalid user decrypt payload", nil))
		return
	}

	resp, err := s.revealService.ProxyUserDecryptSubmit(r.Context(), ticketID, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeProxyResponse(w, resp)
}

func (s *Server) handleTicketZamaUserDecryptStatus(w http.ResponseWriter, r *http.Request, ticketID uint64, jobID string) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.revealService.ProxyUserDecryptStatus(r.Context(), ticketID, jobID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeProxyResponse(w, resp)
}

func (s *Server) handleAdminJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.adminService.Jobs(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleAdminJobRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/jobs/")
	parts := splitPath(path)
	if len(parts) != 2 || parts[1] != "retry" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	jobID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.adminService.RetryJob(r.Context(), jobID, s.adminActor(r)); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobId": jobID, "status": "pending"})
}

func (s *Server) handleAdminRelayerHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.adminService.RelayerHealth(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleAdminPoolRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/pools/")
	parts := splitPath(path)
	if len(parts) != 2 || parts[1] != "costs" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	poolID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.adminService.PoolCosts(r.Context(), poolID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleAdminGaslessPoolRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/gasless/pools/")
	parts := splitPath(path)
	if len(parts) != 2 || parts[1] != "pause" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	poolID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := s.adminService.PausePoolGasless(r.Context(), poolID, body.Reason, s.adminActor(r)); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"poolId": poolID, "status": "paused"})
}

func (s *Server) handleAdminGaslessUserRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/gasless/users/")
	parts := splitPath(path)
	if len(parts) != 2 || parts[1] != "block" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := s.adminService.BlockUserGasless(r.Context(), parts[0], body.Reason, s.adminActor(r)); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"address": parts[0], "status": "blocked"})
}

func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.Admin.Token != "" {
			token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			if token != s.cfg.Admin.Token {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
		}
		next(w, r)
	}
}

func (s *Server) adminActor(r *http.Request) string {
	if header := strings.TrimSpace(r.Header.Get("X-Admin-Actor")); header != "" {
		return header
	}
	return "admin"
}

func splitPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func listParams(r *http.Request) (int, int) {
	limit := 20
	offset := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return limit, offset
}

func poolResponse(row db.Pool) map[string]any {
	return map[string]any{
		"poolId":                 row.PoolID,
		"creator":                row.Creator,
		"protocolOwned":          row.ProtocolOwned,
		"mode":                   row.Mode,
		"status":                 row.Status,
		"paused":                 row.Paused,
		"closeRequested":         row.CloseRequested,
		"vrfPending":             row.VrfPending,
		"initialized":            row.Initialized,
		"themeId":                row.ThemeID,
		"ticketPrice":            row.TicketPrice,
		"totalTicketsPerRound":   row.TotalTicketsPerRound,
		"totalPrizeBudget":       row.TotalPrizeBudget,
		"poolInstanceGroupSize":  row.PoolInstanceGroupSize,
		"feeBps":                 row.FeeBps,
		"targetRtpBps":           row.TargetRtpBps,
		"hitRateBps":             row.HitRateBps,
		"maxPrize":               row.MaxPrize,
		"selectable":             row.Selectable,
		"currentRound":           row.CurrentRound,
		"lockedBond":             row.LockedBond,
		"reservedPrizeBudget":    row.ReservedPrizeBudget,
		"lockedNextRoundBudget":  row.LockedNextRoundBudget,
		"realizedRevenue":        row.RealizedRevenue,
		"settledPrizeCost":       row.SettledPrizeCost,
		"settledProtocolCost":    row.SettledProtocolCost,
		"accruedPlatformFee":     row.AccruedPlatformFee,
		"creatorProfitClaimed":   row.CreatorProfitClaimed,
		"claimableCreatorProfit": row.ClaimableCreatorProfit,
		"createdBlock":           row.CreatedBlock,
		"createdTxHash":          row.CreatedTxHash,
		"lastEventBlock":         row.LastEventBlock,
		"lastEventTxHash":        row.LastEventTxHash,
		"lastEventLogIndex":      row.LastEventLogIndex,
		"lastEventBlockHash":     row.LastEventBlockHash,
		"createdAt":              row.CreatedAt.Time,
		"updatedAt":              row.UpdatedAt.Time,
	}
}

func roundResponse(row db.Round) map[string]any {
	return map[string]any{
		"poolId":               row.PoolID,
		"roundId":              row.RoundID,
		"status":               row.Status,
		"soldCount":            row.SoldCount,
		"scratchedCount":       row.ScratchedCount,
		"claimedCount":         row.ClaimedCount,
		"winClaimableCount":    row.WinClaimableCount,
		"totalTickets":         row.TotalTickets,
		"ticketPrice":          row.TicketPrice,
		"roundPrizeBudget":     row.RoundPrizeBudget,
		"vrfRequestRef":        row.VrfRequestRef,
		"shuffleRoot":          row.ShuffleRoot,
		"lastVrfRequestedAt":   row.LastVrfRequestedAt.Time,
		"lastVrfInitializedAt": row.LastVrfInitializedAt.Time,
		"lastEventBlock":       row.LastEventBlock,
		"lastEventTxHash":      row.LastEventTxHash,
		"lastEventLogIndex":    row.LastEventLogIndex,
		"lastEventBlockHash":   row.LastEventBlockHash,
		"createdAt":            row.CreatedAt.Time,
		"updatedAt":            row.UpdatedAt.Time,
	}
}

func ticketResponse(row db.Ticket) map[string]any {
	return map[string]any{
		"ticketId":                 row.TicketID,
		"poolId":                   row.PoolID,
		"roundId":                  row.RoundID,
		"owner":                    row.Owner,
		"ticketIndex":              row.TicketIndex,
		"status":                   row.Status,
		"revealAuthorized":         row.RevealAuthorized,
		"transferredBeforeScratch": row.TransferredBeforeScratch,
		"mintTxHash":               row.MintTxHash,
		"claimedBy":                row.ClaimedBy,
		"claimClearRewardAmount":   row.ClaimClearRewardAmount,
		"lastEventBlock":           row.LastEventBlock,
		"lastEventTxHash":          row.LastEventTxHash,
		"lastEventLogIndex":        row.LastEventLogIndex,
		"lastEventBlockHash":       row.LastEventBlockHash,
		"createdAt":                row.CreatedAt.Time,
		"updatedAt":                row.UpdatedAt.Time,
	}
}

func writeLookupError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeServiceError(w, err)
}

func writeMethodNotAllowed(w http.ResponseWriter) {
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeServiceError(w http.ResponseWriter, err error) {
	if typed, ok := apperrors.As(err); ok {
		writeJSON(w, typed.StatusCode, map[string]string{"error": typed.PublicMessage})
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeProxyResponse(w http.ResponseWriter, resp zama.ProxyResponse) {
	for key, values := range resp.Headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(resp.Body)
}

func (s *Server) backendBaseURL(r *http.Request) string {
	if s.cfg.API.PublicBaseURL != "" {
		return s.cfg.API.PublicBaseURL
	}

	scheme := "http"
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwarded != "" {
		scheme = strings.Split(forwarded, ",")[0]
	} else if r.TLS != nil {
		scheme = "https"
	}

	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = r.Host
	}
	if host == "" {
		return ""
	}
	return scheme + "://" + host
}
