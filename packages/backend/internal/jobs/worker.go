package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/gasless"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/indexer"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/reveal"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

const (
	JobIndexerCatchUp      = "indexer.catch_up"
	JobGaslessReceiptSync  = "gasless.receipt_sync"
	JobGaslessRetryFailed  = "gasless.retry_failed"
	JobPendingVRFChecker   = "indexer.pending_vrf_checker"
	JobStateReconciliation = "indexer.state_reconciliation"
	JobRevealProxySync     = "reveal.proxy_sync"
)

type Worker struct {
	cfg            config.Config
	queries        *db.Queries
	indexerService indexer.Service
	gaslessService gasless.Service
	revealService  reveal.Service
}

func NewWorker(cfg config.Config, queries *db.Queries, indexerService indexer.Service, gaslessService gasless.Service, revealService reveal.Service) Worker {
	return Worker{
		cfg:            cfg,
		queries:        queries,
		indexerService: indexerService,
		gaslessService: gaslessService,
		revealService:  revealService,
	}
}

func (w Worker) Run(ctx context.Context) error {
	if err := w.ensureJobs(ctx); err != nil {
		return err
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		if err := w.runDueJobs(ctx); err != nil {
			return err
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
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
		{key: JobGaslessReceiptSync, interval: w.cfg.Jobs.ReceiptSyncInterval},
		{key: JobGaslessRetryFailed, interval: w.cfg.Jobs.RetryFailedTxInterval},
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
	case JobGaslessReceiptSync:
		return w.gaslessService.SyncReceipts(ctx)
	case JobGaslessRetryFailed:
		return w.gaslessService.RetryFailed(ctx)
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
