-- name: UpsertJob :one
INSERT INTO jobs (
    job_key,
    job_type,
    payload,
    status,
    schedule_interval_seconds,
    run_after,
    max_attempts
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
ON CONFLICT (job_key) DO UPDATE SET
    job_type = EXCLUDED.job_type,
    payload = EXCLUDED.payload,
    schedule_interval_seconds = EXCLUDED.schedule_interval_seconds,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = NOW()
RETURNING *;

-- name: ClaimDueJobs :many
WITH picked AS (
    SELECT id
    FROM jobs
    WHERE status IN ('pending', 'completed', 'failed')
      AND run_after <= NOW()
    ORDER BY run_after ASC
    FOR UPDATE SKIP LOCKED
    LIMIT $1
)
UPDATE jobs
SET status = 'running',
    locked_at = NOW(),
    locked_by = $2,
    last_started_at = NOW(),
    attempts = attempts + 1,
    updated_at = NOW()
WHERE id IN (SELECT id FROM picked)
RETURNING *;

-- name: ReleaseStaleRunningJobs :many
UPDATE jobs
SET status = 'pending',
    run_after = NOW(),
    locked_at = NULL,
    locked_by = '',
    last_error = CASE
        WHEN last_error = '' THEN 'job lock timed out and was reclaimed'
        ELSE last_error
    END,
    updated_at = NOW()
WHERE status = 'running'
  AND locked_at IS NOT NULL
  AND locked_at <= NOW() - ($1::BIGINT * INTERVAL '1 second')
RETURNING *;

-- name: GetJob :one
SELECT *
FROM jobs
WHERE id = $1;

-- name: ListJobs :many
SELECT *
FROM jobs
ORDER BY job_key ASC;

-- name: MarkJobCompleted :one
UPDATE jobs
SET status = 'completed',
    run_after = $2,
    locked_at = NULL,
    locked_by = '',
    last_finished_at = NOW(),
    last_error = '',
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MarkJobFailed :one
UPDATE jobs
SET status = 'failed',
    run_after = $2,
    locked_at = NULL,
    locked_by = '',
    last_finished_at = NOW(),
    last_error = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RetryJob :one
UPDATE jobs
SET status = 'pending',
    run_after = NOW(),
    locked_at = NULL,
    locked_by = '',
    last_error = '',
    updated_at = NOW()
WHERE id = $1
RETURNING *;
