CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pools (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    pool_id BIGINT NOT NULL,
    creator TEXT NOT NULL,
    protocol_owned BOOLEAN NOT NULL DEFAULT FALSE,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    close_requested BOOLEAN NOT NULL DEFAULT FALSE,
    vrf_pending BOOLEAN NOT NULL DEFAULT FALSE,
    initialized BOOLEAN NOT NULL DEFAULT FALSE,
    theme_id TEXT NOT NULL DEFAULT '',
    ticket_price BIGINT NOT NULL DEFAULT 0,
    total_tickets_per_round BIGINT NOT NULL DEFAULT 0,
    total_prize_budget BIGINT NOT NULL DEFAULT 0,
    pool_instance_group_size BIGINT NOT NULL DEFAULT 0,
    fee_bps INTEGER NOT NULL DEFAULT 0,
    target_rtp_bps INTEGER NOT NULL DEFAULT 0,
    hit_rate_bps INTEGER NOT NULL DEFAULT 0,
    max_prize BIGINT NOT NULL DEFAULT 0,
    selectable BOOLEAN NOT NULL DEFAULT FALSE,
    current_round BIGINT NOT NULL DEFAULT 0,
    locked_bond BIGINT NOT NULL DEFAULT 0,
    reserved_prize_budget BIGINT NOT NULL DEFAULT 0,
    locked_next_round_budget BIGINT NOT NULL DEFAULT 0,
    realized_revenue BIGINT NOT NULL DEFAULT 0,
    settled_prize_cost BIGINT NOT NULL DEFAULT 0,
    settled_protocol_cost BIGINT NOT NULL DEFAULT 0,
    accrued_platform_fee BIGINT NOT NULL DEFAULT 0,
    creator_profit_claimed BIGINT NOT NULL DEFAULT 0,
    claimable_creator_profit BIGINT NOT NULL DEFAULT 0,
    created_block BIGINT NOT NULL DEFAULT 0,
    created_tx_hash TEXT NOT NULL DEFAULT '',
    last_event_block BIGINT NOT NULL DEFAULT 0,
    last_event_tx_hash TEXT NOT NULL DEFAULT '',
    last_event_log_index BIGINT NOT NULL DEFAULT 0,
    last_event_block_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, pool_id)
);

CREATE TABLE IF NOT EXISTS rounds (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    pool_id BIGINT NOT NULL,
    round_id BIGINT NOT NULL,
    status TEXT NOT NULL,
    sold_count BIGINT NOT NULL DEFAULT 0,
    scratched_count BIGINT NOT NULL DEFAULT 0,
    claimed_count BIGINT NOT NULL DEFAULT 0,
    win_claimable_count BIGINT NOT NULL DEFAULT 0,
    total_tickets BIGINT NOT NULL DEFAULT 0,
    ticket_price BIGINT NOT NULL DEFAULT 0,
    round_prize_budget BIGINT NOT NULL DEFAULT 0,
    vrf_request_ref TEXT NOT NULL DEFAULT '',
    shuffle_root TEXT NOT NULL DEFAULT '',
    last_vrf_requested_at TIMESTAMPTZ,
    last_vrf_initialized_at TIMESTAMPTZ,
    last_event_block BIGINT NOT NULL DEFAULT 0,
    last_event_tx_hash TEXT NOT NULL DEFAULT '',
    last_event_log_index BIGINT NOT NULL DEFAULT 0,
    last_event_block_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, pool_id, round_id)
);

CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    ticket_id BIGINT NOT NULL,
    pool_id BIGINT NOT NULL,
    round_id BIGINT NOT NULL,
    owner TEXT NOT NULL,
    ticket_index BIGINT NOT NULL,
    status TEXT NOT NULL,
    reveal_authorized BOOLEAN NOT NULL DEFAULT FALSE,
    transferred_before_scratch BOOLEAN NOT NULL DEFAULT FALSE,
    mint_tx_hash TEXT NOT NULL DEFAULT '',
    claimed_by TEXT NOT NULL DEFAULT '',
    claim_clear_reward_amount BIGINT NOT NULL DEFAULT 0,
    last_event_block BIGINT NOT NULL DEFAULT 0,
    last_event_tx_hash TEXT NOT NULL DEFAULT '',
    last_event_log_index BIGINT NOT NULL DEFAULT 0,
    last_event_block_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS gasless_requests (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    digest TEXT NOT NULL UNIQUE,
    user_address TEXT NOT NULL,
    action TEXT NOT NULL,
    target_contract TEXT NOT NULL,
    params_hash TEXT NOT NULL,
    nonce BIGINT NOT NULL,
    deadline BIGINT NOT NULL,
    status TEXT NOT NULL,
    failure_code TEXT NOT NULL DEFAULT '',
    failure_reason TEXT NOT NULL DEFAULT '',
    tx_hash TEXT NOT NULL DEFAULT '',
    gas_used BIGINT,
    effective_gas_price_wei BIGINT,
    gas_cost_wei BIGINT,
    pool_id BIGINT,
    round_id BIGINT,
    ticket_id BIGINT,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature TEXT NOT NULL DEFAULT '',
    receipt_block_number BIGINT,
    receipt_block_hash TEXT NOT NULL DEFAULT '',
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reveal_requests (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    ticket_id BIGINT NOT NULL,
    request_user TEXT NOT NULL,
    owner_snapshot TEXT NOT NULL,
    request_status TEXT NOT NULL,
    zama_request_ref TEXT NOT NULL DEFAULT '',
    ticket_status_snapshot TEXT NOT NULL DEFAULT '',
    reveal_authorized_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
    auth_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    claim_clear_reward_amount BIGINT,
    claim_proof_ref TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pool_cost_ledgers (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    pool_id BIGINT NOT NULL,
    round_id BIGINT,
    cost_type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    tx_hash TEXT NOT NULL DEFAULT '',
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, cost_type, ref_type, ref_id)
);

CREATE TABLE IF NOT EXISTS deployment_registry (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    chain_name TEXT NOT NULL,
    contract_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    deployment_block BIGINT NOT NULL,
    deployment_tx_hash TEXT NOT NULL DEFAULT '',
    deployment_version TEXT NOT NULL DEFAULT 'v1',
    abi_source_path TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, contract_name, contract_address)
);

CREATE TABLE IF NOT EXISTS indexed_logs (
    id BIGSERIAL PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    contract_name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index BIGINT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    event_key TEXT NOT NULL,
    removed BOOLEAN NOT NULL DEFAULT FALSE,
    pool_id BIGINT,
    round_id BIGINT,
    ticket_id BIGINT,
    user_address TEXT NOT NULL DEFAULT '',
    digest TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS indexer_cursors (
    chain_id BIGINT NOT NULL,
    contract_name TEXT NOT NULL,
    last_processed_block BIGINT NOT NULL DEFAULT 0,
    last_processed_log_index BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chain_id, contract_name)
);

CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    job_key TEXT NOT NULL UNIQUE,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL,
    schedule_interval_seconds INTEGER NOT NULL DEFAULT 60,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_started_at TIMESTAMPTZ,
    last_finished_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by TEXT NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 25,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gasless_controls (
    id BIGSERIAL PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    control_type TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope_type, scope_key, control_type)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pools_chain_status_idx ON pools (chain_id, status, pool_id DESC);
CREATE INDEX IF NOT EXISTS rounds_chain_pool_idx ON rounds (chain_id, pool_id, round_id DESC);
CREATE INDEX IF NOT EXISTS tickets_owner_idx ON tickets (chain_id, lower(owner), ticket_id DESC);
CREATE INDEX IF NOT EXISTS tickets_claimed_by_idx ON tickets (chain_id, lower(claimed_by), ticket_id DESC);
CREATE INDEX IF NOT EXISTS gasless_requests_status_idx ON gasless_requests (chain_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS gasless_requests_user_idx ON gasless_requests (chain_id, lower(user_address), created_at DESC);
CREATE INDEX IF NOT EXISTS reveal_requests_ticket_user_idx ON reveal_requests (chain_id, ticket_id, lower(request_user), created_at DESC);
CREATE INDEX IF NOT EXISTS pool_cost_ledgers_pool_idx ON pool_cost_ledgers (chain_id, pool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS indexed_logs_block_idx ON indexed_logs (chain_id, block_number, log_index);
CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs (status, run_after);
CREATE INDEX IF NOT EXISTS gasless_controls_active_idx ON gasless_controls (scope_type, scope_key, control_type, is_active);
