// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ILuckyScratchCore } from "./interfaces/ILuckyScratchCore.sol";
import { ILuckyScratchVRFAdapter } from "./interfaces/ILuckyScratchVRFAdapter.sol";

contract LuckyScratchVRFAdapter is Ownable, ILuckyScratchVRFAdapter {
    error OnlyCore();
    error ZeroAddress();
    error UnknownRequest(bytes32 requestId);
    error RequestAlreadyFulfilled(bytes32 requestId);

    struct RequestData {
        uint256 poolId;
        uint256 roundId;
        bool exists;
        bool fulfilled;
    }

    address public override core;

    uint256 private requestNonce;

    mapping(bytes32 requestId => RequestData) public requests;

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    function setCore(address newCore) external override onlyOwner {
        if (newCore == address(0)) revert ZeroAddress();
        core = newCore;
    }

    function requestRandomness(uint256 poolId, uint256 roundId) external override onlyCore returns (bytes32 requestId) {
        requestNonce += 1;
        requestId = keccak256(abi.encode(block.chainid, address(this), poolId, roundId, requestNonce));
        requests[requestId] = RequestData({ poolId: poolId, roundId: roundId, exists: true, fulfilled: false });
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomWord) external onlyOwner {
        RequestData storage requestData = requests[requestId];
        if (!requestData.exists) revert UnknownRequest(requestId);
        if (requestData.fulfilled) revert RequestAlreadyFulfilled(requestId);

        requestData.fulfilled = true;
        ILuckyScratchCore(core).fulfillPoolRandomness(requestId, randomWord);
    }
}
