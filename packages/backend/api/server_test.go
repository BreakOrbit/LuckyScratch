package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"lucky-scratch/apperrors"
	"lucky-scratch/config"
	"lucky-scratch/poolmeta"
	"lucky-scratch/readmodel"
	"lucky-scratch/reveal"
	"lucky-scratch/store/db"
	"lucky-scratch/zama"
)

func TestWriteServiceErrorUsesPublicAppErrorShape(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, apperrors.Conflict("pool sponsor budget exceeded", errors.New("pool sponsor budget exceeded")))

	if recorder.Code != 409 {
		t.Fatalf("expected 409, got %d", recorder.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["error"] != "pool sponsor budget exceeded" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestWriteServiceErrorHidesInternalMessages(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, errors.New("dial tcp 10.0.0.1:5432: connect: connection refused"))

	if recorder.Code != 500 {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["error"] != "internal server error" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestWriteServiceErrorMapsNoRowsToNotFound(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, pgx.ErrNoRows)

	if recorder.Code != 404 {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestUserTicketListFilterParsesViewPoolAndPagination(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/0xAbC/tickets?view=to-claim&poolId=12&limit=24&offset=48", nil)
	filter, err := userTicketListFilter(req, "0xAbC")
	if err != nil {
		t.Fatalf("parse filter: %v", err)
	}

	if filter.Owner != "0xabc" {
		t.Fatalf("expected normalized owner, got %q", filter.Owner)
	}
	if filter.View != "to-claim" || filter.PoolID != 12 || filter.Limit != 24 || filter.Offset != 48 {
		t.Fatalf("unexpected filter: %#v", filter)
	}
}

func TestUserTicketListFilterRejectsUnsupportedView(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/0xabc/tickets?view=expired", nil)
	if _, err := userTicketListFilter(req, "0xabc"); err == nil {
		t.Fatalf("expected unsupported view error")
	}
}

type stubReadService struct{}

func (stubReadService) ListPools(context.Context, int, int) ([]db.Pool, error) { return nil, nil }
func (stubReadService) ListPoolsByCreator(context.Context, string, int, int) ([]db.Pool, error) {
	return nil, nil
}
func (stubReadService) ListAllPoolsByCreator(context.Context, string) ([]db.Pool, error) {
	return nil, nil
}
func (stubReadService) GetPool(context.Context, uint64) (db.Pool, error) {
	return db.Pool{}, pgx.ErrNoRows
}
func (stubReadService) GetRound(context.Context, uint64, uint64) (db.Round, error) {
	return db.Round{}, pgx.ErrNoRows
}
func (stubReadService) ListTicketsByOwner(context.Context, string, int, int) ([]db.Ticket, error) {
	return nil, nil
}
func (stubReadService) ListTicketsByOwnerFiltered(context.Context, readmodel.TicketListFilter) (readmodel.TicketListPage, error) {
	return readmodel.TicketListPage{}, nil
}
func (stubReadService) ListTicketsByPool(context.Context, uint64, int, int) ([]db.Ticket, error) {
	return nil, nil
}
func (stubReadService) ListTicketsByPoolAndRound(context.Context, uint64, uint64, int, int) ([]db.Ticket, error) {
	return nil, nil
}
func (stubReadService) ListWinsByUser(context.Context, string, int, int) ([]db.Ticket, error) {
	return nil, nil
}
func (stubReadService) GetTicket(context.Context, uint64) (db.Ticket, error) {
	return db.Ticket{}, pgx.ErrNoRows
}
func (stubReadService) GetPlatformOverview(context.Context) (db.GetPlatformOverviewRow, error) {
	return db.GetPlatformOverviewRow{}, nil
}
func (stubReadService) ListRecentWins(context.Context, int, int) ([]db.Ticket, error) {
	return nil, nil
}
func (stubReadService) ListTopPlayersAllTime(context.Context, int) ([]db.ListTopPlayersAllTimeRow, error) {
	return nil, nil
}
func (stubReadService) ListTopPlayersSince(context.Context, time.Time, int) ([]db.ListTopPlayersSinceRow, error) {
	return nil, nil
}

type stubRevealService struct{}

func (stubRevealService) BuildRevealAuth(context.Context, uint64, string, string) (reveal.RevealAuthResponse, error) {
	return reveal.RevealAuthResponse{}, nil
}
func (stubRevealService) BuildClaimPrecheck(context.Context, uint64) (reveal.ClaimPrecheckResponse, error) {
	return reveal.ClaimPrecheckResponse{}, nil
}
func (stubRevealService) ProxyKeyURL(context.Context, uint64) (zama.ProxyResponse, error) {
	return zama.ProxyResponse{}, nil
}
func (stubRevealService) ProxyUserDecryptSubmit(context.Context, uint64, zama.UserDecryptPayload) (zama.ProxyResponse, error) {
	return zama.ProxyResponse{}, nil
}
func (stubRevealService) ProxyPublicDecrypt(context.Context, uint64, zama.PublicDecryptPayload) (zama.ProxyResponse, error) {
	return zama.ProxyResponse{}, nil
}
func (stubRevealService) ProxyUserDecryptStatus(context.Context, uint64, string) (zama.ProxyResponse, error) {
	return zama.ProxyResponse{}, nil
}

type stubPoolMetaService struct{}

func (stubPoolMetaService) UploadImage(context.Context, poolmeta.UploadImageInput) (poolmeta.UploadedAsset, error) {
	return poolmeta.UploadedAsset{}, nil
}

func (stubPoolMetaService) CreateDraft(context.Context, poolmeta.CreatePoolDraftInput) (poolmeta.PoolDraft, error) {
	return poolmeta.PoolDraft{}, nil
}

func (stubPoolMetaService) FinalizePool(context.Context, uint64, poolmeta.FinalizePoolInput) (poolmeta.PoolMetadata, error) {
	return poolmeta.PoolMetadata{}, nil
}

func (stubPoolMetaService) GetPoolMetadata(context.Context, uint64) (*poolmeta.PoolMetadata, error) {
	return nil, nil
}

type recordingAdminService struct {
	jobsCalls   int
	rebuildPool []struct {
		PoolID uint64
		Actor  string
	}
	rebuildRound []struct {
		PoolID  uint64
		RoundID uint64
		Actor   string
	}
	rebuildTicket []struct {
		TicketID uint64
		Actor    string
	}
}

func (s *recordingAdminService) Jobs(context.Context) (map[string]any, error) {
	s.jobsCalls += 1
	return map[string]any{
		"jobs": []map[string]any{},
		"indexer": map[string]any{
			"head":     "100",
			"safeHead": "88",
		},
	}, nil
}

func (*recordingAdminService) RetryJob(context.Context, int64, string) error { return nil }
func (*recordingAdminService) PoolCosts(context.Context, uint64) (map[string]any, error) {
	return map[string]any{}, nil
}

func (s *recordingAdminService) RebuildPool(_ context.Context, poolID uint64, actor string) error {
	s.rebuildPool = append(s.rebuildPool, struct {
		PoolID uint64
		Actor  string
	}{PoolID: poolID, Actor: actor})
	return nil
}

func (s *recordingAdminService) RebuildRound(_ context.Context, poolID uint64, roundID uint64, actor string) error {
	s.rebuildRound = append(s.rebuildRound, struct {
		PoolID  uint64
		RoundID uint64
		Actor   string
	}{PoolID: poolID, RoundID: roundID, Actor: actor})
	return nil
}

func (s *recordingAdminService) RebuildTicket(_ context.Context, ticketID uint64, actor string) error {
	s.rebuildTicket = append(s.rebuildTicket, struct {
		TicketID uint64
		Actor    string
	}{TicketID: ticketID, Actor: actor})
	return nil
}

func (*recordingAdminService) EncryptRound(context.Context, uint64, string) error { return nil }

func newTestServer(adminSvc AdminService, token string, corsOrigins ...string) *Server {
	cfg := config.Config{}
	cfg.Admin.Token = token
	cfg.API.CORSAllowedOrigins = append([]string(nil), corsOrigins...)
	return NewServer(Dependencies{
		Config:        cfg,
		ReadService:   stubReadService{},
		PoolMeta:      stubPoolMetaService{},
		RevealService: stubRevealService{},
		AdminService:  adminSvc,
	})
}

func TestAdminJobsRouteReturnsIndexerPayload(t *testing.T) {
	t.Parallel()

	adminSvc := &recordingAdminService{}
	server := newTestServer(adminSvc, "secret")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/jobs", nil)
	req.Header.Set("Authorization", "Bearer secret")
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if adminSvc.jobsCalls != 1 {
		t.Fatalf("expected Jobs to be called once, got %d", adminSvc.jobsCalls)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	indexerPayload, ok := payload["indexer"].(map[string]any)
	if !ok {
		t.Fatalf("expected indexer payload, got %#v", payload)
	}
	if indexerPayload["safeHead"] != "88" {
		t.Fatalf("expected safeHead to be present, got %#v", indexerPayload)
	}
}

func TestAdminReindexRoutesDispatchToAdminService(t *testing.T) {
	t.Parallel()

	adminSvc := &recordingAdminService{}
	server := newTestServer(adminSvc, "secret")

	cases := []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/api/v1/admin/pools/12/reindex"},
		{method: http.MethodPost, path: "/api/v1/admin/pools/12/rounds/3/reindex"},
		{method: http.MethodPost, path: "/api/v1/admin/tickets/99/reindex"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(nil))
		req.Header.Set("Authorization", "Bearer secret")
		req.Header.Set("X-Admin-Actor", "ops-bot")
		recorder := httptest.NewRecorder()

		server.Routes().ServeHTTP(recorder, req)

		if recorder.Code != http.StatusOK {
			t.Fatalf("%s %s expected 200, got %d", tc.method, tc.path, recorder.Code)
		}
	}

	if len(adminSvc.rebuildPool) != 1 || adminSvc.rebuildPool[0].PoolID != 12 || adminSvc.rebuildPool[0].Actor != "ops-bot" {
		t.Fatalf("unexpected rebuild pool calls: %#v", adminSvc.rebuildPool)
	}
	if len(adminSvc.rebuildRound) != 1 || adminSvc.rebuildRound[0].PoolID != 12 || adminSvc.rebuildRound[0].RoundID != 3 || adminSvc.rebuildRound[0].Actor != "ops-bot" {
		t.Fatalf("unexpected rebuild round calls: %#v", adminSvc.rebuildRound)
	}
	if len(adminSvc.rebuildTicket) != 1 || adminSvc.rebuildTicket[0].TicketID != 99 || adminSvc.rebuildTicket[0].Actor != "ops-bot" {
		t.Fatalf("unexpected rebuild ticket calls: %#v", adminSvc.rebuildTicket)
	}
}

func TestAdminRoutesRequireBearerTokenWhenConfigured(t *testing.T) {
	t.Parallel()

	adminSvc := &recordingAdminService{}
	server := newTestServer(adminSvc, "secret")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/pools/12/reindex", nil)
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
	if len(adminSvc.rebuildPool) != 0 {
		t.Fatalf("expected rebuild not to be called, got %#v", adminSvc.rebuildPool)
	}
}

func TestCORSPreflightAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	server := newTestServer(&recordingAdminService{}, "", "https://app.example.com")

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/pools", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "Content-Type")
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("expected allow origin header, got %q", got)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Headers"); got != "Content-Type" {
		t.Fatalf("expected reflected allow headers, got %q", got)
	}
}

func TestCORSPreflightRejectsDisallowedOrigin(t *testing.T) {
	t.Parallel()

	server := newTestServer(&recordingAdminService{}, "", "https://app.example.com")

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/pools", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no allow origin header, got %q", got)
	}
}

func TestCORSAddsHeadersToSimpleRequests(t *testing.T) {
	t.Parallel()

	server := newTestServer(&recordingAdminService{}, "", "https://app.example.com")

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://app.example.com")
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("expected allow origin header, got %q", got)
	}
}

func TestCORSAllowAllOriginsHandlesArbitraryOrigin(t *testing.T) {
	t.Parallel()

	server := newTestServer(&recordingAdminService{}, "")
	server.cfg.API.CORSAllowAllOrigins = true

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/pools", nil)
	req.Header.Set("Origin", "https://any-frontend.example.com")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	recorder := httptest.NewRecorder()

	server.Routes().ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("expected wildcard allow origin header, got %q", got)
	}
}
