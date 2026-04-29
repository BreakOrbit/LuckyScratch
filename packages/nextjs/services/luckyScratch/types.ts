export type LuckyScratchTicket = {
  ticketId: number;
  poolId: number;
  roundId: number;
  owner: string;
  ticketIndex: number;
  status: string;
  revealAuthorized: boolean;
  transferredBeforeScratch: boolean;
  mintTxHash: string;
  claimedBy: string;
  claimClearRewardAmount: number;
  lastEventBlock: number;
  lastEventTxHash: string;
  lastEventLogIndex: number;
  lastEventBlockHash: string;
  createdAt: string;
  updatedAt: string;
};

export type UserTicketsResponse = {
  items: LuckyScratchTicket[];
  limit: number;
  offset: number;
  nextOffset: number;
  totalCount: number;
  hasMore: boolean;
};

export type UserWinsResponse = {
  items: LuckyScratchTicket[];
};

export type RecentWinsResponse = {
  items: LuckyScratchTicket[];
};

export type LuckyScratchHealth = {
  status: string;
  chain: string;
};

export type LuckyScratchPlatformOverview = {
  totalPools: number;
  activePools: number;
  totalRealizedRevenue: number;
  totalRevealedTickets: number;
  totalWinningClaims: number;
  totalClaimedRewards: number;
};

export type LuckyScratchPlayerLeaderboardEntry = {
  rank: number;
  playerAddress: string;
  displayAddress: string;
  winCount: number;
  totalRewardAmount: number;
  lastWinAt: string;
};

export type LuckyScratchPlayerLeaderboardResponse = {
  timeframe: "weekly" | "all-time";
  items: LuckyScratchPlayerLeaderboardEntry[];
};

export type RevealClaimInfo = {
  requiresClearRewardAmount: boolean;
  requiresDecryptionProof: boolean;
  claimMethod: string;
};

export type ZamaHandleContractPair = {
  handle: string;
  contractAddress: string;
};

export type ZamaSDKConfig = {
  relayerUrl: string;
  upstreamRelayerUrl?: string;
  usesBackendProxy: boolean;
  gatewayChainId: number;
  fhevmExecutorContractAddress?: string;
  aclContractAddress: string;
  hcuContractAddress?: string;
  kmsVerifierContractAddress: string;
  inputVerifierContractAddress: string;
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  apiKeyRequired: boolean;
};

export type ZamaUserDecryptTemplate = {
  handleContractPairs: ZamaHandleContractPair[];
  contractAddresses: string[];
  startTimestamp: string;
  durationDays: string;
  maxTotalBits: number;
  expectedSigner: string;
};

export type ZamaClaimProofTemplate = {
  handles: string[];
  handleContractPairs: ZamaHandleContractPair[];
  abiEncoding: string;
  proofType: string;
  verifyOnchainWith: string;
  batchOrderMatters: boolean;
};

export type ZamaRevealContext = {
  integrationMode: string;
  billingMode: string;
  sdkConfig: ZamaSDKConfig;
  userDecrypt: ZamaUserDecryptTemplate;
  claimProof: ZamaClaimProofTemplate;
  notes?: string[];
};

export type RevealAuthPayload = {
  mode: string;
  chainId: number;
  ticketId: number;
  owner: string;
  coreContract: string;
  ticketContract: string;
  encryptedPrizeHandle: string;
  binding: {
    ticketId: number;
    owner: string;
    chainId: number;
    expiresAt: string;
    revealRequestRef?: string;
  };
  zama?: ZamaRevealContext;
};

export type RevealAuthResponse = {
  ticketId: string;
  authPayload: RevealAuthPayload;
  claim: RevealClaimInfo;
  expiresAt: string;
};

export type ClaimPrecheckResponse = {
  ticketId: string;
  owner: string;
  status: string;
  revealAuthorized: boolean;
  claimMethod: string;
  sourceOfTruthHint: string;
};

export type LuckyScratchPoolRound = {
  poolId: number;
  roundId: number;
  status: string;
  soldCount: number;
  scratchedCount: number;
  claimedCount: number;
  winClaimableCount: number;
  totalTickets: number;
  ticketPrice: number;
  roundPrizeBudget: number;
  vrfRequestRef: string;
  shuffleRoot: string;
  lastVrfRequestedAt: string;
  lastVrfInitializedAt: string;
  lastEventBlock: number;
  lastEventTxHash: string;
  lastEventLogIndex: number;
  lastEventBlockHash: string;
  createdAt: string;
  updatedAt: string;
};

export type LuckyScratchPoolMetadata = {
  poolId: number;
  ownerAddress: string;
  name: string;
  description: string;
  themeKey: string;
  themeId: string;
  metadataCid: string;
  metadataUri: string;
  metadataGatewayUrl: string;
  coverAssetId?: number;
  ticketArtAssetId?: number;
  coverImageUrl?: string;
  ticketArtUrl?: string;
  prizeTiers?: PrizeTierPreview[];
};

export type LuckyScratchPool = {
  poolId: number;
  creator: string;
  protocolOwned: boolean;
  mode: string;
  status: string;
  paused: boolean;
  closeRequested: boolean;
  vrfPending: boolean;
  initialized: boolean;
  themeId: string;
  ticketPrice: number;
  totalTicketsPerRound: number;
  totalPrizeBudget: number;
  poolInstanceGroupSize: number;
  feeBps: number;
  targetRtpBps: number;
  hitRateBps: number;
  maxPrize: number;
  selectable: boolean;
  currentRound: number;
  lockedBond: number;
  reservedPrizeBudget: number;
  lockedNextRoundBudget: number;
  realizedRevenue: number;
  settledPrizeCost: number;
  settledProtocolCost: number;
  accruedPlatformFee: number;
  creatorProfitClaimed: number;
  claimableCreatorProfit: number;
  createdBlock: number;
  createdTxHash: string;
  lastEventBlock: number;
  lastEventTxHash: string;
  lastEventLogIndex: number;
  lastEventBlockHash: string;
  createdAt: string;
  updatedAt: string;
  currentRoundState?: LuckyScratchPoolRound;
  metadata?: LuckyScratchPoolMetadata | null;
};

export type LuckyScratchPoolsResponse = {
  items: LuckyScratchPool[];
};

export type LuckyScratchCreatorSummary = {
  creator: string;
  totalPools: number;
  activePools: number;
  totalRealizedRevenue: number;
  totalAccruedPlatformFee: number;
  totalClaimableProfit: number;
  totalLockedBond: number;
  currentRoundSoldCount: number;
  currentRoundTotalTickets: number;
};

export type UploadedImageAsset = {
  assetId: number;
  ownerAddress: string;
  kind: string;
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export type PrizeTierPreview = {
  prizeAmount: number;
  count: number;
  prizeAmountUsdc?: number;
};

export type LuckyScratchPoolMetadataDocument = {
  prizeTiers: PrizeTierPreview[];
};

export type PoolConfigPreview = {
  mode: string;
  modeValue: number;
  ticketPriceUsdc: number;
  ticketPrice: number;
  totalTicketsPerRound: number;
  totalPrizeBudgetUsdc: number;
  totalPrizeBudget: number;
  poolInstanceGroupSize: number;
  feeBps: number;
  targetRtpBps: number;
  hitRateBps: number;
  maxPrizeUsdc: number;
  maxPrize: number;
  selectable: boolean;
  estimatedBondUsdc: number;
  estimatedBond: number;
};

export type CreatePoolDraftInput = {
  ownerAddress: string;
  name: string;
  description: string;
  themeKey?: string;
  coverAssetId: number;
  ticketArtAssetId: number;
  poolConfigPreview: PoolConfigPreview;
  prizeTiers: PrizeTierPreview[];
};

export type PoolDraft = {
  draftId: number;
  name: string;
  description: string;
  themeKey: string;
  metadataCid: string;
  metadataUri: string;
  metadataGatewayUrl: string;
  themeId: string;
  status: string;
};

export type FinalizePoolInput = {
  draftId: number;
  ownerAddress: string;
  createTxHash: string;
};

export type LuckyScratchPurchaseContext = {
  pool: LuckyScratchPool;
  currentRound?: LuckyScratchPoolRound;
  soldTicketIndexes: number[];
  availableTicketIndexes: number[];
};
