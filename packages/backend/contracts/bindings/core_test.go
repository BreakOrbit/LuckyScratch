package bindings

import (
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestDecodePoolConfigFlatGetterOutputs(t *testing.T) {
	themeID := [32]byte{0x81, 0xb8, 0x06}
	creator := common.HexToAddress("0x805bdf14f6F7a417ff1e7Fb2FeD99Afd600D3430")

	config, err := decodePoolConfig([]interface{}{
		uint8(1),
		creator,
		false,
		uint32(3),
		uint64(5_000_000),
		uint32(20),
		uint64(70_000_000),
		uint16(800),
		uint16(7000),
		uint16(4000),
		uint64(20_000_000),
		themeID,
		true,
	})
	if err != nil {
		t.Fatalf("decodePoolConfig returned error: %v", err)
	}

	if config.Mode != 1 {
		t.Fatalf("Mode = %d, want 1", config.Mode)
	}
	if config.Creator != creator {
		t.Fatalf("Creator = %s, want %s", config.Creator.Hex(), creator.Hex())
	}
	if config.PoolInstanceGroupSize != 3 {
		t.Fatalf("PoolInstanceGroupSize = %d, want 3", config.PoolInstanceGroupSize)
	}
	if config.TicketPrice != 5_000_000 {
		t.Fatalf("TicketPrice = %d, want 5000000", config.TicketPrice)
	}
	if config.ThemeID != themeID {
		t.Fatalf("ThemeID = %x, want %x", config.ThemeID, themeID)
	}
	if !config.Selectable {
		t.Fatal("Selectable = false, want true")
	}
}

func TestDecodePublicStructGetterOutputs(t *testing.T) {
	poolState, err := decodePoolState([]interface{}{uint8(0), uint32(1), false, true, false, false})
	if err != nil {
		t.Fatalf("decodePoolState returned error: %v", err)
	}
	if poolState.Status != 0 || poolState.CurrentRound != 1 || !poolState.VrfPending {
		t.Fatalf("unexpected pool state: %+v", poolState)
	}

	accounting, err := decodePoolAccounting([]interface{}{
		uint64(84_000_000),
		uint64(70_000_000),
		uint64(0),
		uint64(0),
		uint64(0),
		uint64(0),
		uint64(0),
		uint64(0),
	})
	if err != nil {
		t.Fatalf("decodePoolAccounting returned error: %v", err)
	}
	if accounting.LockedBond != 84_000_000 || accounting.ReservedPrizeBudget != 70_000_000 {
		t.Fatalf("unexpected accounting: %+v", accounting)
	}

	requestRef := [32]byte{0x01, 0x02}
	shuffleRoot := [32]byte{0x03, 0x04}
	roundState, err := decodeRoundState([]interface{}{
		uint8(1),
		uint32(2),
		uint32(1),
		uint32(2),
		uint32(1),
		uint32(20),
		uint64(5_000_000),
		uint64(70_000_000),
		requestRef,
		shuffleRoot,
	})
	if err != nil {
		t.Fatalf("decodeRoundState returned error: %v", err)
	}
	if roundState.TotalTickets != 20 || roundState.VrfRequestRef != requestRef || roundState.ShuffleRoot != shuffleRoot {
		t.Fatalf("unexpected round state: %+v", roundState)
	}

	ticket, err := decodeTicketData([]interface{}{uint64(2), uint64(1), uint32(4), uint8(0), true})
	if err != nil {
		t.Fatalf("decodeTicketData returned error: %v", err)
	}
	if ticket.PoolID != 2 || ticket.RoundID != 1 || ticket.TicketIndex != 4 || !ticket.TransferredBeforeScratch {
		t.Fatalf("unexpected ticket data: %+v", ticket)
	}
}

func TestDecodePoolConfigRejectsUnexpectedOutputLength(t *testing.T) {
	_, err := decodePoolConfig([]interface{}{uint8(1)})
	if err == nil {
		t.Fatal("decodePoolConfig succeeded with incomplete output")
	}
}
