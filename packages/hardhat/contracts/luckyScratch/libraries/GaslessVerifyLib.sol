// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { GaslessAction, GaslessRequest } from "../types/LuckyScratchTypes.sol";

library GaslessVerifyLib {
    bytes32 internal constant GASLESS_REQUEST_TYPEHASH =
        keccak256(
            "GaslessRequest(address user,uint8 action,address targetContract,bytes32 paramsHash,uint256 nonce,uint256 deadline,uint256 chainId)"
        );

    function hashRequest(GaslessRequest calldata req) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                GASLESS_REQUEST_TYPEHASH,
                req.user,
                uint8(req.action),
                req.targetContract,
                req.paramsHash,
                req.nonce,
                req.deadline,
                req.chainId
            )
        );
    }

    function recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        return ECDSA.recover(digest, signature);
    }

    function hashPurchaseParams(uint256 poolId, uint32 quantity) internal pure returns (bytes32) {
        return keccak256(abi.encode(GaslessAction.Purchase, poolId, quantity));
    }

    function hashSelectionParams(uint256 poolId, uint32[] calldata ticketIndexes) internal pure returns (bytes32) {
        return keccak256(abi.encode(GaslessAction.PurchaseSelection, poolId, ticketIndexes));
    }

    function hashScratchParams(uint256 ticketId) internal pure returns (bytes32) {
        return keccak256(abi.encode(GaslessAction.Scratch, ticketId));
    }

    function hashBatchScratchParams(uint256[] calldata ticketIds) internal pure returns (bytes32) {
        return keccak256(abi.encode(GaslessAction.BatchScratch, ticketIds));
    }
}
