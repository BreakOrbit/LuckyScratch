// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { PoolAccounting, PrizeTierInput } from "../types/LuckyScratchTypes.sol";

library PoolMathLib {
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    function validatePrizeBudget(PrizeTierInput[] calldata tiers, uint32 totalTickets, uint64 expectedBudget)
        internal
        pure
        returns (bool)
    {
        uint256 ticketCount;
        uint256 budget;

        for (uint256 i = 0; i < tiers.length; i++) {
            ticketCount += tiers[i].count;
            budget += uint256(tiers[i].prizeAmount) * uint256(tiers[i].count);
        }

        return ticketCount == totalTickets && budget == expectedBudget;
    }

    function computeBondRequirement(uint64 totalPrizeBudget) internal pure returns (uint64) {
        if (totalPrizeBudget <= 200) {
            return totalPrizeBudget + ((totalPrizeBudget * 2) / 10);
        }
        if (totalPrizeBudget <= 500) {
            return totalPrizeBudget + ((totalPrizeBudget * 15) / 100);
        }
        return totalPrizeBudget + (totalPrizeBudget / 10);
    }

    function computePlatformFee(uint64 revenue, uint16 feeBps) internal pure returns (uint64) {
        return uint64((uint256(revenue) * uint256(feeBps)) / BPS_DENOMINATOR);
    }

    function computeClaimableProfit(PoolAccounting storage accounting) internal view returns (uint256) {
        uint256 liabilities = uint256(accounting.settledPrizeCost) + uint256(accounting.reservedPrizeBudget)
            + uint256(accounting.lockedNextRoundBudget) + uint256(accounting.settledProtocolCost)
            + uint256(accounting.accruedPlatformFee) + uint256(accounting.creatorProfitClaimed);

        if (uint256(accounting.realizedRevenue) <= liabilities) {
            return 0;
        }

        return uint256(accounting.realizedRevenue) - liabilities;
    }

    function canReserveNextRound(PoolAccounting storage accounting, uint64 nextRoundBudget) internal view returns (bool) {
        uint256 liabilities = uint256(accounting.settledPrizeCost) + uint256(accounting.reservedPrizeBudget)
            + uint256(accounting.lockedNextRoundBudget) + uint256(accounting.settledProtocolCost)
            + uint256(accounting.accruedPlatformFee) + uint256(accounting.creatorProfitClaimed)
            + uint256(nextRoundBudget);

        return uint256(accounting.lockedBond) + uint256(accounting.realizedRevenue) >= liabilities;
    }
}
