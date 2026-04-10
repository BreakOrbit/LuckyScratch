// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ChainlinkVRFV2PlusClient } from "../libraries/ChainlinkVRFV2PlusClient.sol";

interface IChainlinkVRFCoordinatorV2Plus {
    function requestRandomWords(ChainlinkVRFV2PlusClient.RandomWordsRequest calldata request)
        external
        returns (uint256 requestId);
}
