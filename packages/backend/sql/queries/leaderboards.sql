-- name: GetPlatformOverview :one
SELECT
  COALESCE((SELECT COUNT(*)::BIGINT FROM pools WHERE pools.chain_id = $1), 0::BIGINT) AS total_pools,
  COALESCE((SELECT COUNT(*)::BIGINT FROM pools WHERE pools.chain_id = $1 AND pools.status != 'Closed'), 0::BIGINT) AS active_pools,
  COALESCE((SELECT SUM(pools.realized_revenue)::BIGINT FROM pools WHERE pools.chain_id = $1), 0::BIGINT) AS total_realized_revenue,
  COALESCE((SELECT COUNT(*)::BIGINT FROM tickets WHERE tickets.chain_id = $1 AND tickets.status IN ('Scratched', 'Claimed')), 0::BIGINT) AS total_revealed_tickets,
  COALESCE((SELECT COUNT(*)::BIGINT FROM tickets WHERE tickets.chain_id = $1 AND lower(tickets.claimed_by) != '' AND tickets.claim_clear_reward_amount > 0), 0::BIGINT) AS total_winning_claims,
  COALESCE((SELECT SUM(tickets.claim_clear_reward_amount)::BIGINT FROM tickets WHERE tickets.chain_id = $1 AND lower(tickets.claimed_by) != '' AND tickets.claim_clear_reward_amount > 0), 0::BIGINT) AS total_claimed_rewards;

-- name: ListRecentWins :many
SELECT *
FROM tickets
WHERE chain_id = $1
  AND lower(claimed_by) != ''
  AND claim_clear_reward_amount > 0
ORDER BY updated_at DESC, ticket_id DESC
LIMIT $2 OFFSET $3;

-- name: ListTopPlayersAllTime :many
SELECT
  lower(claimed_by) AS player_address,
  MIN(claimed_by)::TEXT AS display_address,
  COUNT(*)::BIGINT AS win_count,
  COALESCE(SUM(claim_clear_reward_amount), 0)::BIGINT AS total_reward_amount,
  MAX(updated_at)::TIMESTAMPTZ AS last_win_at
FROM tickets
WHERE chain_id = $1
  AND lower(claimed_by) != ''
  AND claim_clear_reward_amount > 0
GROUP BY lower(claimed_by)
ORDER BY total_reward_amount DESC, win_count DESC, last_win_at DESC
LIMIT $2;

-- name: ListTopPlayersSince :many
SELECT
  lower(claimed_by) AS player_address,
  MIN(claimed_by)::TEXT AS display_address,
  COUNT(*)::BIGINT AS win_count,
  COALESCE(SUM(claim_clear_reward_amount), 0)::BIGINT AS total_reward_amount,
  MAX(updated_at)::TIMESTAMPTZ AS last_win_at
FROM tickets
WHERE chain_id = $1
  AND lower(claimed_by) != ''
  AND claim_clear_reward_amount > 0
  AND updated_at >= $2
GROUP BY lower(claimed_by)
ORDER BY total_reward_amount DESC, win_count DESC, last_win_at DESC
LIMIT $3;
