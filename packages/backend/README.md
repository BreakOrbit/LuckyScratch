# LuckyScratch Backend

This directory contains the live Go backend for LuckyScratch.

Implemented scope:

- PostgreSQL-backed read model and recurring job state via `pgx` + `sqlc`
- startup migration runner and deployment metadata import from Hardhat artifacts into `deployment_registry`
- go-ethereum chain client plus LuckyScratch contract wrappers for the required read calls
- read-model indexer for finalized/safe core LuckyScratch events plus ERC-721 `Transfer`
- REST query API for pools, rounds, tickets, user tickets, user wins, and claim precheck
- reveal auth / claim-precheck flow with real `ownerOf` and `getTicketRevealState` checks, short-lived auth request storage, backend-scoped Zama relayer-sdk context generation, and ticket-scoped Zama `keyurl` / `user-decrypt` proxy endpoints
- worker-side recurring jobs for indexer catch-up, paginated pending-VRF checks, full-pool state reconciliation, Zama reveal proxy reconciliation, and stale job-lock recovery
- admin endpoints for jobs, pool costs, job retry, and targeted pool / round / ticket reindex

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
- `CHAIN_CONFIRMATIONS`
- `CHAIN_FINALIZATION_DEPTH`
- `CHAIN_REORG_LOOKBACK`
- `API_PUBLIC_BASE_URL`
- `CORS_ALLOW_ALL_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
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
The indexer now processes only finalized/safe blocks, filters log queries to the supported LuckyScratchCore plus ERC-721 topic set before decode, and paginates reconciliation / pending-VRF scans across the full pool set instead of stopping at the first page.
`GET /api/v1/admin/jobs` now includes indexer `head`, `safeHead`, per-contract cursor positions, and safe-block lag so operators can see whether replay is falling behind.
Admin reindex routes are available at `POST /api/v1/admin/pools/{poolId}/reindex`, `POST /api/v1/admin/pools/{poolId}/rounds/{roundId}/reindex`, and `POST /api/v1/admin/tickets/{ticketId}/reindex`.
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
Cross-origin browser access also requires either `CORS_ALLOWED_ORIGINS` or `CORS_ALLOW_ALL_ORIGINS=true` when the frontend is served from a different origin than the backend. `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist such as `https://app.example.com,https://www.example.com`.
In `development`, the backend automatically allows `http://localhost:3000` and `http://127.0.0.1:3000` so the local Next.js app can talk to `:8080` without extra setup.

Docker quick start:

```bash
cd packages/backend
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d
./update-containers.sh --logs
```

The compose stack starts two containers:

- `backend-api`
- `backend-worker`

You must provide `DATABASE_URL` for your existing PostgreSQL deployment before starting the stack.
`packages/backend/.env.docker.example` is the recommended starting point for compose-based deployment.
If your PostgreSQL server runs on the Docker host itself, do not use `127.0.0.1` inside the container; use a host-reachable address such as `host.docker.internal` instead.
By default the backend containers connect to `http://host.docker.internal:8545` for `RPC_URL`, so a local Hardhat node running on the host is reachable from Docker on macOS, Windows, and modern Linux Docker installations that support `host-gateway`.
If you need a different RPC, IPFS, Zama, or admin-token setup, export the corresponding environment variables before running `docker compose up -d`.
If your frontend is deployed on another origin, set `CORS_ALLOWED_ORIGINS` in `.env.docker` before starting the stack. For example: `CORS_ALLOWED_ORIGINS=https://frontend.example.com`.
If you intentionally want to allow any browser frontend to call the backend, set `CORS_ALLOW_ALL_ORIGINS=true` instead. That returns `Access-Control-Allow-Origin: *` for all origins.
For Sepolia, the minimal Zama setup is to point `RPC_URL` at a Sepolia RPC and set `CHAIN_ID=11155111` plus `CHAIN_NAME=sepolia`; the backend automatically loads the official Sepolia relayer and protocol contract defaults from `packages/backend/config/config.go`.
On the official Zama Sepolia testnet relayer, `ZAMA_API_KEY` is typically not required. Leave the rest of the `ZAMA_*` overrides empty unless you are targeting a non-default relayer or overriding protocol addresses.

`./update-containers.sh` now auto-loads `packages/backend/.env.docker` when that file exists.
You can also point it at a different file explicitly:

```bash
./update-containers.sh --env-file .env.docker
./update-containers.sh api --env-file .env.staging
```
