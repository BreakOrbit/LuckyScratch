package bindings

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

type GaslessRequest struct {
	User           common.Address
	Action         uint8
	TargetContract common.Address
	ParamsHash     [32]byte
	Nonce          *big.Int
	Deadline       *big.Int
	ChainID        *big.Int
}

type PoolConfig struct {
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
}

type PoolState struct {
	Status         uint8
	CurrentRound   uint32
	CloseRequested bool
	VrfPending     bool
	Initialized    bool
	Paused         bool
}

type PoolAccounting struct {
	LockedBond            uint64
	ReservedPrizeBudget   uint64
	LockedNextRoundBudget uint64
	RealizedRevenue       uint64
	SettledPrizeCost      uint64
	SettledProtocolCost   uint64
	AccruedPlatformFee    uint64
	CreatorProfitClaimed  uint64
}

type RoundState struct {
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
}

type TicketData struct {
	PoolID                   uint64
	RoundID                  uint64
	TicketIndex              uint32
	Status                   uint8
	TransferredBeforeScratch bool
}
