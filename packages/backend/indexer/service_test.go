package indexer

import (
	"errors"
	"math"
	"math/big"
	"testing"
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
