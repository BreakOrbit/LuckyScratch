package app

import (
	"context"

	"lucky-scratch/admin"
	"lucky-scratch/chain"
	"lucky-scratch/config"
	"lucky-scratch/gasless"
	"lucky-scratch/readmodel"
	"lucky-scratch/reveal"
	"lucky-scratch/risk"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
	"lucky-scratch/zama"
)

type Runtime struct {
	Config         config.Config
	Store          *store.Store
	Queries        db.Querier
	Chain          *chain.Client
	ReadModel      readmodel.Service
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
	readModelService := readmodel.NewService(cfg, dbStore.Queries())
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
		Queries:        dbStore.Queries(),
		Chain:          chainClient,
		ReadModel:      readModelService,
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
