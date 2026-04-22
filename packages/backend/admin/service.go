package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"lucky-scratch/config"
	"lucky-scratch/store/db"
)

type Service struct {
	cfg     config.Config
	queries db.Querier
}

func NewService(cfg config.Config, queries db.Querier) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
	}
}

func (s Service) Jobs(ctx context.Context) (map[string]any, error) {
	jobs, err := s.queries.ListJobs(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(jobs))
	for _, job := range jobs {
		items = append(items, map[string]any{
			"id":          job.ID,
			"jobKey":      job.JobKey,
			"jobType":     job.JobType,
			"status":      job.Status,
			"attempts":    job.Attempts,
			"maxAttempts": job.MaxAttempts,
			"lastError":   job.LastError,
			"runAfter":    job.RunAfter.Time,
		})
	}
	return map[string]any{"jobs": items}, nil
}

func (s Service) PoolCosts(ctx context.Context, poolID uint64) (map[string]any, error) {
	totals, err := s.queries.GetPoolCostTotals(ctx, db.GetPoolCostTotalsParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
	if err != nil {
		return nil, err
	}

	ledgers, err := s.queries.ListPoolCostLedgers(ctx, db.ListPoolCostLedgersParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		Limit:   50,
		Offset:  0,
	})
	if err != nil {
		return nil, err
	}

	summary := make(map[string]string, len(totals))
	for _, row := range totals {
		summary[row.CostType] = strconv.FormatInt(row.TotalAmount, 10)
	}

	items := make([]map[string]any, 0, len(ledgers))
	for _, ledger := range ledgers {
		var metadata map[string]any
		_ = json.Unmarshal(ledger.Metadata, &metadata)
		items = append(items, map[string]any{
			"id":        ledger.ID,
			"costType":  ledger.CostType,
			"amount":    strconv.FormatInt(ledger.Amount, 10),
			"txHash":    ledger.TxHash,
			"refType":   ledger.RefType,
			"refId":     ledger.RefID,
			"createdAt": ledger.CreatedAt.Time,
			"metadata":  metadata,
		})
	}

	return map[string]any{
		"poolId":  strconv.FormatUint(poolID, 10),
		"summary": summary,
		"items":   items,
	}, nil
}

func (s Service) RetryJob(ctx context.Context, jobID int64, actor string) error {
	job, err := s.queries.RetryJob(ctx, jobID)
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]any{
		"jobKey": job.JobKey,
		"actor":  actor,
	})
	_, err = s.queries.InsertAuditLog(ctx, db.InsertAuditLogParams{
		Actor:      actor,
		Action:     "job.retry",
		TargetType: "job",
		TargetID:   fmt.Sprintf("%d", jobID),
		Payload:    payload,
	})
	return err
}
