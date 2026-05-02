package readmodel

import (
	"context"
	"time"

	"lucky-scratch/config"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
)

type Service struct {
	cfg     config.Config
	queries db.Querier
}

type TicketListFilter struct {
	Owner  string
	View   string
	PoolID uint64
	Limit  int
	Offset int
}

type TicketListPage struct {
	Items      []db.Ticket
	TotalCount int64
	Limit      int
	Offset     int
}

func NewService(cfg config.Config, queries db.Querier) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
	}
}

func (s Service) ListPools(ctx context.Context, limit int, offset int) ([]db.Pool, error) {
	return s.queries.ListPools(ctx, db.ListPoolsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListPoolsByCreator(ctx context.Context, creator string, limit int, offset int) ([]db.Pool, error) {
	return s.queries.ListPoolsByCreator(ctx, db.ListPoolsByCreatorParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   creator,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListAllPoolsByCreator(ctx context.Context, creator string) ([]db.Pool, error) {
	return s.queries.ListAllPoolsByCreator(ctx, db.ListAllPoolsByCreatorParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   creator,
	})
}

func (s Service) GetPool(ctx context.Context, poolID uint64) (db.Pool, error) {
	return s.queries.GetPool(ctx, db.GetPoolParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
}

func (s Service) GetRound(ctx context.Context, poolID uint64, roundID uint64) (db.Round, error) {
	return s.queries.GetRound(ctx, db.GetRoundParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		RoundID: int64(roundID),
	})
}

func (s Service) ListTicketsByOwner(ctx context.Context, owner string, limit int, offset int) ([]db.Ticket, error) {
	return s.queries.ListTicketsByOwner(ctx, db.ListTicketsByOwnerParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   owner,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListTicketsByOwnerFiltered(ctx context.Context, filter TicketListFilter) (TicketListPage, error) {
	params := db.ListTicketsByOwnerFilteredParams{
		ChainID:     s.cfg.Chain.ID,
		Owner:       filter.Owner,
		PoolID:      int64(filter.PoolID),
		ViewFilter:  filter.View,
		LimitCount:  int32(filter.Limit),
		OffsetCount: int32(filter.Offset),
	}
	rows, err := s.queries.ListTicketsByOwnerFiltered(ctx, params)
	if err != nil {
		return TicketListPage{}, err
	}
	totalCount, err := s.queries.CountTicketsByOwnerFiltered(ctx, db.CountTicketsByOwnerFilteredParams{
		ChainID:    s.cfg.Chain.ID,
		Owner:      filter.Owner,
		PoolID:     int64(filter.PoolID),
		ViewFilter: filter.View,
	})
	if err != nil {
		return TicketListPage{}, err
	}
	return TicketListPage{
		Items:      rows,
		TotalCount: totalCount,
		Limit:      filter.Limit,
		Offset:     filter.Offset,
	}, nil
}

func (s Service) ListTicketsByPool(ctx context.Context, poolID uint64, limit int, offset int) ([]db.Ticket, error) {
	return s.queries.ListTicketsByPool(ctx, db.ListTicketsByPoolParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListTicketsByPoolAndRound(ctx context.Context, poolID uint64, roundID uint64, limit int, offset int) ([]db.Ticket, error) {
	return s.queries.ListTicketsByPoolAndRound(ctx, db.ListTicketsByPoolAndRoundParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		RoundID: int64(roundID),
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListWinsByUser(ctx context.Context, owner string, limit int, offset int) ([]db.Ticket, error) {
	return s.queries.ListWinsByUser(ctx, db.ListWinsByUserParams{
		ChainID: s.cfg.Chain.ID,
		Lower:   owner,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) GetTicket(ctx context.Context, ticketID uint64) (db.Ticket, error) {
	return s.queries.GetTicket(ctx, db.GetTicketParams{
		ChainID:  s.cfg.Chain.ID,
		TicketID: int64(ticketID),
	})
}

func (s Service) GetPlatformOverview(ctx context.Context) (db.GetPlatformOverviewRow, error) {
	return s.queries.GetPlatformOverview(ctx, s.cfg.Chain.ID)
}

func (s Service) ListRecentWins(ctx context.Context, limit int, offset int) ([]db.Ticket, error) {
	return s.queries.ListRecentWins(ctx, db.ListRecentWinsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
}

func (s Service) ListTopPlayersAllTime(ctx context.Context, limit int) ([]db.ListTopPlayersAllTimeRow, error) {
	return s.queries.ListTopPlayersAllTime(ctx, db.ListTopPlayersAllTimeParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   int32(limit),
	})
}

func (s Service) ListTopPlayersSince(ctx context.Context, since time.Time, limit int) ([]db.ListTopPlayersSinceRow, error) {
	return s.queries.ListTopPlayersSince(ctx, db.ListTopPlayersSinceParams{
		ChainID:   s.cfg.Chain.ID,
		UpdatedAt: store.Timestamptz(since.UTC()),
		Limit:     int32(limit),
	})
}

func (s Service) GetUserSettings(ctx context.Context, walletAddress string) (db.UserSetting, error) {
	return s.queries.GetUserSettings(ctx, walletAddress)
}

func (s Service) UpsertUserSettings(ctx context.Context, arg db.UpsertUserSettingsParams) (db.UserSetting, error) {
	return s.queries.UpsertUserSettings(ctx, arg)
}
