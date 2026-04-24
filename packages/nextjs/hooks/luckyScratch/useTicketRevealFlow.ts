"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  decryptionProof: `0x${string}`;
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

const resolveHandleValue = (values: Record<string, bigint | number | boolean | string>, handle: string) => {
  if (handle in values) {
    return values[handle];
  }

  const normalizedHandle = handle.toLowerCase();
  const match = Object.entries(values).find(([candidate]) => candidate.toLowerCase() === normalizedHandle);
  return match?.[1];
};

const toBigIntValue = (value: bigint | number | boolean | string, label: string) => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value);
  }
  throw new Error(`${label} did not decode into an unsigned integer.`);
};

export const useTicketRevealFlow = (ticketId: string) => {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const {
    status: runtimeStatus,
    error: runtimeError,
    getOrCreateTicketKeypair,
    clearTicketSession,
  } = useFhevmRuntime();
  const {
    writeContractAsync: writeClaimContractAsync,
    isPending: isClaimPending,
    isMining: isClaimMining,
  } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
  });
  const {
    writeContractAsync: writeScratchContractAsync,
    isPending: isScratchPending,
    isMining: isScratchMining,
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

  const scratchMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Connect your wallet before scratching this ticket.");
      }

      return writeScratchContractAsync({
        functionName: "scratchTicket",
        args: [BigInt(ticketId)],
      });
    },
    onSuccess: async () => {
      setRevealAuth(null);
      setDecryptionResult(null);
      setDecryptProgress("");
      clearTicketSession(ticketId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId, "claim-precheck"] }),
        ...(address
          ? [queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] })]
          : []),
      ]);
      notification.success("Scratch transaction submitted.");
    },
    onError: error => {
      notification.error(toErrorMessage(error));
    },
  });

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

      const clearRewardValue = resolveHandleValue(result, rewardHandle);
      if (typeof clearRewardValue === "undefined") {
        throw new Error("The relayer response did not contain the decrypted reward value.");
      }

      const clearRewardAmount = toBigIntValue(clearRewardValue, "User decrypt reward");
      if (clearRewardAmount === 0n) {
        setDecryptProgress("Reward decrypted for the owner. This ticket has no claimable reward.");
        return {
          clearRewardAmount,
          decryptionProof: "0x",
          rewardHandle,
          publicKey: keypair.publicKey,
          signature,
        } satisfies RevealDecryptionResult;
      }

      setDecryptProgress("Reward decrypted for the owner. Fetching the public claim proof for onchain verification.");
      const publicDecrypt = await instance.publicDecrypt([rewardHandle]);
      const publicRewardValue = resolveHandleValue(publicDecrypt.clearValues, rewardHandle);
      if (typeof publicRewardValue === "undefined") {
        throw new Error("The public decrypt response did not contain the ticket reward value.");
      }

      const publicRewardAmount = toBigIntValue(publicRewardValue, "Public decrypt reward");
      if (publicRewardAmount !== clearRewardAmount) {
        throw new Error("Public decrypt proof did not match the owner-visible reward value.");
      }
      if (!publicDecrypt.decryptionProof) {
        throw new Error("The relayer did not return a decryption proof for claim submission.");
      }

      return {
        clearRewardAmount,
        decryptionProof: publicDecrypt.decryptionProof,
        rewardHandle,
        publicKey: keypair.publicKey,
        signature,
      } satisfies RevealDecryptionResult;
    },
    onSuccess: result => {
      setDecryptionResult(result);
      notification.success(
        result.clearRewardAmount === 0n
          ? "Ticket reward decrypted. This ticket has no claimable reward."
          : "Ticket reward decrypted and claim proof prepared.",
      );
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

      if (decryptionResult.clearRewardAmount === 0n) {
        throw new Error("This ticket has no reward to claim.");
      }

      return writeClaimContractAsync({
        functionName: "claimReward",
        args: [BigInt(ticketId), decryptionResult.clearRewardAmount, decryptionResult.decryptionProof],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId, "claim-precheck"] }),
        ...(address
          ? [
              queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
              queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "wins"] }),
            ]
          : []),
      ]);
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
    if (decryptionResult.clearRewardAmount === 0n) {
      return "This ticket has no reward to claim.";
    }
    return null;
  }, [decryptionResult]);

  return {
    address,
    chainId,
    runtimeStatus,
    runtimeError,
    revealAuth,
    scratchMutation,
    revealAuthMutation,
    decryptMutation,
    claimMutation,
    decryptProgress,
    decryptionResult,
    isScratchPending: scratchMutation.isPending || isScratchPending || isScratchMining,
    isClaimPending: isClaimPending || isClaimMining,
    claimDisabledReason,
  };
};
