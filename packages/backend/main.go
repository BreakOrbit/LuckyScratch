package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"lucky-scratch/app"
	"lucky-scratch/config"
)

const (
	modeAll    = "all"
	modeAPI    = "api"
	modeWorker = "worker"
)

func main() {
	mode, err := parseMode(os.Args[1:])
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		log.Fatal(err)
	}

	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	runtime, err := app.BuildRuntime(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer runtime.Close()

	switch mode {
	case modeAPI:
		err = app.RunAPI(ctx, cfg, runtime)
	case modeWorker:
		err = app.RunWorker(ctx, cfg, runtime)
	case modeAll:
		err = runAll(ctx, cfg, runtime)
	default:
		err = fmt.Errorf("unsupported mode %q", mode)
	}

	if err != nil {
		log.Fatal(err)
	}
}

func parseMode(args []string) (string, error) {
	fs := flag.NewFlagSet("backend", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	modeFlag := fs.String("mode", modeAll, "run mode: all, api, worker")
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Usage: %s [all|api|worker] [-mode=all|api|worker]\n", os.Args[0])
		fs.PrintDefaults()
	}

	if err := fs.Parse(args); err != nil {
		return "", err
	}

	mode := strings.TrimSpace(*modeFlag)
	if positional := fs.Args(); len(positional) > 0 {
		mode = strings.TrimSpace(positional[0])
	}

	switch mode {
	case modeAll, modeAPI, modeWorker:
		return mode, nil
	default:
		return "", fmt.Errorf("unsupported mode %q (expected all, api, or worker)", mode)
	}
}

func runAll(ctx context.Context, cfg config.Config, runtime *app.Runtime) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 2)

	go func() {
		errCh <- wrapModeErr(modeAPI, app.RunAPI(runCtx, cfg, runtime))
	}()
	go func() {
		errCh <- wrapModeErr(modeWorker, app.RunWorker(runCtx, cfg, runtime))
	}()

	var firstErr error
	for i := 0; i < 2; i++ {
		if err := <-errCh; err != nil && firstErr == nil {
			firstErr = err
			cancel()
		}
	}

	return firstErr
}

func wrapModeErr(mode string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", mode, err)
}
