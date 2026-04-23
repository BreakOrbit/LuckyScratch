-- name: InsertUploadedAsset :one
INSERT INTO uploaded_assets (
    owner_address,
    kind,
    cid,
    ipfs_uri,
    gateway_url,
    mime_type,
    size_bytes,
    sha256
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: GetUploadedAsset :one
SELECT *
FROM uploaded_assets
WHERE id = $1;

-- name: InsertPoolMetadataDraft :one
INSERT INTO pool_metadata_drafts (
    chain_id,
    owner_address,
    name,
    description,
    theme_key,
    cover_asset_id,
    ticket_art_asset_id,
    metadata_cid,
    metadata_uri,
    metadata_gateway_url,
    theme_id,
    pool_config_preview,
    prize_tiers,
    status,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
)
RETURNING *;

-- name: GetPoolMetadataDraft :one
SELECT *
FROM pool_metadata_drafts
WHERE chain_id = $1
  AND id = $2;

-- name: UpdatePoolMetadataDraftStatus :one
UPDATE pool_metadata_drafts
SET status = $3,
    updated_at = NOW()
WHERE chain_id = $1
  AND id = $2
RETURNING *;

-- name: UpsertPoolMetadata :one
INSERT INTO pool_metadata (
    chain_id,
    pool_id,
    owner_address,
    name,
    description,
    theme_key,
    theme_id,
    metadata_cid,
    metadata_uri,
    metadata_gateway_url,
    cover_asset_id,
    ticket_art_asset_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
ON CONFLICT (chain_id, pool_id) DO UPDATE SET
    owner_address = EXCLUDED.owner_address,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    theme_key = EXCLUDED.theme_key,
    theme_id = EXCLUDED.theme_id,
    metadata_cid = EXCLUDED.metadata_cid,
    metadata_uri = EXCLUDED.metadata_uri,
    metadata_gateway_url = EXCLUDED.metadata_gateway_url,
    cover_asset_id = EXCLUDED.cover_asset_id,
    ticket_art_asset_id = EXCLUDED.ticket_art_asset_id,
    updated_at = NOW()
RETURNING *;

-- name: GetPoolMetadataByPoolID :one
SELECT *
FROM pool_metadata
WHERE chain_id = $1
  AND pool_id = $2;
