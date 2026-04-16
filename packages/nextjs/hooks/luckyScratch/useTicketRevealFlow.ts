"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useWalletClient } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useFhevmRuntime } from "~~/services/fhevm/FhevmRuntimeProvider";
import { createTicketRelayerInstance } from "~~/services/fhevm/sdk";
import type { RelayerUserDecryptProgressArgs } from "~~/services/fhevm/types";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import type { RevealAuthResponse } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

type RevealDecryptionResult = {
  clearRewardAmount: bigint;
  decryptionProof?: `0x${string}`;
  rewardHandle: string;
  publicKey: string;
  signature: `0x${string}`;
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "unknown LuckyScratch error";
};

export const useTicketRevealFlow = (ticketId: string) => {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const {
    status: runtimeStatus,
    error: runtimeError,
    getOrCreateTicketKeypair,
    clearTicketSession,
  } = useFhevmRuntime();
  const {
    writeContractAsync,
    isPending: isClaimPending,
    isMining: isClaimMining,
  } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
  });

  const [revealAuth, setRevealAuth] = useState<RevealAuthResponse | null>(null);
  const [decryptionResult, setDecryptionResult] = useState<RevealDecryptionResult | null>(null);
  const [decryptProgress, setDecryptProgress] = useState<string>("");

  useEffect(() => {
    setRevealAuth(null);
    setDecryptionResult(null);
    setDecryptProgress("");
    clearTicketSession(ticketId);
  }, [clearTicketSession, ticketId]);

  const revealAuthMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Connect your wallet before requesting reveal authorization.");
      }
      return luckyScratchAPI.buildRevealAuth(ticketId, address);
    },
    onSuccess: response => {
      setRevealAuth(response);
      setDecryptionResult(null);
      setDecryptProgress("");
      clearTicketSession(ticketId);
      notification.success("Reveal authorization issued.");
    },
    onError: error => {
      notification.error(toErrorMessage(error));
    },
  });

  const decryptMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Connect your wallet before decrypting a ticket reward.");
      }
      if (!walletClient) {
        throw new Error("Wallet signer is not ready yet.");
      }
      if (!revealAuth?.authPayload.zama) {
        throw new Error("This reveal authorization does not include Zama relayer context.");
      }

      const zama = revealAuth.authPayload.zama;
      const keypair = await getOrCreateTicketKeypair(ticketId);
      const instance = await createTicketRelayerInstance({
        chainId: revealAuth.authPayload.chainId,
        sdkConfig: zama.sdkConfig,
      });

      const startTimestamp = Number(zama.userDecrypt.startTimestamp);
      const durationDays = Number(zama.userDecrypt.durationDays);
      const typedData = instance.createEIP712(
        keypair.publicKey,
        zama.userDecrypt.contractAddresses,
        startTimestamp,
        durationDays,
      );

      setDecryptProgress("Awaiting wallet signature for user decryption.");
      const signature = (await walletClient.signTypedData({
        account: address,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      } as never)) as `0x${string}`;

      setDecryptProgress("Submitting the user-decrypt request through the LuckyScratch backend proxy.");
      const result = await instance.userDecrypt(
        zama.userDecrypt.handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature,
        zama.userDecrypt.contractAddresses,
        address,
        startTimestamp,
        durationDays,
        {
          onProgress: (progress: RelayerUserDecryptProgressArgs) => {
            if (progress.type === "queued") {
              setDecryptProgress(`Decryption queued on relayer job ${progress.jobId}.`);
              return;
            }
            if (progress.type === "succeeded") {
              setDecryptProgress("Decryption completed.");
              return;
            }
            if (progress.type === "throttled") {
              setDecryptProgress(`Relayer throttled the request. Retrying in ${progress.retryAfterMs}ms.`);
              return;
            }
            if (progress.type === "timeout") {
              setDecryptProgress("Relayer request timed out.");
              return;
            }
            if (progress.type === "failed") {
              setDecryptProgress(progress.relayerApiError.message);
            }
          },
        },
      );

      const rewardHandle = zama.userDecrypt.handleContractPairs[0]?.handle;
      if (!rewardHandle) {
        throw new Error("Reveal authorization is missing the encrypted reward handle.");
      }

      const clearRewardValue = result[rewardHandle];
      if (typeof clearRewardValue === "undefined") {
        throw new Error("The relayer response did not contain the decrypted reward value.");
      }

      return {
        clearRewardAmount: BigInt(clearRewardValue),
        rewardHandle,
        publicKey: keypair.publicKey,
        signature,
      } satisfies RevealDecryptionResult;
    },
    onSuccess: result => {
      setDecryptionResult(result);
      notification.success("Ticket reward decrypted.");
    },
    onError: error => {
      notification.error(toErrorMessage(error));
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!decryptionResult) {
        throw new Error("Decrypt the reward before submitting the claim transaction.");
      }
      if (!decryptionResult.decryptionProof) {
        throw new Error(
          "Current reveal flow only returns the clear reward value. Claim proof assembly still needs a dedicated proof path.",
        );
      }

      return writeContractAsync({
        functionName: "claimReward",
        args: [BigInt(ticketId), decryptionResult.clearRewardAmount, decryptionResult.decryptionProof],
      });
    },
    onSuccess: () => {
      notification.success("Claim transaction submitted.");
    },
    onError: error => {
      notification.error(toErrorMessage(error));
    },
  });

  const claimDisabledReason = useMemo(() => {
    if (!decryptionResult) {
      return "Decrypt the reward first.";
    }
    if (!decryptionResult.decryptionProof) {
      return "The current backend proxy exposes user-decrypt, but not a claim-proof assembly route yet.";
    }
    return null;
  }, [decryptionResult]);

  return {
    address,
    chainId,
    runtimeStatus,
    runtimeError,
    revealAuth,
    revealAuthMutation,
    decryptMutation,
    claimMutation,
    decryptProgress,
    decryptionResult,
    isClaimPending: isClaimPending || isClaimMining,
    claimDisabledReason,
  };
};
