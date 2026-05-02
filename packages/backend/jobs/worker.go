package jobs

import (
	"context"
	"fmt"
	"log"
	"math/rand/v2"
	"time"

	"lucky-scratch/config"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
)

const (
	JobIndexerCatchUp      = "indexer.catch_up"
	JobPendingVRFChecker   = "indexer.pending_vrf_checker"
	JobStateReconciliation = "indexer.state_reconciliation"
	JobRevealProxySync     = "reveal.proxy_sync"
)

type Worker struct {
	cfg            config.Config
	queries        JobStore
	indexerService IndexerService
	revealService  RevealService
}

type JobStore interface {
	UpsertJob(ctx context.Context, arg db.UpsertJobParams) (db.Job, error)
	ReleaseStaleRunningJobs(ctx context.Context, timeoutSeconds int64) ([]db.Job, error)
	ClaimDueJobs(ctx context.Context, arg db.ClaimDueJobsParams) ([]db.Job, error)
	MarkJobFailed(ctx context.Context, arg db.MarkJobFailedParams) (db.Job, error)
	MarkJobCompleted(ctx context.Context, arg db.MarkJobCompletedParams) (db.Job, error)
}

type IndexerService interface {
	Sync(ctx context.Context) error
	CheckPendingVRF(ctx context.Context) error
	CheckPendingEncryption(ctx context.Context) error
	Reconcile(ctx context.Context) error
}

type RevealService interface {
	ReconcileProxyJobs(ctx context.Context) error
}

type Dependencies struct {
	Config         config.Config
	Queries        JobStore
	IndexerService IndexerService
	RevealService  RevealService
}

func NewWorker(deps Dependencies) Worker {
	return Worker{
		cfg:            deps.Config,
		queries:        deps.Queries,
		indexerService: deps.IndexerService,
		revealService:  deps.RevealService,
	}
}

func (w Worker) Run(ctx context.Context) error {
	if err := w.ensureJobs(ctx); err != nil {
		return err
	}

	encryptDone := make(chan error, 1)
	go w.runEncryptLoop(ctx, encryptDone)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		if err := w.runDueJobs(ctx); err != nil {
			return err
		}

		select {
		case err := <-encryptDone:
			if err != nil && ctx.Err() == nil {
				log.Printf("encrypt goroutine exited with error: %v", err)
			}
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (w Worker) runEncryptLoop(ctx context.Context, done chan<- error) {
	interval := w.cfg.Jobs.EncryptInterval
	if interval <= 0 {
		interval = 10 * time.Second
	}

	baseInterval := interval
	currentInterval := interval
	maxInterval := 2 * time.Minute
	consecutiveErrors := 0

	ticker := time.NewTicker(currentInterval)
	defer ticker.Stop()

	for {
		if err := w.indexerService.CheckPendingEncryption(ctx); err != nil {
			consecutiveErrors++
			backoff := baseInterval * time.Duration(1<<min(consecutiveErrors, 4))
			if backoff > maxInterval {
				backoff = maxInterval
			}
			jitter := time.Duration(rand.Int64N(int64(backoff) / 4))
			currentInterval = backoff + jitter
			log.Printf("encrypt loop error (backoff %s): %v", currentInterval, err)
			ticker.Reset(currentInterval)
		} else {
			if consecutiveErrors > 0 {
				log.Printf("encrypt loop recovered after %d errors", consecutiveErrors)
			}
			consecutiveErrors = 0
			if currentInterval != baseInterval {
				currentInterval = baseInterval
				ticker.Reset(currentInterval)
			}
		}

		select {
		case <-ctx.Done():
			done <- ctx.Err()
			return
		case <-ticker.C:
		}
	}
}

func (w Worker) ensureJobs(ctx context.Context) error {
	jobs := []struct {
		key      string
		interval time.Duration
	}{
		{key: JobIndexerCatchUp, interval: w.cfg.Jobs.IndexerInterval},
		{key: JobPendingVRFChecker, interval: w.cfg.Jobs.VRFCheckInterval},
		{key: JobStateReconciliation, interval: w.cfg.Jobs.ReconcileInterval},
		{key: JobRevealProxySync, interval: w.cfg.Jobs.ReconcileInterval},
	}

	for _, job := range jobs {
		_, err := w.queries.UpsertJob(ctx, db.UpsertJobParams{
			JobKey:                  job.key,
			JobType:                 job.key,
			Payload:                 []byte(`{}`),
			Status:                  "pending",
			ScheduleIntervalSeconds: int32(job.interval.Seconds()),
			RunAfter:                store.Timestamptz(time.Now().UTC()),
			MaxAttempts:             100,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (w Worker) runDueJobs(ctx context.Context) error {
	if w.cfg.Jobs.LockTimeout > 0 {
		if _, err := w.queries.ReleaseStaleRunningJobs(ctx, int64(w.cfg.Jobs.LockTimeout.Seconds())); err != nil {
			return err
		}
	}

	jobs, err := w.queries.ClaimDueJobs(ctx, db.ClaimDueJobsParams{
		Limit:    int32(w.cfg.Jobs.ClaimBatchSize),
		LockedBy: w.cfg.Jobs.WorkerID,
	})
	if err != nil {
		return err
	}

	for _, job := range jobs {
		runAfter := time.Now().UTC().Add(time.Duration(job.ScheduleIntervalSeconds) * time.Second)
		err := w.executeJob(ctx, job.JobType)
		if err != nil {
			_, markErr := w.queries.MarkJobFailed(ctx, db.MarkJobFailedParams{
				ID:        job.ID,
				RunAfter:  store.Timestamptz(runAfter),
				LastError: err.Error(),
			})
			if markErr != nil {
				return fmt.Errorf("job %s failed: %w (mark error: %v)", job.JobKey, err, markErr)
			}
			continue
		}

		if _, err := w.queries.MarkJobCompleted(ctx, db.MarkJobCompletedParams{
			ID:       job.ID,
			RunAfter: store.Timestamptz(runAfter),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (w Worker) executeJob(ctx context.Context, jobType string) error {
	switch jobType {
	case JobIndexerCatchUp:
		return w.indexerService.Sync(ctx)
	case JobPendingVRFChecker:
		return w.indexerService.CheckPendingVRF(ctx)
	case JobStateReconciliation:
		return w.indexerService.Reconcile(ctx)
	case JobRevealProxySync:
		return w.revealService.ReconcileProxyJobs(ctx)
	default:
		return fmt.Errorf("unsupported job type: %s", jobType)
	}
}
