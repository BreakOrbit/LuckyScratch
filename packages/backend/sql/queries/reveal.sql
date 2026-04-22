-- name: InsertRevealRequest :one
INSERT INTO reveal_requests (
    chain_id,
    ticket_id,
    request_user,
    owner_snapshot,
    request_status,
    zama_request_ref,
    ticket_status_snapshot,
    reveal_authorized_snapshot,
    auth_payload,
    claim_clear_reward_amount,
    claim_proof_ref,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING *;

-- name: GetLatestRevealRequest :one
SELECT *
FROM reveal_requests
WHERE chain_id = $1
  AND ticket_id = $2
  AND lower(request_user) = lower($3)
ORDER BY created_at DESC
LIMIT 1;

-- name: ListStaleSubmittingRevealRequests :many
SELECT *
FROM reveal_requests
WHERE chain_id = $1
  AND request_status = 'submitting'
  AND updated_at <= $2
ORDER BY updated_at ASC
LIMIT $3;

-- name: ListSubmittedRevealRequests :many
SELECT *
FROM reveal_requests
WHERE chain_id = $1
  AND request_status = 'submitted'
  AND claim_proof_ref <> ''
ORDER BY updated_at ASC
LIMIT $2;

-- name: GetRevealRequestByJobRef :one
SELECT *
FROM reveal_requests
WHERE chain_id = $1
  AND ticket_id = $2
  AND claim_proof_ref = $3
ORDER BY created_at DESC
LIMIT 1;

-- name: GetRevealRequestByZamaRequestRef :one
SELECT *
FROM reveal_requests
WHERE chain_id = $1
  AND ticket_id = $2
  AND zama_request_ref = $3
ORDER BY created_at DESC
LIMIT 1;

-- name: UpdateRevealRequestProxyState :one
UPDATE reveal_requests
SET request_status = sqlc.arg(request_status),
    claim_proof_ref = CASE
        WHEN sqlc.arg(claim_proof_ref) = '' THEN claim_proof_ref
        ELSE sqlc.arg(claim_proof_ref)
    END,
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;
