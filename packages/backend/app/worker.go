package app

import (
	"context"
	"errors"

	"lucky-scratch/config"
	"lucky-scratch/jobs"
)

func RunWorker(ctx context.Context, cfg config.Config, runtime *Runtime) error {
	worker := jobs.NewWorker(jobs.Dependencies{
		Config:         cfg,
		Queries:        runtime.Queries,
		IndexerService: runtime.Indexer,
		RevealService:  runtime.RevealService,
	})
	err := worker.Run(ctx)
	if errors.Is(err, context.Canceled) {
		return nil
	}
	return err
}
