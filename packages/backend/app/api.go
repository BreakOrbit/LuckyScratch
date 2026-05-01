package app

import (
	"context"
	"errors"
	"net/http"

	"lucky-scratch/api"
	"lucky-scratch/config"
)

func RunAPI(ctx context.Context, cfg config.Config, runtime *Runtime) error {
	handler := api.NewServer(api.Dependencies{
		Config:        cfg,
		ReadService:   runtime.ReadModel,
		PoolMeta:      runtime.PoolMeta,
		RevealService: runtime.RevealService,
		AdminService:  runtime.AdminService,
		ChainSyncer:   runtime.Indexer,
	}).Routes()

	srv := &http.Server{
		Addr:              cfg.APIAddr(),
		Handler:           handler,
		ReadHeaderTimeout: cfg.API.ReadHeaderTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.API.ShutdownTimeout)
		defer cancel()
		err := ShutdownHTTPServer(shutdownCtx, srv)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

func ShutdownHTTPServer(ctx context.Context, srv *http.Server) error {
	return srv.Shutdown(ctx)
}
