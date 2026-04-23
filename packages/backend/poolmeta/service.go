package poolmeta

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/jackc/pgx/v5"

	"lucky-scratch/apperrors"
	"lucky-scratch/chain"
	"lucky-scratch/config"
	"lucky-scratch/contracts"
	"lucky-scratch/ipfs"
	"lucky-scratch/store"
	"lucky-scratch/store/db"
)

type Service struct {
	cfg     config.Config
	queries db.Querier
	chain   *chain.Client
	ipfs    ipfs.Client
}

type UploadedAsset struct {
	AssetID      int64  `json:"assetId"`
	OwnerAddress string `json:"ownerAddress"`
	Kind         string `json:"kind"`
	CID          string `json:"cid"`
	IPFSURI      string `json:"ipfsUri"`
	GatewayURL   string `json:"gatewayUrl"`
	MimeType     string `json:"mimeType"`
	SizeBytes    int64  `json:"sizeBytes"`
	SHA256       string `json:"sha256"`
}

type UploadImageInput struct {
	OwnerAddress string
	Kind         string
	Filename     string
	MimeType     string
	Data         []byte
}

type CreatePoolDraftInput struct {
	OwnerAddress      string           `json:"ownerAddress"`
	Name              string           `json:"name"`
	Description       string           `json:"description"`
	ThemeKey          string           `json:"themeKey"`
	CoverAssetID      int64            `json:"coverAssetId"`
	TicketArtAssetID  int64            `json:"ticketArtAssetId"`
	PoolConfigPreview map[string]any   `json:"poolConfigPreview"`
	PrizeTiers        []map[string]any `json:"prizeTiers"`
}

type PoolDraft struct {
	DraftID            int64  `json:"draftId"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	ThemeKey           string `json:"themeKey"`
	MetadataCID        string `json:"metadataCid"`
	MetadataURI        string `json:"metadataUri"`
	MetadataGatewayURL string `json:"metadataGatewayUrl"`
	ThemeID            string `json:"themeId"`
	Status             string `json:"status"`
}

type FinalizePoolInput struct {
	DraftID      int64  `json:"draftId"`
	OwnerAddress string `json:"ownerAddress"`
	CreateTxHash string `json:"createTxHash"`
}

type PoolMetadata struct {
	PoolID             int64  `json:"poolId"`
	OwnerAddress       string `json:"ownerAddress"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	ThemeKey           string `json:"themeKey"`
	ThemeID            string `json:"themeId"`
	MetadataCID        string `json:"metadataCid"`
	MetadataURI        string `json:"metadataUri"`
	MetadataGatewayURL string `json:"metadataGatewayUrl"`
	CoverAssetID       int64  `json:"coverAssetId,omitempty"`
	TicketArtAssetID   int64  `json:"ticketArtAssetId,omitempty"`
	CoverImageURL      string `json:"coverImageUrl,omitempty"`
	TicketArtURL       string `json:"ticketArtUrl,omitempty"`
}

func NewService(cfg config.Config, queries db.Querier, chainClient *chain.Client, ipfsClient ipfs.Client) Service {
	return Service{
		cfg:     cfg,
		queries: queries,
		chain:   chainClient,
		ipfs:    ipfsClient,
	}
}

func (s Service) UploadImage(ctx context.Context, input UploadImageInput) (UploadedAsset, error) {
	if s.ipfs == nil {
		return UploadedAsset{}, apperrors.BadRequest("IPFS uploads are not configured", errors.New("IPFS provider disabled"))
	}

	owner := strings.ToLower(strings.TrimSpace(input.OwnerAddress))
	if owner == "" {
		return UploadedAsset{}, apperrors.BadRequest("owner address is required", errors.New("missing owner address"))
	}
	if len(input.Data) == 0 {
		return UploadedAsset{}, apperrors.BadRequest("image file is required", errors.New("empty upload body"))
	}
	if s.cfg.Storage.UploadMaxBytes > 0 && int64(len(input.Data)) > s.cfg.Storage.UploadMaxBytes {
		return UploadedAsset{}, apperrors.BadRequest("image exceeds upload size limit", errors.New("image too large"))
	}

	mimeType := strings.TrimSpace(input.MimeType)
	if mimeType == "" {
		mimeType = http.DetectContentType(input.Data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return UploadedAsset{}, apperrors.BadRequest("only image uploads are supported", fmt.Errorf("unsupported mime type %s", mimeType))
	}

	filename := strings.TrimSpace(input.Filename)
	if filename == "" {
		exts, _ := mime.ExtensionsByType(mimeType)
		filename = "upload"
		if len(exts) > 0 {
			filename += exts[0]
		}
	}

	result, err := s.ipfs.UploadFile(ctx, filename, mimeType, input.Data)
	if err != nil {
		return UploadedAsset{}, err
	}

	sum := sha256.Sum256(input.Data)
	row, err := s.queries.InsertUploadedAsset(ctx, db.InsertUploadedAssetParams{
		OwnerAddress: owner,
		Kind:         strings.TrimSpace(input.Kind),
		Cid:          result.CID,
		IpfsUri:      result.IPFSURI,
		GatewayUrl:   result.GatewayURL,
		MimeType:     mimeType,
		SizeBytes:    int64(len(input.Data)),
		Sha256:       hex.EncodeToString(sum[:]),
	})
	if err != nil {
		return UploadedAsset{}, err
	}

	return uploadedAssetFromRow(row), nil
}

func (s Service) CreateDraft(ctx context.Context, input CreatePoolDraftInput) (PoolDraft, error) {
	if s.ipfs == nil {
		return PoolDraft{}, apperrors.BadRequest("IPFS uploads are not configured", errors.New("IPFS provider disabled"))
	}

	owner := strings.ToLower(strings.TrimSpace(input.OwnerAddress))
	if owner == "" {
		return PoolDraft{}, apperrors.BadRequest("owner address is required", errors.New("missing owner address"))
	}
	name := strings.TrimSpace(input.Name)
	if len(name) < 2 || len(name) > 48 {
		return PoolDraft{}, apperrors.BadRequest("pool name must be between 2 and 48 characters", errors.New("invalid pool name"))
	}
	if input.CoverAssetID <= 0 || input.TicketArtAssetID <= 0 {
		return PoolDraft{}, apperrors.BadRequest("both cover and ticket art assets are required", errors.New("missing asset ids"))
	}

	coverAsset, err := s.queries.GetUploadedAsset(ctx, input.CoverAssetID)
	if err != nil {
		return PoolDraft{}, err
	}
	ticketAsset, err := s.queries.GetUploadedAsset(ctx, input.TicketArtAssetID)
	if err != nil {
		return PoolDraft{}, err
	}
	if strings.ToLower(coverAsset.OwnerAddress) != owner || strings.ToLower(ticketAsset.OwnerAddress) != owner {
		return PoolDraft{}, apperrors.Forbidden("uploaded assets must belong to the pool creator", errors.New("asset owner mismatch"))
	}

	themeKey := strings.TrimSpace(input.ThemeKey)
	if themeKey == "" {
		themeKey = slugify(name)
	}

	metadataPayload := map[string]any{
		"version":     1,
		"kind":        "lucky-scratch-pool",
		"name":        name,
		"description": strings.TrimSpace(input.Description),
		"themeKey":    themeKey,
		"assets": map[string]any{
			"cover": map[string]any{
				"cid":        coverAsset.Cid,
				"ipfsUri":    coverAsset.IpfsUri,
				"gatewayUrl": coverAsset.GatewayUrl,
				"mimeType":   coverAsset.MimeType,
			},
			"ticketArt": map[string]any{
				"cid":        ticketAsset.Cid,
				"ipfsUri":    ticketAsset.IpfsUri,
				"gatewayUrl": ticketAsset.GatewayUrl,
				"mimeType":   ticketAsset.MimeType,
			},
		},
		"poolConfigPreview": input.PoolConfigPreview,
		"prizeTiers":        input.PrizeTiers,
		"createdAt":         time.Now().UTC().Format(time.RFC3339),
	}

	metadataResult, err := s.ipfs.UploadJSON(ctx, themeKey+".json", metadataPayload)
	if err != nil {
		return PoolDraft{}, err
	}

	poolConfigPreview, err := json.Marshal(input.PoolConfigPreview)
	if err != nil {
		return PoolDraft{}, err
	}
	prizeTiers, err := json.Marshal(input.PrizeTiers)
	if err != nil {
		return PoolDraft{}, err
	}

	themeID := themeIDFromCID(metadataResult.CID)
	row, err := s.queries.InsertPoolMetadataDraft(ctx, db.InsertPoolMetadataDraftParams{
		ChainID:            s.cfg.Chain.ID,
		OwnerAddress:       owner,
		Name:               name,
		Description:        strings.TrimSpace(input.Description),
		ThemeKey:           themeKey,
		CoverAssetID:       store.Int8(input.CoverAssetID),
		TicketArtAssetID:   store.Int8(input.TicketArtAssetID),
		MetadataCid:        metadataResult.CID,
		MetadataUri:        metadataResult.IPFSURI,
		MetadataGatewayUrl: metadataResult.GatewayURL,
		ThemeID:            themeID,
		PoolConfigPreview:  poolConfigPreview,
		PrizeTiers:         prizeTiers,
		Status:             "draft",
		ExpiresAt:          store.Timestamptz(time.Now().Add(s.cfg.Storage.PoolDraftTTL)),
	})
	if err != nil {
		return PoolDraft{}, err
	}

	return draftFromRow(row), nil
}

func (s Service) FinalizePool(ctx context.Context, poolID uint64, input FinalizePoolInput) (PoolMetadata, error) {
	owner := strings.ToLower(strings.TrimSpace(input.OwnerAddress))
	if owner == "" {
		return PoolMetadata{}, apperrors.BadRequest("owner address is required", errors.New("missing owner address"))
	}
	if input.DraftID <= 0 {
		return PoolMetadata{}, apperrors.BadRequest("draft id is required", errors.New("missing draft id"))
	}

	draft, err := s.queries.GetPoolMetadataDraft(ctx, db.GetPoolMetadataDraftParams{
		ChainID: s.cfg.Chain.ID,
		ID:      input.DraftID,
	})
	if err != nil {
		return PoolMetadata{}, err
	}
	if strings.ToLower(draft.OwnerAddress) != owner {
		return PoolMetadata{}, apperrors.Forbidden("draft owner does not match the provided wallet", errors.New("draft owner mismatch"))
	}
	if strings.TrimSpace(draft.Status) == "finalized" {
		existing, existingErr := s.GetPoolMetadata(ctx, poolID)
		if existingErr == nil && existing != nil {
			return *existing, nil
		}
	}
	if draft.ExpiresAt.Valid && draft.ExpiresAt.Time.Before(time.Now()) {
		return PoolMetadata{}, apperrors.Conflict("pool draft has expired", errors.New("draft expired"))
	}

	if strings.TrimSpace(input.CreateTxHash) == "" {
		return PoolMetadata{}, apperrors.BadRequest("create transaction hash is required", errors.New("missing create tx hash"))
	}
	if err := s.verifyCreatePoolReceipt(ctx, input.CreateTxHash, poolID); err != nil {
		return PoolMetadata{}, err
	}

	poolConfig, err := s.chain.PoolConfig(ctx, poolID)
	if err != nil {
		return PoolMetadata{}, err
	}

	if strings.ToLower(poolConfig.Creator.Hex()) != owner {
		return PoolMetadata{}, apperrors.Forbidden("pool creator does not match the provided wallet", errors.New("creator mismatch"))
	}
	if !strings.EqualFold(common.BytesToHash(poolConfig.ThemeID[:]).Hex(), draft.ThemeID) {
		return PoolMetadata{}, apperrors.Conflict("pool metadata theme id does not match the deployed pool", errors.New("theme id mismatch"))
	}

	row, err := s.queries.UpsertPoolMetadata(ctx, db.UpsertPoolMetadataParams{
		ChainID:            s.cfg.Chain.ID,
		PoolID:             int64(poolID),
		OwnerAddress:       owner,
		Name:               draft.Name,
		Description:        draft.Description,
		ThemeKey:           draft.ThemeKey,
		ThemeID:            draft.ThemeID,
		MetadataCid:        draft.MetadataCid,
		MetadataUri:        draft.MetadataUri,
		MetadataGatewayUrl: draft.MetadataGatewayUrl,
		CoverAssetID:       draft.CoverAssetID,
		TicketArtAssetID:   draft.TicketArtAssetID,
	})
	if err != nil {
		return PoolMetadata{}, err
	}

	if _, err := s.queries.UpdatePoolMetadataDraftStatus(ctx, db.UpdatePoolMetadataDraftStatusParams{
		ChainID: s.cfg.Chain.ID,
		ID:      draft.ID,
		Status:  "finalized",
	}); err != nil {
		return PoolMetadata{}, err
	}

	metadata, err := s.buildMetadata(ctx, row)
	if err != nil {
		return PoolMetadata{}, err
	}
	return metadata, nil
}

func (s Service) GetPoolMetadata(ctx context.Context, poolID uint64) (*PoolMetadata, error) {
	row, err := s.queries.GetPoolMetadataByPoolID(ctx, db.GetPoolMetadataByPoolIDParams{
		ChainID: s.cfg.Chain.ID,
		PoolID:  int64(poolID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	metadata, err := s.buildMetadata(ctx, row)
	if err != nil {
		return nil, err
	}
	return &metadata, nil
}

func (s Service) buildMetadata(ctx context.Context, row db.PoolMetadatum) (PoolMetadata, error) {
	metadata := PoolMetadata{
		PoolID:             row.PoolID,
		OwnerAddress:       row.OwnerAddress,
		Name:               row.Name,
		Description:        row.Description,
		ThemeKey:           row.ThemeKey,
		ThemeID:            row.ThemeID,
		MetadataCID:        row.MetadataCid,
		MetadataURI:        row.MetadataUri,
		MetadataGatewayURL: row.MetadataGatewayUrl,
	}

	if row.CoverAssetID.Valid && row.CoverAssetID.Int64 > 0 {
		asset, err := s.queries.GetUploadedAsset(ctx, row.CoverAssetID.Int64)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return PoolMetadata{}, err
		}
		if err == nil {
			metadata.CoverAssetID = asset.ID
			metadata.CoverImageURL = asset.GatewayUrl
		}
	}
	if row.TicketArtAssetID.Valid && row.TicketArtAssetID.Int64 > 0 {
		asset, err := s.queries.GetUploadedAsset(ctx, row.TicketArtAssetID.Int64)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return PoolMetadata{}, err
		}
		if err == nil {
			metadata.TicketArtAssetID = asset.ID
			metadata.TicketArtURL = asset.GatewayUrl
		}
	}

	return metadata, nil
}

func (s Service) verifyCreatePoolReceipt(ctx context.Context, txHash string, poolID uint64) error {
	hash := common.HexToHash(strings.TrimSpace(txHash))
	receipt, err := s.chain.TransactionReceipt(ctx, hash)
	if err != nil {
		return err
	}
	if receipt.Status != 1 {
		return apperrors.Conflict("pool creation transaction was not successful", errors.New("transaction reverted"))
	}

	coreDeployment, err := s.chain.Registry().Must(contracts.CoreContractName)
	if err != nil {
		return err
	}

	for _, logEntry := range receipt.Logs {
		if logEntry.Address != coreDeployment.Address || len(logEntry.Topics) == 0 {
			continue
		}
		event, eventErr := coreDeployment.ABI.EventByID(logEntry.Topics[0])
		if eventErr != nil || event.Name != "PoolCreated" || len(logEntry.Topics) < 2 {
			continue
		}
		if logEntry.Topics[1].Big().Uint64() == poolID {
			return nil
		}
	}

	return apperrors.Conflict("pool creation receipt does not match the requested pool", errors.New("missing PoolCreated event"))
}

func uploadedAssetFromRow(row db.UploadedAsset) UploadedAsset {
	return UploadedAsset{
		AssetID:      row.ID,
		OwnerAddress: row.OwnerAddress,
		Kind:         row.Kind,
		CID:          row.Cid,
		IPFSURI:      row.IpfsUri,
		GatewayURL:   row.GatewayUrl,
		MimeType:     row.MimeType,
		SizeBytes:    row.SizeBytes,
		SHA256:       row.Sha256,
	}
}

func draftFromRow(row db.PoolMetadataDraft) PoolDraft {
	return PoolDraft{
		DraftID:            row.ID,
		Name:               row.Name,
		Description:        row.Description,
		ThemeKey:           row.ThemeKey,
		MetadataCID:        row.MetadataCid,
		MetadataURI:        row.MetadataUri,
		MetadataGatewayURL: row.MetadataGatewayUrl,
		ThemeID:            row.ThemeID,
		Status:             row.Status,
	}
}

func themeIDFromCID(cid string) string {
	return crypto.Keccak256Hash([]byte("luckyscratch:pool-metadata:v1:" + strings.TrimSpace(cid))).Hex()
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var out []rune
	lastDash := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			out = append(out, r)
			lastDash = false
		case r >= '0' && r <= '9':
			out = append(out, r)
			lastDash = false
		default:
			if !lastDash && len(out) > 0 {
				out = append(out, '-')
				lastDash = true
			}
		}
	}
	result := strings.Trim(string(out), "-")
	if result == "" {
		return "pool"
	}
	return result
}
