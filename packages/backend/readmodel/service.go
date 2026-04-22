package readmodel

import (
	"context"

	"lucky-scratch/config"
	"lucky-scratch/store/db"
)

type Service struct {
	cfg     config.Config
	queries db.Querier
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
