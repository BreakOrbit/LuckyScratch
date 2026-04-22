-- name: UpsertUser :one
INSERT INTO users (
    wallet_address,
    last_seen_at
) VALUES (
    $1, NOW()
)
ON CONFLICT (wallet_address) DO UPDATE SET
    last_seen_at = NOW()
RETURNING *;

-- name: UpsertPool :one
INSERT INTO pools (
    chain_id,
    pool_id,
    creator,
    protocol_owned,
    mode,
    status,
    paused,
    close_requested,
    vrf_pending,
    initialized,
    theme_id,
    ticket_price,
    total_tickets_per_round,
    total_prize_budget,
    pool_instance_group_size,
    fee_bps,
    target_rtp_bps,
    hit_rate_bps,
    max_prize,
    selectable,
    current_round,
    locked_bond,
    reserved_prize_budget,
    locked_next_round_budget,
    realized_revenue,
    settled_prize_cost,
    settled_protocol_cost,
    accrued_platform_fee,
    creator_profit_claimed,
    claimable_creator_profit,
    created_block,
    created_tx_hash,
    last_event_block,
    last_event_tx_hash,
    last_event_log_index,
    last_event_block_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
)
ON CONFLICT (chain_id, pool_id) DO UPDATE SET
    creator = EXCLUDED.creator,
    protocol_owned = EXCLUDED.protocol_owned,
    mode = EXCLUDED.mode,
    status = EXCLUDED.status,
    paused = EXCLUDED.paused,
    close_requested = EXCLUDED.close_requested,
    vrf_pending = EXCLUDED.vrf_pending,
    initialized = EXCLUDED.initialized,
    theme_id = EXCLUDED.theme_id,
    ticket_price = EXCLUDED.ticket_price,
    total_tickets_per_round = EXCLUDED.total_tickets_per_round,
    total_prize_budget = EXCLUDED.total_prize_budget,
    pool_instance_group_size = EXCLUDED.pool_instance_group_size,
    fee_bps = EXCLUDED.fee_bps,
    target_rtp_bps = EXCLUDED.target_rtp_bps,
    hit_rate_bps = EXCLUDED.hit_rate_bps,
    max_prize = EXCLUDED.max_prize,
    selectable = EXCLUDED.selectable,
    current_round = EXCLUDED.current_round,
    locked_bond = EXCLUDED.locked_bond,
    reserved_prize_budget = EXCLUDED.reserved_prize_budget,
    locked_next_round_budget = EXCLUDED.locked_next_round_budget,
    realized_revenue = EXCLUDED.realized_revenue,
    settled_prize_cost = EXCLUDED.settled_prize_cost,
    settled_protocol_cost = EXCLUDED.settled_protocol_cost,
    accrued_platform_fee = EXCLUDED.accrued_platform_fee,
    creator_profit_claimed = EXCLUDED.creator_profit_claimed,
    claimable_creator_profit = EXCLUDED.claimable_creator_profit,
    created_block = EXCLUDED.created_block,
    created_tx_hash = EXCLUDED.created_tx_hash,
    last_event_block = EXCLUDED.last_event_block,
    last_event_tx_hash = EXCLUDED.last_event_tx_hash,
    last_event_log_index = EXCLUDED.last_event_log_index,
    last_event_block_hash = EXCLUDED.last_event_block_hash,
    updated_at = NOW()
RETURNING *;

-- name: ListPools :many
SELECT *
FROM pools
WHERE chain_id = $1
ORDER BY pool_id DESC
LIMIT $2 OFFSET $3;

-- name: GetPool :one
SELECT *
FROM pools
WHERE chain_id = $1
  AND pool_id = $2;

-- name: DeletePool :exec
DELETE FROM pools
WHERE chain_id = $1
  AND pool_id = $2;

-- name: UpsertRound :one
INSERT INTO rounds (
    chain_id,
    pool_id,
    round_id,
    status,
    sold_count,
    scratched_count,
    claimed_count,
    win_claimable_count,
    total_tickets,
    ticket_price,
    round_prize_budget,
    vrf_request_ref,
    shuffle_root,
    last_vrf_requested_at,
    last_vrf_initialized_at,
    last_event_block,
    last_event_tx_hash,
    last_event_log_index,
    last_event_block_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
)
ON CONFLICT (chain_id, pool_id, round_id) DO UPDATE SET
    status = EXCLUDED.status,
    sold_count = EXCLUDED.sold_count,
    scratched_count = EXCLUDED.scratched_count,
    claimed_count = EXCLUDED.claimed_count,
    win_claimable_count = EXCLUDED.win_claimable_count,
    total_tickets = EXCLUDED.total_tickets,
    ticket_price = EXCLUDED.ticket_price,
    round_prize_budget = EXCLUDED.round_prize_budget,
    vrf_request_ref = EXCLUDED.vrf_request_ref,
    shuffle_root = EXCLUDED.shuffle_root,
    last_vrf_requested_at = EXCLUDED.last_vrf_requested_at,
    last_vrf_initialized_at = EXCLUDED.last_vrf_initialized_at,
    last_event_block = EXCLUDED.last_event_block,
    last_event_tx_hash = EXCLUDED.last_event_tx_hash,
    last_event_log_index = EXCLUDED.last_event_log_index,
    last_event_block_hash = EXCLUDED.last_event_block_hash,
    updated_at = NOW()
RETURNING *;

-- name: GetRound :one
SELECT *
FROM rounds
WHERE chain_id = $1
  AND pool_id = $2
  AND round_id = $3;

-- name: DeleteRound :exec
DELETE FROM rounds
WHERE chain_id = $1
  AND pool_id = $2
  AND round_id = $3;

-- name: UpsertTicket :one
INSERT INTO tickets (
    chain_id,
    ticket_id,
    pool_id,
    round_id,
    owner,
    ticket_index,
    status,
    reveal_authorized,
    transferred_before_scratch,
    mint_tx_hash,
    claimed_by,
    claim_clear_reward_amount,
    last_event_block,
    last_event_tx_hash,
    last_event_log_index,
    last_event_block_hash
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
)
ON CONFLICT (chain_id, ticket_id) DO UPDATE SET
    pool_id = EXCLUDED.pool_id,
    round_id = EXCLUDED.round_id,
    owner = EXCLUDED.owner,
    ticket_index = EXCLUDED.ticket_index,
    status = EXCLUDED.status,
    reveal_authorized = EXCLUDED.reveal_authorized,
    transferred_before_scratch = EXCLUDED.transferred_before_scratch,
    mint_tx_hash = EXCLUDED.mint_tx_hash,
    claimed_by = EXCLUDED.claimed_by,
    claim_clear_reward_amount = EXCLUDED.claim_clear_reward_amount,
    last_event_block = EXCLUDED.last_event_block,
    last_event_tx_hash = EXCLUDED.last_event_tx_hash,
    last_event_log_index = EXCLUDED.last_event_log_index,
    last_event_block_hash = EXCLUDED.last_event_block_hash,
    updated_at = NOW()
RETURNING *;

-- name: GetTicket :one
SELECT *
FROM tickets
WHERE chain_id = $1
  AND ticket_id = $2;

-- name: DeleteTicket :exec
DELETE FROM tickets
WHERE chain_id = $1
  AND ticket_id = $2;

-- name: ListTicketsByOwner :many
SELECT *
FROM tickets
WHERE chain_id = $1
  AND lower(owner) = lower($2)
ORDER BY ticket_id DESC
LIMIT $3 OFFSET $4;

-- name: ListWinsByUser :many
SELECT *
FROM tickets
WHERE chain_id = $1
  AND lower(claimed_by) = lower($2)
  AND claim_clear_reward_amount > 0
ORDER BY ticket_id DESC
LIMIT $3 OFFSET $4;
