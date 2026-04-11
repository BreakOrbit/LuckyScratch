package app

import (
	"context"
	"net/http"
	"os/signal"
	"syscall"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/api"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
)

func RunAPI() error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	runtime, err := BuildRuntime(ctx, cfg)
	if err != nil {
		return err
	}
	defer runtime.Close()

	handler := api.NewServer(cfg, runtime.Store.Queries(), runtime.GaslessService, runtime.RevealService, runtime.AdminService).Routes()

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
		return ShutdownHTTPServer(shutdownCtx, srv)
	}
}

func ShutdownHTTPServer(ctx context.Context, srv *http.Server) error {
	return srv.Shutdown(ctx)
}
