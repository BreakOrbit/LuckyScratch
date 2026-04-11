package risk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

const (
	ScopeTypePool = "pool"
	ScopeTypeUser = "user"

	ControlTypePause = "pause"
	ControlTypeBlock = "block"
)

var (
	ErrPoolGaslessPaused    = errors.New("pool gasless is paused")
	ErrUserGaslessBlocked   = errors.New("user gasless is blocked")
	ErrUserRateLimited      = errors.New("user gasless rate limit exceeded")
	ErrGlobalBudgetExceeded = errors.New("global sponsor budget exceeded")
	ErrPoolBudgetExceeded   = errors.New("pool sponsor budget exceeded")
	ErrGasCostTooHigh       = errors.New("estimated gas cost exceeds configured maximum")
)

type Service struct {
	cfg     config.Config
	queries *db.Queries
}

type CheckInput struct {
	UserAddress         string
	PoolID              uint64
	EstimatedGasCostWei int64
}

func NewService(cfg config.Config, queries *db.Queries) Service {
	return Service{cfg: cfg, queries: queries}
}

func (s Service) CheckGasless(ctx context.Context, input CheckInput) error {
	userKey := normalizeAddress(input.UserAddress)
	if userKey == "" {
		return fmt.Errorf("user address is required")
	}

	if input.PoolID > 0 {
		if err := s.ensureNoControl(ctx, ScopeTypePool, strconv.FormatUint(input.PoolID, 10), ControlTypePause, ErrPoolGaslessPaused); err != nil {
			return err
		}

		poolSpent, err := s.queries.GetPoolSponsorCostTotal(ctx, db.GetPoolSponsorCostTotalParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  int64(input.PoolID),
		})
		if err != nil {
			return err
		}
		if poolSpent+input.EstimatedGasCostWei > s.cfg.Risk.DefaultPoolSponsorBudgetWei {
			return ErrPoolBudgetExceeded
		}
	}

	if err := s.ensureNoControl(ctx, ScopeTypeUser, userKey, ControlTypeBlock, ErrUserGaslessBlocked); err != nil {
		return err
	}

	requestCount, err := s.queries.CountRecentGaslessRequestsByUser(ctx, db.CountRecentGaslessRequestsByUserParams{
		ChainID:   s.cfg.Chain.ID,
		Lower:     userKey,
		CreatedAt: store.Timestamptz(time.Now().Add(-s.cfg.Risk.UserWindow)),
	})
	if err != nil {
		return err
	}
	if requestCount >= int64(s.cfg.Risk.UserWindowMaxRequests) {
		return ErrUserRateLimited
	}

	globalSpent, err := s.queries.GetGlobalSponsorCostTotal(ctx, s.cfg.Chain.ID)
	if err != nil {
		return err
	}
	if globalSpent+input.EstimatedGasCostWei > s.cfg.Risk.GlobalSponsorBudgetWei {
		return ErrGlobalBudgetExceeded
	}

	if input.EstimatedGasCostWei > s.cfg.Relayer.MaxGasCostWei {
		return ErrGasCostTooHigh
	}

	return nil
}

func (s Service) PausePool(ctx context.Context, poolID uint64, reason string, actor string) error {
	return s.upsertControl(ctx, ScopeTypePool, strconv.FormatUint(poolID, 10), ControlTypePause, true, reason, actor)
}

func (s Service) BlockUser(ctx context.Context, address string, reason string, actor string) error {
	return s.upsertControl(ctx, ScopeTypeUser, normalizeAddress(address), ControlTypeBlock, true, reason, actor)
}

func (s Service) ensureNoControl(ctx context.Context, scopeType string, scopeKey string, controlType string, failure error) error {
	_, err := s.queries.GetActiveGaslessControl(ctx, db.GetActiveGaslessControlParams{
		ScopeType:   scopeType,
		ScopeKey:    scopeKey,
		ControlType: controlType,
	})
	if err == nil {
		return failure
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

func (s Service) upsertControl(ctx context.Context, scopeType string, scopeKey string, controlType string, isActive bool, reason string, actor string) error {
	if scopeKey == "" {
		return errors.New("scope key is required")
	}

	_, err := s.queries.UpsertGaslessControl(ctx, db.UpsertGaslessControlParams{
		ScopeType:   scopeType,
		ScopeKey:    scopeKey,
		ControlType: controlType,
		IsActive:    isActive,
		Reason:      reason,
		ExpiresAt:   store.NullTimestamptz(),
	})
	if err != nil {
		return err
	}

	return s.recordAudit(ctx, actor, "gasless_control.updated", scopeType, scopeKey, map[string]any{
		"controlType": controlType,
		"isActive":    isActive,
		"reason":      reason,
	})
}

func (s Service) recordAudit(ctx context.Context, actor string, action string, targetType string, targetID string, payload map[string]any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = s.queries.InsertAuditLog(ctx, db.InsertAuditLogParams{
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Payload:    encoded,
	})
	return err
}

func normalizeAddress(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
