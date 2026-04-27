CREATE INDEX IF NOT EXISTS pools_creator_pool_id_idx
    ON pools (chain_id, lower(creator), pool_id DESC);

CREATE INDEX IF NOT EXISTS tickets_pool_ticket_id_idx
    ON tickets (chain_id, pool_id, ticket_id DESC);

CREATE INDEX IF NOT EXISTS tickets_pool_round_ticket_id_idx
    ON tickets (chain_id, pool_id, round_id, ticket_id DESC);

CREATE INDEX IF NOT EXISTS tickets_owner_pool_ticket_id_idx
    ON tickets (chain_id, lower(owner), pool_id, ticket_id DESC);

CREATE INDEX IF NOT EXISTS tickets_chain_status_idx
    ON tickets (chain_id, status);

CREATE INDEX IF NOT EXISTS tickets_owner_claim_ready_idx
    ON tickets (chain_id, lower(owner), ticket_id DESC)
    WHERE status = 'Scratched' AND reveal_authorized = TRUE;

CREATE INDEX IF NOT EXISTS tickets_owner_winning_idx
    ON tickets (chain_id, lower(owner), ticket_id DESC)
    WHERE claim_clear_reward_amount > 0;

CREATE INDEX IF NOT EXISTS tickets_claimed_rewards_recent_idx
    ON tickets (chain_id, updated_at DESC, ticket_id DESC)
    WHERE lower(claimed_by) != '' AND claim_clear_reward_amount > 0;

CREATE INDEX IF NOT EXISTS tickets_claimed_rewards_player_idx
    ON tickets (chain_id, lower(claimed_by), updated_at DESC)
    WHERE lower(claimed_by) != '' AND claim_clear_reward_amount > 0;
