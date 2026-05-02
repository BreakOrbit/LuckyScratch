package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"lucky-scratch/config"
	"lucky-scratch/store/db"
)

type ChainReader interface {
	BlockNumber(ctx context.Context) (uint64, error)
}

type IndexerAdmin interface {
	RebuildPool(ctx context.Context, poolID uint64) error
	RebuildRound(ctx context.Context, poolID uint64, roundID uint64) error
	RebuildTicket(ctx context.Context, ticketID uint64) error
	EncryptPool(ctx context.Context, poolID uint64) error
}

type Service struct {
	cfg     config.Config
	queries db.Querier
	chain   ChainReader
	indexer IndexerAdmin
}

func NewService(cfg config.Config, queries db.Querier, chain ChainReader, indexer IndexerAdmin) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
		chain:   chain,
		indexer: indexer,
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

	response := map[string]any{"jobs": items}
	if s.chain != nil {
		head, err := s.chain.BlockNumber(ctx)
		if err != nil {
			return nil, err
		}
		safeHead := finalizedHead(head, s.cfg.Chain.Confirmations, s.cfg.Chain.FinalizationDepth)
		cursors, err := s.queries.ListIndexerCursors(ctx, s.cfg.Chain.ID)
		if err != nil {
			return nil, err
		}

		cursorItems := make([]map[string]any, 0, len(cursors))
		for _, cursor := range cursors {
			lag := int64(0)
			if safeHead > uint64(cursor.LastProcessedBlock) {
				lag = int64(safeHead - uint64(cursor.LastProcessedBlock))
			}
			cursorItems = append(cursorItems, map[string]any{
				"contractName":        cursor.ContractName,
				"lastProcessedBlock":  cursor.LastProcessedBlock,
				"lastProcessedLogIdx": cursor.LastProcessedLogIndex,
				"updatedAt":           cursor.UpdatedAt.Time,
				"safeBlockLag":        lag,
			})
		}

		response["indexer"] = map[string]any{
			"head":              strconv.FormatUint(head, 10),
			"safeHead":          strconv.FormatUint(safeHead, 10),
			"confirmations":     s.cfg.Chain.Confirmations,
			"finalizationDepth": s.cfg.Chain.FinalizationDepth,
			"reorgLookback":     s.cfg.Chain.ReorgLookback,
			"cursors":           cursorItems,
		}
	}

	return response, nil
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
	return s.auditAction(ctx, actor, "job.retry", "job", fmt.Sprintf("%d", jobID), map[string]any{
		"jobKey": job.JobKey,
	})
}

func (s Service) RebuildPool(ctx context.Context, poolID uint64, actor string) error {
	if s.indexer == nil {
		return fmt.Errorf("indexer admin operations are not configured")
	}
	if err := s.indexer.RebuildPool(ctx, poolID); err != nil {
		return err
	}
	return s.auditAction(ctx, actor, "indexer.rebuild_pool", "pool", strconv.FormatUint(poolID, 10), nil)
}

func (s Service) RebuildRound(ctx context.Context, poolID uint64, roundID uint64, actor string) error {
	if s.indexer == nil {
		return fmt.Errorf("indexer admin operations are not configured")
	}
	if err := s.indexer.RebuildRound(ctx, poolID, roundID); err != nil {
		return err
	}
	return s.auditAction(ctx, actor, "indexer.rebuild_round", "round", fmt.Sprintf("%d:%d", poolID, roundID), nil)
}

func (s Service) RebuildTicket(ctx context.Context, ticketID uint64, actor string) error {
	if s.indexer == nil {
		return fmt.Errorf("indexer admin operations are not configured")
	}
	if err := s.indexer.RebuildTicket(ctx, ticketID); err != nil {
		return err
	}
	return s.auditAction(ctx, actor, "indexer.rebuild_ticket", "ticket", strconv.FormatUint(ticketID, 10), nil)
}

func (s Service) EncryptRound(ctx context.Context, poolID uint64, actor string) error {
	if s.indexer == nil {
		return fmt.Errorf("indexer admin operations are not configured")
	}
	if err := s.indexer.EncryptPool(ctx, poolID); err != nil {
		return err
	}
	return s.auditAction(ctx, actor, "indexer.encrypt_rounds", "pool", strconv.FormatUint(poolID, 10), nil)
}

func (s Service) auditAction(ctx context.Context, actor string, action string, targetType string, targetID string, extra map[string]any) error {
	payload := map[string]any{
		"actor": actor,
	}
	for key, value := range extra {
		payload[key] = value
	}
	raw, _ := json.Marshal(payload)
	_, err := s.queries.InsertAuditLog(ctx, db.InsertAuditLogParams{
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Payload:    raw,
	})
	return err
}

func finalizedHead(head uint64, confirmations uint64, finalizationDepth uint64) uint64 {
	safetyDepth := confirmations
	if finalizationDepth > safetyDepth {
		safetyDepth = finalizationDepth
	}
	if head <= safetyDepth {
		return 0
	}
	return head - safetyDepth
}
