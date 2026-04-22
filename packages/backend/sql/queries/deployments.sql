-- name: UpsertDeployment :one
INSERT INTO deployment_registry (
    chain_id,
    chain_name,
    contract_name,
    contract_address,
    deployment_block,
    deployment_tx_hash,
    deployment_version,
    abi_source_path,
    is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
ON CONFLICT (chain_id, contract_name, contract_address) DO UPDATE SET
    chain_name = EXCLUDED.chain_name,
    deployment_block = EXCLUDED.deployment_block,
    deployment_tx_hash = EXCLUDED.deployment_tx_hash,
    deployment_version = EXCLUDED.deployment_version,
    abi_source_path = EXCLUDED.abi_source_path,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
RETURNING *;

-- name: GetActiveDeployment :one
SELECT *
FROM deployment_registry
WHERE chain_id = $1
  AND contract_name = $2
  AND is_active = TRUE
ORDER BY deployment_block DESC
LIMIT 1;

-- name: ListActiveDeployments :many
SELECT *
FROM deployment_registry
WHERE chain_id = $1
  AND is_active = TRUE
ORDER BY contract_name ASC, deployment_block DESC;
