-- name: InsertGaslessRequest :one
INSERT INTO gasless_requests (
    chain_id,
    digest,
    user_address,
    action,
    target_contract,
    params_hash,
    nonce,
    deadline,
    status,
    pool_id,
    round_id,
    ticket_id,
    request_payload,
    signature
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (digest) DO UPDATE SET
    user_address = EXCLUDED.user_address,
    action = EXCLUDED.action,
    target_contract = EXCLUDED.target_contract,
    params_hash = EXCLUDED.params_hash,
    nonce = EXCLUDED.nonce,
    deadline = EXCLUDED.deadline,
    pool_id = EXCLUDED.pool_id,
    round_id = EXCLUDED.round_id,
    ticket_id = EXCLUDED.ticket_id,
    request_payload = EXCLUDED.request_payload,
    signature = EXCLUDED.signature,
    updated_at = NOW()
RETURNING *;

-- name: GetGaslessRequestByDigest :one
SELECT *
FROM gasless_requests
WHERE digest = $1;

-- name: MarkGaslessRequestValidated :one
UPDATE gasless_requests
SET status = 'validated',
    updated_at = NOW()
WHERE digest = $1
RETURNING *;

-- name: MarkGaslessRequestSubmitted :one
UPDATE gasless_requests
SET status = 'submitted',
    tx_hash = $2,
    submitted_at = NOW(),
    updated_at = NOW()
WHERE digest = $1
RETURNING *;

-- name: BackfillGaslessRequestOnchainState :one
UPDATE gasless_requests
SET status = $2,
    failure_code = $3,
    failure_reason = $4,
    tx_hash = CASE
        WHEN tx_hash = '' THEN $5
        ELSE tx_hash
    END,
    gas_used = COALESCE($6, gas_used),
    effective_gas_price_wei = COALESCE($7, effective_gas_price_wei),
    gas_cost_wei = COALESCE($8, gas_cost_wei),
    receipt_block_number = COALESCE($9, receipt_block_number),
    receipt_block_hash = CASE
        WHEN sqlc.arg(receipt_block_hash)::text <> '' THEN sqlc.arg(receipt_block_hash)::text
        ELSE receipt_block_hash
    END,
    submitted_at = CASE
        WHEN submitted_at IS NULL AND $5 <> '' THEN NOW()
        ELSE submitted_at
    END,
    confirmed_at = CASE
        WHEN $2 = 'confirmed' AND confirmed_at IS NULL THEN NOW()
        ELSE confirmed_at
    END,
    finalized_at = CASE
        WHEN $2 = 'finalized' AND finalized_at IS NULL THEN NOW()
        ELSE finalized_at
    END,
    updated_at = NOW()
WHERE digest = $1
RETURNING *;

-- name: MarkGaslessRequestResult :one
UPDATE gasless_requests
SET status = $2,
    failure_code = $3,
    failure_reason = $4,
    gas_used = $5,
    effective_gas_price_wei = $6,
    gas_cost_wei = $7,
    receipt_block_number = $8,
    receipt_block_hash = $9,
    confirmed_at = CASE
        WHEN $2 = 'confirmed' THEN NOW()
        ELSE confirmed_at
    END,
    finalized_at = CASE
        WHEN $2 = 'finalized' THEN NOW()
        ELSE finalized_at
    END,
    updated_at = NOW()
WHERE digest = $1
RETURNING *;

-- name: ListGaslessRequestsByStatuses :many
SELECT *
FROM gasless_requests
WHERE chain_id = $1
  AND status = ANY($2::text[])
ORDER BY created_at ASC
LIMIT $3;

-- name: CountRecentGaslessRequestsByUser :one
SELECT COUNT(*)::BIGINT
FROM gasless_requests
WHERE chain_id = $1
  AND lower(user_address) = lower($2)
  AND created_at >= $3;
