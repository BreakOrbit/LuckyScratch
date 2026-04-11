package gasless

import (
	"errors"
	"math"
	"math/big"
	"testing"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/apperrors"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/risk"
)

func TestSignedFlexibleUint64RejectsOverflow(t *testing.T) {
	t.Parallel()

	if _, err := signedFlexibleUint64(FlexibleUint64(uint64(math.MaxInt64)+1), "deadline"); err == nil {
		t.Fatal("expected overflow error")
	}
}

func TestClampBigIntToInt64SaturatesPositiveOverflow(t *testing.T) {
	t.Parallel()

	value := new(big.Int).Add(big.NewInt(math.MaxInt64), big.NewInt(1024))
	if got := clampBigIntToInt64(value); got != math.MaxInt64 {
		t.Fatalf("expected %d, got %d", int64(math.MaxInt64), got)
	}
}

func TestIsNotFoundErrorMatchesProviderStyleMessages(t *testing.T) {
	t.Parallel()

	if !isNotFoundError(errors.New("not found")) {
		t.Fatal("expected not found error to match")
	}
	if isNotFoundError(errors.New("execution reverted")) {
		t.Fatal("did not expect reverted error to match")
	}
}

func TestMapSubmitErrorMapsRiskAndValidationErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		input      error
		statusCode int
	}{
		{name: "rate limited", input: risk.ErrUserRateLimited, statusCode: 429},
		{name: "blocked", input: risk.ErrUserGaslessBlocked, statusCode: 403},
		{name: "budget exceeded", input: risk.ErrPoolBudgetExceeded, statusCode: 409},
		{name: "validation", input: errors.New("paramsHash mismatch"), statusCode: 400},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mapped := mapSubmitError(tc.input)
			typed, ok := apperrors.As(mapped)
			if !ok {
				t.Fatalf("expected typed app error for %s", tc.name)
			}
			if typed.StatusCode != tc.statusCode {
				t.Fatalf("expected status %d, got %d", tc.statusCode, typed.StatusCode)
			}
		})
	}
}
