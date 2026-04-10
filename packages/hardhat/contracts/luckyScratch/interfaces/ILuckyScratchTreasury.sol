// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILuckyScratchTreasury {
    function token() external view returns (address);

    function core() external view returns (address);

    function setCore(address newCore) external;

    function collectTicketPayment(address payer, uint256 poolId, uint256 amount) external;

    function lockBond(address payer, uint256 poolId, uint256 amount) external;

    function payoutReward(address recipient, uint256 poolId, uint256 amount) external;

    function withdrawCreatorProfit(address recipient, uint256 poolId, uint256 amount) external;

    function refundBond(address recipient, uint256 poolId, uint256 amount) external;

    function currentBalance() external view returns (uint256);
}
