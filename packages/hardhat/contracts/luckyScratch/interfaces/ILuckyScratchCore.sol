// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { euint64 } from "@fhevm/solidity/lib/FHE.sol";
import {
    GaslessRequest,
    PoolConfig,
    PrizeTierInput,
    TicketStatus
} from "../types/LuckyScratchTypes.sol";

interface ILuckyScratchCore {
    function createPool(PoolConfig calldata config, PrizeTierInput[] calldata tiers) external returns (uint256);

    function pausePool(uint256 poolId, bool paused) external;

    function setRelayer(address relayer, bool allowed) external;

    function setVrfAdapter(address adapter) external;

    function setTreasury(address treasury) external;

    function setTicket(address ticket) external;

    function closePool(uint256 poolId) external;

    function rollToNextRound(uint256 poolId) external;

    function purchaseTickets(uint256 poolId, uint32 quantity) external;

    function purchaseTicketsWithSelection(uint256 poolId, uint32[] calldata ticketIndexes) external;

    function scratchTicket(uint256 ticketId) external;

    function batchScratch(uint256[] calldata ticketIds) external;

    function claimReward(uint256 ticketId, uint64 clearRewardAmount, bytes calldata decryptionProof) external;

    function batchClaimRewards(
        uint256[] calldata ticketIds,
        uint64[] calldata clearRewardAmounts,
        bytes[] calldata decryptionProofs
    ) external;

    function executeGaslessPurchase(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256 poolId,
        uint32 quantity
    ) external;

    function executeGaslessPurchaseSelection(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256 poolId,
        uint32[] calldata ticketIndexes
    ) external;

    function executeGaslessScratch(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256 ticketId
    ) external;

    function executeGaslessBatchScratch(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256[] calldata ticketIds
    ) external;

    function fulfillPoolRandomness(bytes32 requestId, uint256 randomWord) external;

    function getTicketRevealState(uint256 ticketId) external view returns (TicketStatus status, bool revealAuthorized);

    function getTicketPrizeHandle(uint256 ticketId) external view returns (euint64);

    function claimableCreatorProfit(uint256 poolId) external view returns (uint256);

    function onTicketTransfer(uint256 ticketId, address from, address to) external;
}
