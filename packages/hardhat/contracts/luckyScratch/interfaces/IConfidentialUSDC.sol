// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { euint64 } from "@fhevm/solidity/lib/FHE.sol";

interface IConfidentialUSDC {
    function confidentialBalanceOf(address account) external view returns (euint64);

    function confidentialTransfer(address to, euint64 encryptedAmount) external returns (euint64);

    function confidentialTransferFrom(address from, address to, euint64 encryptedAmount) external returns (euint64);
}
