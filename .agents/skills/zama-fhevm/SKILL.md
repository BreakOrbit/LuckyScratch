---
name: zama-fhevm
description: "Build or modify Zama fhEVM features in this Scaffold-ETH 2 project. Use when the user wants to add encrypted onchain state, Zama FHE contracts, relayer-backed browser encryption/decryption, encrypted inputs with `externalEuint*`, Hardhat fhevm tasks/tests, or LuckyScratch privacy logic such as hidden pools, encrypted rewards, or user-only decryption."
---

# Zama fhEVM for LuckyScratch

Use this skill when working on Zama protocol features in this repository. This repo already contains a working fhEVM baseline:

- Solidity: `packages/hardhat/contracts/FHECounter.sol`
- Deploy: `packages/hardhat/deploy/01_deploy_fhe_counter.ts`
- Tasks: `packages/hardhat/tasks/FHECounter.ts`
- Tests: `packages/hardhat/test/FHECounter.ts`
- Frontend relayer flow: `packages/nextjs/app/_components/FHECounterPanel.tsx`
- Product design: `doc/design.md`

Read those files first and extend the existing pattern instead of inventing a new one.

If the task is about LuckyScratch product logic instead of the demo counter, also read `references/luckyscratch-architecture.md`.

## What this repo is optimized for

There are two distinct execution modes and they are not interchangeable:

- `hardhat` / localhost: good for contract iteration, deploy scripts, and mock-mode tests. Browser relayer encryption/decryption is not available there.
- `sepolia`: use this for browser-side Zama relayer SDK, EIP-712 user decryption, and end-to-end frontend validation.

If the task involves browser encryption or user decryption, target `sepolia`, not localhost.

## Contract workflow

When adding encrypted state or logic:

1. Start in `packages/hardhat/contracts/`.
2. Import from `@fhevm/solidity/lib/FHE.sol`.
3. Inherit Zama network config from `@fhevm/solidity/config/ZamaConfig.sol`.
4. Accept encrypted user input as `externalEuint*` plus `bytes inputProof`.
5. Convert external input with `FHE.fromExternal(...)`.
6. Persist permissions after state updates with:
   - `FHE.allowThis(value)`
   - `FHE.allow(value, msg.sender)` or another intended reader

Reference pattern from this repo:

```solidity
import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract Example is ZamaEthereumConfig {
    euint32 private encryptedValue;

    function setValue(externalEuint32 inputValue, bytes calldata inputProof) external {
        encryptedValue = FHE.fromExternal(inputValue, inputProof);
        FHE.allowThis(encryptedValue);
        FHE.allow(encryptedValue, msg.sender);
    }
}
```

## Contract design rules

- Keep plaintext business rules public only when they are meant to be public. Pool balances, prize inventory, user rewards, and scratch outcomes should remain encrypted if the feature is privacy-sensitive.
- Do not expose helper view functions that accidentally reveal cleartext state.
- Grant decryption/read permissions deliberately after each encrypted write. If a user should later decrypt a handle, make sure the contract grants the right allowance path.
- Prefer small encrypted primitives first. Get one encrypted state transition working before composing multiple pools, prize buckets, or NFT-linked records.
- Preserve determinism in contract logic. Offchain randomness or hidden frontend state is not a substitute for encrypted onchain state.

## Hardhat tasks and tests

For CLI workflows, mirror the existing `packages/hardhat/tasks/FHECounter.ts` pattern:

- initialize the fhevm CLI API with `await fhevm.initializeCLIApi()`
- create encrypted inputs with `fhevm.createEncryptedInput(contractAddress, signer.address)`
- decrypt in tasks/tests with `fhevm.userDecryptEuint(...)`

For tests, prefer the existing mock-friendly pattern in `packages/hardhat/test/FHECounter.ts`:

- deploy the contract normally
- skip assumptions that only hold on Sepolia relayer flows
- use encrypted input helpers from the Hardhat plugin
- validate the clear value only through fhevm user decryption helpers

If the feature is frontend-only and depends on browser relayer SDK behavior, still add at least one contract-level test for the encrypted state transition.

## Frontend workflow

For the frontend:

1. Use SE-2 hooks from `packages/nextjs/hooks/scaffold-eth`.
2. Read deployment data with `useDeployedContractInfo`.
3. Initialize browser relayer SDK only on supported chains.
4. Encrypt inputs client-side before contract writes.
5. Decrypt via user keypair + EIP-712 signature flow.
6. Surface failures through `notification` and `getParsedError`.

The canonical example is `packages/nextjs/app/_components/FHECounterPanel.tsx`. Reuse its approach for:

- `initSDK`
- `createInstance`
- `createEncryptedInput(...).add32(...).encrypt()`
- `generateKeypair()`
- `createEIP712(...)`
- `userDecrypt(...)`

Do not invent a parallel wallet or contract interaction layer. Stay on the repo's scaffold-eth hooks.

## LuckyScratch-specific guidance

If the task touches lottery mechanics, read `doc/design.md` before coding. For implementation-oriented structure, also read `references/luckyscratch-architecture.md`. In this repo, Zama is not a generic demo: it exists to support hidden state in a scratch-lottery product.

Default privacy expectations:

- encrypted pool balances
- encrypted prize inventory and remaining distribution
- encrypted per-ticket reward outcome
- user-local decryption for claimable rewards or scratch results

When mapping the design into contracts, prefer a structure where:

- public state covers configuration, pricing, NFT ownership, and allowed transitions
- encrypted state covers reward amounts, pool internals, and game-sensitive inventory

## Deployment and validation

Use the existing workflow and adapt to the target chain:

- local contract iteration: `yarn chain`
- deploy locally: `yarn deploy --tags FHECounter --network localhost`
- deploy to Sepolia: `yarn deploy --tags FHECounter --network sepolia`
- run frontend: `yarn start`

Validate the right layer for the right environment:

- localhost: compile, deploy, Hardhat tasks, unit tests
- Sepolia: frontend wallet flow, relayer SDK init, encrypted write, user decryption

## Common mistakes

- Treating localhost mock mode as equivalent to Sepolia relayer mode
- Forgetting `FHE.allowThis(...)` / `FHE.allow(...)` after encrypted state updates
- Returning or logging data that effectively leaks private state
- Building frontend contract calls without first encrypting the input
- Adding raw wagmi contract interactions instead of using scaffold-eth hooks
- Implementing Zama features without checking existing patterns in `FHECounter.sol`, `FHECounter.ts`, and `FHECounterPanel.tsx`
