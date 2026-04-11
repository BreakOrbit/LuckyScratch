package indexer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/chain"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/contracts"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/models"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

type Service struct {
	cfg     config.Config
	queries *db.Queries
	chain   *chain.Client
}

func NewService(cfg config.Config, queries *db.Queries, chainClient *chain.Client) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
		chain:   chainClient,
	}
}

func (s Service) Sync(ctx context.Context) error {
	for _, contractName := range []string{contracts.CoreContractName, contracts.TicketContractName} {
		if err := s.syncContract(ctx, contractName); err != nil {
			return err
		}
	}
	return nil
}

func (s Service) Reconcile(ctx context.Context) error {
	pools, err := s.queries.ListPools(ctx, db.ListPoolsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   500,
		Offset:  0,
	})
	if err != nil {
		return err
	}

	for _, pool := range pools {
		if err := s.syncPool(ctx, uint64(pool.PoolID), eventContext{}); err != nil {
			return err
		}
		if err := s.syncRound(ctx, uint64(pool.PoolID), uint64(pool.CurrentRound), eventContext{}, nil, nil); err != nil {
			return err
		}
	}
	return nil
}

func (s Service) CheckPendingVRF(ctx context.Context) error {
	pools, err := s.queries.ListPools(ctx, db.ListPoolsParams{
		ChainID: s.cfg.Chain.ID,
		Limit:   500,
		Offset:  0,
	})
	if err != nil {
		return err
	}

	var stalePools []int64
	threshold := time.Now().Add(-2 * s.cfg.Jobs.VRFCheckInterval)
	for _, pool := range pools {
		round, roundErr := s.queries.GetRound(ctx, db.GetRoundParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  pool.PoolID,
			RoundID: pool.CurrentRound,
		})
		if roundErr != nil {
			continue
		}
		if round.Status == models.RoundStatusPendingVRF && round.LastVrfRequestedAt.Valid && round.LastVrfRequestedAt.Time.Before(threshold) {
			stalePools = append(stalePools, pool.PoolID)
		}
	}

	if len(stalePools) > 0 {
		return fmt.Errorf("stale pending VRF rounds detected for pools %v", stalePools)
	}
	return nil
}

func (s Service) syncContract(ctx context.Context, contractName string) error {
	deployment, err := s.chain.Registry().Must(contractName)
	if err != nil {
		return err
	}

	head, err := s.chain.BlockNumber(ctx)
	if err != nil {
		return err
	}

	startBlock := deployment.DeploymentBlock
	cursor, err := s.queries.GetIndexerCursor(ctx, db.GetIndexerCursorParams{
		ChainID:      s.cfg.Chain.ID,
		ContractName: contractName,
	})
	if err == nil && cursor.LastProcessedBlock > 0 {
		rewind := uint64(cursor.LastProcessedBlock)
		if rewind > s.cfg.Chain.ReorgLookback {
			startBlock = rewind - s.cfg.Chain.ReorgLookback
		}
	}
	if errors.Is(err, pgx.ErrNoRows) && startBlock > 0 {
		startBlock--
	}

	if head <= startBlock {
		_, upsertErr := s.queries.UpsertIndexerCursor(ctx, db.UpsertIndexerCursorParams{
			ChainID:               s.cfg.Chain.ID,
			ContractName:          contractName,
			LastProcessedBlock:    int64(head),
			LastProcessedLogIndex: 0,
		})
		return upsertErr
	}

	fromBlock := startBlock + 1
	oldLogs, err := s.queries.ListIndexedLogsFromBlock(ctx, db.ListIndexedLogsFromBlockParams{
		ChainID:      s.cfg.Chain.ID,
		ContractName: contractName,
		BlockNumber:  int64(fromBlock),
	})
	if err != nil {
		return err
	}

	if err := s.queries.DeleteIndexedLogsFromBlock(ctx, db.DeleteIndexedLogsFromBlockParams{
		ChainID:      s.cfg.Chain.ID,
		ContractName: contractName,
		BlockNumber:  int64(fromBlock),
	}); err != nil {
		return err
	}

	logs, err := s.chain.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(head)),
		Addresses: []common.Address{deployment.Address},
	})
	if err != nil {
		return err
	}
	sort.Slice(logs, func(i, j int) bool {
		if logs[i].BlockNumber == logs[j].BlockNumber {
			return logs[i].Index < logs[j].Index
		}
		return logs[i].BlockNumber < logs[j].BlockNumber
	})

	blockTimeCache := make(map[uint64]time.Time)
	impacts := newImpactSet()
	for _, oldLog := range oldLogs {
		impacts.addLog(oldLog)
	}

	for _, logEntry := range logs {
		decoded, decodeErr := s.decodeLog(deployment, logEntry)
		if decodeErr != nil {
			return decodeErr
		}

		blockTime, timeErr := s.blockTime(ctx, logEntry.BlockNumber, blockTimeCache)
		if timeErr != nil {
			return timeErr
		}
		decoded.Event.BlockTime = blockTime

		if err := s.applyEvent(ctx, decoded); err != nil {
			return err
		}
		impacts.addDecoded(decoded.Event)
	}

	if err := s.reconcileImpacts(ctx, impacts); err != nil {
		return err
	}

	_, err = s.queries.UpsertIndexerCursor(ctx, db.UpsertIndexerCursorParams{
		ChainID:               s.cfg.Chain.ID,
		ContractName:          contractName,
		LastProcessedBlock:    int64(head),
		LastProcessedLogIndex: 0,
	})
	return err
}

type decodedLog struct {
	Event decodedEvent
}

type decodedEvent struct {
	ContractName string
	EventName    string
	ContractAddr string
	TxHash       string
	LogIndex     int64
	BlockNumber  int64
	BlockHash    string
	BlockTime    time.Time
	PoolID       int64
	RoundID      int64
	TicketID     int64
	UserAddress  string
	Digest       string
	Payload      map[string]any
}

func (s Service) decodeLog(deployment contracts.Deployment, logEntry types.Log) (decodedLog, error) {
	event, err := deployment.ABI.EventByID(logEntry.Topics[0])
	if err != nil {
		return decodedLog{}, err
	}

	out, err := deployment.ABI.Unpack(event.Name, logEntry.Data)
	if err != nil {
		return decodedLog{}, err
	}

	result := decodedLog{
		Event: decodedEvent{
			ContractName: deployment.Name,
			EventName:    event.Name,
			ContractAddr: logEntry.Address.Hex(),
			TxHash:       logEntry.TxHash.Hex(),
			LogIndex:     int64(logEntry.Index),
			BlockNumber:  int64(logEntry.BlockNumber),
			BlockHash:    logEntry.BlockHash.Hex(),
			Payload:      map[string]any{},
		},
	}

	switch event.Name {
	case "PoolCreated":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.UserAddress = topicAddress(logEntry.Topics[2]).Hex()
		result.Event.Payload["protocolOwned"] = asBool(out[0])
	case "PoolRoundRequested":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
		result.Event.Payload["requestId"] = bytes32Hex(out[0])
	case "PoolRoundInitialized":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
	case "RoundSettled":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
	case "TicketPurchased":
		result.Event.UserAddress = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.PoolID = topicUint64(logEntry.Topics[2])
		result.Event.TicketID = topicUint64(logEntry.Topics[3])
		result.Event.Payload["ticketIndex"] = asUint32(out[0])
	case "TicketScratched":
		result.Event.UserAddress = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.PoolID = topicUint64(logEntry.Topics[2])
		result.Event.RoundID = topicUint64(logEntry.Topics[3])
		result.Event.TicketID = asUint64(out[0])
		result.Event.Payload["revealAuthorized"] = asBool(out[1])
	case "RewardClaimed":
		result.Event.UserAddress = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.TicketID = topicUint64(logEntry.Topics[2])
		result.Event.PoolID = topicUint64(logEntry.Topics[3])
		result.Event.RoundID = asUint64(out[0])
	case "CreatorProfitWithdrawn":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.UserAddress = topicAddress(logEntry.Topics[2]).Hex()
		result.Event.Payload["amount"] = bigToString(out[0])
	case "BondRefunded":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.UserAddress = topicAddress(logEntry.Topics[2]).Hex()
		result.Event.Payload["amount"] = bigToString(out[0])
	case "PoolClosed":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
	case "PoolRolledToNextRound":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
	case "GaslessExecuted":
		result.Event.UserAddress = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.Payload["action"] = asUint8(out[0])
		result.Event.Digest = bytes32Hex(out[1])
	case "Transfer":
		result.Event.UserAddress = topicAddress(logEntry.Topics[2]).Hex()
		result.Event.TicketID = topicUint64(logEntry.Topics[3])
		result.Event.Payload["from"] = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.Payload["to"] = topicAddress(logEntry.Topics[2]).Hex()
	default:
		return decodedLog{}, fmt.Errorf("unsupported event %s", event.Name)
	}

	return result, nil
}

func (s Service) applyEvent(ctx context.Context, decoded decodedLog) error {
	payload, err := json.Marshal(decoded.Event.Payload)
	if err != nil {
		return err
	}

	_, err = s.queries.InsertIndexedLog(ctx, db.InsertIndexedLogParams{
		ChainID:         s.cfg.Chain.ID,
		ContractName:    decoded.Event.ContractName,
		ContractAddress: decoded.Event.ContractAddr,
		EventName:       decoded.Event.EventName,
		TxHash:          decoded.Event.TxHash,
		LogIndex:        decoded.Event.LogIndex,
		BlockNumber:     decoded.Event.BlockNumber,
		BlockHash:       decoded.Event.BlockHash,
		EventKey:        fmt.Sprintf("%s:%s:%d", decoded.Event.TxHash, decoded.Event.EventName, decoded.Event.LogIndex),
		Removed:         false,
		PoolID:          maybeInt8(decoded.Event.PoolID),
		RoundID:         maybeInt8(decoded.Event.RoundID),
		TicketID:        maybeInt8(decoded.Event.TicketID),
		UserAddress:     decoded.Event.UserAddress,
		Digest:          normalizeHex(decoded.Event.Digest),
		Payload:         payload,
	})
	if err != nil {
		return err
	}

	switch decoded.Event.EventName {
	case "PoolCreated":
		return s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext{
			BlockNumber: decoded.Event.BlockNumber,
			BlockHash:   decoded.Event.BlockHash,
			TxHash:      decoded.Event.TxHash,
			LogIndex:    decoded.Event.LogIndex,
			Created:     true,
		})
	case "PoolRoundRequested":
		if err := s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context())); err != nil {
			return err
		}
		return s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), &decoded.Event.BlockTime, nil)
	case "PoolRoundInitialized":
		if err := s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context())); err != nil {
			return err
		}
		if err := s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, &decoded.Event.BlockTime); err != nil {
			return err
		}
		return s.recordInfraCost(ctx, "VRF_INFRA", decoded.Event.PoolID, decoded.Event.RoundID, decoded.Event.TxHash, "vrf_request", decoded.Event.TxHash)
	case "TicketPurchased":
		if err := s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context())); err != nil {
			return err
		}
		if err := s.syncTicket(ctx, uint64(decoded.Event.TicketID), eventContext(decoded.Event.context()), "", 0); err != nil {
			return err
		}
		ticket, err := s.chain.TicketData(ctx, uint64(decoded.Event.TicketID))
		if err == nil {
			return s.syncRound(ctx, uint64(decoded.Event.PoolID), ticket.RoundID, eventContext(decoded.Event.context()), nil, nil)
		}
		return nil
	case "TicketScratched":
		if err := s.syncTicket(ctx, uint64(decoded.Event.TicketID), eventContext(decoded.Event.context()), "", 0); err != nil {
			return err
		}
		return s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil)
	case "RewardClaimed":
		amount, _ := s.extractClaimAmount(ctx, decoded.Event.TxHash, uint64(decoded.Event.TicketID))
		if err := s.syncTicket(ctx, uint64(decoded.Event.TicketID), eventContext(decoded.Event.context()), decoded.Event.UserAddress, amount); err != nil {
			return err
		}
		if err := s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil); err != nil {
			return err
		}
		return s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context()))
	case "GaslessExecuted":
		if decoded.Event.Digest == "" {
			return nil
		}
		existing, err := s.queries.GetGaslessRequestByDigest(ctx, normalizeHex(decoded.Event.Digest))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if (existing.Status == models.GaslessStatusConfirmed || existing.Status == models.GaslessStatusFinalized) && hasGaslessReceiptState(existing) {
			return nil
		}
		receipt, err := s.chain.TransactionReceipt(ctx, common.HexToHash(decoded.Event.TxHash))
		if err != nil {
			return err
		}

		status := models.GaslessStatusConfirmed
		failureCode := ""
		failureReason := ""
		if receipt.Status != types.ReceiptStatusSuccessful {
			status = models.GaslessStatusFailed
			failureCode = "execution_reverted"
			failureReason = "transaction reverted onchain"
		}
		gasUsed := clampUint64ToInt64(receipt.GasUsed)
		gasPrice := bigIntToPg(receipt.EffectiveGasPrice)
		totalCost := receipt.EffectiveGasPrice
		if totalCost == nil {
			totalCost = big.NewInt(0)
		} else {
			totalCost = new(big.Int).Mul(totalCost, new(big.Int).SetUint64(receipt.GasUsed))
		}

		updated, err := s.queries.BackfillGaslessRequestOnchainState(ctx, db.BackfillGaslessRequestOnchainStateParams{
			Digest:               normalizeHex(decoded.Event.Digest),
			Status:               status,
			FailureCode:          failureCode,
			FailureReason:        failureReason,
			TxHash:               decoded.Event.TxHash,
			GasUsed:              store.Int8(gasUsed),
			EffectiveGasPriceWei: gasPrice,
			GasCostWei:           bigIntToPg(totalCost),
			ReceiptBlockNumber:   bigIntToPg(receipt.BlockNumber),
			ReceiptBlockHash:     receipt.BlockHash.Hex(),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if receipt.Status == types.ReceiptStatusSuccessful && updated.PoolID.Valid {
			metadata, _ := json.Marshal(map[string]any{
				"digest":  updated.Digest,
				"txHash":  decoded.Event.TxHash,
				"gasUsed": gasUsed,
			})
			_, _ = s.queries.InsertPoolCostLedger(ctx, db.InsertPoolCostLedgerParams{
				ChainID:  s.cfg.Chain.ID,
				PoolID:   updated.PoolID.Int64,
				RoundID:  updated.RoundID,
				CostType: "SPONSOR_GAS",
				Amount:   clampBigIntToInt64(totalCost),
				TxHash:   decoded.Event.TxHash,
				RefType:  "gasless_request",
				RefID:    updated.Digest,
				Metadata: metadata,
			})
		}
		return nil
	case "RoundSettled":
		if err := s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil); err != nil {
			return err
		}
		return s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context()))
	case "PoolRolledToNextRound":
		if err := s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context())); err != nil {
			return err
		}
		return s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), &decoded.Event.BlockTime, nil)
	case "PoolClosed", "CreatorProfitWithdrawn", "BondRefunded":
		return s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context()))
	case "Transfer":
		return s.syncTicket(ctx, uint64(decoded.Event.TicketID), eventContext(decoded.Event.context()), "", 0)
	default:
		return nil
	}
}

type eventContext struct {
	BlockNumber int64
	BlockHash   string
	TxHash      string
	LogIndex    int64
	Created     bool
}

func (e decodedEvent) context() eventContext {
	return eventContext{
		BlockNumber: e.BlockNumber,
		BlockHash:   e.BlockHash,
		TxHash:      e.TxHash,
		LogIndex:    e.LogIndex,
	}
}

func (s Service) syncPool(ctx context.Context, poolID uint64, meta eventContext) error {
	configState, err := s.chain.PoolConfig(ctx, poolID)
	if err != nil {
		return err
	}
	if configState.Creator == (common.Address{}) {
		return s.queries.DeletePool(ctx, db.DeletePoolParams{ChainID: s.cfg.Chain.ID, PoolID: int64(poolID)})
	}

	poolState, err := s.chain.PoolState(ctx, poolID)
	if err != nil {
		return err
	}
	accounting, err := s.chain.PoolAccounting(ctx, poolID)
	if err != nil {
		return err
	}
	claimableProfit, err := s.chain.ClaimableCreatorProfit(ctx, poolID)
	if err != nil {
		return err
	}

	existing, err := s.queries.GetPool(ctx, db.GetPoolParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	createdBlock := existing.CreatedBlock
	createdTxHash := existing.CreatedTxHash
	if meta.Created || errors.Is(err, pgx.ErrNoRows) {
		createdBlock = meta.BlockNumber
		createdTxHash = meta.TxHash
	}
	meta = mergeEventContext(meta, existing.LastEventBlock, existing.LastEventTxHash, existing.LastEventLogIndex, existing.LastEventBlockHash)

	claimable := int64(0)
	claimable = clampBigIntToInt64(claimableProfit)

	_, err = s.queries.UpsertPool(ctx, db.UpsertPoolParams{
		ChainID:                s.cfg.Chain.ID,
		PoolID:                 int64(poolID),
		Creator:                configState.Creator.Hex(),
		ProtocolOwned:          configState.ProtocolOwned,
		Mode:                   mapPoolMode(configState.Mode),
		Status:                 models.PoolStatusName(poolState.Status),
		Paused:                 poolState.Paused,
		CloseRequested:         poolState.CloseRequested,
		VrfPending:             poolState.VrfPending,
		Initialized:            poolState.Initialized,
		ThemeID:                bytes32Hex(configState.ThemeID),
		TicketPrice:            clampUint64ToInt64(configState.TicketPrice),
		TotalTicketsPerRound:   clampUint64ToInt64(uint64(configState.TotalTicketsPerRound)),
		TotalPrizeBudget:       clampUint64ToInt64(configState.TotalPrizeBudget),
		PoolInstanceGroupSize:  clampUint64ToInt64(uint64(configState.PoolInstanceGroupSize)),
		FeeBps:                 int32(configState.FeeBps),
		TargetRtpBps:           int32(configState.TargetRtpBps),
		HitRateBps:             int32(configState.HitRateBps),
		MaxPrize:               clampUint64ToInt64(configState.MaxPrize),
		Selectable:             configState.Selectable,
		CurrentRound:           clampUint64ToInt64(uint64(poolState.CurrentRound)),
		LockedBond:             clampUint64ToInt64(accounting.LockedBond),
		ReservedPrizeBudget:    clampUint64ToInt64(accounting.ReservedPrizeBudget),
		LockedNextRoundBudget:  clampUint64ToInt64(accounting.LockedNextRoundBudget),
		RealizedRevenue:        clampUint64ToInt64(accounting.RealizedRevenue),
		SettledPrizeCost:       clampUint64ToInt64(accounting.SettledPrizeCost),
		SettledProtocolCost:    clampUint64ToInt64(accounting.SettledProtocolCost),
		AccruedPlatformFee:     clampUint64ToInt64(accounting.AccruedPlatformFee),
		CreatorProfitClaimed:   clampUint64ToInt64(accounting.CreatorProfitClaimed),
		ClaimableCreatorProfit: claimable,
		CreatedBlock:           createdBlock,
		CreatedTxHash:          createdTxHash,
		LastEventBlock:         meta.BlockNumber,
		LastEventTxHash:        meta.TxHash,
		LastEventLogIndex:      meta.LogIndex,
		LastEventBlockHash:     meta.BlockHash,
	})
	return err
}

func (s Service) syncRound(ctx context.Context, poolID uint64, roundID uint64, meta eventContext, vrfRequestedAt *time.Time, vrfInitializedAt *time.Time) error {
	poolState, err := s.chain.PoolState(ctx, poolID)
	if err != nil {
		return err
	}
	if poolState.CurrentRound < uint32(roundID) {
		return s.queries.DeleteRound(ctx, db.DeleteRoundParams{ChainID: s.cfg.Chain.ID, PoolID: int64(poolID), RoundID: int64(roundID)})
	}

	state, err := s.chain.RoundState(ctx, poolID, roundID)
	if err != nil {
		return err
	}

	existing, err := s.queries.GetRound(ctx, db.GetRoundParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
		RoundID: int64(roundID),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	requestedAt := existing.LastVrfRequestedAt
	initializedAt := existing.LastVrfInitializedAt
	if vrfRequestedAt != nil {
		requestedAt = store.Timestamptz(*vrfRequestedAt)
	}
	if vrfInitializedAt != nil {
		initializedAt = store.Timestamptz(*vrfInitializedAt)
	}
	meta = mergeEventContext(meta, existing.LastEventBlock, existing.LastEventTxHash, existing.LastEventLogIndex, existing.LastEventBlockHash)

	_, err = s.queries.UpsertRound(ctx, db.UpsertRoundParams{
		ChainID:              s.cfg.Chain.ID,
		PoolID:               int64(poolID),
		RoundID:              int64(roundID),
		Status:               models.RoundStatusName(state.Status),
		SoldCount:            clampUint64ToInt64(uint64(state.SoldCount)),
		ScratchedCount:       clampUint64ToInt64(uint64(state.ScratchedCount)),
		ClaimedCount:         clampUint64ToInt64(uint64(state.ClaimedCount)),
		WinClaimableCount:    clampUint64ToInt64(uint64(state.WinClaimableCount)),
		TotalTickets:         clampUint64ToInt64(uint64(state.TotalTickets)),
		TicketPrice:          clampUint64ToInt64(state.TicketPrice),
		RoundPrizeBudget:     clampUint64ToInt64(state.RoundPrizeBudget),
		VrfRequestRef:        bytes32Hex(state.VrfRequestRef),
		ShuffleRoot:          bytes32Hex(state.ShuffleRoot),
		LastVrfRequestedAt:   requestedAt,
		LastVrfInitializedAt: initializedAt,
		LastEventBlock:       meta.BlockNumber,
		LastEventTxHash:      meta.TxHash,
		LastEventLogIndex:    meta.LogIndex,
		LastEventBlockHash:   meta.BlockHash,
	})
	return err
}

func (s Service) syncTicket(ctx context.Context, ticketID uint64, meta eventContext, claimedBy string, claimAmount int64) error {
	owner, err := s.chain.OwnerOf(ctx, ticketID)
	if err != nil {
		if isMissingOwnerOfTokenError(err) {
			return s.queries.DeleteTicket(ctx, db.DeleteTicketParams{
				ChainID:  s.cfg.Chain.ID,
				TicketID: int64(ticketID),
			})
		}
		return err
	}

	data, err := s.chain.TicketData(ctx, ticketID)
	if err != nil {
		return err
	}
	status, revealAuthorized, err := s.chain.TicketRevealState(ctx, ticketID)
	if err != nil {
		return err
	}

	existing, err := s.queries.GetTicket(ctx, db.GetTicketParams{
		ChainID:  s.cfg.Chain.ID,
		TicketID: int64(ticketID),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if claimedBy == "" {
		claimedBy = existing.ClaimedBy
	}
	if claimAmount == 0 {
		claimAmount = existing.ClaimClearRewardAmount
	}
	mintTxHash := existing.MintTxHash
	if mintTxHash == "" {
		mintTxHash = meta.TxHash
	}
	meta = mergeEventContext(meta, existing.LastEventBlock, existing.LastEventTxHash, existing.LastEventLogIndex, existing.LastEventBlockHash)

	_, err = s.queries.UpsertTicket(ctx, db.UpsertTicketParams{
		ChainID:                  s.cfg.Chain.ID,
		TicketID:                 int64(ticketID),
		PoolID:                   clampUint64ToInt64(data.PoolID),
		RoundID:                  clampUint64ToInt64(data.RoundID),
		Owner:                    owner.Hex(),
		TicketIndex:              clampUint64ToInt64(uint64(data.TicketIndex)),
		Status:                   models.TicketStatusName(status),
		RevealAuthorized:         revealAuthorized,
		TransferredBeforeScratch: data.TransferredBeforeScratch,
		MintTxHash:               mintTxHash,
		ClaimedBy:                claimedBy,
		ClaimClearRewardAmount:   claimAmount,
		LastEventBlock:           meta.BlockNumber,
		LastEventTxHash:          meta.TxHash,
		LastEventLogIndex:        meta.LogIndex,
		LastEventBlockHash:       meta.BlockHash,
	})
	return err
}

func (s Service) extractClaimAmount(ctx context.Context, txHash string, ticketID uint64) (int64, error) {
	tx, _, err := s.chain.TransactionByHash(ctx, common.HexToHash(txHash))
	if err != nil {
		return 0, err
	}
	input := tx.Data()
	if len(input) < 4 {
		return 0, nil
	}

	deployment, err := s.chain.Registry().Must(contracts.CoreContractName)
	if err != nil {
		return 0, err
	}
	method, err := deployment.ABI.MethodById(input[:4])
	if err != nil {
		return 0, err
	}

	values, err := method.Inputs.Unpack(input[4:])
	if err != nil {
		return 0, err
	}

	switch method.Name {
	case "claimReward":
		return int64(asUint64(values[1])), nil
	case "batchClaimRewards":
		ticketIDs := *gethabi.ConvertType(values[0], new([]*big.Int)).(*[]*big.Int)
		clearRewards := *gethabi.ConvertType(values[1], new([]uint64)).(*[]uint64)
		for index, value := range ticketIDs {
			if value.Uint64() == ticketID && index < len(clearRewards) {
				return int64(clearRewards[index]), nil
			}
		}
	}
	return 0, nil
}

func (s Service) recordInfraCost(ctx context.Context, costType string, poolID int64, roundID int64, txHash string, refType string, refID string) error {
	receipt, err := s.chain.TransactionReceipt(ctx, common.HexToHash(txHash))
	if err != nil {
		return err
	}
	cost := int64(0)
	if receipt.EffectiveGasPrice != nil {
		cost = clampBigIntToInt64(new(big.Int).Mul(receipt.EffectiveGasPrice, new(big.Int).SetUint64(receipt.GasUsed)))
	}

	metadata, _ := json.Marshal(map[string]any{
		"txHash": txHash,
	})
	_, err = s.queries.InsertPoolCostLedger(ctx, db.InsertPoolCostLedgerParams{
		ChainID:  s.cfg.Chain.ID,
		PoolID:   poolID,
		RoundID:  maybeInt8(roundID),
		CostType: costType,
		Amount:   cost,
		TxHash:   txHash,
		RefType:  refType,
		RefID:    refID,
		Metadata: metadata,
	})
	return err
}

func (s Service) reconcileImpacts(ctx context.Context, impacts impactSet) error {
	for poolID := range impacts.Pools {
		if err := s.syncPool(ctx, uint64(poolID), eventContext{}); err != nil {
			return err
		}
	}
	for round := range impacts.Rounds {
		if err := s.syncRound(ctx, uint64(round.PoolID), uint64(round.RoundID), eventContext{}, nil, nil); err != nil {
			return err
		}
	}
	for ticketID := range impacts.Tickets {
		if err := s.syncTicket(ctx, uint64(ticketID), eventContext{}, "", 0); err != nil {
			return err
		}
	}
	return nil
}

func (s Service) blockTime(ctx context.Context, blockNumber uint64, cache map[uint64]time.Time) (time.Time, error) {
	if value, ok := cache[blockNumber]; ok {
		return value, nil
	}
	header, err := s.chain.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return time.Time{}, err
	}
	value := time.Unix(int64(header.Time), 0).UTC()
	cache[blockNumber] = value
	return value, nil
}

type impactRound struct {
	PoolID  int64
	RoundID int64
}

type impactSet struct {
	Pools   map[int64]struct{}
	Rounds  map[impactRound]struct{}
	Tickets map[int64]struct{}
}

func newImpactSet() impactSet {
	return impactSet{
		Pools:   make(map[int64]struct{}),
		Rounds:  make(map[impactRound]struct{}),
		Tickets: make(map[int64]struct{}),
	}
}

func (i impactSet) addLog(log db.IndexedLog) {
	if log.PoolID.Valid {
		i.Pools[log.PoolID.Int64] = struct{}{}
	}
	if log.PoolID.Valid && log.RoundID.Valid {
		i.Rounds[impactRound{PoolID: log.PoolID.Int64, RoundID: log.RoundID.Int64}] = struct{}{}
	}
	if log.TicketID.Valid {
		i.Tickets[log.TicketID.Int64] = struct{}{}
	}
}

func (i impactSet) addDecoded(event decodedEvent) {
	if event.PoolID > 0 {
		i.Pools[event.PoolID] = struct{}{}
	}
	if event.PoolID > 0 && event.RoundID > 0 {
		i.Rounds[impactRound{PoolID: event.PoolID, RoundID: event.RoundID}] = struct{}{}
	}
	if event.TicketID > 0 {
		i.Tickets[event.TicketID] = struct{}{}
	}
}

func topicUint64(topic common.Hash) int64 {
	return clampBigIntToInt64(new(big.Int).SetBytes(topic.Bytes()))
}

func mergeEventContext(meta eventContext, blockNumber int64, txHash string, logIndex int64, blockHash string) eventContext {
	if meta.BlockNumber != 0 || meta.TxHash != "" || meta.BlockHash != "" {
		return meta
	}
	meta.BlockNumber = blockNumber
	meta.TxHash = txHash
	meta.LogIndex = logIndex
	meta.BlockHash = blockHash
	return meta
}

func hasGaslessReceiptState(record db.GaslessRequest) bool {
	return record.TxHash != "" && record.GasCostWei.Valid && record.ReceiptBlockNumber.Valid
}

func topicAddress(topic common.Hash) common.Address {
	return common.BytesToAddress(topic.Bytes()[12:])
}

func asUint64(value interface{}) int64 {
	switch casted := value.(type) {
	case *big.Int:
		return clampBigIntToInt64(casted)
	case uint64:
		return clampUint64ToInt64(casted)
	case uint32:
		return clampUint64ToInt64(uint64(casted))
	case int64:
		return casted
	default:
		return 0
	}
}

func asUint32(value interface{}) uint32 {
	switch casted := value.(type) {
	case uint32:
		return casted
	case uint64:
		return uint32(casted)
	case *big.Int:
		return uint32(casted.Uint64())
	default:
		return 0
	}
}

func asUint8(value interface{}) uint8 {
	switch casted := value.(type) {
	case uint8:
		return casted
	case uint16:
		return uint8(casted)
	case *big.Int:
		return uint8(casted.Uint64())
	default:
		return 0
	}
}

func asBool(value interface{}) bool {
	if casted, ok := value.(bool); ok {
		return casted
	}
	return false
}

func bytes32Hex(value interface{}) string {
	switch casted := value.(type) {
	case [32]byte:
		return "0x" + common.Bytes2Hex(casted[:])
	case common.Hash:
		return casted.Hex()
	default:
		return ""
	}
}

func bigIntToPg(value *big.Int) pgtype.Int8 {
	if value == nil {
		return store.NullInt8()
	}
	return store.Int8(clampBigIntToInt64(value))
}

func bigToString(value interface{}) string {
	switch casted := value.(type) {
	case *big.Int:
		return casted.String()
	case uint64:
		return fmt.Sprintf("%d", casted)
	default:
		return ""
	}
}

func maybeInt8(value int64) pgtype.Int8 {
	if value <= 0 {
		return store.NullInt8()
	}
	return store.Int8(value)
}

func clampUint64ToInt64(value uint64) int64 {
	if value > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(value)
}

func clampBigIntToInt64(value *big.Int) int64 {
	if value == nil {
		return 0
	}
	if value.Sign() < 0 {
		if value.IsInt64() {
			return value.Int64()
		}
		return math.MinInt64
	}
	if value.BitLen() > 63 {
		return math.MaxInt64
	}
	return value.Int64()
}

func isMissingOwnerOfTokenError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "erc721nonexistenttoken") ||
		strings.Contains(message, "nonexistent token") ||
		strings.Contains(message, "invalid token id") ||
		strings.Contains(message, "owner query for nonexistent token")
}

func normalizeHex(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "0x") || strings.HasPrefix(trimmed, "0X") {
		return "0x" + strings.TrimPrefix(strings.TrimPrefix(trimmed, "0x"), "0X")
	}
	return "0x" + trimmed
}

func mapPoolMode(value uint8) string {
	if value == 1 {
		return "Loop"
	}
	return "OneTime"
}
