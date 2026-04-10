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
- Scaffold template example contracts and demo tasks have been removed; LuckyScratch is the only active contract suite
- Deployment wiring lives in `packages/hardhat/deploy/02_deploy_lucky_scratch.ts`
- Contract tests for LuckyScratch live in `packages/hardhat/test/luckyScratch/`
- Production deployment now targets real `cUSDC` addresses and real Chainlink VRF v2.5 network settings on supported networks such as Sepolia; no local mock token is deployed by the LuckyScratch deploy script
- The homepage no longer exposes a scaffold demo contract panel; it is now a project status entry page
- Product and contract design inputs live in `doc/`, especially `doc/smart-contract-design.md` and `doc/smart-contract-implementation-plan.md`

### LuckyScratch Current Scope

The current smart-contract implementation includes:

- `LuckyScratchCore`: pool lifecycle, round management, ticket purchase, scratch, claim, gasless execution, creator profit accounting, and next-round rolling
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
- Gasless purchase, gasless scratch, and gasless batch scratch
- Loop pool settlement and roll to next round
- Creator profit withdrawal and bond refund
- Live-network randomness requests now flow through Chainlink VRF v2.5 subscription callbacks, while local tests still use manual adapter fulfillment

Current LuckyScratch rule highlights:

- `createPool` enforces the documented budget band, supported ticket-price presets, fixed platform fee, hit-rate range, and max-prize cap
- A round settles only after all tickets are scratched and all winning tickets are claimed
- Closing an unsold or still-initializing pool now keeps it closed even if an old VRF request is fulfilled later
- Gasless success is represented onchain by `GaslessExecuted`; rejected gasless attempts are tracked by the relayer service and transaction receipts rather than a persisted onchain `GaslessRejected` event
- Frontend/backend state reads should prefer the existing public getters on `LuckyScratchCore` (`poolConfigs`, `poolStates`, `poolAccounting`, `roundStates`, `tickets`, `nonces`), plus `getTicketRevealState`, `claimableCreatorProfit`, and ERC-721 `ownerOf`; list-style queries belong in the backend indexer
- The core contract is gas- and bytecode-sensitive: avoid adding wrapper view functions, redundant replay-tracking storage, or duplicated struct-copy helpers unless the feature justifies the extra runtime size

Important implementation note:

- Reward values are stored encrypted onchain with fhEVM primitives
- Reward payout is finalized via `claimReward(ticketId, clearRewardAmount, decryptionProof)` and `batchClaimRewards(...)`
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
