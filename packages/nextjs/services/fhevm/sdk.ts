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

export const generateTicketKeypair = async (): Promise<TicketKeypair> => {
  const sdk = await loadRelayerSDK();
  return sdk.generateKeypair();
};
