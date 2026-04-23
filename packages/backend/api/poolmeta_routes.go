package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"lucky-scratch/poolmeta"
	"lucky-scratch/store/db"
)

type PoolMetaService interface {
	UploadImage(ctx context.Context, input poolmeta.UploadImageInput) (poolmeta.UploadedAsset, error)
	CreateDraft(ctx context.Context, input poolmeta.CreatePoolDraftInput) (poolmeta.PoolDraft, error)
	FinalizePool(ctx context.Context, poolID uint64, input poolmeta.FinalizePoolInput) (poolmeta.PoolMetadata, error)
	GetPoolMetadata(ctx context.Context, poolID uint64) (*poolmeta.PoolMetadata, error)
}

func (s *Server) handleUploadImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}
	if s.poolMeta == nil {
		writeError(w, http.StatusNotImplemented, errors.New("pool metadata service is not configured"))
		return
	}

	if s.cfg.Storage.UploadMaxBytes > 0 {
		r.Body = http.MaxBytesReader(w, r.Body, s.cfg.Storage.UploadMaxBytes)
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	resp, err := s.poolMeta.UploadImage(r.Context(), poolmeta.UploadImageInput{
		OwnerAddress: r.FormValue("ownerAddress"),
		Kind:         r.FormValue("kind"),
		Filename:     header.Filename,
		MimeType:     header.Header.Get("Content-Type"),
		Data:         data,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) handlePoolDrafts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}
	if s.poolMeta == nil {
		writeError(w, http.StatusNotImplemented, errors.New("pool metadata service is not configured"))
		return
	}

	var req poolmeta.CreatePoolDraftInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.poolMeta.CreateDraft(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) handleFinalizePool(w http.ResponseWriter, r *http.Request, poolID uint64) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(w)
		return
	}
	if s.poolMeta == nil {
		writeError(w, http.StatusNotImplemented, errors.New("pool metadata service is not configured"))
		return
	}

	var req poolmeta.FinalizePoolInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	resp, err := s.poolMeta.FinalizePool(r.Context(), poolID, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleCurrentRound(w http.ResponseWriter, r *http.Request, poolID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	pool, err := s.readService.GetPool(r.Context(), poolID)
	if err != nil {
		writeLookupError(w, err)
		return
	}

	round, err := s.readService.GetRound(r.Context(), poolID, uint64(pool.CurrentRound))
	if err != nil {
		writeLookupError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, roundResponse(round))
}

func (s *Server) handlePurchaseContext(w http.ResponseWriter, r *http.Request, poolID uint64) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	pool, err := s.readService.GetPool(r.Context(), poolID)
	if err != nil {
		writeLookupError(w, err)
		return
	}

	payload, err := s.buildPoolPayload(r.Context(), pool)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	soldTicketIndexes := make([]int, 0)
	availableTicketIndexes := make([]int, 0)
	if pool.CurrentRound > 0 {
		tickets, ticketErr := s.readService.ListTicketsByPoolAndRound(r.Context(), poolID, uint64(pool.CurrentRound), 512, 0)
		if ticketErr != nil {
			writeServiceError(w, ticketErr)
			return
		}

		soldLookup := make(map[int]struct{}, len(tickets))
		for _, ticket := range tickets {
			index := int(ticket.TicketIndex)
			soldTicketIndexes = append(soldTicketIndexes, index)
			soldLookup[index] = struct{}{}
		}

		totalTickets := int(pool.TotalTicketsPerRound)
		availableCapacity := totalTickets - len(soldTicketIndexes)
		if availableCapacity < 0 {
			availableCapacity = 0
		}
		availableTicketIndexes = make([]int, 0, availableCapacity)
		for index := 0; index < totalTickets; index += 1 {
			if _, exists := soldLookup[index]; exists {
				continue
			}
			availableTicketIndexes = append(availableTicketIndexes, index)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"pool":                   payload,
		"currentRound":           payload["currentRoundState"],
		"soldTicketIndexes":      soldTicketIndexes,
		"availableTicketIndexes": availableTicketIndexes,
	})
}

func (s *Server) handleUserCreatedPoolsSummary(w http.ResponseWriter, r *http.Request, address string) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}

	resp, err := s.creatorSummaryResponse(r.Context(), address)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) buildPoolPayload(ctx context.Context, row db.Pool) (map[string]any, error) {
	payload := poolResponse(row)

	if row.CurrentRound > 0 {
		round, err := s.readService.GetRound(ctx, uint64(row.PoolID), uint64(row.CurrentRound))
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			payload["currentRoundState"] = roundResponse(round)
		}
	}

	if s.poolMeta != nil {
		metadata, err := s.poolMeta.GetPoolMetadata(ctx, uint64(row.PoolID))
		if err != nil {
			return nil, err
		}
		payload["metadata"] = metadata
	}

	return payload, nil
}

func (s *Server) creatorSummaryResponse(ctx context.Context, address string) (map[string]any, error) {
	creator := strings.ToLower(strings.TrimSpace(address))
	rows, err := s.readService.ListAllPoolsByCreator(ctx, creator)
	if err != nil {
		return nil, err
	}

	var (
		activePools          int
		totalRevenue         int64
		totalPlatformFee     int64
		totalClaimableProfit int64
		totalLockedBond      int64
		soldCount            int64
		totalTickets         int64
	)

	for _, row := range rows {
		if row.Status != "Closed" {
			activePools += 1
		}
		totalRevenue += row.RealizedRevenue
		totalPlatformFee += row.AccruedPlatformFee
		totalClaimableProfit += row.ClaimableCreatorProfit
		totalLockedBond += row.LockedBond

		if row.CurrentRound == 0 {
			continue
		}
		round, roundErr := s.readService.GetRound(ctx, uint64(row.PoolID), uint64(row.CurrentRound))
		if roundErr != nil {
			if errors.Is(roundErr, pgx.ErrNoRows) {
				continue
			}
			return nil, roundErr
		}
		soldCount += int64(round.SoldCount)
		totalTickets += int64(round.TotalTickets)
	}

	return map[string]any{
		"creator":                  creator,
		"totalPools":               len(rows),
		"activePools":              activePools,
		"totalRealizedRevenue":     totalRevenue,
		"totalAccruedPlatformFee":  totalPlatformFee,
		"totalClaimableProfit":     totalClaimableProfit,
		"totalLockedBond":          totalLockedBond,
		"currentRoundSoldCount":    soldCount,
		"currentRoundTotalTickets": totalTickets,
	}, nil
}
