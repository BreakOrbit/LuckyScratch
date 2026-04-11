-- name: GetIndexerCursor :one
SELECT *
FROM indexer_cursors
WHERE chain_id = $1
  AND contract_name = $2;

-- name: UpsertIndexerCursor :one
INSERT INTO indexer_cursors (
    chain_id,
    contract_name,
    last_processed_block,
    last_processed_log_index
) VALUES (
    $1, $2, $3, $4
)
ON CONFLICT (chain_id, contract_name) DO UPDATE SET
    last_processed_block = EXCLUDED.last_processed_block,
    last_processed_log_index = EXCLUDED.last_processed_log_index,
    updated_at = NOW()
RETURNING *;

-- name: InsertIndexedLog :one
INSERT INTO indexed_logs (
    chain_id,
    contract_name,
    contract_address,
    event_name,
    tx_hash,
    log_index,
    block_number,
    block_hash,
    event_key,
    removed,
    pool_id,
    round_id,
    ticket_id,
    user_address,
    digest,
    payload
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
)
ON CONFLICT (chain_id, tx_hash, log_index) DO UPDATE SET
    contract_name = EXCLUDED.contract_name,
    contract_address = EXCLUDED.contract_address,
    event_name = EXCLUDED.event_name,
    block_number = EXCLUDED.block_number,
    block_hash = EXCLUDED.block_hash,
    event_key = EXCLUDED.event_key,
    removed = EXCLUDED.removed,
    pool_id = EXCLUDED.pool_id,
    round_id = EXCLUDED.round_id,
    ticket_id = EXCLUDED.ticket_id,
    user_address = EXCLUDED.user_address,
    digest = EXCLUDED.digest,
    payload = EXCLUDED.payload
RETURNING *;

-- name: ListIndexedLogsFromBlock :many
SELECT *
FROM indexed_logs
WHERE chain_id = $1
  AND contract_name = $2
  AND block_number >= $3
ORDER BY block_number ASC, log_index ASC;

-- name: DeleteIndexedLogsFromBlock :exec
DELETE FROM indexed_logs
WHERE chain_id = $1
  AND contract_name = $2
  AND block_number >= $3;
