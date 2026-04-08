# LuckyScratch Architecture Reference

Use this reference when the task is about turning the product design into contracts, storage layout, frontend flows, or phased implementation. This file is intentionally implementation-oriented and complements `doc/design.md`.

## Scope

LuckyScratch is not just "an FHE demo". The target system is:

- privacy-preserving scratch tickets
- pool-based prize accounting
- NFT ownership as the access-control surface
- user-local decryption for outcomes
- gas-sponsored buy/scratch flows

## Suggested module split

A clean first-pass split for this repo is:

- `TicketNFT`: ERC-721 ownership, minting, transfer restrictions, token status
- `PoolManager`: pool definitions, active pool sets, pool lifecycle, inventory counters
- `PrizeEngine`: encrypted prize draw, encrypted prize state updates, ticket result assignment
- `Treasury`: USDC / cUSDC accounting, prize funding, withdrawals, pool reserves
- `StakingVault`: stake accounting and profit-share distribution

Do not force everything into one contract unless the task is explicitly a prototype. For demos, one contract is acceptable. For product logic, separation is cleaner.

## Public vs encrypted state

Default split:

Public state:

- pool type definitions
- ticket price
- pool IDs and lifecycle flags
- NFT ownership
- whether a ticket is scratched
- staking shares
- treasury config and allowed roles

Encrypted state:

- remaining prize inventory if revealing it would enable gaming
- prize amount assigned to a ticket
- user cumulative claimable reward
- pool-internal balances when the design requires hidden pool state

When in doubt, ask: "Would exposing this number let a rational user change buy/scratch behavior?" If yes, keep it encrypted.

## Ticket model

Suggested public fields per ticket:

- `poolType`
- `mintedAt`
- `scratched`
- `scratchedAt` or equivalent settlement marker

Suggested encrypted association per ticket:

- encrypted prize result handle
- optional encrypted claimable amount handle

Recommended rule set:

- an unscratched ticket can transfer
- a scratched ticket should usually stop transferring
- the current owner at scratch time becomes the authorized reader / claimer

If transfer-after-scratch is required, define whether the right to decrypt follows current ownership or is frozen at scratch-time ownership. Do not leave that ambiguous.

## Pool model

The design doc describes three pool types with many sub-pools. A practical model is:

- `PoolType`: static economics such as ticket price, planned payout budget, target RTP
- `SubPool`: runtime inventory unit used for actual draws

Suggested public fields for a sub-pool:

- `poolType`
- `status`
- `ticketsSold`
- `ticketCap`

Suggested encrypted fields for a sub-pool:

- remaining prize distribution or prize inventory
- internal payout balance if it must stay hidden

Suggested lifecycle:

1. seed sub-pool
2. sell tickets
3. scratch consumes encrypted inventory
4. when exhausted, mark closed
5. recreate from retained profit plus buffer

## Scratch flow

Target user flow:

1. user owns an unscratched ticket NFT
2. user submits a scratch request
3. relayer sends the transaction
4. contract chooses the sub-pool and computes the encrypted outcome
5. contract stores encrypted result and grants access
6. frontend performs local decryption for the current owner

Implementation constraint:

- the contract should finalize the encrypted result onchain
- the frontend should only decrypt and display, never decide the outcome

## Treasury and token flow

The design intends:

- user pays in USDC
- internal game accounting uses cUSDC
- withdrawals return USDC

That usually implies at least two design choices:

- where wrapping / unwrapping happens
- whether claimable rewards are accumulated per user or redeemed per ticket

For an MVP, per-user accumulated encrypted rewards is often simpler than per-ticket cashout logic.

## Staking model

Staking is described as profit share, not fixed yield.

Suggested approach:

- keep stake balances public
- keep pool profit allocation rules public
- keep raw game-sensitive pool internals encrypted
- compute distributable profit from finalized accounting events

Avoid coupling staking math directly to transient per-ticket scratch state.

## Access control and permissions

At minimum, design explicit roles for:

- admin / owner
- relayer or sponsor authority if needed
- treasury operator if separated
- optional pool manager role

For encrypted values, permissions must be granted intentionally. When a ticket outcome or user reward becomes readable by a user, the contract path writing that value should also establish the allowance required for later decryption.

## Phase-by-phase implementation plan

Recommended delivery order:

1. single-pool, single-ticket encrypted prize result
2. NFT mint + scratch + user decrypt end to end on Sepolia
3. multiple pool types
4. sub-pool inventory and refresh logic
5. claim / withdraw flow
6. staking and profit sharing

This order keeps the highest-risk Zama path validated early.

## Testing guidance

Test at three levels:

- contract unit tests on localhost mock mode
- Hardhat tasks for operational sanity checks
- Sepolia manual validation for browser relayer flow

The minimum meaningful end-to-end demo is:

1. mint a ticket
2. scratch it
3. read encrypted result
4. decrypt locally in the frontend

## Common architecture mistakes

- putting randomness or prize assignment offchain
- storing game-sensitive prize inventory publicly
- letting the frontend determine the outcome instead of only decrypting it
- failing to define transfer semantics after a ticket is scratched
- mixing demo-only counter patterns with production ticket / treasury design without refactoring the domain model
