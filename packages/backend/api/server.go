package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"lucky-scratch/apperrors"
	"lucky-scratch/config"
	"lucky-scratch/readmodel"
	"lucky-scratch/reveal"
	"lucky-scratch/store/db"
	"lucky-scratch/zama"
)

var corsAllowedMethods = []string{http.MethodGet, http.MethodPost, http.MethodOptions}

type ReadService interface {
	ListPools(ctx context.Context, limit int, offset int) ([]db.Pool, error)
	ListPoolsByCreator(ctx context.Context, creator string, limit int, offset int) ([]db.Pool, error)
	ListAllPoolsByCreator(ctx context.Context, creator string) ([]db.Pool, error)
	GetPool(ctx context.Context, poolID uint64) (db.Pool, error)
	GetRound(ctx context.Context, poolID uint64, roundID uint64) (db.Round, error)
	ListTicketsByOwner(ctx context.Context, owner string, limit int, offset int) ([]db.Ticket, error)
	ListTicketsByPool(ctx context.Context, poolID uint64, limit int, offset int) ([]db.Ticket, error)
	ListTicketsByPoolAndRound(ctx context.Context, poolID uint64, roundID uint64, limit int, offset int) ([]db.Ticket, error)
	ListWinsByUser(ctx context.Context, owner string, limit int, offset int) ([]db.Ticket, error)
	GetTicket(ctx context.Context, ticketID uint64) (db.Ticket, error)
	GetPlatformOverview(ctx context.Context) (db.GetPlatformOverviewRow, error)
	ListRecentWins(ctx context.Context, limit int, offset int) ([]db.Ticket, error)
	ListTopPlayersAllTime(ctx context.Context, limit int) ([]db.ListTopPlayersAllTimeRow, error)
	ListTopPlayersSince(ctx context.Context, since time.Time, limit int) ([]db.ListTopPlayersSinceRow, error)
}

type RevealService interface {
	BuildRevealAuth(ctx context.Context, ticketID uint64, userAddress string, backendBaseURL string) (reveal.RevealAuthResponse, error)
	BuildClaimPrecheck(ctx context.Context, ticketID uint64) (reveal.ClaimPrecheckResponse, error)
	ProxyKeyURL(ctx context.Context, ticketID uint64) (zama.ProxyResponse, error)
	ProxyUserDecryptSubmit(ctx context.Context, ticketID uint64, payload zama.UserDecryptPayload) (zama.ProxyResponse, error)
	ProxyPublicDecrypt(ctx context.Context, ticketID uint64, payload zama.PublicDecryptPayload) (zama.ProxyResponse, error)
	ProxyUserDecryptStatus(ctx context.Context, ticketID uint64, jobID string) (zama.ProxyResponse, error)
}

type AdminService interface {
	Jobs(ctx context.Context) (map[string]any, error)
	RetryJob(ctx context.Context, jobID int64, actor string) error
	PoolCosts(ctx context.Context, poolID uint64) (map[string]any, error)
	RebuildPool(ctx context.Context, poolID uint64, actor string) error
	RebuildRound(ctx context.Context, poolID uint64, roundID uint64, actor string) error
	RebuildTicket(ctx context.Context, ticketID uint64, actor string) error
}

type Dependencies struct {
	Config        config.Config
	ReadService   ReadService
	PoolMeta      PoolMetaService
	RevealService RevealService
	AdminService  AdminService
}

type Server struct {
	cfg           config.Config
	readService   ReadService
	poolMeta      PoolMetaService
	revealService RevealService
	adminService  AdminService
}

func NewServer(deps Dependencies) *Server {
	return &Server{
		cfg:           deps.Config,
		readService:   deps.ReadService,
		poolMeta:      deps.PoolMeta,
		revealService: deps.RevealService,
		adminService:  deps.AdminService,
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/api/v1/pools", s.handlePools)
	mux.HandleFunc("/api/v1/pools/", s.handlePoolRoutes)
	mux.HandleFunc("/api/v1/uploads/images", s.handleUploadImages)
	mux.HandleFunc("/api/v1/pool-drafts", s.handlePoolDrafts)
	mux.HandleFunc("/api/v1/stats/overview", s.handlePlatformOverview)
	mux.HandleFunc("/api/v1/wins/recent", s.handleRecentWins)
	mux.HandleFunc("/api/v1/leaderboards/players", s.handlePlayerLeaderboard)
	mux.HandleFunc("/api/v1/users/", s.handleUserRoutes)
	mux.HandleFunc("/api/v1/tickets/", s.handleTickets)
	mux.HandleFunc("/api/v1/admin/jobs", s.requireAdmin(s.handleAdminJobs))
	mux.HandleFunc("/api/v1/admin/jobs/", s.requireAdmin(s.handleAdminJobRoutes))
	mux.HandleFunc("/api/v1/admin/pools/", s.requireAdmin(s.handleAdminPoolRoutes))
	mux.HandleFunc("/api/v1/admin/tickets/", s.requireAdmin(s.handleAdminTicketRoutes))

	return s.withCORS(mux)
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	if !s.cfg.API.CORSAllowAllOrigins && len(s.cfg.API.CORSAllowedOrigins) == 0 {
		return next
	}

	allowedMethods := strings.Join(corsAllowedMethods, ", ")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		allowAllOrigins := s.cfg.API.CORSAllowAllOrigins
		allowedOrigin, ok := matchCORSOrigin(origin, s.cfg.API.CORSAllowedOrigins)
		if !allowAllOrigins && !ok {
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		headers := w.Header()
		if allowAllOrigins || allowedOrigin == "*" {
			headers.Set("Access-Control-Allow-Origin", "*")
		} else {
			headers.Set("Access-Control-Allow-Origin", origin)
			headers.Add("Vary", "Origin")
		}
		headers.Add("Vary", "Access-Control-Request-Method")
		headers.Add("Vary", "Access-Control-Request-Headers")
		headers.Set("Access-Control-Allow-Methods", allowedMethods)
		headers.Set("Access-Control-Max-Age", "600")

		requestHeaders := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers"))
		if requestHeaders == "" {
			requestHeaders = "Authorization, Content-Type, X-Admin-Actor"
		}
		headers.Set("Access-Control-Allow-Headers", requestHeaders)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func matchCORSOrigin(origin string, allowedOrigins []string) (string, bool) {
	for _, allowedOrigin := range allowedOrigins {
		switch strings.TrimSpace(allowedOrigin) {
		case "":
			continue
		case "*":
			return "*", true
		default:
			if strings.EqualFold(strings.TrimSpace(allowedOrigin), origin) {
				return origin, true
			}
		}
	}
	return "", false
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
	creator := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("creator")))
	var (
		rows []db.Pool
		err  error
	)
	if creator != "" {
		rows, err = s.readService.ListPoolsByCreator(r.Context(), creator, limit, offset)
	} else {
		rows, err = s.readService.ListPools(r.Context(), limit, offset)
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		payload, buildErr := s.buildPoolPayload(r.Context(), row)
		if buildErr != nil {
			writeServiceError(w, buildErr)
			return
		}
		items = append(items, payload)
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

	if len(parts) == 2 && parts[1] == "finalize" {
		s.handleFinalizePool(w, r, poolID)
		return
	}

	if len(parts) == 3 && parts[1] == "rounds" && parts[2] == "current" {
		s.handleCurrentRound(w, r, poolID)
		return
	}

	if len(parts) == 2 && parts[1] == "purchase-context" {
		s.handlePurchaseContext(w, r, poolID)
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

	row, err := s.readService.GetPool(r.Context(), poolID)
	if err != nil {
		writeLookupError(w, err)
		return
	}
	payload, err := s.buildPoolPayload(r.Context(), row)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (s *Server) handleRound(w http.ResponseWriter, r *http.Request, poolID uint64, roundID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	row, err := s.readService.GetRound(r.Context(), poolID, roundID)
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
	case "created-pools":
		if len(parts) == 3 && parts[2] == "summary" {
			s.handleUserCreatedPoolsSummary(w, r, address)
			return
		}
		writeError(w, http.StatusNotFound, errors.New("route not found"))
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
	rows, err := s.readService.ListTicketsByOwner(r.Context(), strings.ToLower(address), limit, offset)
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
	rows, err := s.readService.ListWinsByUser(r.Context(), strings.ToLower(address), limit, offset)
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

func (s *Server) handlePlatformOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	row, err := s.readService.GetPlatformOverview(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"totalPools":           int64FromAny(row.TotalPools),
		"activePools":          int64FromAny(row.ActivePools),
		"totalRealizedRevenue": int64FromAny(row.TotalRealizedRevenue),
		"totalRevealedTickets": int64FromAny(row.TotalRevealedTickets),
		"totalWinningClaims":   int64FromAny(row.TotalWinningClaims),
		"totalClaimedRewards":  int64FromAny(row.TotalClaimedRewards),
	})
}

func (s *Server) handleRecentWins(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	limit, offset := listParams(r)
	rows, err := s.readService.ListRecentWins(r.Context(), limit, offset)
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

func (s *Server) handlePlayerLeaderboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	timeframe := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("timeframe")))
	if timeframe == "" {
		timeframe = "all-time"
	}

	var (
		items []map[string]any
		err   error
	)
	switch timeframe {
	case "weekly":
		var rows []db.ListTopPlayersSinceRow
		rows, err = s.readService.ListTopPlayersSince(r.Context(), time.Now().UTC().Add(-7*24*time.Hour), limit)
		if err == nil {
			items = playerLeaderboardSinceResponse(rows)
		}
	case "all-time":
		var rows []db.ListTopPlayersAllTimeRow
		rows, err = s.readService.ListTopPlayersAllTime(r.Context(), limit)
		if err == nil {
			items = playerLeaderboardAllTimeResponse(rows)
		}
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported timeframe"})
		return
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"timeframe": timeframe,
		"items":     items,
	})
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

	row, err := s.readService.GetTicket(r.Context(), ticketID)
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
	case "public-decrypt":
		if len(parts) != 3 {
			writeError(w, http.StatusNotFound, errors.New("route not found"))
			return
		}
		s.handleTicketZamaPublicDecrypt(w, r, ticketID)
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

func (s *Server) handleTicketZamaPublicDecrypt(w http.ResponseWriter, r *http.Request, ticketID uint64) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	var req zama.PublicDecryptPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeProxyResponse(w, zama.NewFailedResponse(http.StatusBadRequest, "malformed_json", "invalid public decrypt payload", nil))
		return
	}

	resp, err := s.revealService.ProxyPublicDecrypt(r.Context(), ticketID, req)
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

func (s *Server) handleAdminPoolRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/pools/")
	parts := splitPath(path)
	if len(parts) < 2 {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}

	poolID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	switch {
	case len(parts) == 2 && parts[1] == "costs":
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}
		resp, err := s.adminService.PoolCosts(r.Context(), poolID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	case len(parts) == 2 && parts[1] == "reindex":
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w)
			return
		}
		if err := s.adminService.RebuildPool(r.Context(), poolID, s.adminActor(r)); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"poolId": poolID, "status": "reindexed"})
	case len(parts) == 4 && parts[1] == "rounds" && parts[3] == "reindex":
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w)
			return
		}
		roundID, parseErr := strconv.ParseUint(parts[2], 10, 64)
		if parseErr != nil {
			writeError(w, http.StatusBadRequest, parseErr)
			return
		}
		if err := s.adminService.RebuildRound(r.Context(), poolID, roundID, s.adminActor(r)); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"poolId": poolID, "roundId": roundID, "status": "reindexed"})
	default:
		writeError(w, http.StatusNotFound, errors.New("route not found"))
	}
}

func (s *Server) handleAdminTicketRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/tickets/")
	parts := splitPath(path)
	if len(parts) != 2 || parts[1] != "reindex" {
		writeError(w, http.StatusNotFound, errors.New("route not found"))
		return
	}
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}

	ticketID, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.adminService.RebuildTicket(r.Context(), ticketID, s.adminActor(r)); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ticketId": ticketID, "status": "reindexed"})
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

func playerLeaderboardAllTimeResponse(rows []db.ListTopPlayersAllTimeRow) []map[string]any {
	items := make([]map[string]any, 0, len(rows))
	for idx, row := range rows {
		items = append(items, map[string]any{
			"rank":              idx + 1,
			"playerAddress":     row.PlayerAddress,
			"displayAddress":    row.DisplayAddress,
			"winCount":          row.WinCount,
			"totalRewardAmount": row.TotalRewardAmount,
			"lastWinAt":         row.LastWinAt.Time,
		})
	}
	return items
}

func playerLeaderboardSinceResponse(rows []db.ListTopPlayersSinceRow) []map[string]any {
	items := make([]map[string]any, 0, len(rows))
	for idx, row := range rows {
		items = append(items, map[string]any{
			"rank":              idx + 1,
			"playerAddress":     row.PlayerAddress,
			"displayAddress":    row.DisplayAddress,
			"winCount":          row.WinCount,
			"totalRewardAmount": row.TotalRewardAmount,
			"lastWinAt":         row.LastWinAt.Time,
		})
	}
	return items
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

func int64FromAny(value any) int64 {
	switch typed := value.(type) {
	case nil:
		return 0
	case int64:
		return typed
	case int32:
		return int64(typed)
	case int:
		return int64(typed)
	case uint64:
		return int64(typed)
	case uint32:
		return int64(typed)
	case float64:
		return int64(typed)
	case []byte:
		parsed, err := strconv.ParseInt(string(typed), 10, 64)
		if err == nil {
			return parsed
		}
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return parsed
		}
	}
	return 0
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

var _ ReadService = readmodel.Service{}

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
