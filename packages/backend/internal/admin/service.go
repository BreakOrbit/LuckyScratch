package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/chain"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/risk"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

type Service struct {
	cfg         config.Config
	queries     *db.Queries
	chain       *chain.Client
	riskService risk.Service
}

func NewService(cfg config.Config, queries *db.Queries, chainClient *chain.Client, riskService risk.Service) Service {
	return Service{
		cfg:         cfg,
		queries:     queries,
		chain:       chainClient,
		riskService: riskService,
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

func (s Service) RelayerHealth(ctx context.Context) (map[string]any, error) {
	address, err := s.chain.RelayerAddress()
	if err != nil {
		return map[string]any{
			"status": "unconfigured",
			"error":  err.Error(),
		}, nil
	}

	balance, err := s.chain.BalanceAt(ctx, address)
	if err != nil {
		return nil, err
	}

	status := "ok"
	if balance.Cmp(big.NewInt(s.cfg.Relayer.HealthMinBalanceWei)) < 0 {
		status = "low_balance"
	}

	return map[string]any{
		"status":            status,
		"address":           address.Hex(),
		"balanceWei":        balance.String(),
		"minimumBalanceWei": strconv.FormatInt(s.cfg.Relayer.HealthMinBalanceWei, 10),
		"chainId":           s.cfg.Chain.ID,
	}, nil
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

func (s Service) PausePoolGasless(ctx context.Context, poolID uint64, reason string, actor string) error {
	return s.riskService.PausePool(ctx, poolID, reason, actor)
}

func (s Service) BlockUserGasless(ctx context.Context, address string, reason string, actor string) error {
	return s.riskService.BlockUser(ctx, address, reason, actor)
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
