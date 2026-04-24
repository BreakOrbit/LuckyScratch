"use client";

import type { FhevmInstance, FhevmInstanceConfig, RelayerSDKModule, TicketKeypair } from "./types";
import scaffoldConfig from "~~/scaffold.config";
import type { ZamaSDKConfig } from "~~/services/luckyScratch/types";

const RELAYER_SDK_LOAD_TIMEOUT_MS = 15_000;

let relayerSDKPromise: Promise<RelayerSDKModule> | null = null;
let relayerSDKInitPromise: Promise<boolean> | null = null;

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "unknown relayer SDK error";
};

const waitForRelayerSDK = (timeoutMs = RELAYER_SDK_LOAD_TIMEOUT_MS) =>
  new Promise<RelayerSDKModule>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("relayer SDK is only available in the browser"));
      return;
    }

    const startedAt = Date.now();
    const poll = () => {
      if (window.relayerSDK) {
        resolve(window.relayerSDK);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("timed out while loading the relayer SDK script"));
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  });

export const loadRelayerSDK = async () => {
  if (!relayerSDKPromise) {
    relayerSDKPromise = waitForRelayerSDK();
  }
  const sdk = await relayerSDKPromise;

  if (!relayerSDKInitPromise) {
    relayerSDKInitPromise = sdk.initSDK();
  }
  await relayerSDKInitPromise;

  return sdk;
};

const resolveRPCURL = (chainId: number) => {
  const override = (scaffoldConfig.rpcOverrides as Record<number, string> | undefined)?.[chainId];
  if (override) {
    return override;
  }

  const chain = scaffoldConfig.targetNetworks.find(targetNetwork => targetNetwork.id === chainId);
  return chain?.rpcUrls.default.http[0];
};

export const ZAMA_SEPOLIA_SDK_CONFIG: ZamaSDKConfig = {
  relayerUrl: "https://relayer.testnet.zama.org",
  usesBackendProxy: false,
  gatewayChainId: 10901,
  fhevmExecutorContractAddress: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
  aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  hcuContractAddress: "0xa10998783c8CF88D886Bc30307e631D6686F0A22",
  kmsVerifierContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  inputVerifierContractAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  verifyingContractAddressDecryption: "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478",
  verifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955",
  apiKeyRequired: false,
};

export const createTicketRelayerInstance = async ({
  chainId,
  sdkConfig,
}: {
  chainId: number;
  sdkConfig: ZamaSDKConfig;
}): Promise<FhevmInstance> => {
  const sdk = await loadRelayerSDK();
  const network = resolveRPCURL(chainId);

  if (!network) {
    throw new Error(
      `No RPC URL is configured for chain ${chainId}. Add the network to scaffold.config.ts or set an override.`,
    );
  }

  const config: FhevmInstanceConfig = {
    verifyingContractAddressDecryption: sdkConfig.verifyingContractAddressDecryption,
    verifyingContractAddressInputVerification: sdkConfig.verifyingContractAddressInputVerification,
    kmsContractAddress: sdkConfig.kmsVerifierContractAddress,
    inputVerifierContractAddress: sdkConfig.inputVerifierContractAddress,
    aclContractAddress: sdkConfig.aclContractAddress,
    gatewayChainId: sdkConfig.gatewayChainId,
    relayerUrl: sdkConfig.relayerUrl,
    network,
    chainId,
    relayerRouteVersion: 2,
  };

  try {
    return await sdk.createInstance(config);
  } catch (error) {
    throw new Error(`failed to create relayer instance: ${toErrorMessage(error)}`);
  }
};

export const createSepoliaRelayerInstance = async ({ chainId }: { chainId: number }): Promise<FhevmInstance> => {
  if (chainId !== 11155111) {
    throw new Error("Zama balance decryption is currently configured for Sepolia only.");
  }

  return createTicketRelayerInstance({
    chainId,
    sdkConfig: ZAMA_SEPOLIA_SDK_CONFIG,
  });
};

export const generateTicketKeypair = async (): Promise<TicketKeypair> => {
  const sdk = await loadRelayerSDK();
  return sdk.generateKeypair();
};
