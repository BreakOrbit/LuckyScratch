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
  lower(t.claimed_by) AS player_address,
  MIN(t.claimed_by)::TEXT AS display_address,
  COUNT(*)::BIGINT AS win_count,
  COALESCE(SUM(t.claim_clear_reward_amount), 0)::BIGINT AS total_reward_amount,
  MAX(t.updated_at)::TIMESTAMPTZ AS last_win_at,
  COALESCE(us.nickname, '') AS nickname,
  COALESCE(us.avatar_url, '') AS avatar_url
FROM tickets t
LEFT JOIN user_settings us ON us.wallet_address = lower(t.claimed_by)
WHERE t.chain_id = $1
  AND lower(t.claimed_by) != ''
  AND t.claim_clear_reward_amount > 0
GROUP BY lower(t.claimed_by), us.nickname, us.avatar_url
ORDER BY total_reward_amount DESC, win_count DESC, last_win_at DESC
LIMIT $2;

-- name: ListTopPlayersSince :many
SELECT
  lower(t.claimed_by) AS player_address,
  MIN(t.claimed_by)::TEXT AS display_address,
  COUNT(*)::BIGINT AS win_count,
  COALESCE(SUM(t.claim_clear_reward_amount), 0)::BIGINT AS total_reward_amount,
  MAX(t.updated_at)::TIMESTAMPTZ AS last_win_at,
  COALESCE(us.nickname, '') AS nickname,
  COALESCE(us.avatar_url, '') AS avatar_url
FROM tickets t
LEFT JOIN user_settings us ON us.wallet_address = lower(t.claimed_by)
WHERE t.chain_id = $1
  AND lower(t.claimed_by) != ''
  AND t.claim_clear_reward_amount > 0
  AND t.updated_at >= $2
GROUP BY lower(t.claimed_by), us.nickname, us.avatar_url
ORDER BY total_reward_amount DESC, win_count DESC, last_win_at DESC
LIMIT $3;
