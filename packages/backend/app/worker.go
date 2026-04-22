package app

import (
	"context"
	"errors"

	"lucky-scratch/config"
	"lucky-scratch/indexer"
	"lucky-scratch/jobs"
)

func RunWorker(ctx context.Context, cfg config.Config, runtime *Runtime) error {
	indexerService := indexer.NewService(cfg, runtime.Queries, runtime.Chain)
	worker := jobs.NewWorker(jobs.Dependencies{
		Config:         cfg,
		Queries:        runtime.Queries,
		IndexerService: indexerService,
		RevealService:  runtime.RevealService,
	})
	err := worker.Run(ctx)
	if errors.Is(err, context.Canceled) {
		return nil
	}
	return err
}
