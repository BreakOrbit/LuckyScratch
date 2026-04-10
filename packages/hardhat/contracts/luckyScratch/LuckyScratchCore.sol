// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { FHE, euint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { ILuckyScratchCore } from "./interfaces/ILuckyScratchCore.sol";
import { ILuckyScratchTicket } from "./interfaces/ILuckyScratchTicket.sol";
import { ILuckyScratchTreasury } from "./interfaces/ILuckyScratchTreasury.sol";
import { ILuckyScratchVRFAdapter } from "./interfaces/ILuckyScratchVRFAdapter.sol";
import { GaslessVerifyLib } from "./libraries/GaslessVerifyLib.sol";
import { PoolMathLib } from "./libraries/PoolMathLib.sol";
import { PrizeShuffleLib } from "./libraries/PrizeShuffleLib.sol";
import { TicketStateLib } from "./libraries/TicketStateLib.sol";
import {
    EncryptedTicketState,
    EncryptedUserState,
    GaslessAction,
    GaslessRequest,
    PoolAccounting,
    PoolConfig,
    PoolMode,
    PoolState,
    PoolStatus,
    PrizeTierInput,
    RoundState,
    RoundStatus,
    TicketData,
    TicketStatus
} from "./types/LuckyScratchTypes.sol";

contract LuckyScratchCore is AccessControl, EIP712, ReentrancyGuard, Pausable, ZamaEthereumConfig, ILuckyScratchCore {
    using PoolMathLib for PoolAccounting;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    uint32 internal constant MAX_BATCH_SIZE = 64;
    uint16 internal constant MAX_BPS = 10_000;
    uint16 internal constant PLATFORM_FEE_BPS = 800;
    uint16 internal constant MIN_HIT_RATE_BPS = 2_000;
    uint16 internal constant MAX_HIT_RATE_BPS = 7_000;
    uint16 internal constant MIN_RTP_BPS = 5_000;
    uint16 internal constant MAX_RTP_BPS = 9_500;
    uint16 internal constant MAX_PRIZE_SHARE_BPS = 3_000;
    uint64 internal constant MIN_TOTAL_PRIZE_BUDGET = 50_000_000;
    uint64 internal constant MAX_TOTAL_PRIZE_BUDGET = 2_000_000_000;
    uint64 internal constant PRICE_TIER_1 = 1_000_000;
    uint64 internal constant PRICE_TIER_2 = 2_000_000;
    uint64 internal constant PRICE_TIER_5 = 5_000_000;
    uint64 internal constant PRICE_TIER_10 = 10_000_000;
    uint64 internal constant PRICE_TIER_15 = 15_000_000;
    uint64 internal constant PRICE_TIER_20 = 20_000_000;

    error ZeroAddress();
    error DependencyNotConfigured();
    error InvalidPoolConfig();
    error InvalidPrizeTiers();
    error InvalidQuantity();
    error PoolNotFound(uint256 poolId);
    error RoundNotReady(uint256 poolId, uint256 roundId);
    error PoolPurchasesPaused(uint256 poolId);
    error PoolClosedForRolling(uint256 poolId);
    error SoldOut(uint256 poolId, uint256 roundId);
    error InvalidTicket(uint256 ticketId);
    error NotTicketOwner(uint256 ticketId, address caller);
    error TicketNotScratchable(uint256 ticketId);
    error TicketNotClaimable(uint256 ticketId);
    error NoReward(uint256 ticketId);
    error TicketIndexOutOfBounds(uint32 ticketIndex);
    error TicketIndexAlreadySold(uint32 ticketIndex);
    error DuplicateTicketIndex(uint32 ticketIndex);
    error InvalidVrfCaller(address caller);
    error InvalidRequest(bytes32 requestId);
    error InvalidGaslessAction();
    error InvalidGaslessNonce(uint256 expectedNonce, uint256 receivedNonce);
    error InvalidGaslessSignature();
    error ExpiredGaslessRequest(uint256 deadline, uint256 currentTimestamp);
    error InvalidGaslessParamsHash(bytes32 expectedHash, bytes32 receivedHash);
    error InvalidTargetContract(address expectedTarget, address receivedTarget);
    error InvalidChainId(uint256 expectedChainId, uint256 receivedChainId);
    error NotPoolCreator(uint256 poolId, address caller);
    error PoolNotSettled(uint256 poolId, uint256 roundId);
    error PoolNotLoopMode(uint256 poolId);
    event PoolCreated(uint256 indexed poolId, address indexed creator, bool protocolOwned);
    event PoolRoundRequested(uint256 indexed poolId, uint256 indexed roundId, bytes32 requestId);
    event PoolRoundInitialized(uint256 indexed poolId, uint256 indexed roundId);
    event RoundSettled(uint256 indexed poolId, uint256 indexed roundId);
    event TicketPurchased(address indexed user, uint256 indexed poolId, uint256 indexed ticketId, uint32 ticketIndex);
    event TicketScratched(
        address indexed user, uint256 indexed poolId, uint256 indexed roundId, uint256 ticketId, bool revealAuthorized
    );
    event RewardClaimed(address indexed user, uint256 indexed ticketId, uint256 indexed poolId, uint256 roundId);
    event CreatorProfitWithdrawn(uint256 indexed poolId, address indexed creator, uint256 amount);
    event BondRefunded(uint256 indexed poolId, address indexed creator, uint256 amount);
    event PoolClosed(uint256 indexed poolId);
    event PoolRolledToNextRound(uint256 indexed poolId, uint256 indexed newRoundId);
    event GaslessExecuted(address indexed user, GaslessAction action, bytes32 digest);

    struct VrfRequestContext {
        uint256 poolId;
        uint256 roundId;
    }

    address public treasury;
    address public ticket;
    address public vrfAdapter;

    uint256 public nextPoolId = 1;
    uint256 public nextTicketId = 1;

    mapping(uint256 poolId => PoolConfig) public poolConfigs;
    mapping(uint256 poolId => PoolState) public poolStates;
    mapping(uint256 poolId => PoolAccounting) public poolAccounting;
    mapping(uint256 poolId => mapping(uint256 roundId => RoundState)) public roundStates;
    mapping(uint256 poolId => PrizeTierInput[]) private poolPrizeTiers;
    mapping(uint256 poolId => mapping(uint256 roundId => mapping(uint32 ticketIndex => euint64))) private encryptedPrizeSlots;
    mapping(uint256 ticketId => TicketData) public tickets;
    mapping(uint256 ticketId => EncryptedTicketState) private encryptedTickets;
    mapping(address user => EncryptedUserState) private users;
    mapping(address user => uint256) public nonces;
    mapping(bytes32 requestId => VrfRequestContext) private vrfRequests;
    mapping(uint256 poolId => mapping(uint256 roundId => mapping(uint32 ticketIndex => bool))) public soldTicketSlots;
    mapping(uint256 poolId => mapping(uint256 roundId => uint32 cursor)) private nextAutoTicketIndex;

    constructor(address admin) EIP712("LuckyScratch", "1") {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    modifier onlyPoolCreatorOrAdmin(uint256 poolId) {
        PoolConfig storage config = _getPoolConfigStorage(poolId);
        if (config.creator != msg.sender && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotPoolCreator(poolId, msg.sender);
        }
        _;
    }

    function setRelayer(address relayer, bool allowed) external override onlyRole(ADMIN_ROLE) {
        if (relayer == address(0)) revert ZeroAddress();

        if (allowed) {
            _grantRole(RELAYER_ROLE, relayer);
        } else {
            _revokeRole(RELAYER_ROLE, relayer);
        }
    }

    function setVrfAdapter(address adapter) external override onlyRole(ADMIN_ROLE) {
        if (adapter == address(0)) revert ZeroAddress();
        vrfAdapter = adapter;
    }

    function setTreasury(address treasuryAddress) external override onlyRole(ADMIN_ROLE) {
        if (treasuryAddress == address(0)) revert ZeroAddress();
        treasury = treasuryAddress;
    }

    function setTicket(address ticketAddress) external override onlyRole(ADMIN_ROLE) {
        if (ticketAddress == address(0)) revert ZeroAddress();
        ticket = ticketAddress;
    }

    function pausePool(uint256 poolId, bool paused) external override onlyPoolCreatorOrAdmin(poolId) {
        PoolState storage state = _getPoolStateStorage(poolId);
        state.paused = paused;
    }

    function createPool(PoolConfig calldata config, PrizeTierInput[] calldata tiers)
        external
        override
        nonReentrant
        whenNotPaused
        returns (uint256 poolId)
    {
        _requireDependenciesConfigured();
        _validatePoolCreation(config, tiers);

        poolId = nextPoolId;
        nextPoolId += 1;

        PoolConfig storage storedConfig = poolConfigs[poolId];
        storedConfig.mode = config.mode;
        storedConfig.creator = config.creator == address(0) ? msg.sender : config.creator;
        storedConfig.protocolOwned = config.protocolOwned;
        storedConfig.poolInstanceGroupSize = config.poolInstanceGroupSize;
        storedConfig.ticketPrice = config.ticketPrice;
        storedConfig.totalTicketsPerRound = config.totalTicketsPerRound;
        storedConfig.totalPrizeBudget = config.totalPrizeBudget;
        storedConfig.feeBps = config.feeBps;
        storedConfig.targetRtpBps = config.targetRtpBps;
        storedConfig.hitRateBps = config.hitRateBps;
        storedConfig.maxPrize = config.maxPrize;
        storedConfig.themeId = config.themeId;
        storedConfig.selectable = config.selectable;

        for (uint256 i = 0; i < tiers.length; i++) {
            poolPrizeTiers[poolId].push(tiers[i]);
        }

        uint64 bondRequirement = PoolMathLib.computeBondRequirement(storedConfig.totalPrizeBudget);
        if (bondRequirement > 0) {
            poolAccounting[poolId].lockedBond = bondRequirement;
            ILuckyScratchTreasury(treasury).lockBond(storedConfig.creator, poolId, bondRequirement);
        }

        PoolState storage state = poolStates[poolId];
        state.status = PoolStatus.Initializing;
        state.currentRound = 1;
        state.vrfPending = true;
        state.initialized = false;

        RoundState storage round = roundStates[poolId][1];
        round.status = RoundStatus.PendingVRF;
        round.totalTickets = storedConfig.totalTicketsPerRound;
        round.ticketPrice = storedConfig.ticketPrice;
        round.roundPrizeBudget = storedConfig.totalPrizeBudget;

        bytes32 requestId = ILuckyScratchVRFAdapter(vrfAdapter).requestRandomness(poolId, 1);
        round.vrfRequestRef = requestId;
        vrfRequests[requestId] = VrfRequestContext({ poolId: poolId, roundId: 1 });

        emit PoolCreated(poolId, storedConfig.creator, storedConfig.protocolOwned);
        emit PoolRoundRequested(poolId, 1, requestId);
    }

    function closePool(uint256 poolId) external override onlyPoolCreatorOrAdmin(poolId) {
        PoolState storage state = _getPoolStateStorage(poolId);
        state.closeRequested = true;

        RoundState storage round = roundStates[poolId][state.currentRound];
        if (round.soldCount == 0 || !state.initialized || round.status == RoundStatus.Settled) {
            _closePoolImmediately(poolId, state, round);
        }
    }

    function rollToNextRound(uint256 poolId) external override nonReentrant onlyPoolCreatorOrAdmin(poolId) {
        PoolConfig storage config = _getPoolConfigStorage(poolId);
        PoolState storage state = _getPoolStateStorage(poolId);

        if (config.mode != PoolMode.Loop) revert PoolNotLoopMode(poolId);
        if (state.closeRequested) revert PoolClosedForRolling(poolId);

        RoundState storage currentRound = roundStates[poolId][state.currentRound];
        if (currentRound.status != RoundStatus.Settled) revert PoolNotSettled(poolId, state.currentRound);

        PoolAccounting storage accounting = poolAccounting[poolId];
        if (!PoolMathLib.canReserveNextRound(accounting, config.totalPrizeBudget)) {
            state.status = PoolStatus.Closing;
            return;
        }

        accounting.lockedNextRoundBudget += config.totalPrizeBudget;

        uint256 nextRoundId = uint256(state.currentRound) + 1;
        state.currentRound = uint32(nextRoundId);
        state.status = PoolStatus.Initializing;
        state.vrfPending = true;
        state.initialized = true;

        RoundState storage round = roundStates[poolId][nextRoundId];
        round.status = RoundStatus.PendingVRF;
        round.totalTickets = config.totalTicketsPerRound;
        round.ticketPrice = config.ticketPrice;
        round.roundPrizeBudget = config.totalPrizeBudget;

        bytes32 requestId = ILuckyScratchVRFAdapter(vrfAdapter).requestRandomness(poolId, nextRoundId);
        round.vrfRequestRef = requestId;
        vrfRequests[requestId] = VrfRequestContext({ poolId: poolId, roundId: nextRoundId });

        emit PoolRoundRequested(poolId, nextRoundId, requestId);
        emit PoolRolledToNextRound(poolId, nextRoundId);
    }

    function purchaseTickets(uint256 poolId, uint32 quantity) external override nonReentrant whenNotPaused {
        _purchaseTickets(msg.sender, poolId, quantity);
    }

    function purchaseTicketsWithSelection(uint256 poolId, uint32[] calldata ticketIndexes)
        external
        override
        nonReentrant
        whenNotPaused
    {
        _purchaseTicketsWithSelection(msg.sender, poolId, ticketIndexes);
    }

    function scratchTicket(uint256 ticketId) external override nonReentrant whenNotPaused {
        _scratchTicket(msg.sender, ticketId);
    }

    function batchScratch(uint256[] calldata ticketIds) external override nonReentrant whenNotPaused {
        if (ticketIds.length == 0 || ticketIds.length > MAX_BATCH_SIZE) revert InvalidQuantity();

        for (uint256 i = 0; i < ticketIds.length; i++) {
            _scratchTicket(msg.sender, ticketIds[i]);
        }
    }

    function claimReward(uint256 ticketId, uint64 clearRewardAmount, bytes calldata decryptionProof)
        external
        override
        nonReentrant
        whenNotPaused
    {
        _claimReward(msg.sender, ticketId, clearRewardAmount, decryptionProof);
    }

    function batchClaimRewards(
        uint256[] calldata ticketIds,
        uint64[] calldata clearRewardAmounts,
        bytes[] calldata decryptionProofs
    ) external override nonReentrant whenNotPaused {
        if (ticketIds.length == 0 || ticketIds.length > MAX_BATCH_SIZE) revert InvalidQuantity();
        if (ticketIds.length != clearRewardAmounts.length || ticketIds.length != decryptionProofs.length) {
            revert InvalidQuantity();
        }

        for (uint256 i = 0; i < ticketIds.length; i++) {
            _claimReward(msg.sender, ticketIds[i], clearRewardAmounts[i], decryptionProofs[i]);
        }
    }

    function executeGaslessPurchase(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256 poolId,
        uint32 quantity
    ) external override nonReentrant whenNotPaused onlyRole(RELAYER_ROLE) {
        bytes32 paramsHash = GaslessVerifyLib.hashPurchaseParams(poolId, quantity);
        bytes32 digest = _consumeGaslessRequest(req, signature, GaslessAction.Purchase, paramsHash);
        _purchaseTickets(req.user, poolId, quantity);
        emit GaslessExecuted(req.user, req.action, digest);
    }

    function executeGaslessPurchaseSelection(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256 poolId,
        uint32[] calldata ticketIndexes
    ) external override nonReentrant whenNotPaused onlyRole(RELAYER_ROLE) {
        bytes32 paramsHash = GaslessVerifyLib.hashSelectionParams(poolId, ticketIndexes);
        bytes32 digest = _consumeGaslessRequest(req, signature, GaslessAction.PurchaseSelection, paramsHash);
        _purchaseTicketsWithSelection(req.user, poolId, ticketIndexes);
        emit GaslessExecuted(req.user, req.action, digest);
    }

    function executeGaslessScratch(GaslessRequest calldata req, bytes calldata signature, uint256 ticketId)
        external
        override
        nonReentrant
        whenNotPaused
        onlyRole(RELAYER_ROLE)
    {
        bytes32 paramsHash = GaslessVerifyLib.hashScratchParams(ticketId);
        bytes32 digest = _consumeGaslessRequest(req, signature, GaslessAction.Scratch, paramsHash);
        _scratchTicket(req.user, ticketId);
        emit GaslessExecuted(req.user, req.action, digest);
    }

    function executeGaslessBatchScratch(
        GaslessRequest calldata req,
        bytes calldata signature,
        uint256[] calldata ticketIds
    ) external override nonReentrant whenNotPaused onlyRole(RELAYER_ROLE) {
        if (ticketIds.length == 0 || ticketIds.length > MAX_BATCH_SIZE) revert InvalidQuantity();

        bytes32 paramsHash = GaslessVerifyLib.hashBatchScratchParams(ticketIds);
        bytes32 digest = _consumeGaslessRequest(req, signature, GaslessAction.BatchScratch, paramsHash);

        for (uint256 i = 0; i < ticketIds.length; i++) {
            _scratchTicket(req.user, ticketIds[i]);
        }

        emit GaslessExecuted(req.user, req.action, digest);
    }

    function fulfillPoolRandomness(bytes32 requestId, uint256 randomWord) external override {
        if (msg.sender != vrfAdapter) revert InvalidVrfCaller(msg.sender);

        VrfRequestContext memory request = vrfRequests[requestId];
        if (request.poolId == 0) revert InvalidRequest(requestId);

        RoundState storage round = roundStates[request.poolId][request.roundId];
        if (round.status != RoundStatus.PendingVRF || round.vrfRequestRef != requestId) {
            revert InvalidRequest(requestId);
        }

        PoolState storage state = poolStates[request.poolId];
        PoolAccounting storage accounting = poolAccounting[request.poolId];

        if (state.status == PoolStatus.Closed) {
            state.vrfPending = false;
            round.vrfRequestRef = bytes32(0);
            return;
        }

        (uint64[] memory shuffledPrizes, bytes32 shuffleRoot) =
            PrizeShuffleLib.buildShuffledPrizeTable(poolPrizeTiers[request.poolId], round.totalTickets, randomWord);

        uint32 positivePrizeCount;
        for (uint32 i = 0; i < round.totalTickets; i++) {
            euint64 encryptedPrize = FHE.asEuint64(shuffledPrizes[i]);
            FHE.allowThis(encryptedPrize);
            encryptedPrizeSlots[request.poolId][request.roundId][i] = encryptedPrize;
            if (shuffledPrizes[i] > 0) {
                positivePrizeCount += 1;
            }
        }

        if (accounting.lockedNextRoundBudget >= round.roundPrizeBudget) {
            accounting.lockedNextRoundBudget -= round.roundPrizeBudget;
        }
        accounting.reservedPrizeBudget += round.roundPrizeBudget;

        round.status = RoundStatus.Ready;
        round.winClaimableCount = positivePrizeCount;
        round.shuffleRoot = shuffleRoot;
        state.status = PoolStatus.Active;
        state.vrfPending = false;
        state.initialized = true;

        emit PoolRoundInitialized(request.poolId, request.roundId);
    }

    function withdrawCreatorProfit(uint256 poolId, uint256 amount) external nonReentrant onlyPoolCreatorOrAdmin(poolId) {
        if (amount == 0) revert InvalidQuantity();

        PoolAccounting storage accounting = poolAccounting[poolId];
        uint256 claimableProfit = accounting.computeClaimableProfit();
        if (amount > claimableProfit) revert InvalidQuantity();

        accounting.creatorProfitClaimed += uint64(amount);
        ILuckyScratchTreasury(treasury).withdrawCreatorProfit(poolConfigs[poolId].creator, poolId, amount);

        emit CreatorProfitWithdrawn(poolId, poolConfigs[poolId].creator, amount);
    }

    function refundBond(uint256 poolId) external nonReentrant onlyPoolCreatorOrAdmin(poolId) {
        PoolState storage state = _getPoolStateStorage(poolId);
        if (state.status != PoolStatus.Closed) revert PoolClosedForRolling(poolId);

        PoolAccounting storage accounting = poolAccounting[poolId];
        uint256 refundAmount = accounting.lockedBond;
        accounting.lockedBond = 0;

        ILuckyScratchTreasury(treasury).refundBond(poolConfigs[poolId].creator, poolId, refundAmount);
        emit BondRefunded(poolId, poolConfigs[poolId].creator, refundAmount);
    }

    function getTicketRevealState(uint256 ticketId)
        external
        view
        override
        returns (TicketStatus status, bool revealAuthorized)
    {
        TicketData memory ticketData = _getTicketData(ticketId);
        EncryptedTicketState storage encryptedTicket = encryptedTickets[ticketId];
        return (ticketData.status, encryptedTicket.revealAuthorized);
    }

    function getTicketPrizeHandle(uint256 ticketId) external view override returns (euint64) {
        _getTicketData(ticketId);
        return encryptedTickets[ticketId].encryptedPrizeAmount;
    }

    function onTicketTransfer(uint256 ticketId, address from, address to) external override {
        if (msg.sender != ticket) revert InvalidTargetContract(ticket, msg.sender);
        if (from == address(0) || to == address(0)) return;

        TicketData storage ticketData = tickets[ticketId];
        if (ticketData.status == TicketStatus.Unscratched) {
            ticketData.transferredBeforeScratch = true;
        }
    }

    function claimableCreatorProfit(uint256 poolId) external view returns (uint256) {
        _getPoolConfigStorage(poolId);
        return poolAccounting[poolId].computeClaimableProfit();
    }

    function pauseProtocol() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpauseProtocol() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _purchaseTickets(address buyer, uint256 poolId, uint32 quantity) internal {
        if (quantity == 0 || quantity > MAX_BATCH_SIZE) revert InvalidQuantity();

        PoolConfig storage config = _getPoolConfigStorage(poolId);
        PoolState storage state = _getPoolStateStorage(poolId);
        if (state.paused) revert PoolPurchasesPaused(poolId);

        RoundState storage round = _getActiveRound(poolId);
        if (uint256(round.soldCount) + quantity > round.totalTickets) revert SoldOut(poolId, state.currentRound);

        uint256 totalPayment = uint256(round.ticketPrice) * quantity;
        ILuckyScratchTreasury(treasury).collectTicketPayment(buyer, poolId, totalPayment);

        PoolAccounting storage accounting = poolAccounting[poolId];
        accounting.realizedRevenue += uint64(totalPayment);
        accounting.accruedPlatformFee += PoolMathLib.computePlatformFee(uint64(totalPayment), config.feeBps);

        for (uint32 i = 0; i < quantity; i++) {
            uint32 ticketIndex = _consumeAutoTicketIndex(poolId, state.currentRound, round.totalTickets);
            _mintTicketForIndex(buyer, poolId, state.currentRound, ticketIndex);
        }

        round.soldCount += quantity;
        if (round.soldCount == round.totalTickets) {
            round.status = RoundStatus.SoldOut;
            state.status = PoolStatus.SoldOut;
        }
    }

    function _purchaseTicketsWithSelection(address buyer, uint256 poolId, uint32[] calldata ticketIndexes) internal {
        if (ticketIndexes.length == 0 || ticketIndexes.length > MAX_BATCH_SIZE) revert InvalidQuantity();

        PoolConfig storage config = _getPoolConfigStorage(poolId);
        if (!config.selectable) revert InvalidPoolConfig();

        PoolState storage state = _getPoolStateStorage(poolId);
        if (state.paused) revert PoolPurchasesPaused(poolId);

        RoundState storage round = _getActiveRound(poolId);
        if (uint256(round.soldCount) + ticketIndexes.length > round.totalTickets) {
            revert SoldOut(poolId, state.currentRound);
        }

        _validateSelectionIndexes(poolId, state.currentRound, round.totalTickets, ticketIndexes);

        uint256 totalPayment = uint256(round.ticketPrice) * ticketIndexes.length;
        ILuckyScratchTreasury(treasury).collectTicketPayment(buyer, poolId, totalPayment);

        PoolAccounting storage accounting = poolAccounting[poolId];
        accounting.realizedRevenue += uint64(totalPayment);
        accounting.accruedPlatformFee += PoolMathLib.computePlatformFee(uint64(totalPayment), config.feeBps);

        for (uint256 i = 0; i < ticketIndexes.length; i++) {
            uint32 ticketIndex = ticketIndexes[i];
            soldTicketSlots[poolId][state.currentRound][ticketIndex] = true;
            _mintTicketForIndex(buyer, poolId, state.currentRound, ticketIndex);
        }

        round.soldCount += uint32(ticketIndexes.length);
        if (round.soldCount == round.totalTickets) {
            round.status = RoundStatus.SoldOut;
            state.status = PoolStatus.SoldOut;
        }
    }

    function _scratchTicket(address user, uint256 ticketId) internal {
        TicketData storage ticketData = _getTicketDataStorage(ticketId);
        if (ILuckyScratchTicket(ticket).ownerOf(ticketId) != user) revert NotTicketOwner(ticketId, user);
        if (!TicketStateLib.canScratch(ticketData.status)) revert TicketNotScratchable(ticketId);

        ticketData.status = TicketStatus.Scratched;
        encryptedTickets[ticketId].revealAuthorized = true;

        euint64 prizeHandle = encryptedTickets[ticketId].encryptedPrizeAmount;
        FHE.allowThis(prizeHandle);
        FHE.allow(prizeHandle, user);

        ILuckyScratchTicket(ticket).setTransferLocked(ticketId, true);

        RoundState storage round = roundStates[ticketData.poolId][ticketData.roundId];
        round.scratchedCount += 1;

        _maybeSettleRound(ticketData.poolId, ticketData.roundId);
        emit TicketScratched(user, ticketData.poolId, ticketData.roundId, ticketId, true);
    }

    function _claimReward(address user, uint256 ticketId, uint64 clearRewardAmount, bytes memory decryptionProof) internal {
        TicketData storage ticketData = _getTicketDataStorage(ticketId);
        if (ILuckyScratchTicket(ticket).ownerOf(ticketId) != user) revert NotTicketOwner(ticketId, user);
        if (!TicketStateLib.canClaim(ticketData.status)) revert TicketNotClaimable(ticketId);
        if (!encryptedTickets[ticketId].revealAuthorized) revert TicketNotClaimable(ticketId);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(encryptedTickets[ticketId].encryptedPrizeAmount);
        FHE.checkSignatures(handles, abi.encode(clearRewardAmount), decryptionProof);

        if (clearRewardAmount == 0) revert NoReward(ticketId);

        ticketData.status = TicketStatus.Claimed;
        RoundState storage round = roundStates[ticketData.poolId][ticketData.roundId];
        round.claimedCount += 1;
        if (round.winClaimableCount > 0) {
            round.winClaimableCount -= 1;
        }

        EncryptedUserState storage userState = users[user];
        if (!FHE.isInitialized(userState.encryptedLifetimeWinnings)) {
            userState.encryptedLifetimeWinnings = encryptedTickets[ticketId].encryptedPrizeAmount;
        } else {
            userState.encryptedLifetimeWinnings =
                FHE.add(userState.encryptedLifetimeWinnings, encryptedTickets[ticketId].encryptedPrizeAmount);
        }

        FHE.allowThis(userState.encryptedLifetimeWinnings);
        FHE.allow(userState.encryptedLifetimeWinnings, user);

        ILuckyScratchTreasury(treasury).payoutReward(user, ticketData.poolId, clearRewardAmount);
        _maybeSettleRound(ticketData.poolId, ticketData.roundId);
        emit RewardClaimed(user, ticketId, ticketData.poolId, ticketData.roundId);
    }

    function _consumeGaslessRequest(
        GaslessRequest calldata req,
        bytes calldata signature,
        GaslessAction expectedAction,
        bytes32 expectedParamsHash
    ) internal returns (bytes32 digest) {
        if (req.action != expectedAction) revert InvalidGaslessAction();
        if (req.targetContract != address(this)) revert InvalidTargetContract(address(this), req.targetContract);
        if (req.chainId != block.chainid) revert InvalidChainId(block.chainid, req.chainId);
        if (req.deadline < block.timestamp) revert ExpiredGaslessRequest(req.deadline, block.timestamp);
        if (req.paramsHash != expectedParamsHash) revert InvalidGaslessParamsHash(expectedParamsHash, req.paramsHash);

        uint256 currentNonce = nonces[req.user];
        if (req.nonce != currentNonce) revert InvalidGaslessNonce(currentNonce, req.nonce);

        bytes32 structHash = GaslessVerifyLib.hashRequest(req);
        digest = _hashTypedDataV4(structHash);

        address recoveredSigner = GaslessVerifyLib.recoverSigner(digest, signature);
        if (recoveredSigner != req.user) revert InvalidGaslessSignature();

        nonces[req.user] = currentNonce + 1;
    }

    function _requireDependenciesConfigured() internal view {
        if (ticket == address(0) || treasury == address(0) || vrfAdapter == address(0)) {
            revert DependencyNotConfigured();
        }
    }

    function _validatePoolCreation(PoolConfig calldata config, PrizeTierInput[] calldata tiers) internal view {
        if (tiers.length == 0) revert InvalidPrizeTiers();
        if (config.ticketPrice == 0 || config.totalTicketsPerRound == 0 || config.totalPrizeBudget == 0) {
            revert InvalidPoolConfig();
        }
        if (config.poolInstanceGroupSize == 0) revert InvalidPoolConfig();
        if (config.totalPrizeBudget < MIN_TOTAL_PRIZE_BUDGET || config.totalPrizeBudget > MAX_TOTAL_PRIZE_BUDGET) {
            revert InvalidPoolConfig();
        }
        if (config.maxPrize == 0 || config.maxPrize > config.totalPrizeBudget) revert InvalidPoolConfig();
        if (!_isSupportedTicketPrice(config.ticketPrice)) revert InvalidPoolConfig();
        if (config.feeBps != PLATFORM_FEE_BPS) revert InvalidPoolConfig();
        if (config.hitRateBps < MIN_HIT_RATE_BPS || config.hitRateBps > MAX_HIT_RATE_BPS) revert InvalidPoolConfig();
        if (config.targetRtpBps < MIN_RTP_BPS || config.targetRtpBps > MAX_RTP_BPS) revert InvalidPoolConfig();
        if (uint256(config.maxPrize) * MAX_BPS > uint256(config.totalPrizeBudget) * MAX_PRIZE_SHARE_BPS) {
            revert InvalidPoolConfig();
        }

        address creator = config.creator == address(0) ? msg.sender : config.creator;
        if (creator == address(0)) revert InvalidPoolConfig();
        if (config.protocolOwned) {
            if (!hasRole(ADMIN_ROLE, msg.sender)) revert InvalidPoolConfig();
        } else if (creator != msg.sender) {
            revert InvalidPoolConfig();
        }

        if (!PoolMathLib.validatePrizeBudget(tiers, config.totalTicketsPerRound, config.totalPrizeBudget)) {
            revert InvalidPrizeTiers();
        }
    }

    function _mintTicketForIndex(address buyer, uint256 poolId, uint256 roundId, uint32 ticketIndex)
        internal
        returns (uint256 ticketId)
    {
        ticketId = nextTicketId;
        nextTicketId += 1;

        tickets[ticketId] = TicketData({
            poolId: poolId,
            roundId: roundId,
            ticketIndex: ticketIndex,
            status: TicketStatus.Unscratched,
            transferredBeforeScratch: false
        });
        encryptedTickets[ticketId] =
            EncryptedTicketState({ encryptedPrizeAmount: encryptedPrizeSlots[poolId][roundId][ticketIndex], revealAuthorized: false });

        ILuckyScratchTicket(ticket).mintTicket(buyer, ticketId);
        emit TicketPurchased(buyer, poolId, ticketId, ticketIndex);
    }

    function _consumeAutoTicketIndex(uint256 poolId, uint256 roundId, uint32 totalTickets) internal returns (uint32) {
        uint32 cursor = nextAutoTicketIndex[poolId][roundId];

        while (cursor < totalTickets && soldTicketSlots[poolId][roundId][cursor]) {
            cursor += 1;
        }

        if (cursor >= totalTickets) revert SoldOut(poolId, roundId);

        soldTicketSlots[poolId][roundId][cursor] = true;
        nextAutoTicketIndex[poolId][roundId] = cursor + 1;

        return cursor;
    }

    function _validateSelectionIndexes(
        uint256 poolId,
        uint256 roundId,
        uint32 totalTickets,
        uint32[] calldata ticketIndexes
    ) internal view {
        for (uint256 i = 0; i < ticketIndexes.length; i++) {
            uint32 ticketIndex = ticketIndexes[i];
            if (ticketIndex >= totalTickets) revert TicketIndexOutOfBounds(ticketIndex);
            if (soldTicketSlots[poolId][roundId][ticketIndex]) revert TicketIndexAlreadySold(ticketIndex);

            for (uint256 j = i + 1; j < ticketIndexes.length; j++) {
                if (ticketIndex == ticketIndexes[j]) revert DuplicateTicketIndex(ticketIndex);
            }
        }
    }

    function _maybeSettleRound(uint256 poolId, uint256 roundId) internal {
        RoundState storage round = roundStates[poolId][roundId];
        if (round.status != RoundStatus.SoldOut) return;
        if (round.scratchedCount != round.soldCount) return;
        if (round.winClaimableCount != 0) return;

        round.status = RoundStatus.Settled;

        PoolAccounting storage accounting = poolAccounting[poolId];
        if (accounting.reservedPrizeBudget >= round.roundPrizeBudget) {
            accounting.reservedPrizeBudget -= round.roundPrizeBudget;
        } else {
            accounting.reservedPrizeBudget = 0;
        }
        accounting.settledPrizeCost += round.roundPrizeBudget;

        PoolState storage state = poolStates[poolId];
        PoolConfig storage config = poolConfigs[poolId];

        if (state.closeRequested || config.mode == PoolMode.OneTime) {
            state.status = PoolStatus.Closed;
            emit PoolClosed(poolId);
        }

        emit RoundSettled(poolId, roundId);
    }

    function _getPoolConfigStorage(uint256 poolId) internal view returns (PoolConfig storage config) {
        config = poolConfigs[poolId];
        if (config.creator == address(0)) revert PoolNotFound(poolId);
    }

    function _getPoolStateStorage(uint256 poolId) internal view returns (PoolState storage state) {
        if (poolConfigs[poolId].creator == address(0)) revert PoolNotFound(poolId);
        state = poolStates[poolId];
    }

    function _getActiveRound(uint256 poolId) internal view returns (RoundState storage round) {
        PoolState storage state = poolStates[poolId];
        round = roundStates[poolId][state.currentRound];
        if (state.status != PoolStatus.Active || round.status != RoundStatus.Ready) {
            revert RoundNotReady(poolId, state.currentRound);
        }
    }

    function _closePoolImmediately(uint256 poolId, PoolState storage state, RoundState storage round) internal {
        if (state.status == PoolStatus.Closed) return;

        PoolAccounting storage accounting = poolAccounting[poolId];
        if (round.soldCount == 0) {
            if (round.status == RoundStatus.Ready && accounting.reservedPrizeBudget >= round.roundPrizeBudget) {
                accounting.reservedPrizeBudget -= round.roundPrizeBudget;
            }
            if (round.status == RoundStatus.PendingVRF && accounting.lockedNextRoundBudget >= round.roundPrizeBudget) {
                accounting.lockedNextRoundBudget -= round.roundPrizeBudget;
            }
        }

        state.status = PoolStatus.Closed;
        state.vrfPending = false;
        emit PoolClosed(poolId);
    }

    function _isSupportedTicketPrice(uint64 ticketPrice) internal pure returns (bool) {
        return ticketPrice == PRICE_TIER_1 || ticketPrice == PRICE_TIER_2 || ticketPrice == PRICE_TIER_5
            || ticketPrice == PRICE_TIER_10 || ticketPrice == PRICE_TIER_15 || ticketPrice == PRICE_TIER_20;
    }

    function _getTicketData(uint256 ticketId) internal view returns (TicketData memory ticketData) {
        ticketData = tickets[ticketId];
        if (ticketData.poolId == 0) revert InvalidTicket(ticketId);
    }

    function _getTicketDataStorage(uint256 ticketId) internal view returns (TicketData storage ticketData) {
        ticketData = tickets[ticketId];
        if (ticketData.poolId == 0) revert InvalidTicket(ticketId);
    }
}
