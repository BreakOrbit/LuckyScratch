// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { PoolAccounting, PrizeTierInput } from "../types/LuckyScratchTypes.sol";

library PoolMathLib {
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint64 internal constant SMALL_POOL_BUDGET_MAX = 200_000_000;
    uint64 internal constant MEDIUM_POOL_BUDGET_MAX = 500_000_000;

    function validatePrizeEconomics(
        PrizeTierInput[] calldata tiers,
        uint32 totalTickets,
        uint64 ticketPrice,
        uint64 expectedBudget,
        uint16 expectedHitRateBps,
        uint16 expectedRtpBps,
        uint64 expectedMaxPrize
    ) internal pure returns (bool budgetValid, bool metricsValid) {
        uint256 ticketCount;
        uint256 budget;
        uint256 positivePrizeCount;
        uint64 maxPrize;

        for (uint256 i = 0; i < tiers.length; i++) {
            PrizeTierInput calldata tier = tiers[i];
            if (tier.count == 0) {
                return (false, false);
            }

            ticketCount += tier.count;
            budget += uint256(tier.prizeAmount) * uint256(tier.count);

            if (tier.prizeAmount > 0) {
                positivePrizeCount += tier.count;
                if (tier.prizeAmount > maxPrize) {
                    maxPrize = tier.prizeAmount;
                }
            }
        }

        if (ticketCount != totalTickets || budget != expectedBudget || maxPrize == 0) {
            return (false, false);
        }

        uint256 grossRevenue = uint256(ticketPrice) * ticketCount;
        if (grossRevenue == 0) {
            return (true, false);
        }

        uint256 derivedHitRateBps = ((positivePrizeCount * BPS_DENOMINATOR) + (ticketCount / 2)) / ticketCount;
        uint256 derivedRtpBps = ((budget * BPS_DENOMINATOR) + (grossRevenue / 2)) / grossRevenue;

        return (
            true,
            maxPrize == expectedMaxPrize && derivedHitRateBps == expectedHitRateBps && derivedRtpBps == expectedRtpBps
        );
    }

    function computeBondRequirement(uint64 totalPrizeBudget) internal pure returns (uint64) {
        if (totalPrizeBudget <= SMALL_POOL_BUDGET_MAX) {
            return totalPrizeBudget + ((totalPrizeBudget * 2) / 10);
        }
        if (totalPrizeBudget <= MEDIUM_POOL_BUDGET_MAX) {
            return totalPrizeBudget + ((totalPrizeBudget * 15) / 100);
        }
        return totalPrizeBudget + (totalPrizeBudget / 10);
    }

    function computePlatformFee(uint64 revenue, uint16 feeBps) internal pure returns (uint64) {
        return uint64((uint256(revenue) * uint256(feeBps)) / BPS_DENOMINATOR);
    }

    function computeClaimableProfit(PoolAccounting storage accounting) internal view returns (uint256) {
        uint256 liabilities = uint256(accounting.settledPrizeCost) +
            uint256(accounting.reservedPrizeBudget) +
            uint256(accounting.lockedNextRoundBudget) +
            uint256(accounting.settledProtocolCost) +
            uint256(accounting.accruedPlatformFee) +
            uint256(accounting.creatorProfitClaimed);

        if (uint256(accounting.realizedRevenue) <= liabilities) {
            return 0;
        }

        return uint256(accounting.realizedRevenue) - liabilities;
    }

    function canReserveNextRound(
        PoolAccounting storage accounting,
        uint64 nextRoundBudget
    ) internal view returns (bool) {
        uint256 liabilities = uint256(accounting.settledPrizeCost) +
            uint256(accounting.reservedPrizeBudget) +
            uint256(accounting.lockedNextRoundBudget) +
            uint256(accounting.settledProtocolCost) +
            uint256(accounting.accruedPlatformFee) +
            uint256(accounting.creatorProfitClaimed) +
            uint256(nextRoundBudget);

        return uint256(accounting.lockedBond) + uint256(accounting.realizedRevenue) >= liabilities;
    }
}
