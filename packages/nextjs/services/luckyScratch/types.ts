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
