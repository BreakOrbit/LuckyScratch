# LuckyScratch Backend

This directory contains the live Go backend for LuckyScratch.

Implemented scope:

- PostgreSQL-backed read model and recurring job state via `pgx` + `sqlc`
- startup migration runner and deployment metadata import from Hardhat artifacts into `deployment_registry`
- go-ethereum chain client plus LuckyScratch contract wrappers for the required read calls
- read-model indexer for core LuckyScratch events plus ERC-721 `Transfer`
- REST query API for pools, rounds, tickets, user tickets, user wins, and claim precheck
- reveal auth / claim-precheck flow with real `ownerOf` and `getTicketRevealState` checks, short-lived auth request storage, backend-scoped Zama relayer-sdk context generation, and ticket-scoped Zama `keyurl` / `user-decrypt` proxy endpoints
- worker-side recurring jobs for indexer catch-up, pending-VRF checks, state reconciliation, Zama reveal proxy reconciliation, and stale job-lock recovery
- admin endpoints for jobs, pool costs, and job retry

Current boundaries:

- final reward claim remains client-driven via `claimReward(ticketId, clearRewardAmount, decryptionProof)`
- Redis is not wired yet; recurring jobs currently use the PostgreSQL `jobs` table only
- SIWE / JWT auth is not implemented; admin endpoints use `ADMIN_TOKEN` when configured

Current backend layout:

- `main.go`: single backend entrypoint with `all`, `api`, and `worker` modes
- `go.mod`: local backend module path is `lucky-scratch`, so in-repo Go imports use `lucky-scratch/...`
- top-level packages such as `app/`, `api/`, `store/`, `contracts/`, and `zama/`: the old `internal/` tree has been removed
- `api/` and `jobs/`: depend on narrow service/store interfaces instead of binding directly to concrete service implementations
- `readmodel/`: wraps read-only pool / round / ticket queries so HTTP handlers do not assemble sqlc params directly
- `store/db`: `sqlc`-generated query layer; services now depend on its `Querier` interface rather than `*db.Queries`
- `sql/migrations`: runtime PostgreSQL migrations
- `sql/queries`: `sqlc` query sources
- `store/db`: generated Go query layer

Required environment variables:

- `DATABASE_URL`
- `RPC_URL`

Recommended environment variables:

- `ADMIN_TOKEN`
- `AUTO_IMPORT_DEPLOYMENTS`
- `DEPLOYMENTS_DIR`
- `CHAIN_ID`
- `CHAIN_NAME`
- `API_PUBLIC_BASE_URL`
- `REVEAL_AUTH_TTL`
- `REVEAL_SUBMIT_TIMEOUT`
- `JOB_LOCK_TIMEOUT`
- `ZAMA_MODE`
- `ZAMA_RELAYER_URL`
- `ZAMA_API_KEY`
- `ZAMA_HTTP_TIMEOUT`

The full environment template lives in `packages/backend/.env.example`.
Optional settings in that file are commented out so the code defaults still apply unless you explicitly override them.
For Sepolia, the backend now ships with official Zama relayer / contract defaults, emits a ticket-scoped backend proxy relayer URL in reveal-auth responses when `ZAMA_MODE=zama-relayer-sdk`, and proxies `keyurl` / `user-decrypt` requests to the upstream Zama relayer.
If reveal-auth needs to emit a public proxy URL from behind a reverse proxy, configure `API_PUBLIC_BASE_URL` or make sure forwarded host/proto headers are passed through correctly; the backend now fails fast instead of silently falling back to a direct upstream relayer URL.
The worker also reconciles submitted Zama decrypt jobs in the background and times out stale local `submitting` requests after `REVEAL_SUBMIT_TIMEOUT` so they do not stay queued forever.
Recurring PostgreSQL jobs also reclaim stale `running` locks after `JOB_LOCK_TIMEOUT`, so a worker crash does not strand background jobs forever.
With the currently pinned `@zama-fhe/relayer-sdk` 0.4.1 / relayer v2 flow, the backend can prevent duplicate local submits and reconcile known upstream jobs, but it cannot losslessly recover the narrow failure mode where the upstream relayer accepts a POST and the backend crashes before persisting the returned upstream `jobId`; the upstream protocol does not expose a client-supplied idempotency key or a lookup-by-local-request-ref path.

Quick start:

```bash
cd packages/backend
go test ./...
go run .
```

`go run .` starts both the HTTP API and the worker in one process. If you need to run them separately, use:

```bash
go run . api
go run . worker
```

The API and worker expect a reachable PostgreSQL instance plus a reachable EVM RPC.
