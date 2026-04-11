package app

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/indexer"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/jobs"
)

func RunWorker() error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	runtime, err := BuildRuntime(ctx, cfg)
	if err != nil {
		return err
	}
	defer runtime.Close()

	indexerService := indexer.NewService(cfg, runtime.Store.Queries(), runtime.Chain)
	worker := jobs.NewWorker(cfg, runtime.Store.Queries(), indexerService, runtime.GaslessService, runtime.RevealService)
	return worker.Run(ctx)
}
