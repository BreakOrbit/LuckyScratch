CREATE TABLE IF NOT EXISTS uploaded_assets (
    id BIGSERIAL PRIMARY KEY,
    owner_address TEXT NOT NULL,
    kind TEXT NOT NULL,
    cid TEXT NOT NULL,
    ipfs_uri TEXT NOT NULL,
    gateway_url TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_metadata_drafts (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    owner_address TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    theme_key TEXT NOT NULL DEFAULT '',
    cover_asset_id BIGINT REFERENCES uploaded_assets(id),
    ticket_art_asset_id BIGINT REFERENCES uploaded_assets(id),
    metadata_cid TEXT NOT NULL,
    metadata_uri TEXT NOT NULL,
    metadata_gateway_url TEXT NOT NULL DEFAULT '',
    theme_id TEXT NOT NULL,
    pool_config_preview JSONB NOT NULL DEFAULT '{}'::jsonb,
    prize_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_metadata (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    pool_id BIGINT NOT NULL,
    owner_address TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    theme_key TEXT NOT NULL DEFAULT '',
    theme_id TEXT NOT NULL,
    metadata_cid TEXT NOT NULL,
    metadata_uri TEXT NOT NULL,
    metadata_gateway_url TEXT NOT NULL DEFAULT '',
    cover_asset_id BIGINT REFERENCES uploaded_assets(id),
    ticket_art_asset_id BIGINT REFERENCES uploaded_assets(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, pool_id)
);

CREATE INDEX IF NOT EXISTS uploaded_assets_owner_idx ON uploaded_assets (lower(owner_address), created_at DESC);
CREATE INDEX IF NOT EXISTS pool_metadata_drafts_owner_idx ON pool_metadata_drafts (chain_id, lower(owner_address), created_at DESC);
CREATE INDEX IF NOT EXISTS pool_metadata_drafts_status_idx ON pool_metadata_drafts (chain_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS pool_metadata_pool_idx ON pool_metadata (chain_id, pool_id);
