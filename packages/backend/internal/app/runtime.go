package app

import (
	"context"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/admin"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/chain"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/gasless"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/reveal"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/risk"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/zama"
)

type Runtime struct {
	Config         config.Config
	Store          *store.Store
	Chain          *chain.Client
	RiskService    risk.Service
	GaslessService gasless.Service
	RevealService  reveal.Service
	AdminService   admin.Service
}

func BuildRuntime(ctx context.Context, cfg config.Config) (*Runtime, error) {
	dbStore, err := store.Open(ctx, cfg)
	if err != nil {
		return nil, err
	}

	chainClient, err := chain.NewClient(ctx, cfg, dbStore.Queries())
	if err != nil {
		dbStore.Close()
		return nil, err
	}

	riskService := risk.NewService(cfg, dbStore.Queries())
	gaslessService := gasless.NewService(cfg, dbStore.Queries(), chainClient, riskService)
	zamaClient, err := zama.NewClient(cfg.Zama)
	if err != nil {
		chainClient.Close()
		dbStore.Close()
		return nil, err
	}
	revealService := reveal.NewService(cfg, dbStore.Queries(), chainClient, zamaClient)
	adminService := admin.NewService(cfg, dbStore.Queries(), chainClient, riskService)

	return &Runtime{
		Config:         cfg,
		Store:          dbStore,
		Chain:          chainClient,
		RiskService:    riskService,
		GaslessService: gaslessService,
		RevealService:  revealService,
		AdminService:   adminService,
	}, nil
}

func (r *Runtime) Close() {
	if r.Chain != nil {
		r.Chain.Close()
	}
	if r.Store != nil {
		r.Store.Close()
	}
}
