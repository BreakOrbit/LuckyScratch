// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { TicketStatus } from "../types/LuckyScratchTypes.sol";

library TicketStateLib {
    function canScratch(TicketStatus status) internal pure returns (bool) {
        return status == TicketStatus.Unscratched;
    }

    function canClaim(TicketStatus status) internal pure returns (bool) {
        return status == TicketStatus.Scratched;
    }

    function isTransferLocked(TicketStatus status) internal pure returns (bool) {
        return status != TicketStatus.Unscratched;
    }
}
