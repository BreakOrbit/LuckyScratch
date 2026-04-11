package gasless

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
	"time"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	gethmath "github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/apperrors"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/chain"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/contracts/bindings"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/models"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/risk"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

type Action uint8

const (
	ActionPurchase Action = iota
	ActionPurchaseSelection
	ActionScratch
	ActionBatchScratch
)

var (
	abiUint8, _        = gethabi.NewType("uint8", "", nil)
	abiUint32, _       = gethabi.NewType("uint32", "", nil)
	abiUint32Slice, _  = gethabi.NewType("uint32[]", "", nil)
	abiUint256, _      = gethabi.NewType("uint256", "", nil)
	abiUint256Slice, _ = gethabi.NewType("uint256[]", "", nil)
)

type FlexibleUint64 uint64

type SignedRequest struct {
	User           string         `json:"user"`
	Action         Action         `json:"action"`
	TargetContract string         `json:"targetContract"`
	ParamsHash     string         `json:"paramsHash"`
	Nonce          FlexibleUint64 `json:"nonce"`
	Deadline       FlexibleUint64 `json:"deadline"`
	ChainID        FlexibleUint64 `json:"chainId"`
}

type PurchaseRequest struct {
	Request   SignedRequest  `json:"request"`
	Signature string         `json:"signature"`
	PoolID    FlexibleUint64 `json:"poolId"`
	Quantity  uint32         `json:"quantity"`
}

type PurchaseSelectionRequest struct {
	Request       SignedRequest  `json:"request"`
	Signature     string         `json:"signature"`
	PoolID        FlexibleUint64 `json:"poolId"`
	TicketIndexes []uint32       `json:"ticketIndexes"`
}

type ScratchRequest struct {
	Request   SignedRequest  `json:"request"`
	Signature string         `json:"signature"`
	TicketID  FlexibleUint64 `json:"ticketId"`
}

type BatchScratchRequest struct {
	Request   SignedRequest    `json:"request"`
	Signature string           `json:"signature"`
	TicketIDs []FlexibleUint64 `json:"ticketIds"`
}

type NonceResponse struct {
	Address string `json:"address"`
	Nonce   string `json:"nonce"`
	Source  string `json:"source"`
}

type RequestStatusResponse struct {
	Digest        string `json:"digest"`
	Status        string `json:"status"`
	TxHash        string `json:"txHash,omitempty"`
	FailureCode   string `json:"failureCode,omitempty"`
	FailureReason string `json:"failureReason,omitempty"`
}

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

func (s Service) Nonce(ctx context.Context, address string) (NonceResponse, error) {
	user, err := parseAddress(address)
	if err != nil {
		return NonceResponse{}, apperrors.BadRequest(err.Error(), err)
	}

	nonce, err := s.chain.Nonce(ctx, user)
	if err != nil {
		return NonceResponse{}, err
	}

	return NonceResponse{
		Address: user.Hex(),
		Nonce:   nonce.String(),
		Source:  "onchain",
	}, nil
}

func (s Service) SubmitPurchase(ctx context.Context, req PurchaseRequest) (RequestStatusResponse, error) {
	poolID := uint64(req.PoolID)
	if req.Quantity == 0 {
		return RequestStatusResponse{}, newValidationError("quantity must be greater than zero")
	}
	if req.Quantity > uint32(s.cfg.Relayer.MaxBatchTickets) {
		return RequestStatusResponse{}, newValidationError("quantity exceeds relayer batch limit")
	}

	state, err := s.submit(ctx, submitInput{
		ExpectedAction: ActionPurchase,
		Request:        req.Request,
		Signature:      req.Signature,
		PoolID:         poolID,
		Quantity:       req.Quantity,
	})
	if err != nil {
		return RequestStatusResponse{}, mapSubmitError(err)
	}
	return state, nil
}

func (s Service) SubmitPurchaseSelection(ctx context.Context, req PurchaseSelectionRequest) (RequestStatusResponse, error) {
	poolID := uint64(req.PoolID)
	if len(req.TicketIndexes) == 0 {
		return RequestStatusResponse{}, newValidationError("ticketIndexes is required")
	}
	if len(req.TicketIndexes) > s.cfg.Relayer.MaxBatchTickets {
		return RequestStatusResponse{}, newValidationError("ticketIndexes exceeds relayer batch limit")
	}
	if hasDuplicateTicketIndexes(req.TicketIndexes) {
		return RequestStatusResponse{}, newValidationError("ticketIndexes contains duplicates")
	}

	state, err := s.submit(ctx, submitInput{
		ExpectedAction: ActionPurchaseSelection,
		Request:        req.Request,
		Signature:      req.Signature,
		PoolID:         poolID,
		TicketIndexes:  req.TicketIndexes,
	})
	if err != nil {
		return RequestStatusResponse{}, mapSubmitError(err)
	}
	return state, nil
}

func (s Service) SubmitScratch(ctx context.Context, req ScratchRequest) (RequestStatusResponse, error) {
	ticketID := uint64(req.TicketID)
	state, err := s.submit(ctx, submitInput{
		ExpectedAction: ActionScratch,
		Request:        req.Request,
		Signature:      req.Signature,
		TicketID:       ticketID,
	})
	if err != nil {
		return RequestStatusResponse{}, mapSubmitError(err)
	}
	return state, nil
}

func (s Service) SubmitBatchScratch(ctx context.Context, req BatchScratchRequest) (RequestStatusResponse, error) {
	if len(req.TicketIDs) == 0 {
		return RequestStatusResponse{}, newValidationError("ticketIds is required")
	}
	if len(req.TicketIDs) > s.cfg.Relayer.MaxBatchTickets {
		return RequestStatusResponse{}, newValidationError("ticketIds exceeds relayer batch limit")
	}

	ticketIDs := make([]uint64, 0, len(req.TicketIDs))
	for _, id := range req.TicketIDs {
		ticketIDs = append(ticketIDs, uint64(id))
	}

	state, err := s.submit(ctx, submitInput{
		ExpectedAction: ActionBatchScratch,
		Request:        req.Request,
		Signature:      req.Signature,
		TicketIDs:      ticketIDs,
	})
	if err != nil {
		return RequestStatusResponse{}, mapSubmitError(err)
	}
	return state, nil
}

func (s Service) GetRequest(ctx context.Context, digest string) (RequestStatusResponse, error) {
	record, err := s.queries.GetGaslessRequestByDigest(ctx, normalizeHex(digest))
	if err != nil {
		return RequestStatusResponse{}, err
	}
	return mapRequestStatus(record), nil
}

func (s Service) SyncReceipts(ctx context.Context) error {
	requests, err := s.queries.ListGaslessRequestsByStatuses(ctx, db.ListGaslessRequestsByStatusesParams{
		ChainID: s.cfg.Chain.ID,
		Column2: []string{models.GaslessStatusSubmitted, models.GaslessStatusConfirmed},
		Limit:   int32(s.cfg.Relayer.ReceiptSyncBatchSize),
	})
	if err != nil {
		return err
	}

	head, err := s.chain.BlockNumber(ctx)
	if err != nil {
		return err
	}

	for _, request := range requests {
		if request.TxHash == "" {
			continue
		}

		receipt, err := s.chain.TransactionReceipt(ctx, common.HexToHash(request.TxHash))
		if err != nil {
			if isReceiptPending(err) {
				tx, pending, txErr := s.chain.TransactionByHash(ctx, common.HexToHash(request.TxHash))
				if txErr == nil && tx != nil {
					if pending {
						continue
					}
					continue
				}
				if txErr != nil && !isNotFoundError(txErr) {
					return txErr
				}
				if request.SubmittedAt.Valid && time.Since(request.SubmittedAt.Time) > 2*s.cfg.Relayer.RetryBackoff {
					_, _ = s.queries.MarkGaslessRequestResult(ctx, db.MarkGaslessRequestResultParams{
						Digest:               request.Digest,
						Status:               models.GaslessStatusDropped,
						FailureCode:          "tx_not_found",
						FailureReason:        "transaction not found by hash before retry threshold",
						GasUsed:              store.NullInt8(),
						EffectiveGasPriceWei: store.NullInt8(),
						GasCostWei:           store.NullInt8(),
						ReceiptBlockNumber:   store.NullInt8(),
						ReceiptBlockHash:     "",
					})
				}
				continue
			}
			return err
		}

		gasUsed := clampUint64ToInt64(receipt.GasUsed)
		gasPrice := bigIntToPg(receipt.EffectiveGasPrice)
		totalCost := receipt.EffectiveGasPrice
		if totalCost == nil {
			totalCost = big.NewInt(0)
		} else {
			totalCost = new(big.Int).Mul(totalCost, new(big.Int).SetUint64(receipt.GasUsed))
		}

		status := models.GaslessStatusConfirmed
		failureCode := ""
		failureReason := ""
		if receipt.Status != types.ReceiptStatusSuccessful {
			status = models.GaslessStatusFailed
			failureCode = "execution_reverted"
			failureReason = "transaction reverted onchain"
		} else if receipt.BlockNumber != nil && head >= receipt.BlockNumber.Uint64()+s.cfg.Chain.FinalizationDepth {
			status = models.GaslessStatusFinalized
		}

		updated, err := s.queries.MarkGaslessRequestResult(ctx, db.MarkGaslessRequestResultParams{
			Digest:               request.Digest,
			Status:               status,
			FailureCode:          failureCode,
			FailureReason:        failureReason,
			GasUsed:              store.Int8(gasUsed),
			EffectiveGasPriceWei: gasPrice,
			GasCostWei:           bigIntToPg(totalCost),
			ReceiptBlockNumber:   bigIntToPg(receipt.BlockNumber),
			ReceiptBlockHash:     receipt.BlockHash.Hex(),
		})
		if err != nil {
			return err
		}

		if receipt.Status == types.ReceiptStatusSuccessful && updated.PoolID.Valid {
			metadata, _ := json.Marshal(map[string]any{
				"digest":  request.Digest,
				"txHash":  request.TxHash,
				"gasUsed": gasUsed,
			})
			_, _ = s.queries.InsertPoolCostLedger(ctx, db.InsertPoolCostLedgerParams{
				ChainID:  s.cfg.Chain.ID,
				PoolID:   updated.PoolID.Int64,
				RoundID:  updated.RoundID,
				CostType: "SPONSOR_GAS",
				Amount:   clampBigIntToInt64(totalCost),
				TxHash:   updated.TxHash,
				RefType:  "gasless_request",
				RefID:    updated.Digest,
				Metadata: metadata,
			})
		}
	}

	return nil
}

func (s Service) RetryFailed(ctx context.Context) error {
	requests, err := s.queries.ListGaslessRequestsByStatuses(ctx, db.ListGaslessRequestsByStatusesParams{
		ChainID: s.cfg.Chain.ID,
		Column2: []string{models.GaslessStatusDropped},
		Limit:   int32(s.cfg.Relayer.ReceiptSyncBatchSize),
	})
	if err != nil {
		return err
	}

	for _, request := range requests {
		var input submitInput
		if err := json.Unmarshal(request.RequestPayload, &input); err != nil {
			continue
		}
		input.ForceRebroadcast = true
		if _, err := s.submit(ctx, input); err != nil {
			_, _ = s.queries.MarkGaslessRequestResult(ctx, db.MarkGaslessRequestResultParams{
				Digest:               request.Digest,
				Status:               models.GaslessStatusFailed,
				FailureCode:          "retry_failed",
				FailureReason:        err.Error(),
				GasUsed:              store.NullInt8(),
				EffectiveGasPriceWei: store.NullInt8(),
				GasCostWei:           store.NullInt8(),
				ReceiptBlockNumber:   store.NullInt8(),
				ReceiptBlockHash:     "",
			})
		}
	}

	return nil
}

type submitInput struct {
	ExpectedAction   Action
	Request          SignedRequest
	Signature        string
	PoolID           uint64
	Quantity         uint32
	TicketIndexes    []uint32
	TicketID         uint64
	TicketIDs        []uint64
	ForceRebroadcast bool
}

func (s Service) submit(ctx context.Context, input submitInput) (RequestStatusResponse, error) {
	bindingReq, digestHex, signatureBytes, rawPayload, poolID, roundID, ticketID, err := s.prepareRequest(ctx, input)
	if err != nil {
		return RequestStatusResponse{}, err
	}

	existing, existingErr := s.queries.GetGaslessRequestByDigest(ctx, digestHex)
	if existingErr == nil && !input.ForceRebroadcast {
		return mapRequestStatus(existing), nil
	}
	if existingErr != nil && !errors.Is(existingErr, pgx.ErrNoRows) {
		return RequestStatusResponse{}, existingErr
	}

	record, err := s.queries.InsertGaslessRequest(ctx, db.InsertGaslessRequestParams{
		ChainID:        s.cfg.Chain.ID,
		Digest:         digestHex,
		UserAddress:    bindingReq.User.Hex(),
		Action:         input.ExpectedAction.String(),
		TargetContract: bindingReq.TargetContract.Hex(),
		ParamsHash:     input.Request.ParamsHash,
		Nonce:          clampUint64ToInt64(uint64(input.Request.Nonce)),
		Deadline:       clampUint64ToInt64(uint64(input.Request.Deadline)),
		Status:         models.GaslessStatusCreated,
		PoolID:         maybeInt8(poolID),
		RoundID:        maybeInt8(roundID),
		TicketID:       maybeInt8(ticketID),
		RequestPayload: rawPayload,
		Signature:      input.Signature,
	})
	if err != nil {
		return RequestStatusResponse{}, err
	}

	if _, err := s.queries.MarkGaslessRequestValidated(ctx, digestHex); err != nil {
		return RequestStatusResponse{}, err
	}

	txHash := ""
	var tx *types.Transaction
	switch input.ExpectedAction {
	case ActionPurchase:
		tx, _, err = s.chain.BuildGaslessPurchaseTx(ctx, bindingReq, signatureBytes, input.PoolID, input.Quantity)
		if err != nil {
			return s.failRequest(ctx, digestHex, "broadcast_error", err.Error())
		}
	case ActionPurchaseSelection:
		tx, _, err = s.chain.BuildGaslessPurchaseSelectionTx(ctx, bindingReq, signatureBytes, input.PoolID, input.TicketIndexes)
		if err != nil {
			return s.failRequest(ctx, digestHex, "broadcast_error", err.Error())
		}
	case ActionScratch:
		tx, _, err = s.chain.BuildGaslessScratchTx(ctx, bindingReq, signatureBytes, input.TicketID)
		if err != nil {
			return s.failRequest(ctx, digestHex, "broadcast_error", err.Error())
		}
	case ActionBatchScratch:
		tx, _, err = s.chain.BuildGaslessBatchScratchTx(ctx, bindingReq, signatureBytes, input.TicketIDs)
		if err != nil {
			return s.failRequest(ctx, digestHex, "broadcast_error", err.Error())
		}
	default:
		return RequestStatusResponse{}, fmt.Errorf("unsupported action %s", input.ExpectedAction)
	}
	txHash = tx.Hash().Hex()

	record, err = s.markRequestSubmitted(ctx, digestHex, txHash)
	if err != nil {
		return RequestStatusResponse{}, err
	}

	sendCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := s.chain.SendTransaction(sendCtx, tx); err != nil {
		return mapRequestStatus(record), nil
	}

	return mapRequestStatus(record), nil
}

func (s Service) prepareRequest(ctx context.Context, input submitInput) (bindings.GaslessRequest, string, []byte, []byte, int64, int64, int64, error) {
	if input.Request.Action != input.ExpectedAction {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, fmt.Errorf("request action %s does not match endpoint %s", input.Request.Action, input.ExpectedAction)
	}

	user, err := parseAddress(input.Request.User)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	target, err := parseAddress(input.Request.TargetContract)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if target != s.chain.CoreAddress() {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("targetContract does not match LuckyScratchCore")
	}
	nonceValue, err := signedFlexibleUint64(input.Request.Nonce, "nonce")
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	deadlineValue, err := signedFlexibleUint64(input.Request.Deadline, "deadline")
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	chainIDValue, err := signedFlexibleUint64(input.Request.ChainID, "chainId")
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if chainIDValue != s.cfg.Chain.ID {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("request chainId does not match backend chain")
	}
	if time.Now().Unix() > deadlineValue {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("request deadline has expired")
	}

	paramsHash, err := parseBytes32(input.Request.ParamsHash)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	expectedParamsHash, err := s.expectedParamsHash(input)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if paramsHash != expectedParamsHash {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("paramsHash mismatch")
	}

	nonce, err := s.chain.Nonce(ctx, user)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if nonce.Uint64() != uint64(nonceValue) {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("request nonce does not match onchain nonce")
	}

	scopedRoundID, ticketRef, err := s.deriveActionScope(ctx, &input)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if err := s.validateActionState(ctx, input, user); err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	bindingReq := bindings.GaslessRequest{
		User:           user,
		Action:         uint8(input.ExpectedAction),
		TargetContract: target,
		ParamsHash:     paramsHash,
		Nonce:          new(big.Int).SetUint64(uint64(input.Request.Nonce)),
		Deadline:       new(big.Int).SetUint64(uint64(input.Request.Deadline)),
		ChainID:        new(big.Int).SetUint64(uint64(input.Request.ChainID)),
	}

	digestBytes, digestHex, err := typedDataDigest(s.cfg.Chain.ID, target, bindingReq)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	signatureBytes, err := parseSignature(input.Signature)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	recovered, err := recoverSigner(digestBytes, signatureBytes)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if recovered != user {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, errors.New("signature does not match request.user")
	}

	relayerAddress, err := s.chain.RelayerAddress()
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	estimatedGasCostWei, roundID, ticketRef, err := s.estimateAndScope(ctx, input, relayerAddress, bindingReq, signatureBytes)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}
	if scopedRoundID > 0 {
		roundID = scopedRoundID
	}

	if err := s.riskService.CheckGasless(ctx, risk.CheckInput{
		UserAddress:         user.Hex(),
		PoolID:              input.PoolID,
		EstimatedGasCostWei: estimatedGasCostWei,
	}); err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	rawPayload, err := json.Marshal(input)
	if err != nil {
		return bindings.GaslessRequest{}, "", nil, nil, 0, 0, 0, err
	}

	return bindingReq, normalizeHex(digestHex), signatureBytes, rawPayload, clampUint64ToInt64(input.PoolID), roundID, ticketRef, nil
}

func (s Service) validateActionState(ctx context.Context, input submitInput, user common.Address) error {
	switch input.ExpectedAction {
	case ActionPurchase, ActionPurchaseSelection:
		poolState, err := s.chain.PoolState(ctx, input.PoolID)
		if err != nil {
			return err
		}
		if poolState.Paused {
			return errors.New("pool is paused")
		}

		roundState, err := s.chain.RoundState(ctx, input.PoolID, uint64(poolState.CurrentRound))
		if err != nil {
			return err
		}
		if models.RoundStatusName(roundState.Status) != models.RoundStatusReady {
			return errors.New("pool current round is not ready")
		}
		if err := s.validateTreasuryApproval(ctx, user, input, roundState.TicketPrice); err != nil {
			return err
		}
	case ActionScratch:
		return s.validateScratchTicket(ctx, input.TicketID, user)
	case ActionBatchScratch:
		for _, ticketID := range input.TicketIDs {
			if err := s.validateScratchTicket(ctx, ticketID, user); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s Service) validateTreasuryApproval(ctx context.Context, user common.Address, input submitInput, ticketPrice uint64) error {
	quantity := uint64(input.Quantity)
	if input.ExpectedAction == ActionPurchaseSelection {
		quantity = uint64(len(input.TicketIndexes))
	}
	if quantity == 0 || ticketPrice == 0 {
		return nil
	}

	required := new(big.Int).Mul(new(big.Int).SetUint64(ticketPrice), new(big.Int).SetUint64(quantity))
	token, err := s.chain.TreasuryToken(ctx)
	if err != nil {
		return err
	}
	allowance, err := s.chain.ERC20Allowance(ctx, token, user, s.chain.TreasuryAddress())
	if err != nil {
		return err
	}
	if allowance.Cmp(required) < 0 {
		return errors.New("ticket payment allowance to treasury is insufficient")
	}
	return nil
}

func (s Service) validateScratchTicket(ctx context.Context, ticketID uint64, user common.Address) error {
	owner, err := s.chain.OwnerOf(ctx, ticketID)
	if err != nil {
		return err
	}
	if owner != user {
		return fmt.Errorf("ticket %d is not owned by request.user", ticketID)
	}

	status, _, err := s.chain.TicketRevealState(ctx, ticketID)
	if err != nil {
		return err
	}
	if models.TicketStatusName(status) != models.TicketStatusUnscratched {
		return fmt.Errorf("ticket %d is not unscratched", ticketID)
	}
	return nil
}

func (s Service) expectedParamsHash(input submitInput) ([32]byte, error) {
	switch input.ExpectedAction {
	case ActionPurchase:
		return keccak256(
			[]gethabi.Argument{{Type: abiUint8}, {Type: abiUint256}, {Type: abiUint32}},
			uint8(input.ExpectedAction),
			new(big.Int).SetUint64(input.PoolID),
			input.Quantity,
		)
	case ActionPurchaseSelection:
		return keccak256(
			[]gethabi.Argument{{Type: abiUint8}, {Type: abiUint256}, {Type: abiUint32Slice}},
			uint8(input.ExpectedAction),
			new(big.Int).SetUint64(input.PoolID),
			input.TicketIndexes,
		)
	case ActionScratch:
		return keccak256(
			[]gethabi.Argument{{Type: abiUint8}, {Type: abiUint256}},
			uint8(input.ExpectedAction),
			new(big.Int).SetUint64(input.TicketID),
		)
	case ActionBatchScratch:
		values := make([]*big.Int, 0, len(input.TicketIDs))
		for _, ticketID := range input.TicketIDs {
			values = append(values, new(big.Int).SetUint64(ticketID))
		}
		return keccak256(
			[]gethabi.Argument{{Type: abiUint8}, {Type: abiUint256Slice}},
			uint8(input.ExpectedAction),
			values,
		)
	default:
		return [32]byte{}, fmt.Errorf("unsupported action %s", input.ExpectedAction)
	}
}

func (s Service) deriveActionScope(ctx context.Context, input *submitInput) (int64, int64, error) {
	switch input.ExpectedAction {
	case ActionScratch:
		ticketData, err := s.chain.TicketData(ctx, input.TicketID)
		if err != nil {
			return 0, 0, err
		}
		input.PoolID = ticketData.PoolID
		return clampUint64ToInt64(ticketData.RoundID), clampUint64ToInt64(input.TicketID), nil
	case ActionBatchScratch:
		if len(input.TicketIDs) == 0 {
			return 0, 0, errors.New("ticketIds is required")
		}

		first, err := s.chain.TicketData(ctx, input.TicketIDs[0])
		if err != nil {
			return 0, 0, err
		}
		input.PoolID = first.PoolID
		roundID := first.RoundID
		for _, ticketID := range input.TicketIDs[1:] {
			ticketData, err := s.chain.TicketData(ctx, ticketID)
			if err != nil {
				return 0, 0, err
			}
			if ticketData.PoolID != input.PoolID {
				return 0, 0, errors.New("gasless batch-scratch must stay within one pool")
			}
			if ticketData.RoundID != roundID {
				return 0, 0, errors.New("gasless batch-scratch must stay within one round")
			}
		}
		return clampUint64ToInt64(roundID), 0, nil
	default:
		return 0, 0, nil
	}
}

func (s Service) estimateAndScope(ctx context.Context, input submitInput, relayer common.Address, bindingReq bindings.GaslessRequest, signature []byte) (int64, int64, int64, error) {
	var (
		totalCost *big.Int
		roundID   int64
		ticketRef int64
		err       error
	)

	switch input.ExpectedAction {
	case ActionPurchase:
		_, totalCost, err = s.chain.EstimateGaslessPurchase(ctx, relayer, bindingReq, signature, input.PoolID, input.Quantity)
		if err == nil {
			poolState, stateErr := s.chain.PoolState(ctx, input.PoolID)
			if stateErr == nil {
				roundID = clampUint64ToInt64(uint64(poolState.CurrentRound))
			}
		}
	case ActionPurchaseSelection:
		_, totalCost, err = s.chain.EstimateGaslessPurchaseSelection(ctx, relayer, bindingReq, signature, input.PoolID, input.TicketIndexes)
		if err == nil {
			poolState, stateErr := s.chain.PoolState(ctx, input.PoolID)
			if stateErr == nil {
				roundID = clampUint64ToInt64(uint64(poolState.CurrentRound))
			}
		}
	case ActionScratch:
		_, totalCost, err = s.chain.EstimateGaslessScratch(ctx, relayer, bindingReq, signature, input.TicketID)
		if err == nil {
			ticketData, stateErr := s.chain.TicketData(ctx, input.TicketID)
			if stateErr == nil {
				roundID = clampUint64ToInt64(ticketData.RoundID)
				ticketRef = clampUint64ToInt64(input.TicketID)
			}
		}
	case ActionBatchScratch:
		_, totalCost, err = s.chain.EstimateGaslessBatchScratch(ctx, relayer, bindingReq, signature, input.TicketIDs)
		if err == nil && len(input.TicketIDs) > 0 {
			ticketData, stateErr := s.chain.TicketData(ctx, input.TicketIDs[0])
			if stateErr == nil {
				roundID = clampUint64ToInt64(ticketData.RoundID)
			}
		}
	}
	if err != nil {
		return 0, 0, 0, err
	}

	if !totalCost.IsInt64() || totalCost.Int64() > math.MaxInt64 {
		return math.MaxInt64, roundID, ticketRef, nil
	}
	return totalCost.Int64(), roundID, ticketRef, nil
}

func (s Service) failRequest(ctx context.Context, digest string, failureCode string, failureReason string) (RequestStatusResponse, error) {
	record, err := s.queries.MarkGaslessRequestResult(ctx, db.MarkGaslessRequestResultParams{
		Digest:               digest,
		Status:               models.GaslessStatusFailed,
		FailureCode:          failureCode,
		FailureReason:        failureReason,
		GasUsed:              store.NullInt8(),
		EffectiveGasPriceWei: store.NullInt8(),
		GasCostWei:           store.NullInt8(),
		ReceiptBlockNumber:   store.NullInt8(),
		ReceiptBlockHash:     "",
	})
	if err != nil {
		return RequestStatusResponse{}, err
	}
	return mapRequestStatus(record), nil
}

func (s Service) markRequestSubmitted(ctx context.Context, digest string, txHash string) (db.GaslessRequest, error) {
	persistCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		record, err := s.queries.MarkGaslessRequestSubmitted(persistCtx, db.MarkGaslessRequestSubmittedParams{
			Digest: digest,
			TxHash: txHash,
		})
		if err == nil {
			return record, nil
		}
		lastErr = err
		select {
		case <-ctx.Done():
			return db.GaslessRequest{}, ctx.Err()
		case <-persistCtx.Done():
			return db.GaslessRequest{}, persistCtx.Err()
		case <-time.After(time.Duration(attempt+1) * 100 * time.Millisecond):
		}
	}
	return db.GaslessRequest{}, lastErr
}

func mapSubmitError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, risk.ErrUserRateLimited):
		return apperrors.TooManyRequests(err.Error(), err)
	case errors.Is(err, risk.ErrUserGaslessBlocked):
		return apperrors.Forbidden(err.Error(), err)
	case errors.Is(err, risk.ErrPoolGaslessPaused),
		errors.Is(err, risk.ErrGlobalBudgetExceeded),
		errors.Is(err, risk.ErrPoolBudgetExceeded),
		errors.Is(err, risk.ErrGasCostTooHigh),
		isStateConflictError(err):
		return apperrors.Conflict(err.Error(), err)
	case isValidationError(err):
		return apperrors.BadRequest(err.Error(), err)
	default:
		return err
	}
}

func newValidationError(message string) error {
	return apperrors.BadRequest(message, errors.New(message))
}

func typedDataDigest(chainID int64, verifyingContract common.Address, request bindings.GaslessRequest) ([]byte, string, error) {
	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": {
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"GaslessRequest": {
				{Name: "user", Type: "address"},
				{Name: "action", Type: "uint8"},
				{Name: "targetContract", Type: "address"},
				{Name: "paramsHash", Type: "bytes32"},
				{Name: "nonce", Type: "uint256"},
				{Name: "deadline", Type: "uint256"},
				{Name: "chainId", Type: "uint256"},
			},
		},
		PrimaryType: "GaslessRequest",
		Domain: apitypes.TypedDataDomain{
			Name:              "LuckyScratch",
			Version:           "1",
			ChainId:           gethmath.NewHexOrDecimal256(chainID),
			VerifyingContract: verifyingContract.Hex(),
		},
		Message: apitypes.TypedDataMessage{
			"user":           request.User.Hex(),
			"action":         gethmath.NewHexOrDecimal256(int64(request.Action)),
			"targetContract": request.TargetContract.Hex(),
			"paramsHash":     "0x" + hex.EncodeToString(request.ParamsHash[:]),
			"nonce":          gethmath.NewHexOrDecimal256(request.Nonce.Int64()),
			"deadline":       gethmath.NewHexOrDecimal256(request.Deadline.Int64()),
			"chainId":        gethmath.NewHexOrDecimal256(request.ChainID.Int64()),
		},
	}

	return apitypes.TypedDataAndHash(typedData)
}

func recoverSigner(digest []byte, signature []byte) (common.Address, error) {
	pubKey, err := crypto.SigToPub(digest, signature)
	if err != nil {
		return common.Address{}, err
	}
	return crypto.PubkeyToAddress(*pubKey), nil
}

func parseSignature(value string) ([]byte, error) {
	signature := common.FromHex(value)
	if len(signature) != crypto.SignatureLength {
		return nil, errors.New("signature must be 65 bytes")
	}
	if signature[64] >= 27 {
		signature[64] -= 27
	}
	return signature, nil
}

func parseAddress(value string) (common.Address, error) {
	if !common.IsHexAddress(value) {
		return common.Address{}, fmt.Errorf("invalid address: %s", value)
	}
	return common.HexToAddress(value), nil
}

func parseBytes32(value string) ([32]byte, error) {
	value = normalizeHex(value)
	raw := common.FromHex(value)
	if len(raw) != 32 {
		return [32]byte{}, errors.New("expected bytes32 hex value")
	}
	var result [32]byte
	copy(result[:], raw)
	return result, nil
}

func keccak256(arguments []gethabi.Argument, values ...interface{}) ([32]byte, error) {
	encoded, err := gethabi.Arguments(arguments).Pack(values...)
	if err != nil {
		return [32]byte{}, err
	}
	return crypto.Keccak256Hash(encoded), nil
}

func hasDuplicateTicketIndexes(indexes []uint32) bool {
	seen := make(map[uint32]struct{}, len(indexes))
	for _, index := range indexes {
		if _, ok := seen[index]; ok {
			return true
		}
		seen[index] = struct{}{}
	}
	return false
}

func mapRequestStatus(record db.GaslessRequest) RequestStatusResponse {
	response := RequestStatusResponse{
		Digest:        record.Digest,
		Status:        record.Status,
		TxHash:        record.TxHash,
		FailureCode:   record.FailureCode,
		FailureReason: record.FailureReason,
	}
	return response
}

func maybeInt8(value int64) pgtype.Int8 {
	if value <= 0 {
		return store.NullInt8()
	}
	return store.Int8(value)
}

func bigIntToPg(value *big.Int) pgtype.Int8 {
	if value == nil {
		return store.NullInt8()
	}
	return store.Int8(clampBigIntToInt64(value))
}

func normalizeHex(value string) string {
	trimmed := strings.TrimSpace(value)
	if strings.HasPrefix(trimmed, "0x") || strings.HasPrefix(trimmed, "0X") {
		return "0x" + strings.TrimPrefix(strings.TrimPrefix(trimmed, "0x"), "0X")
	}
	return "0x" + trimmed
}

func isReceiptPending(err error) bool {
	return isNotFoundError(err)
}

func isNotFoundError(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "not found")
}

func isValidationError(err error) bool {
	if _, ok := apperrors.As(err); ok {
		return true
	}
	if err == nil {
		return false
	}
	message := err.Error()
	for _, candidate := range []string{
		"quantity must be greater than zero",
		"quantity exceeds relayer batch limit",
		"ticketIndexes is required",
		"ticketIndexes exceeds relayer batch limit",
		"ticketIndexes contains duplicates",
		"ticketIds is required",
		"ticketIds exceeds relayer batch limit",
		"request action ",
		"targetContract does not match LuckyScratchCore",
		"request chainId does not match backend chain",
		"request deadline has expired",
		"paramsHash mismatch",
		"request nonce does not match onchain nonce",
		"signature does not match request.user",
		"signature must be 65 bytes",
		"invalid address:",
		"expected bytes32 hex value",
		"exceeds backend BIGINT range",
	} {
		if strings.Contains(message, candidate) {
			return true
		}
	}
	return false
}

func isStateConflictError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	for _, candidate := range []string{
		"pool is paused",
		"pool current round is not ready",
		"ticket payment allowance to treasury is insufficient",
		"is not owned by request.user",
		"is not unscratched",
		"gasless batch-scratch must stay within one pool",
		"gasless batch-scratch must stay within one round",
	} {
		if strings.Contains(message, candidate) {
			return true
		}
	}
	return false
}

func signedFlexibleUint64(value FlexibleUint64, field string) (int64, error) {
	if uint64(value) > math.MaxInt64 {
		return 0, fmt.Errorf("%s exceeds backend BIGINT range", field)
	}
	return int64(value), nil
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

func (a Action) String() string {
	switch a {
	case ActionPurchase:
		return "purchase"
	case ActionPurchaseSelection:
		return "purchase-selection"
	case ActionScratch:
		return "scratch"
	case ActionBatchScratch:
		return "batch-scratch"
	default:
		return fmt.Sprintf("unknown-%d", uint8(a))
	}
}

func (a *Action) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*a = ActionPurchase
		return nil
	}
	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(data, &value); err != nil {
			return err
		}
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "purchase":
			*a = ActionPurchase
		case "purchaseselection", "purchase-selection":
			*a = ActionPurchaseSelection
		case "scratch":
			*a = ActionScratch
		case "batchscratch", "batch-scratch":
			*a = ActionBatchScratch
		default:
			return fmt.Errorf("unsupported action %q", value)
		}
		return nil
	}

	raw, err := strconv.ParseUint(trimmed, 10, 8)
	if err != nil {
		return err
	}
	*a = Action(raw)
	return nil
}

func (v *FlexibleUint64) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*v = 0
		return nil
	}
	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(data, &value); err != nil {
			return err
		}
		parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
		if err != nil {
			return err
		}
		*v = FlexibleUint64(parsed)
		return nil
	}

	parsed, err := strconv.ParseUint(trimmed, 10, 64)
	if err != nil {
		return err
	}
	*v = FlexibleUint64(parsed)
	return nil
}
