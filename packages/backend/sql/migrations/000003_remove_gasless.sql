DELETE FROM pool_cost_ledgers
WHERE cost_type = 'SPONSOR_GAS'
   OR ref_type = 'gasless_request';

DELETE FROM indexed_logs
WHERE event_name = 'GaslessExecuted';

DELETE FROM jobs
WHERE job_key IN ('gasless.receipt_sync', 'gasless.retry_failed')
   OR job_type IN ('gasless.receipt_sync', 'gasless.retry_failed');

ALTER TABLE IF EXISTS indexed_logs
    DROP COLUMN IF EXISTS digest;

DROP INDEX IF EXISTS gasless_requests_status_idx;
DROP INDEX IF EXISTS gasless_requests_user_idx;
DROP INDEX IF EXISTS gasless_controls_active_idx;

DROP TABLE IF EXISTS gasless_requests;
DROP TABLE IF EXISTS gasless_controls;
