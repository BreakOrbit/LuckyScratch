// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { IConfidentialUSDC } from "./interfaces/IConfidentialUSDC.sol";
import { ILuckyScratchTreasury } from "./interfaces/ILuckyScratchTreasury.sol";

contract LuckyScratchTreasury is Ownable, ReentrancyGuard, ZamaEthereumConfig, ILuckyScratchTreasury {
    error OnlyCore();
    error ZeroAddress();
    error AmountTooLarge();

    IConfidentialUSDC private immutable paymentToken;

    address public override core;

    constructor(address initialOwner, address tokenAddress) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        paymentToken = IConfidentialUSDC(tokenAddress);
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
        paymentToken.confidentialTransferFrom(payer, address(this), _prepareAmount(amount));
    }

    function lockBond(address payer, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.confidentialTransferFrom(payer, address(this), _prepareAmount(amount));
    }

    function payoutReward(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.confidentialTransfer(recipient, _prepareAmount(amount));
    }

    function withdrawCreatorProfit(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.confidentialTransfer(recipient, _prepareAmount(amount));
    }

    function refundBond(address recipient, uint256, uint256 amount) external override onlyCore nonReentrant {
        if (amount == 0) return;
        paymentToken.confidentialTransfer(recipient, _prepareAmount(amount));
    }

    function currentBalance() external view override returns (euint64) {
        return paymentToken.confidentialBalanceOf(address(this));
    }

    function _prepareAmount(uint256 amount) internal returns (euint64 encryptedAmount) {
        if (amount > type(uint64).max) revert AmountTooLarge();
        encryptedAmount = FHE.asEuint64(uint64(amount));
        FHE.allowTransient(encryptedAmount, address(this));
        FHE.allowTransient(encryptedAmount, address(paymentToken));
    }
}
