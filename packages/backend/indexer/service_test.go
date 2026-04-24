package indexer

import (
	"errors"
	"math"
	"math/big"
	"strings"
	"testing"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"lucky-scratch/contracts"
)

func TestClampBigIntToInt64SaturatesPositiveOverflow(t *testing.T) {
	t.Parallel()

	value := new(big.Int).Add(big.NewInt(math.MaxInt64), big.NewInt(1024))
	if got := clampBigIntToInt64(value); got != math.MaxInt64 {
		t.Fatalf("expected %d, got %d", int64(math.MaxInt64), got)
	}
}

func TestIsMissingOwnerOfTokenErrorMatchesCommonERC721Messages(t *testing.T) {
	t.Parallel()

	cases := []error{
		errors.New("execution reverted: ERC721NonexistentToken(1)"),
		errors.New("execution reverted: ERC721: invalid token ID"),
		errors.New("owner query for nonexistent token"),
	}
	for _, tc := range cases {
		if !isMissingOwnerOfTokenError(tc) {
			t.Fatalf("expected %q to match", tc.Error())
		}
	}

	if isMissingOwnerOfTokenError(errors.New("dial tcp timeout")) {
		t.Fatal("did not expect network error to match missing-token condition")
	}
}

func TestMergeEventContextPreservesStoredEventMetadataWhenReconcileHasNoEvent(t *testing.T) {
	t.Parallel()

	merged := mergeEventContext(eventContext{}, 123, "0xabc", 7, "0xdef")
	if merged.BlockNumber != 123 || merged.TxHash != "0xabc" || merged.LogIndex != 7 || merged.BlockHash != "0xdef" {
		t.Fatalf("unexpected merged context: %+v", merged)
	}

	preserved := mergeEventContext(eventContext{
		BlockNumber: 456,
		TxHash:      "0x123",
		LogIndex:    0,
		BlockHash:   "0x456",
	}, 123, "0xabc", 7, "0xdef")
	if preserved.BlockNumber != 456 || preserved.TxHash != "0x123" || preserved.LogIndex != 0 || preserved.BlockHash != "0x456" {
		t.Fatalf("expected explicit event context to win, got %+v", preserved)
	}
}

func TestFinalizedHeadUsesLargestSafetyWindow(t *testing.T) {
	t.Parallel()

	if got := finalizedHead(100, 3, 12); got != 88 {
		t.Fatalf("expected safe head 88, got %d", got)
	}
	if got := finalizedHead(100, 15, 12); got != 85 {
		t.Fatalf("expected safe head 85, got %d", got)
	}
	if got := finalizedHead(12, 3, 12); got != 0 {
		t.Fatalf("expected zero safe head when chain head is not beyond safety window, got %d", got)
	}
}

func TestReplayWindowUsesLargestConfiguredGuard(t *testing.T) {
	t.Parallel()

	if got := replayWindow(25, 3, 12); got != 25 {
		t.Fatalf("expected replay window 25, got %d", got)
	}
	if got := replayWindow(5, 8, 12); got != 12 {
		t.Fatalf("expected replay window 12, got %d", got)
	}
}

func TestSupportedEventTopicsFiltersByContractRole(t *testing.T) {
	t.Parallel()

	rawABI := `[
		{"anonymous":false,"inputs":[],"name":"PoolCreated","type":"event"},
		{"anonymous":false,"inputs":[],"name":"TicketPurchased","type":"event"},
		{"anonymous":false,"inputs":[
			{"indexed":true,"internalType":"address","name":"from","type":"address"},
			{"indexed":true,"internalType":"address","name":"to","type":"address"},
			{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}
		],"name":"Transfer","type":"event"}
	]`
	parsedABI, err := gethabi.JSON(strings.NewReader(rawABI))
	if err != nil {
		t.Fatalf("parse ABI: %v", err)
	}

	coreTopics := supportedEventTopics(contracts.Deployment{Name: contracts.CoreContractName, ABI: parsedABI})
	if len(coreTopics) != 2 {
		t.Fatalf("expected 2 supported core topics, got %d", len(coreTopics))
	}

	ticketTopics := supportedEventTopics(contracts.Deployment{Name: contracts.TicketContractName, ABI: parsedABI})
	if len(ticketTopics) != 1 {
		t.Fatalf("expected only Transfer topic for ticket contract, got %d", len(ticketTopics))
	}
	if ticketTopics[0] != parsedABI.Events["Transfer"].ID {
		t.Fatalf("expected Transfer topic, got %s", ticketTopics[0].Hex())
	}
}

func TestDecodeRewardClaimedReadsClearRewardAmountFromEvent(t *testing.T) {
	t.Parallel()

	rawABI := `[
		{"anonymous":false,"inputs":[
			{"indexed":true,"internalType":"address","name":"user","type":"address"},
			{"indexed":true,"internalType":"uint256","name":"ticketId","type":"uint256"},
			{"indexed":true,"internalType":"uint256","name":"poolId","type":"uint256"},
			{"indexed":false,"internalType":"uint256","name":"roundId","type":"uint256"},
			{"indexed":false,"internalType":"uint64","name":"clearRewardAmount","type":"uint64"}
		],"name":"RewardClaimed","type":"event"}
	]`
	parsedABI, err := gethabi.JSON(strings.NewReader(rawABI))
	if err != nil {
		t.Fatalf("parse ABI: %v", err)
	}

	event := parsedABI.Events["RewardClaimed"]
	user := common.HexToAddress("0x123400000000000000000000000000000000abcd")
	data, err := event.Inputs.NonIndexed().Pack(big.NewInt(7), uint64(42_000_000))
	if err != nil {
		t.Fatalf("pack event data: %v", err)
	}

	decoded, err := (Service{}).decodeLog(contracts.Deployment{Name: contracts.CoreContractName, ABI: parsedABI}, types.Log{
		Topics: []common.Hash{
			event.ID,
			common.BytesToHash(user.Bytes()),
			common.BigToHash(big.NewInt(99)),
			common.BigToHash(big.NewInt(5)),
		},
		Data: data,
	})
	if err != nil {
		t.Fatalf("decode log: %v", err)
	}

	if decoded.Event.UserAddress != user.Hex() {
		t.Fatalf("expected user %s, got %s", user.Hex(), decoded.Event.UserAddress)
	}
	if decoded.Event.TicketID != 99 || decoded.Event.PoolID != 5 || decoded.Event.RoundID != 7 {
		t.Fatalf("unexpected ids: %+v", decoded.Event)
	}
	if decoded.Event.ClaimAmount != 42_000_000 {
		t.Fatalf("expected claim amount 42000000, got %d", decoded.Event.ClaimAmount)
	}
}
