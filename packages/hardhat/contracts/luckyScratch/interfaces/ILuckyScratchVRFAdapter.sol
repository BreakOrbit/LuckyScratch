// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILuckyScratchVRFAdapter {
    function core() external view returns (address);

    function setCore(address newCore) external;

    function requestRandomness(uint256 poolId, uint256 roundId) external returns (bytes32);
}
