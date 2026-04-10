// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ILuckyScratchTreasury } from "./interfaces/ILuckyScratchTreasury.sol";

contract LuckyScratchTreasury is Ownable, ReentrancyGuard, ILuckyScratchTreasury {
    using SafeERC20 for IERC20;

    error OnlyCore();
    error ZeroAddress();

    IERC20 private immutable paymentToken;

    address public override core;

    constructor(address initialOwner, address tokenAddress) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        paymentToken = IERC20(tokenAddress);
    }

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    function token() external view override returns (address) {
        return address(paymentToken);
    }

    function setCore(address newCore) external override onlyOwner {
        if (newCore == address(0)) revert ZeroAddress();
        core = newCore;
    }

    function collectTicketPayment(address payer, uint256, uint256 amount) external override onlyCore nonReentrant {
        paymentToken.safeTransferFrom(payer, address(this), amount);
    }

    function lockBond(address payer, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.safeTransferFrom(payer, address(this), amount);
    }

    function payoutReward(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.safeTransfer(recipient, amount);
    }

    function withdrawCreatorProfit(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.safeTransfer(recipient, amount);
    }

    function refundBond(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.safeTransfer(recipient, amount);
    }

    function currentBalance() external view override returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }
}
