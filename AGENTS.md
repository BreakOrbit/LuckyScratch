# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

LuckyScratch is a blockchain-based scratch-card dApp built on **Scaffold-ETH 2 (Hardhat flavor)**.

**Stack**: Solidity (Hardhat) | Next.js App Router + RainbowKit + Wagmi + Viem + Tailwind/DaisyUI | Go + PostgreSQL backend | Zama fhEVM (encrypted on-chain state) | Chainlink VRF v2.5

### Repository Layout

- **Contracts**: `packages/hardhat/contracts/luckyScratch/` — LuckyScratch is the only active contract suite
- **Deploy**: `packages/hardhat/deploy/02_deploy_lucky_scratch.ts` — full fresh redeploy by default; set `LUCKY_SCRATCH_REUSE_EXISTING=true` to keep old addresses
- **Tests**: `packages/hardhat/test/luckyScratch/` — Hardhat fhEVM mock environment; test-only token at `contracts/test/TestConfidentialUSDC.sol`
- **Backend**: `packages/backend/` — single `main.go` entrypoint (`all` / `api` / `worker` modes), PostgreSQL-backed indexer + API
- **Frontend**: `packages/nextjs/` — App Router pages, components under `components/`
- **Docs**: `doc/` — contract design, backend design, deployment runbook, UI specs

### Backend Structure

- `api/`, `jobs/` use narrow dependency interfaces; `store/db.Querier` is the primary storage boundary
- Read-only queries route through `readmodel/`
- SQL: `sql/migrations/` for runtime migrations, `sql/queries/` for sqlc
- Docker: `Dockerfile`, `docker-compose.yml` (runs `backend-api` + `backend-worker`), `update-containers.sh`
- Cleanup: `sql/clean_database.sql` — truncates all tables, resets sequences (use after contract redeploy)

### LuckyScratch Contracts

| Contract | Responsibility |
|----------|---------------|
| `LuckyScratchCore` | Pool lifecycle, round management, ticket purchase/scratch/claim, creator accounting, next-round rolling |
| `LuckyScratchTicket` | ERC-721 ticket NFT, transfer lock after scratch |
| `LuckyScratchTreasury` | cUSDC custody, payments, payouts, bond refund |
| `LuckyScratchVRFAdapter` | Chainlink VRF v2.5 adapter; mock mode for local tests |

Shared: `interfaces/`, `libraries/`, `types/` under `contracts/luckyScratch/`

### Key Design Rules

- Reward values are encrypted on-chain with fhEVM; payout requires `claimReward(ticketId, clearRewardAmount, decryptionProof)`
- `scratchTicket` makes encrypted reward handle publicly decryptable; frontend obtains KMS `decryptionProof` via backend reveal-auth + Zama `publicDecrypt`
- Scratch UI prepares results before the user scratches: `/scratch/[poolId]` submits `scratchTicket`/`batchScratch`, decrypts prize handles, then unlocks the scratch animation so revealed cards show ticket-specific amounts immediately
- Decrypted ticket results are cached in the browser by chain, core contract, wallet, and ticket id so `/scratch/[poolId]` and `/my-tickets` can reuse known zero/winning amounts without repeat decrypt calls
- Already scratched tickets are display-only in the scratch UI; only tickets that were `Unscratched` when preparation ran get an interactive scratch coating
- `/my-tickets` classifies tabs client-side from the full user inventory plus browser reward cache: All, Unscratched, Revealed, Winning, and To Claim
- All state-changing transactions are wallet-driven; no backend transaction relay
- `tickets(ticketId)` returns compact `uint64` pool/round ids — keep backend/client bindings in sync with ABI
- `createPool` enforces budget bands, ticket-price presets, 6-decimal cUSDC bond schedule, 256 ticket ceiling, and prize-tier consistency
- Core contract is gas/bytecode-sensitive: avoid wrapper views, redundant storage, or duplicated helpers without justification
- Frontend/backend reads prefer public getters on `LuckyScratchCore` (`poolConfigs`, `poolStates`, `poolAccounting`, `roundStates`, `tickets`, `getTicketRevealState`, `claimableCreatorProfit`, `ownerOf`); list queries belong in the backend
- Backend reveal service issues ticket-scoped Zama proxy URLs; `ZAMA_API_KEY` stays server-side, never exposed to client

### Frontend Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `app/page.tsx` | Homepage with live backend data |
| `/store` | `app/store/page.tsx` | Sortable/filterable pool grid |
| `/purchase/[poolId]` | `components/purchase/PurchasePage.tsx` | Ticket selection + checkout |
| `/scratch/[poolId]` | `components/scratch/ScratchPage.tsx` | Scratch + decrypt results |
| `/my-tickets` | `components/my-tickets/MyTicketsVault.tsx` | Ticket vault + claim |
| `/create-pool` | `components/create-pool/CreatePoolPage.tsx` | Pool creation wizard |
| `/pool-detail/[id]` | `components/pool-detail/PoolDetailPage.tsx` | Pool detail + round state |
| `/pool-rankings` | `app/pool-rankings/page.tsx` | Pool leaderboard |
| `/player-rankings` | `app/player-rankings/page.tsx` | Player leaderboard |
| `/profile` | `app/profile/page.tsx` | User profile + creator panel |
| `/faucet` | `app/faucet/page.tsx` | Sepolia cUSDC faucet |

### Design Conventions

- Pool covers: canonical 16:9 frame across all surfaces
- Ticket artwork: canonical 9:16 frame
- Wallet header: project primary yellow in both states; Sepolia-first UX; wrong-network only offers disconnect
- RainbowKit connectors: MetaMask, WalletConnect, Ledger, Rainbow, Safe, optional burner (no Base Account)

## Common Commands

```bash
# Frontend dev
yarn chain                    # Start local blockchain
yarn deploy                   # Deploy contracts (fresh by default)
yarn start                    # Next.js at http://localhost:3000
yarn compile                  # Compile Solidity
yarn next:build               # Build frontend
yarn lint && yarn format      # Lint + format

# Verification
yarn compile && yarn hardhat:check-types && yarn test

# Live deploy
yarn deploy --network sepolia                                          # fresh redeploy
LUCKY_SCRATCH_REUSE_EXISTING=true yarn deploy --network sepolia        # reuse existing

# Backend (from packages/backend/)
go test ./...
go run . [all|api|worker]
docker compose up -d
./update-containers.sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/clean_database.sql
```

### Runtime Environment

**Backend** (see `packages/backend/.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `RPC_URL` | Yes | Ethereum RPC endpoint |
| `ADMIN_TOKEN` | No | Admin route auth |
| `API_PUBLIC_BASE_URL` | No* | Absolute URL for reverse proxy setups |
| `CORS_ALLOWED_ORIGINS` | No* | Required for cross-origin frontend access |
| `CHAIN_FINALIZATION_DEPTH` | No | Block finalization depth (default: 3) |
| `JOB_INDEXER_INTERVAL` | No | Indexer poll interval (default: 5s) |
| `IPFS_PROVIDER` | No | `pinata` or `kubo` for artwork uploads |

**Frontend** (see `packages/nextjs/.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | No* | Backend API URL (fallback: `http://127.0.0.1:8080`) |
| `NEXT_PUBLIC_IPFS_GATEWAY_BASE_URL` | No | Rewrite IPFS URLs for display |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | No | Override Sepolia RPC |
| `NEXT_PUBLIC_ZAMA_RELAYER_URL` | No | Override Zama relayer URL |

Required WASM files: `packages/nextjs/public/tfhe_bg.wasm`, `packages/nextjs/public/kms_lib_bg.wasm`

### Deployment Notes

- Sepolia/mainnet `LuckyScratchVRFAdapter` requires Chainlink VRF subscription consumer registration after deploy
- Live deploys use `packages/hardhat/scripts/runHardhatDeployWithPK.ts` (compile locally first, then `deploy --no-compile` on target)
- After full live redeploy: stop backend, run `clean_database.sql`, restart backend
- `deployedContracts.ts` is auto-generated from deployment artifacts; can be empty until live-network deploy is written to disk
- GitHub Actions runs: `go test`, `yarn hardhat:test`, `yarn next:build`, lint, type checks

## Architecture

### Contract Interaction (Frontend)

**Hook names** (always use these):
- `useScaffoldReadContract` — NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` — NOT ~~useScaffoldContractWrite~~

Other hooks: `useScaffoldWatchContractEvent`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`

Contract data: `packages/nextjs/contracts/deployedContracts.ts` (auto-generated) + `externalContracts.ts` (manual)

Confidential cUSDC payment: the purchase UI checks for a non-zero `CUSDCToken.confidentialBalanceOf(wallet)` handle before submitting, and the wallet must call `CUSDCToken.setOperator(LuckyScratchTreasury, validUntil)` before Treasury can collect ticket payments.

**Always use hooks from `packages/nextjs/hooks/scaffold-eth`.**

### UI Components

Use `@scaffold-ui/components`: `Address`, `AddressInput`, `Balance`, `EtherInput`, `IntegerInput`

### Styling

Use **DaisyUI classes** (`btn btn-primary`, `card bg-base-100`) over raw Tailwind.

### Notifications

Use `notification` from `~~/utils/scaffold-eth` + `getParsedError` for error messages.

## Code Style

### Identifiers

| Style | Category |
|-------|----------|
| `UpperCamelCase` | class / interface / type / enum / component functions |
| `lowerCamelCase` | variable / parameter / function / property / module alias |
| `CONSTANT_CASE` | constant / enum / global variables |
| `snake_case` | hardhat deploy files and foundry script files |

### Conventions

- Import path alias: `~~` (e.g., `import { useTargetNetwork } from "~~/hooks/scaffold-eth"`)
- Use `type` over `interface` for custom types
- Types: `UpperCamelCase` without `T` prefix
- Avoid explicit typing when TypeScript can infer
- Comments: only when they add non-obvious information

### Network Configuration

Add networks in `packages/hardhat/hardhat.config.ts` (Hardhat) and `packages/nextjs/scaffold.config.ts` (frontend) before deploying to testnet/mainnet.

## Documentation

Use **Context7 MCP** tools to fetch up-to-date documentation for any library (Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.).

## Skills & Agents Index

IMPORTANT: Prefer retrieval-led reasoning over pre-trained knowledge. Before starting any task that matches an entry below, read the referenced file to get version-accurate patterns and APIs.

**Skills** (read `.agents/skills/<name>/SKILL.md` before implementing):

- **openzeppelin** — OpenZeppelin Contracts integration, library-first development, pattern discovery from installed source
- **erc-721** — NFT-specific pitfalls: `_safeMint` reentrancy, on-chain SVG stack-too-deep, marketplace metadata `attributes`, IPFS base URI trailing slash
- **eip-5792** — batch transactions, wallet_sendCalls, paymaster, ERC-7677
- **zama-fhevm** — Zama fhEVM development for this repo: encrypted onchain state, relayer-backed browser encryption/decryption, Hardhat fhevm tasks/tests, and LuckyScratch privacy logic
- **ponder** — blockchain event indexing, GraphQL APIs, onchain data queries
- **siwe** — Sign-In with Ethereum, wallet authentication, SIWE sessions, EIP-4361
- **x402** — HTTP 402 payment-gated routes, micropayments, API monetization, x402 protocol
- **drizzle-neon** — Drizzle ORM, Neon PostgreSQL, database integration, off-chain storage
- **subgraph** — The Graph subgraph integration, blockchain event indexing, GraphQL APIs

**Agents** (in `.agents/agents/`):

- **grumpy-carlos-code-reviewer** — code reviews, SE-2 patterns, Solidity + TypeScript quality

## Maintenance Rule

This file must track the current repository state. Any code change that affects architecture, file layout, commands, contract interfaces, deployment flow, testing flow, or key product behavior must update `AGENTS.md` in the same change. Do not leave it stale after shipping code.
