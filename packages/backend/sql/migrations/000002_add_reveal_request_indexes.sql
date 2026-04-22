CREATE INDEX IF NOT EXISTS reveal_requests_ticket_request_ref_idx
    ON reveal_requests (chain_id, ticket_id, zama_request_ref, created_at DESC);

CREATE INDEX IF NOT EXISTS reveal_requests_ticket_job_ref_idx
    ON reveal_requests (chain_id, ticket_id, claim_proof_ref, created_at DESC);
