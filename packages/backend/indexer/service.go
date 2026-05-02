package indexer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"lucky-scratch/chain"
	"lucky-scratch/config"
	"lucky-scratch/contracts"
	"lucky-scratch/models"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
)

type Service struct {
	cfg          config.Config
	queries      db.Querier
	chain        *chain.Client
	encryptorAuth *bind.TransactOpts
}

const (
	indexerPageSize                  = 500
	roundStatusPendingEncryption    = 1 // matches Solidity RoundStatus.PendingEncryption
)

func NewService(cfg config.Config, queries db.Querier, chainClient *chain.Client) Service {
	s := Service{
		cfg:     cfg,
		queries: queries,
		chain:   chainClient,
	}
	if key := strings.TrimSpace(cfg.Chain.EncryptorKey); key != "" {
		auth, err := chainClient.NewTransactor(key)
		if err != nil {
			log.Printf("WARNING: failed to initialize encryptor transactor: %v", err)
		} else {
			s.encryptorAuth = auth
		}
	}
	return s
}

func (s Service) Sync(ctx context.Context) error {
	startedAt := time.Now()
	for _, contractName := range []string{contracts.CoreContractName, contracts.TicketContractName} {
		if err := s.syncContract(ctx, contractName); err != nil {
			return err
		}
	}
	log.Printf("indexer sync completed in %s", time.Since(startedAt).Round(time.Millisecond))
	return nil
}

// SyncTransaction fetches the receipt for a specific transaction and indexes all
// LuckyScratch events found in it, bypassing the normal periodic polling delay.
func (s Service) SyncTransaction(ctx context.Context, txHash common.Hash) error {
	receipt, err := s.chain.TransactionReceipt(ctx, txHash)
	if err != nil {
		return fmt.Errorf("fetch receipt for %s: %w", txHash.Hex(), err)
	}

	blockTimeCache := make(map[uint64]time.Time)
	for _, contractName := range []string{contracts.CoreContractName, contracts.TicketContractName} {
		deployment, err := s.chain.Registry().Must(contractName)
		if err != nil {
			return err
		}
		topics := supportedEventTopics(deployment)
		topicSet := make(map[common.Hash]struct{}, len(topics))
		for _, t := range topics {
			topicSet[t] = struct{}{}
		}

		for _, logEntry := range receipt.Logs {
			if logEntry.Address != deployment.Address {
				continue
			}
			if len(logEntry.Topics) == 0 {
				continue
			}
			if _, ok := topicSet[logEntry.Topics[0]]; !ok {
				continue
			}

			decoded, decodeErr := s.decodeLog(deployment, *logEntry)
			if decodeErr != nil {
				if errors.Is(decodeErr, errUnsupportedEvent) {
					continue
				}
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
		}
	}

	log.Printf("indexer synced tx %s (%d logs)", txHash.Hex(), len(receipt.Logs))
	return nil
}

func (s Service) Reconcile(ctx context.Context) error {
	startedAt := time.Now()
	var poolCount int
	var roundCount int
	var ticketCount int

	err := s.forEachPool(ctx, func(pool db.Pool) error {
		poolCount += 1
		reconciledRounds, reconciledTickets, err := s.reconcilePool(ctx, uint64(pool.PoolID))
		if err != nil {
			return err
		}
		roundCount += reconciledRounds
		ticketCount += reconciledTickets
		return nil
	})
	if err != nil {
		return err
	}

	log.Printf(
		"indexer state reconciliation completed in %s (pools=%d rounds=%d tickets=%d)",
		time.Since(startedAt).Round(time.Millisecond),
		poolCount,
		roundCount,
		ticketCount,
	)
	return nil
}

func (s Service) CheckPendingVRF(ctx context.Context) error {
	var stalePools []int64
	threshold := time.Now().Add(-2 * s.cfg.Jobs.VRFCheckInterval)
	err := s.forEachPool(ctx, func(pool db.Pool) error {
		round, roundErr := s.queries.GetRound(ctx, db.GetRoundParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  pool.PoolID,
			RoundID: pool.CurrentRound,
		})
		if roundErr != nil {
			return nil
		}
		if round.Status == models.RoundStatusPendingVRF && round.LastVrfRequestedAt.Valid && round.LastVrfRequestedAt.Time.Before(threshold) {
			stalePools = append(stalePools, pool.PoolID)
		}
		return nil
	})
	if err != nil {
		return err
	}

	if len(stalePools) > 0 {
		log.Printf("indexer pending VRF check found stale pools: %v", stalePools)
		return fmt.Errorf("stale pending VRF rounds detected for pools %v", stalePools)
	}
	log.Printf("indexer pending VRF check completed without stale pools")
	return nil
}

func (s Service) CheckPendingEncryption(ctx context.Context) error {
	var pendingPools []int64
	err := s.forEachPool(ctx, func(pool db.Pool) error {
		round, roundErr := s.queries.GetRound(ctx, db.GetRoundParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  pool.PoolID,
			RoundID: pool.CurrentRound,
		})
		if roundErr != nil {
			return nil
		}
		if round.Status == models.RoundStatusPendingEncryption {
			pendingPools = append(pendingPools, pool.PoolID)
		}
		return nil
	})
	if err != nil {
		return err
	}

	if len(pendingPools) > 0 {
		log.Printf("indexer pending encryption check found pools needing encryption: %v", pendingPools)
		return s.EncryptPendingRounds(ctx)
	}
	return nil
}

func (s Service) EncryptPendingRounds(ctx context.Context) error {
	return s.encryptRounds(ctx, 0)
}

func (s Service) EncryptPool(ctx context.Context, poolID uint64) error {
	return s.encryptRounds(ctx, poolID)
}

func (s Service) encryptRounds(ctx context.Context, filterPoolID uint64) error {
	if s.encryptorAuth == nil {
		log.Printf("skipping encryption: ENCRYPTOR_PRIVATE_KEY not configured")
		return nil
	}

	return s.forEachPool(ctx, func(pool db.Pool) error {
		if filterPoolID != 0 && uint64(pool.PoolID) != filterPoolID {
			return nil
		}
		round, roundErr := s.queries.GetRound(ctx, db.GetRoundParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  pool.PoolID,
			RoundID: pool.CurrentRound,
		})
		if roundErr != nil || round.Status != models.RoundStatusPendingEncryption {
			return nil
		}

		roundState, chainErr := s.chain.RoundState(ctx, uint64(pool.PoolID), uint64(pool.CurrentRound))
		if chainErr != nil {
			return fmt.Errorf("read round state pool=%d round=%d: %w", pool.PoolID, pool.CurrentRound, chainErr)
		}
		if roundState.Status != roundStatusPendingEncryption {
			return nil
		}

		txHash, txErr := s.chain.EncryptPrizes(ctx, s.encryptorAuth, uint64(pool.PoolID), uint32(pool.CurrentRound), 0, roundState.TotalTickets)
		if txErr != nil {
			return fmt.Errorf("encryptPrizes pool=%d round=%d: %w", pool.PoolID, pool.CurrentRound, txErr)
		}
		log.Printf("encryptPrizes tx sent: pool=%d round=%d tickets=%d tx=%s", pool.PoolID, pool.CurrentRound, roundState.TotalTickets, txHash.Hex())

		return nil
	})
}

func (s Service) RebuildPool(ctx context.Context, poolID uint64) error {
	roundCount, ticketCount, err := s.reconcilePool(ctx, poolID)
	if err != nil {
		return err
	}
	log.Printf("indexer pool rebuild completed for pool=%d rounds=%d tickets=%d", poolID, roundCount, ticketCount)
	return nil
}

func (s Service) RebuildRound(ctx context.Context, poolID uint64, roundID uint64) error {
	if err := s.syncRound(ctx, poolID, roundID, eventContext{}, nil, nil); err != nil {
		return err
	}
	ticketCount, err := s.syncIndexedTicketsByPoolAndRound(ctx, poolID, roundID)
	if err != nil {
		return err
	}
	log.Printf("indexer round rebuild completed for pool=%d round=%d tickets=%d", poolID, roundID, ticketCount)
	return nil
}

func (s Service) RebuildTicket(ctx context.Context, ticketID uint64) error {
	if err := s.syncTicket(ctx, ticketID, eventContext{}, "", 0); err != nil {
		return err
	}
	log.Printf("indexer ticket rebuild completed for ticket=%d", ticketID)
	return nil
}

func (s Service) forEachPool(ctx context.Context, fn func(pool db.Pool) error) error {
	offset := 0
	for {
		pools, err := s.queries.ListPools(ctx, db.ListPoolsParams{
			ChainID: s.cfg.Chain.ID,
			Limit:   indexerPageSize,
			Offset:  int32(offset),
		})
		if err != nil {
			return err
		}
		if len(pools) == 0 {
			return nil
		}
		for _, pool := range pools {
			if err := fn(pool); err != nil {
				return err
			}
		}
		if len(pools) < indexerPageSize {
			return nil
		}
		offset += len(pools)
	}
}

func (s Service) reconcilePool(ctx context.Context, poolID uint64) (int, int, error) {
	if err := s.syncPool(ctx, poolID, eventContext{}); err != nil {
		return 0, 0, err
	}

	pool, err := s.queries.GetPool(ctx, db.GetPoolParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
	if err != nil {
		return 0, 0, err
	}

	roundCount := 0
	for roundID := int64(1); roundID <= pool.CurrentRound; roundID++ {
		if err := s.syncRound(ctx, poolID, uint64(roundID), eventContext{}, nil, nil); err != nil {
			return roundCount, 0, err
		}
		roundCount += 1
	}

	ticketCount, err := s.syncIndexedTicketsByPool(ctx, poolID)
	if err != nil {
		return roundCount, ticketCount, err
	}
	return roundCount, ticketCount, nil
}

func (s Service) syncIndexedTicketsByPool(ctx context.Context, poolID uint64) (int, error) {
	offset := 0
	synced := 0
	for {
		ticketIDs, err := s.queries.ListTicketIDsByPoolFromIndexedLogs(ctx, db.ListTicketIDsByPoolFromIndexedLogsParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  store.Int8(int64(poolID)),
			Limit:   indexerPageSize,
			Offset:  int32(offset),
		})
		if err != nil {
			return synced, err
		}
		if len(ticketIDs) == 0 {
			return synced, nil
		}
		for _, ticketID := range ticketIDs {
			if !ticketID.Valid || ticketID.Int64 <= 0 {
				continue
			}
			if err := s.syncTicket(ctx, uint64(ticketID.Int64), eventContext{}, "", 0); err != nil {
				return synced, err
			}
			synced += 1
		}
		if len(ticketIDs) < indexerPageSize {
			return synced, nil
		}
		offset += len(ticketIDs)
	}
}

func (s Service) syncIndexedTicketsByPoolAndRound(ctx context.Context, poolID uint64, roundID uint64) (int, error) {
	offset := 0
	synced := 0
	for {
		ticketIDs, err := s.queries.ListTicketIDsByPoolAndRoundFromIndexedLogs(ctx, db.ListTicketIDsByPoolAndRoundFromIndexedLogsParams{
			ChainID: s.cfg.Chain.ID,
			PoolID:  store.Int8(int64(poolID)),
			RoundID: store.Int8(int64(roundID)),
			Limit:   indexerPageSize,
			Offset:  int32(offset),
		})
		if err != nil {
			return synced, err
		}
		if len(ticketIDs) == 0 {
			return synced, nil
		}
		for _, ticketID := range ticketIDs {
			if !ticketID.Valid || ticketID.Int64 <= 0 {
				continue
			}
			if err := s.syncTicket(ctx, uint64(ticketID.Int64), eventContext{}, "", 0); err != nil {
				return synced, err
			}
			synced += 1
		}
		if len(ticketIDs) < indexerPageSize {
			return synced, nil
		}
		offset += len(ticketIDs)
	}
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
	safeHead := finalizedHead(head, s.cfg.Chain.Confirmations, s.cfg.Chain.FinalizationDepth)
	if safeHead == 0 {
		log.Printf(
			"indexer sync skipped for %s: head=%d, confirmations=%d, finalizationDepth=%d",
			contractName,
			head,
			s.cfg.Chain.Confirmations,
			s.cfg.Chain.FinalizationDepth,
		)
		return nil
	}

	startBlock := deployment.DeploymentBlock
	cursor, err := s.queries.GetIndexerCursor(ctx, db.GetIndexerCursorParams{
		ChainID:      s.cfg.Chain.ID,
		ContractName: contractName,
	})
	if err == nil && cursor.LastProcessedBlock > 0 {
		rewind := uint64(cursor.LastProcessedBlock)
		replayDepth := replayWindow(s.cfg.Chain.ReorgLookback, s.cfg.Chain.Confirmations, s.cfg.Chain.FinalizationDepth)
		if rewind > replayDepth {
			startBlock = rewind - replayDepth
		}
	}
	if errors.Is(err, pgx.ErrNoRows) && startBlock > 0 {
		startBlock--
	}

	if safeHead <= startBlock {
		_, upsertErr := s.queries.UpsertIndexerCursor(ctx, db.UpsertIndexerCursorParams{
			ChainID:               s.cfg.Chain.ID,
			ContractName:          contractName,
			LastProcessedBlock:    int64(safeHead),
			LastProcessedLogIndex: 0,
		})
		return upsertErr
	}

	fromBlock := startBlock + 1
	topics := supportedEventTopics(deployment)
	if len(topics) == 0 {
		log.Printf("indexer sync skipped for %s: no supported topics configured", contractName)
		return nil
	}
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
		ToBlock:   big.NewInt(int64(safeHead)),
		Addresses: []common.Address{deployment.Address},
		Topics:    [][]common.Hash{topics},
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
			if errors.Is(decodeErr, errUnsupportedEvent) {
				continue
			}
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
	}

	if err := s.reconcileImpacts(ctx, impacts); err != nil {
		return err
	}

	_, err = s.queries.UpsertIndexerCursor(ctx, db.UpsertIndexerCursorParams{
		ChainID:               s.cfg.Chain.ID,
		ContractName:          contractName,
		LastProcessedBlock:    int64(safeHead),
		LastProcessedLogIndex: 0,
	})
	if err == nil {
		log.Printf(
			"indexer synced %s blocks %d-%d (logs=%d replayedLogs=%d head=%d safeHead=%d)",
			contractName,
			fromBlock,
			safeHead,
			len(logs),
			len(oldLogs),
			head,
			safeHead,
		)
	}
	return err
}

type decodedLog struct {
	Event decodedEvent
}

var errUnsupportedEvent = errors.New("unsupported event")

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
	ClaimAmount  int64
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
	case "PoolRoundShuffled":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
	case "PoolRoundEncryptionProgress":
		result.Event.PoolID = topicUint64(logEntry.Topics[1])
		result.Event.RoundID = topicUint64(logEntry.Topics[2])
		result.Event.Payload["startIndex"] = asUint32(out[0])
		result.Event.Payload["endIndex"] = asUint32(out[1])
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
		if len(out) > 1 {
			result.Event.ClaimAmount = asUint64(out[1])
			result.Event.Payload["clearRewardAmount"] = bigToString(out[1])
		}
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
	case "Transfer":
		result.Event.UserAddress = topicAddress(logEntry.Topics[2]).Hex()
		result.Event.TicketID = topicUint64(logEntry.Topics[3])
		result.Event.Payload["from"] = topicAddress(logEntry.Topics[1]).Hex()
		result.Event.Payload["to"] = topicAddress(logEntry.Topics[2]).Hex()
	default:
		return decodedLog{}, fmt.Errorf("%w %s", errUnsupportedEvent, event.Name)
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
	case "PoolRoundShuffled":
		if err := s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context())); err != nil {
			return err
		}
		return s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil)
	case "PoolRoundEncryptionProgress":
		return s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil)
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
		amount := decoded.Event.ClaimAmount
		if amount == 0 {
			amount, _ = s.extractClaimAmount(ctx, decoded.Event.TxHash, uint64(decoded.Event.TicketID))
		}
		if err := s.syncTicket(ctx, uint64(decoded.Event.TicketID), eventContext(decoded.Event.context()), decoded.Event.UserAddress, amount); err != nil {
			return err
		}
		if err := s.syncRound(ctx, uint64(decoded.Event.PoolID), uint64(decoded.Event.RoundID), eventContext(decoded.Event.context()), nil, nil); err != nil {
			return err
		}
		return s.syncPool(ctx, uint64(decoded.Event.PoolID), eventContext(decoded.Event.context()))
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
	if cache != nil {
		if value, ok := cache[blockNumber]; ok {
			return value, nil
		}
	}
	header, err := s.chain.HeaderByNumber(ctx, new(big.Int).SetUint64(blockNumber))
	if err != nil {
		return time.Time{}, err
	}
	value := time.Unix(int64(header.Time), 0).UTC()
	if cache != nil {
		cache[blockNumber] = value
	}
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

func supportedEventTopics(deployment contracts.Deployment) []common.Hash {
	names := []string{
		"PoolCreated",
		"PoolRoundRequested",
		"PoolRoundInitialized",
		"PoolRoundShuffled",
		"PoolRoundEncryptionProgress",
		"RoundSettled",
		"TicketPurchased",
		"TicketScratched",
		"RewardClaimed",
		"CreatorProfitWithdrawn",
		"BondRefunded",
		"PoolClosed",
		"PoolRolledToNextRound",
	}
	if deployment.Name == contracts.TicketContractName {
		names = []string{"Transfer"}
	}

	topics := make([]common.Hash, 0, len(names))
	for _, name := range names {
		event, ok := deployment.ABI.Events[name]
		if !ok {
			continue
		}
		topics = append(topics, event.ID)
	}
	return topics
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

func replayWindow(reorgLookback uint64, confirmations uint64, finalizationDepth uint64) uint64 {
	window := reorgLookback
	if confirmations > window {
		window = confirmations
	}
	if finalizationDepth > window {
		window = finalizationDepth
	}
	return window
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
