package bindings

import (
	"context"
	"errors"
	"fmt"
	"math/big"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

type Core struct {
	address  common.Address
	abi      gethabi.ABI
	contract *bind.BoundContract
}

func NewCore(address common.Address, parsedABI gethabi.ABI, backend bind.ContractBackend) *Core {
	return &Core{
		address:  address,
		abi:      parsedABI,
		contract: bind.NewBoundContract(address, parsedABI, backend, backend, backend),
	}
}

func (c *Core) Address() common.Address {
	return c.address
}

func (c *Core) call(ctx context.Context, method string, params ...interface{}) ([]interface{}, error) {
	var out []interface{}
	err := c.contract.Call(&bind.CallOpts{Context: ctx}, &out, method, params...)
	return out, err
}

func (c *Core) PoolConfig(ctx context.Context, poolID uint64) (PoolConfig, error) {
	out, err := c.call(ctx, "poolConfigs", newBig(poolID))
	if err != nil {
		return PoolConfig{}, err
	}
	return decodePoolConfig(out)
}

func (c *Core) PoolState(ctx context.Context, poolID uint64) (PoolState, error) {
	out, err := c.call(ctx, "poolStates", newBig(poolID))
	if err != nil {
		return PoolState{}, err
	}
	return decodePoolState(out)
}

func (c *Core) PoolAccounting(ctx context.Context, poolID uint64) (PoolAccounting, error) {
	out, err := c.call(ctx, "poolAccounting", newBig(poolID))
	if err != nil {
		return PoolAccounting{}, err
	}
	return decodePoolAccounting(out)
}

func (c *Core) RoundState(ctx context.Context, poolID uint64, roundID uint64) (RoundState, error) {
	out, err := c.call(ctx, "roundStates", newBig(poolID), newBig(roundID))
	if err != nil {
		return RoundState{}, err
	}
	return decodeRoundState(out)
}

func (c *Core) Ticket(ctx context.Context, ticketID uint64) (TicketData, error) {
	out, err := c.call(ctx, "tickets", newBig(ticketID))
	if err != nil {
		return TicketData{}, err
	}
	return decodeTicketData(out)
}

func (c *Core) ClaimableCreatorProfit(ctx context.Context, poolID uint64) (*big.Int, error) {
	out, err := c.call(ctx, "claimableCreatorProfit", newBig(poolID))
	if err != nil {
		return nil, err
	}
	converted, ok := gethabi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	if !ok || converted == nil || *converted == nil {
		return nil, errors.New("unexpected claimableCreatorProfit return type")
	}
	return *converted, nil
}

func (c *Core) TicketRevealState(ctx context.Context, ticketID uint64) (uint8, bool, error) {
	out, err := c.call(ctx, "getTicketRevealState", newBig(ticketID))
	if err != nil {
		return 0, false, err
	}

	status := *gethabi.ConvertType(out[0], new(uint8)).(*uint8)
	revealAuthorized := *gethabi.ConvertType(out[1], new(bool)).(*bool)
	return status, revealAuthorized, nil
}

func (c *Core) TicketPrizeHandle(ctx context.Context, ticketID uint64) ([32]byte, error) {
	out, err := c.call(ctx, "getTicketPrizeHandle", newBig(ticketID))
	if err != nil {
		return [32]byte{}, err
	}
	return *gethabi.ConvertType(out[0], new([32]byte)).(*[32]byte), nil
}

func (c *Core) EncryptPrizes(opts *bind.TransactOpts, poolID uint64, roundID uint32, startIndex uint32, endIndex uint32) (*types.Transaction, error) {
	return c.contract.Transact(opts, "encryptPrizes", newBig(poolID), roundID, startIndex, endIndex)
}

func newBig(value uint64) *big.Int {
	return new(big.Int).SetUint64(value)
}

func decodePoolConfig(out []interface{}) (PoolConfig, error) {
	if err := requireOutputLen("poolConfigs", out, 13); err != nil {
		return PoolConfig{}, err
	}

	mode, err := abiOutput[uint8](out, 0)
	if err != nil {
		return PoolConfig{}, err
	}
	creator, err := abiOutput[common.Address](out, 1)
	if err != nil {
		return PoolConfig{}, err
	}
	protocolOwned, err := abiOutput[bool](out, 2)
	if err != nil {
		return PoolConfig{}, err
	}
	poolInstanceGroupSize, err := abiOutput[uint32](out, 3)
	if err != nil {
		return PoolConfig{}, err
	}
	ticketPrice, err := abiOutput[uint64](out, 4)
	if err != nil {
		return PoolConfig{}, err
	}
	totalTicketsPerRound, err := abiOutput[uint32](out, 5)
	if err != nil {
		return PoolConfig{}, err
	}
	totalPrizeBudget, err := abiOutput[uint64](out, 6)
	if err != nil {
		return PoolConfig{}, err
	}
	feeBps, err := abiOutput[uint16](out, 7)
	if err != nil {
		return PoolConfig{}, err
	}
	targetRtpBps, err := abiOutput[uint16](out, 8)
	if err != nil {
		return PoolConfig{}, err
	}
	hitRateBps, err := abiOutput[uint16](out, 9)
	if err != nil {
		return PoolConfig{}, err
	}
	maxPrize, err := abiOutput[uint64](out, 10)
	if err != nil {
		return PoolConfig{}, err
	}
	themeID, err := abiOutput[[32]byte](out, 11)
	if err != nil {
		return PoolConfig{}, err
	}
	selectable, err := abiOutput[bool](out, 12)
	if err != nil {
		return PoolConfig{}, err
	}

	return PoolConfig{
		Mode:                  mode,
		Creator:               creator,
		ProtocolOwned:         protocolOwned,
		PoolInstanceGroupSize: poolInstanceGroupSize,
		TicketPrice:           ticketPrice,
		TotalTicketsPerRound:  totalTicketsPerRound,
		TotalPrizeBudget:      totalPrizeBudget,
		FeeBps:                feeBps,
		TargetRtpBps:          targetRtpBps,
		HitRateBps:            hitRateBps,
		MaxPrize:              maxPrize,
		ThemeID:               themeID,
		Selectable:            selectable,
	}, nil
}

func decodePoolState(out []interface{}) (PoolState, error) {
	if err := requireOutputLen("poolStates", out, 7); err != nil {
		return PoolState{}, err
	}

	status, err := abiOutput[uint8](out, 0)
	if err != nil {
		return PoolState{}, err
	}
	currentRound, err := abiOutput[uint32](out, 1)
	if err != nil {
		return PoolState{}, err
	}
	closeRequested, err := abiOutput[bool](out, 2)
	if err != nil {
		return PoolState{}, err
	}
	vrfPending, err := abiOutput[bool](out, 3)
	if err != nil {
		return PoolState{}, err
	}
	initialized, err := abiOutput[bool](out, 4)
	if err != nil {
		return PoolState{}, err
	}
	encrypted, err := abiOutput[bool](out, 5)
	if err != nil {
		return PoolState{}, err
	}
	paused, err := abiOutput[bool](out, 6)
	if err != nil {
		return PoolState{}, err
	}

	return PoolState{
		Status:         status,
		CurrentRound:   currentRound,
		CloseRequested: closeRequested,
		VrfPending:     vrfPending,
		Initialized:    initialized,
		Encrypted:      encrypted,
		Paused:         paused,
	}, nil
}

func decodePoolAccounting(out []interface{}) (PoolAccounting, error) {
	if err := requireOutputLen("poolAccounting", out, 8); err != nil {
		return PoolAccounting{}, err
	}

	lockedBond, err := abiOutput[uint64](out, 0)
	if err != nil {
		return PoolAccounting{}, err
	}
	reservedPrizeBudget, err := abiOutput[uint64](out, 1)
	if err != nil {
		return PoolAccounting{}, err
	}
	lockedNextRoundBudget, err := abiOutput[uint64](out, 2)
	if err != nil {
		return PoolAccounting{}, err
	}
	realizedRevenue, err := abiOutput[uint64](out, 3)
	if err != nil {
		return PoolAccounting{}, err
	}
	settledPrizeCost, err := abiOutput[uint64](out, 4)
	if err != nil {
		return PoolAccounting{}, err
	}
	settledProtocolCost, err := abiOutput[uint64](out, 5)
	if err != nil {
		return PoolAccounting{}, err
	}
	accruedPlatformFee, err := abiOutput[uint64](out, 6)
	if err != nil {
		return PoolAccounting{}, err
	}
	creatorProfitClaimed, err := abiOutput[uint64](out, 7)
	if err != nil {
		return PoolAccounting{}, err
	}

	return PoolAccounting{
		LockedBond:            lockedBond,
		ReservedPrizeBudget:   reservedPrizeBudget,
		LockedNextRoundBudget: lockedNextRoundBudget,
		RealizedRevenue:       realizedRevenue,
		SettledPrizeCost:      settledPrizeCost,
		SettledProtocolCost:   settledProtocolCost,
		AccruedPlatformFee:    accruedPlatformFee,
		CreatorProfitClaimed:  creatorProfitClaimed,
	}, nil
}

func decodeRoundState(out []interface{}) (RoundState, error) {
	if err := requireOutputLen("roundStates", out, 11); err != nil {
		return RoundState{}, err
	}

	status, err := abiOutput[uint8](out, 0)
	if err != nil {
		return RoundState{}, err
	}
	soldCount, err := abiOutput[uint32](out, 1)
	if err != nil {
		return RoundState{}, err
	}
	claimedCount, err := abiOutput[uint32](out, 2)
	if err != nil {
		return RoundState{}, err
	}
	scratchedCount, err := abiOutput[uint32](out, 3)
	if err != nil {
		return RoundState{}, err
	}
	winClaimableCount, err := abiOutput[uint32](out, 4)
	if err != nil {
		return RoundState{}, err
	}
	totalTickets, err := abiOutput[uint32](out, 5)
	if err != nil {
		return RoundState{}, err
	}
	encryptedCount, err := abiOutput[uint32](out, 6)
	if err != nil {
		return RoundState{}, err
	}
	ticketPrice, err := abiOutput[uint64](out, 7)
	if err != nil {
		return RoundState{}, err
	}
	roundPrizeBudget, err := abiOutput[uint64](out, 8)
	if err != nil {
		return RoundState{}, err
	}
	vrfRequestRef, err := abiOutput[[32]byte](out, 9)
	if err != nil {
		return RoundState{}, err
	}
	shuffleRoot, err := abiOutput[[32]byte](out, 10)
	if err != nil {
		return RoundState{}, err
	}

	return RoundState{
		Status:            status,
		SoldCount:         soldCount,
		ClaimedCount:      claimedCount,
		ScratchedCount:    scratchedCount,
		WinClaimableCount: winClaimableCount,
		TotalTickets:      totalTickets,
		EncryptedCount:    encryptedCount,
		TicketPrice:       ticketPrice,
		RoundPrizeBudget:  roundPrizeBudget,
		VrfRequestRef:     vrfRequestRef,
		ShuffleRoot:       shuffleRoot,
	}, nil
}

func decodeTicketData(out []interface{}) (TicketData, error) {
	if err := requireOutputLen("tickets", out, 5); err != nil {
		return TicketData{}, err
	}

	poolID, err := abiOutput[uint64](out, 0)
	if err != nil {
		return TicketData{}, err
	}
	roundID, err := abiOutput[uint64](out, 1)
	if err != nil {
		return TicketData{}, err
	}
	ticketIndex, err := abiOutput[uint32](out, 2)
	if err != nil {
		return TicketData{}, err
	}
	status, err := abiOutput[uint8](out, 3)
	if err != nil {
		return TicketData{}, err
	}
	transferredBeforeScratch, err := abiOutput[bool](out, 4)
	if err != nil {
		return TicketData{}, err
	}

	return TicketData{
		PoolID:                   poolID,
		RoundID:                  roundID,
		TicketIndex:              ticketIndex,
		Status:                   status,
		TransferredBeforeScratch: transferredBeforeScratch,
	}, nil
}

func requireOutputLen(method string, out []interface{}, want int) error {
	if len(out) != want {
		return fmt.Errorf("unexpected %s output length: got %d want %d", method, len(out), want)
	}
	return nil
}

func abiOutput[T any](out []interface{}, index int) (value T, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("unexpected ABI output at index %d: %v", index, recovered)
		}
	}()

	converted, ok := gethabi.ConvertType(out[index], new(T)).(*T)
	if !ok || converted == nil {
		return value, fmt.Errorf("unexpected ABI output at index %d", index)
	}
	return *converted, nil
}
