-- name: InsertPoolCostLedger :one
INSERT INTO pool_cost_ledgers (
    chain_id,
    pool_id,
    round_id,
    cost_type,
    amount,
    tx_hash,
    ref_type,
    ref_id,
    metadata
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
ON CONFLICT (chain_id, cost_type, ref_type, ref_id) DO UPDATE SET
    round_id = EXCLUDED.round_id,
    amount = EXCLUDED.amount,
    tx_hash = EXCLUDED.tx_hash,
    metadata = EXCLUDED.metadata
RETURNING *;

-- name: ListPoolCostLedgers :many
SELECT *
FROM pool_cost_ledgers
WHERE chain_id = $1
  AND pool_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetPoolCostTotals :many
SELECT
    cost_type,
    COALESCE(SUM(amount), 0)::BIGINT AS total_amount
FROM pool_cost_ledgers
WHERE chain_id = $1
  AND pool_id = $2
GROUP BY cost_type
ORDER BY cost_type ASC;

-- name: GetGlobalCostTotal :one
SELECT COALESCE(SUM(amount), 0)::BIGINT
FROM pool_cost_ledgers
WHERE chain_id = $1;

-- name: GetGlobalSponsorCostTotal :one
SELECT COALESCE(SUM(amount), 0)::BIGINT
FROM pool_cost_ledgers
WHERE chain_id = $1
  AND cost_type = 'SPONSOR_GAS';

-- name: GetPoolCostTotal :one
SELECT COALESCE(SUM(amount), 0)::BIGINT
FROM pool_cost_ledgers
WHERE chain_id = $1
  AND pool_id = $2;

-- name: GetPoolSponsorCostTotal :one
SELECT COALESCE(SUM(amount), 0)::BIGINT
FROM pool_cost_ledgers
WHERE chain_id = $1
  AND pool_id = $2
  AND cost_type = 'SPONSOR_GAS';
