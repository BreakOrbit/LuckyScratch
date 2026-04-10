// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { PrizeTierInput } from "../types/LuckyScratchTypes.sol";

library PrizeShuffleLib {
    error InvalidPrizeTable();

    function buildShuffledPrizeTable(PrizeTierInput[] storage tiers, uint32 totalTickets, uint256 randomWord)
        internal
        view
        returns (uint64[] memory shuffledPrizes, bytes32 shuffleRoot)
    {
        shuffledPrizes = new uint64[](totalTickets);

        uint256 cursor;
        for (uint256 i = 0; i < tiers.length; i++) {
            for (uint256 j = 0; j < tiers[i].count; j++) {
                if (cursor >= totalTickets) revert InvalidPrizeTable();
                shuffledPrizes[cursor] = tiers[i].prizeAmount;
                cursor++;
            }
        }

        if (cursor != totalTickets) revert InvalidPrizeTable();

        for (uint256 i = totalTickets; i > 1; i--) {
            uint256 swapIndex = uint256(keccak256(abi.encode(randomWord, i))) % i;
            uint64 currentValue = shuffledPrizes[i - 1];
            shuffledPrizes[i - 1] = shuffledPrizes[swapIndex];
            shuffledPrizes[swapIndex] = currentValue;
        }

        shuffleRoot = keccak256(abi.encode(shuffledPrizes));
    }
}
