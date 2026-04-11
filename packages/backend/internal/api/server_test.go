package api

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/apperrors"
)

func TestWriteServiceErrorUsesPublicAppErrorShape(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, apperrors.Conflict("pool sponsor budget exceeded", errors.New("pool sponsor budget exceeded")))

	if recorder.Code != 409 {
		t.Fatalf("expected 409, got %d", recorder.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["error"] != "pool sponsor budget exceeded" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestWriteServiceErrorHidesInternalMessages(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, errors.New("dial tcp 10.0.0.1:5432: connect: connection refused"))

	if recorder.Code != 500 {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["error"] != "internal server error" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestWriteServiceErrorMapsNoRowsToNotFound(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	writeServiceError(recorder, pgx.ErrNoRows)

	if recorder.Code != 404 {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}
