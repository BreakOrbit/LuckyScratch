-- name: UpsertGaslessControl :one
INSERT INTO gasless_controls (
    scope_type,
    scope_key,
    control_type,
    is_active,
    reason,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6
)
ON CONFLICT (scope_type, scope_key, control_type) DO UPDATE SET
    is_active = EXCLUDED.is_active,
    reason = EXCLUDED.reason,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW()
RETURNING *;

-- name: GetActiveGaslessControl :one
SELECT *
FROM gasless_controls
WHERE scope_type = $1
  AND scope_key = $2
  AND control_type = $3
  AND is_active = TRUE
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY updated_at DESC
LIMIT 1;

-- name: InsertAuditLog :one
INSERT INTO audit_logs (
    actor,
    action,
    target_type,
    target_id,
    payload
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;
