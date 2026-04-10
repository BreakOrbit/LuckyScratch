// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { euint64 } from "@fhevm/solidity/lib/FHE.sol";

enum PoolMode {
    OneTime,
    Loop
}

enum PoolStatus {
    Initializing,
    Active,
    SoldOut,
    Closing,
    Closed
}

enum RoundStatus {
    PendingVRF,
    Ready,
    SoldOut,
    Settled
}

enum TicketStatus {
    Unscratched,
    Scratched,
    Claimed
}

enum GaslessAction {
    Purchase,
    PurchaseSelection,
    Scratch,
    BatchScratch
}

struct PrizeTierInput {
    uint64 prizeAmount;
    uint32 count;
}

struct PoolConfig {
    PoolMode mode;
    address creator;
    bool protocolOwned;
    uint32 poolInstanceGroupSize;
    uint64 ticketPrice;
    uint32 totalTicketsPerRound;
    uint64 totalPrizeBudget;
    uint16 feeBps;
    uint16 targetRtpBps;
    uint16 hitRateBps;
    uint64 maxPrize;
    bytes32 themeId;
    bool selectable;
}

struct PoolAccounting {
    uint64 lockedBond;
    uint64 reservedPrizeBudget;
    uint64 lockedNextRoundBudget;
    uint64 realizedRevenue;
    uint64 settledPrizeCost;
    uint64 settledProtocolCost;
    uint64 accruedPlatformFee;
    uint64 creatorProfitClaimed;
}

struct PoolState {
    PoolStatus status;
    uint32 currentRound;
    bool closeRequested;
    bool vrfPending;
    bool initialized;
    bool paused;
}

struct RoundState {
    RoundStatus status;
    uint32 soldCount;
    uint32 claimedCount;
    uint32 scratchedCount;
    uint32 winClaimableCount;
    uint32 totalTickets;
    uint64 ticketPrice;
    uint64 roundPrizeBudget;
    bytes32 vrfRequestRef;
    bytes32 shuffleRoot;
}

struct TicketData {
    uint256 poolId;
    uint256 roundId;
    uint32 ticketIndex;
    TicketStatus status;
    bool transferredBeforeScratch;
}

struct EncryptedUserState {
    euint64 encryptedLifetimeWinnings;
}

struct EncryptedTicketState {
    euint64 encryptedPrizeAmount;
    bool revealAuthorized;
}

struct GaslessRequest {
    address user;
    GaslessAction action;
    address targetContract;
    bytes32 paramsHash;
    uint256 nonce;
    uint256 deadline;
    uint256 chainId;
}
