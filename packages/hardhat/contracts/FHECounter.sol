// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHECounter is ZamaEthereumConfig {
    euint32 private count;

    function getCount() external view returns (euint32) {
        return count;
    }

    function increment(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);
        count = FHE.add(count, encryptedValue);

        FHE.allowThis(count);
        FHE.allow(count, msg.sender);
    }

    function decrement(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);
        count = FHE.sub(count, encryptedValue);

        FHE.allowThis(count);
        FHE.allow(count, msg.sender);
    }
}
