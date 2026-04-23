package app

import (
	"context"

	"lucky-scratch/admin"
	"lucky-scratch/chain"
	"lucky-scratch/config"
	"lucky-scratch/indexer"
	"lucky-scratch/ipfs"
	"lucky-scratch/poolmeta"
	"lucky-scratch/readmodel"
	"lucky-scratch/reveal"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
	"lucky-scratch/zama"
)

type Runtime struct {
	Config        config.Config
	Store         *store.Store
	Queries       db.Querier
	Chain         *chain.Client
	ReadModel     readmodel.Service
	Indexer       indexer.Service
	PoolMeta      poolmeta.Service
	RevealService reveal.Service
	AdminService  admin.Service
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

	readModelService := readmodel.NewService(cfg, dbStore.Queries())
	indexerService := indexer.NewService(cfg, dbStore.Queries(), chainClient)
	ipfsClient, err := ipfs.NewClient(cfg.Storage)
	if err != nil {
		chainClient.Close()
		dbStore.Close()
		return nil, err
	}
	poolMetaService := poolmeta.NewService(cfg, dbStore.Queries(), chainClient, ipfsClient)
	zamaClient, err := zama.NewClient(cfg.Zama)
	if err != nil {
		chainClient.Close()
		dbStore.Close()
		return nil, err
	}
	revealService := reveal.NewService(cfg, dbStore.Queries(), chainClient, zamaClient)
	adminService := admin.NewService(cfg, dbStore.Queries(), chainClient, indexerService)

	return &Runtime{
		Config:        cfg,
		Store:         dbStore,
		Queries:       dbStore.Queries(),
		Chain:         chainClient,
		ReadModel:     readModelService,
		Indexer:       indexerService,
		PoolMeta:      poolMetaService,
		RevealService: revealService,
		AdminService:  adminService,
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
