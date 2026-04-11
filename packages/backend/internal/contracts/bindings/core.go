package bindings

import (
	"context"
	"errors"
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

	values := *gethabi.ConvertType(out[0], new(struct {
		Mode                  uint8
		Creator               common.Address
		ProtocolOwned         bool
		PoolInstanceGroupSize uint32
		TicketPrice           uint64
		TotalTicketsPerRound  uint32
		TotalPrizeBudget      uint64
		FeeBps                uint16
		TargetRtpBps          uint16
		HitRateBps            uint16
		MaxPrize              uint64
		ThemeID               [32]byte
		Selectable            bool
	})).(*struct {
		Mode                  uint8
		Creator               common.Address
		ProtocolOwned         bool
		PoolInstanceGroupSize uint32
		TicketPrice           uint64
		TotalTicketsPerRound  uint32
		TotalPrizeBudget      uint64
		FeeBps                uint16
		TargetRtpBps          uint16
		HitRateBps            uint16
		MaxPrize              uint64
		ThemeID               [32]byte
		Selectable            bool
	})

	return PoolConfig(values), nil
}

func (c *Core) PoolState(ctx context.Context, poolID uint64) (PoolState, error) {
	out, err := c.call(ctx, "poolStates", newBig(poolID))
	if err != nil {
		return PoolState{}, err
	}

	values := *gethabi.ConvertType(out[0], new(struct {
		Status         uint8
		CurrentRound   uint32
		CloseRequested bool
		VrfPending     bool
		Initialized    bool
		Paused         bool
	})).(*struct {
		Status         uint8
		CurrentRound   uint32
		CloseRequested bool
		VrfPending     bool
		Initialized    bool
		Paused         bool
	})

	return PoolState(values), nil
}

func (c *Core) PoolAccounting(ctx context.Context, poolID uint64) (PoolAccounting, error) {
	out, err := c.call(ctx, "poolAccounting", newBig(poolID))
	if err != nil {
		return PoolAccounting{}, err
	}

	values := *gethabi.ConvertType(out[0], new(struct {
		LockedBond            uint64
		ReservedPrizeBudget   uint64
		LockedNextRoundBudget uint64
		RealizedRevenue       uint64
		SettledPrizeCost      uint64
		SettledProtocolCost   uint64
		AccruedPlatformFee    uint64
		CreatorProfitClaimed  uint64
	})).(*struct {
		LockedBond            uint64
		ReservedPrizeBudget   uint64
		LockedNextRoundBudget uint64
		RealizedRevenue       uint64
		SettledPrizeCost      uint64
		SettledProtocolCost   uint64
		AccruedPlatformFee    uint64
		CreatorProfitClaimed  uint64
	})

	return PoolAccounting(values), nil
}

func (c *Core) RoundState(ctx context.Context, poolID uint64, roundID uint64) (RoundState, error) {
	out, err := c.call(ctx, "roundStates", newBig(poolID), newBig(roundID))
	if err != nil {
		return RoundState{}, err
	}

	values := *gethabi.ConvertType(out[0], new(struct {
		Status            uint8
		SoldCount         uint32
		ClaimedCount      uint32
		ScratchedCount    uint32
		WinClaimableCount uint32
		TotalTickets      uint32
		TicketPrice       uint64
		RoundPrizeBudget  uint64
		VrfRequestRef     [32]byte
		ShuffleRoot       [32]byte
	})).(*struct {
		Status            uint8
		SoldCount         uint32
		ClaimedCount      uint32
		ScratchedCount    uint32
		WinClaimableCount uint32
		TotalTickets      uint32
		TicketPrice       uint64
		RoundPrizeBudget  uint64
		VrfRequestRef     [32]byte
		ShuffleRoot       [32]byte
	})

	return RoundState(values), nil
}

func (c *Core) Ticket(ctx context.Context, ticketID uint64) (TicketData, error) {
	out, err := c.call(ctx, "tickets", newBig(ticketID))
	if err != nil {
		return TicketData{}, err
	}

	values := *gethabi.ConvertType(out[0], new(struct {
		PoolID                   *big.Int
		RoundID                  *big.Int
		TicketIndex              uint32
		Status                   uint8
		TransferredBeforeScratch bool
	})).(*struct {
		PoolID                   *big.Int
		RoundID                  *big.Int
		TicketIndex              uint32
		Status                   uint8
		TransferredBeforeScratch bool
	})

	return TicketData{
		PoolID:                   values.PoolID.Uint64(),
		RoundID:                  values.RoundID.Uint64(),
		TicketIndex:              values.TicketIndex,
		Status:                   values.Status,
		TransferredBeforeScratch: values.TransferredBeforeScratch,
	}, nil
}

func (c *Core) Nonce(ctx context.Context, user common.Address) (*big.Int, error) {
	out, err := c.call(ctx, "nonces", user)
	if err != nil {
		return nil, err
	}
	converted, ok := gethabi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	if !ok || converted == nil || *converted == nil {
		return nil, errors.New("unexpected nonce return type")
	}
	return *converted, nil
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

func (c *Core) ExecuteGaslessPurchase(opts *bind.TransactOpts, req GaslessRequest, signature []byte, poolID uint64, quantity uint32) (*types.Transaction, error) {
	return c.contract.Transact(opts, "executeGaslessPurchase", req, signature, newBig(poolID), quantity)
}

func (c *Core) PackExecuteGaslessPurchase(req GaslessRequest, signature []byte, poolID uint64, quantity uint32) ([]byte, error) {
	return c.abi.Pack("executeGaslessPurchase", req, signature, newBig(poolID), quantity)
}

func (c *Core) ExecuteGaslessPurchaseSelection(opts *bind.TransactOpts, req GaslessRequest, signature []byte, poolID uint64, indexes []uint32) (*types.Transaction, error) {
	return c.contract.Transact(opts, "executeGaslessPurchaseSelection", req, signature, newBig(poolID), indexes)
}

func (c *Core) PackExecuteGaslessPurchaseSelection(req GaslessRequest, signature []byte, poolID uint64, indexes []uint32) ([]byte, error) {
	return c.abi.Pack("executeGaslessPurchaseSelection", req, signature, newBig(poolID), indexes)
}

func (c *Core) ExecuteGaslessScratch(opts *bind.TransactOpts, req GaslessRequest, signature []byte, ticketID uint64) (*types.Transaction, error) {
	return c.contract.Transact(opts, "executeGaslessScratch", req, signature, newBig(ticketID))
}

func (c *Core) PackExecuteGaslessScratch(req GaslessRequest, signature []byte, ticketID uint64) ([]byte, error) {
	return c.abi.Pack("executeGaslessScratch", req, signature, newBig(ticketID))
}

func (c *Core) ExecuteGaslessBatchScratch(opts *bind.TransactOpts, req GaslessRequest, signature []byte, ticketIDs []*big.Int) (*types.Transaction, error) {
	return c.contract.Transact(opts, "executeGaslessBatchScratch", req, signature, ticketIDs)
}

func (c *Core) PackExecuteGaslessBatchScratch(req GaslessRequest, signature []byte, ticketIDs []*big.Int) ([]byte, error) {
	return c.abi.Pack("executeGaslessBatchScratch", req, signature, ticketIDs)
}

func newBig(value uint64) *big.Int {
	return new(big.Int).SetUint64(value)
}
