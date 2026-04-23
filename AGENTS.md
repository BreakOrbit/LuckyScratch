# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Scaffold-ETH 2 (SE-2) is a starter kit for building dApps on Ethereum. It comes in **two flavors** based on the Solidity framework:

- **Hardhat flavor**: Uses `packages/hardhat` with hardhat-deploy plugin
- **Foundry flavor**: Uses `packages/foundry` with Forge scripts

Both flavors share the same frontend package:

- **packages/nextjs**: React frontend (Next.js App Router, not Pages Router, RainbowKit, Wagmi, Viem, TypeScript, Tailwind CSS with DaisyUI)

### Detecting Which Flavor You're Using

Check which package exists in the repository:

- If `packages/hardhat` exists → **Hardhat flavor** (follow Hardhat instructions)
- If `packages/foundry` exists → **Foundry flavor** (follow Foundry instructions)

### Current Repository Status

This repository is currently running in **Hardhat flavor**.

- Smart contracts live in `packages/hardhat/contracts/`
- The active LuckyScratch implementation lives in `packages/hardhat/contracts/luckyScratch/`
- The Go backend now lives in `packages/backend/`, starts from a single `packages/backend/main.go` entrypoint, and includes a real PostgreSQL-backed API/worker implementation
- The backend Go module path is now `lucky-scratch`, in-repo Go imports use `lucky-scratch/...` module-local paths, and the previous `packages/backend/internal/` layout has been flattened into top-level backend packages such as `packages/backend/app/`, `packages/backend/api/`, and `packages/backend/store/`
- The backend structure now keeps `api/` and `jobs/` behind narrow dependency interfaces, uses `store/db.Querier` as the primary storage boundary instead of wiring concrete `*db.Queries` types through upper layers, and routes read-only pool / round / ticket queries through `packages/backend/readmodel/`
- Backend SQL sources are organized under `packages/backend/sql/` with `sql/migrations/` for runtime migrations and `sql/queries/` for `sqlc` query files
- Backend container assets now live under `packages/backend/Dockerfile`, `packages/backend/docker-compose.yml`, `packages/backend/.env.docker.example`, and `packages/backend/update-containers.sh`; the compose stack runs `backend-api` and `backend-worker` against an external PostgreSQL instance supplied through `DATABASE_URL`, mounts `packages/hardhat/deployments` read-only into `/app/deployments`, defaults `RPC_URL` to `http://host.docker.internal:8545`, `packages/backend/.env.docker.example` documents both local hardhat and Sepolia minimum Zama settings, and `update-containers.sh` now auto-loads `packages/backend/.env.docker` unless `--env-file` overrides it
- Scaffold template example contracts and demo tasks have been removed; LuckyScratch is the only active contract suite
- Deployment wiring lives in `packages/hardhat/deploy/02_deploy_lucky_scratch.ts`
- Contract tests for LuckyScratch live in `packages/hardhat/test/luckyScratch/`
- Production deployment now targets real `cUSDC` addresses and real Chainlink VRF v2.5 network settings on supported networks such as Sepolia; no local mock token is deployed by the LuckyScratch deploy script
- `createPool` now applies the documented 6-decimal cUSDC bond schedule correctly (`50-200` => `+20%`, `201-500` => `+15%`, `501-2000` => `+10%`) and caps `totalTicketsPerRound` at `256` to bound VRF initialization cost
- Ticket metadata in `LuckyScratchCore.tickets` is now slot-packed with `uint64` pool / round ids, and the claim path no longer maintains an unused encrypted lifetime-winnings accumulator
- The homepage no longer exposes a scaffold demo contract panel; it is now a project status entry page
- The store frontend now renders a live sortable, price-filterable, paginated pool grid under `packages/nextjs/app/store/page.tsx` with supporting UI components in `packages/nextjs/components/store/`; it reads backend pool inventory plus platform overview data instead of demo cards, and store navigation / theme badges use in-repo Heroicons components instead of Material Symbols font ligatures
- The homepage hero CTA buttons now route to dedicated ranking experiences: `Prize Pool Rankings` opens `packages/nextjs/app/pool-rankings/page.tsx`, and `Heroes Leaderboard` opens `packages/nextjs/app/player-rankings/page.tsx`
- The homepage `HeroSection` status pill now reads backend `/healthz`, while `LiveWinnersTicker`, `StatsSection`, `ThemePoolsSection`, and `CommunityPoolsSection` all consume live backend-indexed data instead of static winner / stats / pool arrays
- The homepage official and community pool cards now show `win rate` / `RTP` and `max prize` on the metadata row, while the purchase CTA appends the single-ticket price in parentheses
- The homepage featured pool cards and store pool cards now route users into the purchase flow at `packages/nextjs/app/purchase/[poolId]/page.tsx`
- `packages/nextjs/components/rankings/PoolRankingsPage.tsx` and `PlayerRankingsPage.tsx` now render live leaderboard data from the backend instead of podium / table demo arrays; pool rankings use indexed pool sales + hit-rate data, while player rankings aggregate claimed winning tickets
- The purchase frontend now renders a live ticket-selection and checkout experience under `packages/nextjs/app/purchase/[poolId]/page.tsx` with the main body in `packages/nextjs/components/purchase/PurchasePage.tsx`; it reads backend purchase-context data, derives sold/available ticket indexes from the indexed round, checks live `cUSDC` balance/allowance, submits `approve` when needed, executes `LuckyScratchCore.purchaseTickets` / `purchaseTicketsWithSelection`, parses `TicketPurchased`, and routes minted ticket ids into the scratch flow
- The scratch frontend now renders a live reveal handoff under `packages/nextjs/app/scratch/[poolId]/page.tsx` with the main body in `packages/nextjs/components/scratch/ScratchPage.tsx`; a single `ticketId` opens the real `TicketRevealWorkspace`, while batch mode reads backend ticket records for the provided ids and links each ticket into the real reveal/decrypt workspace instead of fabricating scratch outcomes
- The create-pool frontend under `packages/nextjs/app/create-pool/page.tsx` / `packages/nextjs/components/create-pool/CreatePoolPage.tsx` now uses real LuckyScratch constraints (`256` ticket cap, supported ticket-price presets, RTP/hit-rate/max-prize validation), can read/approve live `cUSDC` allowance via `packages/nextjs/contracts/externalContracts.ts`, uploads cover/ticket artwork to the backend IPFS service, creates a backend metadata draft, calls `LuckyScratchCore.createPool`, parses `PoolCreated`, and finalizes pool metadata binding back through the backend
- The profile overview and left-side identity card now read wallet-indexed tickets, claimed wins, creator summary, and live `cUSDC` balance; the page no longer shows hard-coded profile numbers or addresses
- The profile frontend sidebar `Setting` action now renders a converted settings terminal panel from `doc/profile/user_profile_settings_terminal/code.html` via `packages/nextjs/components/profile/SettingsPanel.tsx`
- The profile frontend sidebar `My Pools` action now reads creator-filtered pool data from the backend via `packages/nextjs/components/profile/MyPoolsPanel.tsx`; cards show real sales amount, platform fee, sold/total tickets, locked bond, and claimable creator profit, while the modal shows creator accounting line items instead of sold-winner totals the backend cannot source
- The profile `My Pools` panel CTA now routes to `/create-pool`
- `packages/nextjs/app/my-tickets/page.tsx` now aliases the real wallet-driven ticket inventory dashboard instead of rendering demo cards
- The pool-detail frontend under `packages/nextjs/app/pool-detail/[id]/page.tsx` / `packages/nextjs/components/pool-detail/PoolDetailPage.tsx` now uses backend-enriched pool detail responses and current round state, showing sold/total tickets, ticket price, RTP, hit rate, prize budget, creator accounting, and round telemetry instead of fake winner-count / winner-amount feeds
- `packages/nextjs/app/tickets/` now provides a wallet-driven ticket inventory page plus a ticket-specific reveal/decrypt workspace wired to the backend read model and Zama proxy flow
- Product and contract design inputs live in `doc/`, especially `doc/smart-contract-design.md` and `doc/smart-contract-implementation-plan.md`
- Purchase/scratch UI design inputs currently live under `doc/scratch/`
- Backend implementation planning and codegen guidance now live in `doc/backend-design.md` and `doc/backend-codegen-plan.md`
- Cross-layer contract/backend/frontend rollout planning for realistic pool metrics, backend-uploaded IPFS pool assets, metadata draft/finalize flow, and page integration now lives in `doc/frontend-backend-contract-integration-plan.md`
- The backend now includes an IPFS upload client (`packages/backend/ipfs/`), pool metadata draft/finalize service (`packages/backend/poolmeta/`), SQL tables for uploaded assets and pool metadata drafts, and API routes for image upload, metadata draft creation, pool finalize, creator pool summaries, creator-filtered pool lists, purchase-context reads, enriched pool/current-round reads, platform overview stats, recent claimed wins, and player leaderboards
- The backend migration now includes the LuckyScratch read model, `deployment_registry`, `indexed_logs`, recurring `jobs`, and audit/cost tables needed by the live API/worker
- When multiple active deployment rows exist for the same contract after a redeploy, the backend registry loader now keeps the newest deployment block per contract instead of falling back to an older still-active address
- The backend indexer now paginates reconciliation / pending-VRF scans across all pools, filters logs to the supported LuckyScratchCore + ERC-721 event set before decoding, tracks admin-visible cursor lag, and exposes admin-triggered pool / round / ticket rebuild routes

### LuckyScratch Current Scope

The current smart-contract implementation includes:

- `LuckyScratchCore`: pool lifecycle, round management, ticket purchase, scratch, claim, creator profit accounting, and next-round rolling
- `LuckyScratchTicket`: ERC-721 ticket NFT minting, transfer lock after scratch, and transfer callback into the core contract
- `LuckyScratchTreasury`: cUSDC custody, ticket payment collection, prize payout, profit withdrawal, and bond refund
- `LuckyScratchVRFAdapter`: Chainlink VRF v2.5 subscription adapter on supported live networks, with owner-driven mock fulfillment retained for local hardhat tests
- Shared modules under `contracts/luckyScratch/interfaces`, `contracts/luckyScratch/libraries`, and `contracts/luckyScratch/types`
- Test-only contracts live under `packages/hardhat/contracts/test/`

Implemented LuckyScratch flows currently covered in code and tests:

- Pool creation with prize tiers and creator bond lock
- VRF request and round initialization
- Auto-selection purchase and manual selection purchase
- Single-ticket scratch and batch scratch
- Reward claim and batch reward claim
- Loop pool settlement and roll to next round
- Creator profit withdrawal and bond refund
- Live-network randomness requests now flow through Chainlink VRF v2.5 subscription callbacks, while local tests still use manual adapter fulfillment

Current LuckyScratch rule highlights:

- `createPool` enforces the documented budget band, supported ticket-price presets, fixed platform fee, hit-rate range, max-prize cap, the documented 6-decimal cUSDC bond schedule, and a `256` ticket per round ceiling
- `tickets(ticketId)` now returns compact `uint64` pool / round ids, so non-Solidity consumers should keep backend / client bindings in sync with the current ABI
- A round settles only after all tickets are scratched and all winning tickets are claimed
- Closing an unsold or still-initializing pool now keeps it closed even if an old VRF request is fulfilled later
- Ticket purchase, scratch, claim, and creator accounting now run only through direct wallet-submitted transactions; no backend transaction-relay path remains in the current architecture
- The backend reveal service now emits official Zama relayer-sdk context by default on Sepolia, but the relayer URL handed to clients is a ticket-scoped backend proxy that fronts Zama `keyurl` / `user-decrypt` / `public-decrypt`; if `ZAMA_API_KEY` is configured, keep it server-side and never expose it to the client
- The frontend now boots the browser-side relayer SDK from the official UMD script, keeps ticket decryption keypairs in an in-memory runtime provider, and initializes against the backend-issued ticket-scoped relayer URL rather than a direct upstream relayer URL
- The frontend ticket workspace currently covers `GET /users/{address}/tickets`, `GET /tickets/{ticketId}`, `POST /tickets/{ticketId}/reveal-auth`, `GET /tickets/{ticketId}/claim-precheck`, browser-side `user-decrypt`, backend-proxied `public-decrypt`, and final wallet-driven `claimReward`; claim proof assembly now uses relayer `publicDecrypt()` after scratch
- The backend Zama proxy now returns a stable local decryption `jobId` based on `zama_request_ref`, persists a `submitting` state before outbound relayer calls, fails reveal-auth fast when it cannot construct a public proxy URL, and includes a worker-side reconcile loop that advances submitted upstream jobs while timing out stale `submitting` rows
- The backend worker now reclaims stale PostgreSQL `jobs.status='running'` locks after `JOB_LOCK_TIMEOUT`, and the API maps service-level validation/conflict errors to stable public HTTP responses instead of leaking raw internal errors
- The indexer now processes only finalized/safe blocks using `CHAIN_CONFIRMATIONS` and `CHAIN_FINALIZATION_DEPTH`, and avoids re-reading every freshly applied event again during replay reconciliation
- Because the currently pinned `@zama-fhe/relayer-sdk` 0.4.1 / relayer v2 POST flow does not expose a client-controlled idempotency key or lookup-by-local-request-ref API, the backend still cannot losslessly recover the rare case where the upstream relayer already accepted a decrypt request but the backend crashed before persisting the returned upstream `jobId`
- Frontend/backend state reads should prefer the existing public getters on `LuckyScratchCore` (`poolConfigs`, `poolStates`, `poolAccounting`, `roundStates`, `tickets`), plus `getTicketRevealState`, `claimableCreatorProfit`, and ERC-721 `ownerOf`; list-style queries belong in the backend indexer
- The core contract is gas- and bytecode-sensitive: avoid adding wrapper view functions, redundant replay-tracking storage, or duplicated struct-copy helpers unless the feature justifies the extra runtime size

Important implementation note:

- Reward values are stored encrypted onchain with fhEVM primitives
- Reward payout is finalized via `claimReward(ticketId, clearRewardAmount, decryptionProof)` and `batchClaimRewards(...)`
- `scratchTicket` now also makes the encrypted reward handle publicly decryptable so the frontend can obtain the KMS-backed `decryptionProof` required by `claimReward`
- This decryption-proof flow is required because encrypted prize state cannot directly and safely drive plain ERC-20 transfer amounts onchain without verified disclosure

### AGENTS.md Maintenance Rule

This file is not a static template. It must track the current repository state.

- Any code change that affects architecture, file layout, commands, contract interfaces, deployment flow, testing flow, or key product behavior must update `AGENTS.md` in the same change
- When adding or removing a contract, deploy script, test suite, integration, or repo-specific rule, update the relevant section here before finishing the task
- If a change is too small to justify a broad rewrite, at minimum update the `Current Repository Status`, `LuckyScratch Current Scope`, or command references impacted by the change
- Do not leave `AGENTS.md` stale after shipping code

## Common Commands

Commands work the same for both flavors unless noted otherwise:

```bash
# Development workflow (run each in separate terminal)
yarn chain          # Start local blockchain (Hardhat or Anvil)
yarn deploy         # Deploy contracts to local network
yarn start          # Start Next.js frontend at http://localhost:3000

# Code quality
yarn lint           # Lint both packages
yarn format         # Format both packages

# Building
yarn next:build     # Build frontend
yarn compile        # Compile Solidity contracts

# Contract verification (works for both)
yarn verify --network <network>

# Account management (works for both)
yarn generate            # Generate new deployer account
yarn account:import      # Import existing private key
yarn account             # View current account info

# Deploy to live network
yarn deploy --network <network>   # e.g., sepolia, mainnet, base

yarn vercel:yolo --prod # for deployment of frontend
```

Backend commands:

```bash
cd packages/backend
go test ./...
go run .
go run . api
go run . worker
docker compose up -d
./update-containers.sh
```

Backend runtime prerequisites:

- `DATABASE_URL`
- `RPC_URL`
- `ADMIN_TOKEN` is optional but recommended for admin routes
- `API_PUBLIC_BASE_URL` is optional for direct deployments, but effectively required when the backend sits behind a reverse proxy that does not forward the public host/proto headers and reveal-auth must emit a stable absolute Zama proxy URL
- `REVEAL_SUBMIT_TIMEOUT` is optional and controls how long a local Zama decrypt request may remain in `submitting` before the worker marks it failed
- `JOB_LOCK_TIMEOUT` is optional and controls when a stale PostgreSQL-backed recurring job lock is reclaimed after a worker crash
- `IPFS_PROVIDER` enables pool artwork / metadata uploads (`pinata` and `kubo` are currently supported)
- `IPFS_GATEWAY_BASE_URL`, `IPFS_PINATA_JWT`, `IPFS_PINATA_API_BASE_URL`, `IPFS_KUBO_API_URL`, `IPFS_UPLOAD_MAX_BYTES`, and `POOL_DRAFT_TTL` control backend IPFS upload and pool metadata draft behavior; see `packages/backend/.env.example` for a working template

Frontend runtime prerequisites:

- `NEXT_PUBLIC_BACKEND_URL` is optional but recommended whenever Next.js is not reverse-proxying the backend on the same origin; the current frontend falls back to `http://127.0.0.1:8080` on localhost
- `packages/nextjs/public/tfhe_bg.wasm` and `packages/nextjs/public/kms_lib_bg.wasm` must remain present for browser-side relayer SDK initialization

### Current Verification Commands

For the current LuckyScratch contract stack, use these commands as the default validation set:

```bash
yarn compile
yarn hardhat:check-types
yarn test
```

Additional notes:

- LuckyScratch tests are written against the Hardhat fhEVM mock environment
- Tests use `packages/hardhat/contracts/test/TestUSDC.sol`; this test token is not part of the production deployment path
- If contract size becomes a problem, check `packages/hardhat/hardhat.config.ts` before refactoring; the repo currently relies on optimizer + `viaIR`
- Current gas optimization direction favors removing redundant storage writes and avoiding unnecessary memory copies in `LuckyScratchCore` rather than relaxing security or privacy constraints
- Sepolia/mainnet deployment of `LuckyScratchVRFAdapter` requires `CHAINLINK_VRF_SUBSCRIPTION_ID_<NETWORK>` or `CHAINLINK_VRF_SUBSCRIPTION_ID`; optional overrides are `CHAINLINK_VRF_COORDINATOR`, `CHAINLINK_VRF_KEY_HASH`, `CHAINLINK_VRF_CALLBACK_GAS_LIMIT`, `CHAINLINK_VRF_REQUEST_CONFIRMATIONS`, and `CHAINLINK_VRF_NATIVE_PAYMENT`
- `packages/nextjs/contracts/deployedContracts.ts` is generated from persisted deployment artifacts, so it can be empty until a supported live-network deployment is written to disk
- Account utility commands avoid the default Sepolia runtime now: `yarn account` runs against Hardhat's in-process network, while `yarn account:generate`, `yarn account:import`, and `yarn account:reveal-pk` run via `ts-node`
- Live-network deploys are wrapped by `packages/hardhat/scripts/runHardhatDeployWithPK.ts`, which now compiles on the local `hardhat` network first and then runs `deploy --no-compile` on the target network to avoid fhEVM plugin RPC probing issues on Sepolia/mainnet
- The current backend is no longer phase-0: it now includes `sqlc`-generated repositories, deployment import into `deployment_registry`, go-ethereum contract wrappers, read-model query APIs, reveal-auth + claim-precheck + Zama proxy reconciliation, recurring PostgreSQL-backed jobs, and an event indexer with minimal reorg rewind/replay
- The backend now uses a single root `main.go` entrypoint that can run `all`, `api`, or `worker` modes, while SQL source files live under `packages/backend/sql/`
- The backend docs now fix two important implementation boundaries: deployment metadata must be tracked independently of raw Hardhat deployment files, and reveal/claim stays client-driven for final proof submission while the backend only performs authorization/precheck orchestration
- The backend currently uses PostgreSQL for recurring jobs and does not yet wire Redis; keep that in mind before assuming Redis locks or queues exist

## Architecture

### Smart Contract Development

#### Hardhat Flavor

- Contracts: `packages/hardhat/contracts/`
- Deployment scripts: `packages/hardhat/deploy/` (uses hardhat-deploy plugin)
- Tests: `packages/hardhat/test/`
- Config: `packages/hardhat/hardhat.config.ts`
- Current LuckyScratch module root: `packages/hardhat/contracts/luckyScratch/`
- Current LuckyScratch deploy entry: `packages/hardhat/deploy/02_deploy_lucky_scratch.ts`
- Example scaffold deploy scripts and FHE demo tasks are intentionally removed
- The LuckyScratch deploy script expects a real `cUSDC` address and a funded Chainlink VRF v2.5 subscription id for Sepolia / mainnet-style deployments; local tests deploy the VRF adapter in mock mode by passing a zero coordinator
- Deploying specific contract:
  - If the deploy script has:
    ```typescript
    // In packages/hardhat/deploy/01_deploy_my_contract.ts
    deployMyContract.tags = ["MyContract"];
    ```
  - `yarn deploy --tags MyContract`

#### Foundry Flavor

- Contracts: `packages/foundry/contracts/`
- Deployment scripts: `packages/foundry/script/` (uses custom deployment strategy)
  - Example: `packages/foundry/script/Deploy.s.sol` and `packages/foundry/script/DeployLuckyScratch.s.sol`
- Tests: `packages/foundry/test/`
- Config: `packages/foundry/foundry.toml`
- Deploying a specific contract:
  - Create a separate deployment script and run `yarn deploy --file DeployLuckyScratch.s.sol`

#### Both Flavors

- After `yarn deploy`, ABIs are auto-generated to `packages/nextjs/contracts/deployedContracts.ts`

### Current LuckyScratch Contract Map

- `packages/hardhat/contracts/luckyScratch/LuckyScratchCore.sol`
- `packages/hardhat/contracts/luckyScratch/LuckyScratchTicket.sol`
- `packages/hardhat/contracts/luckyScratch/LuckyScratchTreasury.sol`
- `packages/hardhat/contracts/luckyScratch/LuckyScratchVRFAdapter.sol`
- `packages/hardhat/contracts/test/TestUSDC.sol` (test-only utility)
- `packages/hardhat/contracts/luckyScratch/interfaces/`
- `packages/hardhat/contracts/luckyScratch/libraries/`
- `packages/hardhat/contracts/luckyScratch/types/`
- No scaffold example contract should be added back unless explicitly requested

### Frontend Contract Interaction

**Correct interact hook names (use these):**

- `useScaffoldReadContract` - NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` - NOT ~~useScaffoldContractWrite~~

Contract data is read from two files in `packages/nextjs/contracts/`:

- `deployedContracts.ts`: Auto-generated from deployments
- `externalContracts.ts`: Manually added external contracts

#### Reading Contract Data

```typescript
const { data: poolState } = useScaffoldReadContract({
  contractName: "LuckyScratchCore",
  functionName: "poolStates",
  args: [1n],
});
```

#### Writing to Contracts

```typescript
const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "LuckyScratchCore",
});

await writeContractAsync({
  functionName: "purchaseTickets",
  args: [1n, 1],
});
```

#### Reading Events

```typescript
const { data: events, isLoading } = useScaffoldEventHistory({
  contractName: "LuckyScratchCore",
  eventName: "TicketPurchased",
  watch: true,
  fromBlock: 31231n,
  blockData: true,
});
```

SE-2 also provides other hooks to interact with blockchain data: `useScaffoldWatchContractEvent`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`.

**IMPORTANT: Always use hooks from `packages/nextjs/hooks/scaffold-eth` for contract interactions. Always refer to the hook names as they exist in the codebase.**

### UI Components

**Always use `@scaffold-ui/components` library for web3 UI components:**

- `Address`: Display ETH addresses with ENS resolution, blockie avatars, and explorer links
- `AddressInput`: Input field with address validation and ENS resolution
- `Balance`: Show ETH balance in ether and USD
- `EtherInput`: Number input with ETH/USD conversion toggle
- `IntegerInput`: Integer-only input with wei conversion

### Frontend Route Map

- Shared global header/footer are mounted by `packages/nextjs/components/ScaffoldEthAppWithProviders.tsx`
- Home route: `packages/nextjs/app/page.tsx`
- Pool Rankings route: `packages/nextjs/app/pool-rankings/page.tsx`
- Player Rankings route: `packages/nextjs/app/player-rankings/page.tsx`
- Store route: `packages/nextjs/app/store/page.tsx`
- Purchase route: `packages/nextjs/app/purchase/[poolId]/page.tsx`
- Scratch route: `packages/nextjs/app/scratch/[poolId]/page.tsx`
- My Tickets route: `packages/nextjs/app/my-tickets/page.tsx`
- Profile route: `packages/nextjs/app/profile/page.tsx`
- Create Pool route: `packages/nextjs/app/create-pool/page.tsx`

### Notifications & Error Handling

Use `notification` from `~~/utils/scaffold-eth` for success/error/warning feedback and `getParsedError` for readable error messages.

### Styling

**Use DaisyUI classes** for building frontend components.

```tsx
// ✅ Good - using DaisyUI classes
<button className="btn btn-primary">Connect</button>
<div className="card bg-base-100 shadow-xl">...</div>

// ❌ Avoid - raw Tailwind when DaisyUI has a component
<button className="px-4 py-2 bg-blue-500 text-white rounded">Connect</button>
```

### Configure Target Network before deploying to testnet / mainnet.

#### Hardhat

Add networks in `packages/hardhat/hardhat.config.ts` if not present.

#### Foundry

Add RPC endpoints in `packages/foundry/foundry.toml` if not present.

#### NextJs

Add networks in `packages/nextjs/scaffold.config.ts` if not present. This file also contains configuration for polling interval, API keys. Remember to decrease the polling interval for L2 chains.

## Code Style Guide

### Identifiers

| Style            | Category                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | for hardhat deploy files and foundry script files                                                                      |

### Import Paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
```

### Creating Pages

```tsx
import type { NextPage } from "next";

const Home: NextPage = () => {
  return <div>Home</div>;
};

export default Home;
```

### TypeScript Conventions

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address` not `TAddress`)
- Avoid explicit typing when TypeScript can infer the type

### Comments

Make comments that add information. Avoid redundant JSDoc for simple functions.

## Documentation

Use **Context7 MCP** tools to fetch up-to-date documentation for any library (Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.). Context7 is configured as an MCP server and provides access to indexed documentation with code examples.

## Skills & Agents Index

IMPORTANT: Prefer retrieval-led reasoning over pre-trained knowledge. Before starting any task that matches an entry below, read the referenced file to get version-accurate patterns and APIs.

**Skills** (read `.agents/skills/<name>/SKILL.md` before implementing):

- **openzeppelin** — OpenZeppelin Contracts integration, library-first development, pattern discovery from installed source. Use for any contract using OZ (tokens, access control, security primitives)
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
