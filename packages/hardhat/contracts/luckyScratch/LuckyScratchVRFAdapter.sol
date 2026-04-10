// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ILuckyScratchCore } from "./interfaces/ILuckyScratchCore.sol";
import { IChainlinkVRFCoordinatorV2Plus } from "./interfaces/IChainlinkVRFCoordinatorV2Plus.sol";
import { ILuckyScratchVRFAdapter } from "./interfaces/ILuckyScratchVRFAdapter.sol";
import { ChainlinkVRFV2PlusClient } from "./libraries/ChainlinkVRFV2PlusClient.sol";

contract LuckyScratchVRFAdapter is Ownable, ILuckyScratchVRFAdapter {
    error OnlyCore();
    error ZeroAddress();
    error UnknownRequest(bytes32 requestId);
    error RequestAlreadyFulfilled(bytes32 requestId);
    error OnlyCoordinatorCanFulfill(address have, address want);
    error ManualFulfillmentDisabled();

    struct RequestData {
        uint256 poolId;
        uint256 roundId;
        bool exists;
        bool fulfilled;
    }

    uint32 private constant NUM_WORDS = 1;

    address public override core;
    address public immutable coordinator;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public immutable callbackGasLimit;
    uint16 public immutable requestConfirmations;
    bool public immutable nativePayment;

    uint256 private requestNonce;

    mapping(bytes32 requestId => RequestData) public requests;

    constructor(
        address initialOwner,
        address vrfCoordinator,
        uint256 vrfSubscriptionId,
        bytes32 vrfKeyHash,
        uint32 vrfCallbackGasLimit,
        uint16 vrfRequestConfirmations,
        bool vrfNativePayment
    ) Ownable(initialOwner) {
        coordinator = vrfCoordinator;
        subscriptionId = vrfSubscriptionId;
        keyHash = vrfKeyHash;
        callbackGasLimit = vrfCallbackGasLimit;
        requestConfirmations = vrfRequestConfirmations;
        nativePayment = vrfNativePayment;
    }

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    function setCore(address newCore) external override onlyOwner {
        if (newCore == address(0)) revert ZeroAddress();
        core = newCore;
    }

    function requestRandomness(uint256 poolId, uint256 roundId) external override onlyCore returns (bytes32 requestId) {
        if (_isMockMode()) {
            requestNonce += 1;
            requestId = keccak256(abi.encode(block.chainid, address(this), poolId, roundId, requestNonce));
        } else {
            uint256 chainlinkRequestId = IChainlinkVRFCoordinatorV2Plus(coordinator).requestRandomWords(
                ChainlinkVRFV2PlusClient.RandomWordsRequest({
                    keyHash: keyHash,
                    subId: subscriptionId,
                    requestConfirmations: requestConfirmations,
                    callbackGasLimit: callbackGasLimit,
                    numWords: NUM_WORDS,
                    extraArgs: ChainlinkVRFV2PlusClient.argsToBytes(
                        ChainlinkVRFV2PlusClient.ExtraArgsV1({ nativePayment: nativePayment })
                    )
                })
            );
            requestId = bytes32(chainlinkRequestId);
        }

        requests[requestId] = RequestData({ poolId: poolId, roundId: roundId, exists: true, fulfilled: false });
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomWord) external onlyOwner {
        if (!_isMockMode()) revert ManualFulfillmentDisabled();
        _finalizeRequest(requestId, randomWord);
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != coordinator) revert OnlyCoordinatorCanFulfill(msg.sender, coordinator);
        _finalizeRequest(bytes32(requestId), randomWords[0]);
    }

    function _finalizeRequest(bytes32 requestId, uint256 randomWord) private {
        RequestData storage requestData = requests[requestId];
        if (!requestData.exists) revert UnknownRequest(requestId);
        if (requestData.fulfilled) revert RequestAlreadyFulfilled(requestId);

        requestData.fulfilled = true;
        ILuckyScratchCore(core).fulfillPoolRandomness(requestId, randomWord);
    }

    function _isMockMode() private view returns (bool) {
        return coordinator == address(0);
    }
}
