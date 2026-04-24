// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TestConfidentialUSDC is Ownable, ZamaEthereumConfig {
    error UnauthorizedOperator(address holder, address operator);
    error UnauthorizedAmount(address operator);
    error ZeroAddress();

    string public constant name = "Test Confidential USDC";
    string public constant symbol = "tcUSDC";
    uint8 public constant decimals = 6;

    mapping(address account => euint64) private balances;
    mapping(address holder => mapping(address operator => uint48 validUntil)) private operatorExpirations;

    event ConfidentialTransfer(address indexed from, address indexed to, euint64 encryptedAmount);
    event OperatorSet(address indexed holder, address indexed operator, uint48 validUntil);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function mint(address to, uint64 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmount);
        _setBalance(to, FHE.add(_balanceOf(to), encryptedAmount));
        emit ConfidentialTransfer(address(0), to, encryptedAmount);
    }

    function confidentialBalanceOf(address account) external view returns (euint64) {
        return balances[account];
    }

    function setOperator(address operator, uint48 validUntil) external returns (bool) {
        if (operator == address(0)) revert ZeroAddress();
        operatorExpirations[msg.sender][operator] = validUntil;
        emit OperatorSet(msg.sender, operator, validUntil);
        return true;
    }

    function isOperator(address holder, address operator) public view returns (bool) {
        return holder == operator || operatorExpirations[holder][operator] >= block.timestamp;
    }

    function confidentialTransfer(address to, euint64 encryptedAmount) external returns (euint64) {
        _requireAuthorizedAmount(msg.sender, encryptedAmount);
        _transfer(msg.sender, to, encryptedAmount);
        return encryptedAmount;
    }

    function confidentialTransferFrom(address from, address to, euint64 encryptedAmount) external returns (euint64) {
        if (!isOperator(from, msg.sender)) revert UnauthorizedOperator(from, msg.sender);
        _requireAuthorizedAmount(msg.sender, encryptedAmount);
        _transfer(from, to, encryptedAmount);
        return encryptedAmount;
    }

    function _transfer(address from, address to, euint64 encryptedAmount) internal {
        if (to == address(0)) revert ZeroAddress();
        FHE.allowThis(encryptedAmount);
        _setBalance(from, FHE.sub(_balanceOf(from), encryptedAmount));
        _setBalance(to, FHE.add(_balanceOf(to), encryptedAmount));
        emit ConfidentialTransfer(from, to, encryptedAmount);
    }

    function _balanceOf(address account) internal returns (euint64 balance) {
        balance = balances[account];
        if (!FHE.isInitialized(balance)) {
            balance = FHE.asEuint64(0);
            FHE.allowThis(balance);
        }
    }

    function _setBalance(address account, euint64 balance) internal {
        FHE.allowThis(balance);
        FHE.allow(balance, account);
        FHE.makePubliclyDecryptable(balance);
        balances[account] = balance;
    }

    function _requireAuthorizedAmount(address operator, euint64 encryptedAmount) internal view {
        if (!FHE.isAllowed(encryptedAmount, operator)) revert UnauthorizedAmount(operator);
    }
}
