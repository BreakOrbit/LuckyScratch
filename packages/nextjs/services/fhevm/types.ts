export type TicketKeypair = {
  publicKey: string;
  privateKey: string;
};

export type HandleContractPair = {
  handle: string;
  contractAddress: string;
};

export type RelayerUserDecryptProgressArgs =
  | {
      type: "queued";
      jobId: string;
    }
  | {
      type: "succeeded";
      result: unknown;
    }
  | {
      type: "throttled";
      retryAfterMs: number;
    }
  | {
      type: "timeout";
    }
  | {
      type: "failed";
      relayerApiError: {
        message: string;
      };
    };

export type FhevmInstanceConfig = {
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  aclContractAddress: string;
  gatewayChainId: number;
  relayerUrl: string;
  network: string;
  chainId: number;
  relayerRouteVersion?: 1 | 2;
};

export type FhevmInstance = {
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ) => {
    domain: Record<string, unknown>;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  userDecrypt: (
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
    options?: {
      onProgress?: (args: RelayerUserDecryptProgressArgs) => void;
    },
  ) => Promise<Record<string, bigint | number | boolean | string>>;
};

export type RelayerSDKModule = {
  initSDK: () => Promise<boolean>;
  createInstance: (config: FhevmInstanceConfig) => Promise<FhevmInstance>;
  generateKeypair: () => TicketKeypair;
};
