"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isAddressEqual } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ArrowLeftIcon, TicketIcon } from "@heroicons/react/24/outline";
import { BatchScratchView } from "~~/components/scratch/BatchScratchView";
import { SingleScratchView } from "~~/components/scratch/SingleScratchView";
import { useLuckyScratchPool } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { buildTicketClaimProofDirect } from "~~/services/luckyScratch/claim";
import { fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchTicket } from "~~/services/luckyScratch/types";
import { AllowedChainIds, getParsedError, notification } from "~~/utils/scaffold-eth";

type ScratchPageProps = {
  poolId: string;
};

type TicketResult = {
  ticketId: string;
  isWin: boolean;
  prize: number;
  isKnown?: boolean;
};

const TICKET_STATUS_UNSCRATCHED = 0;
const TICKET_STATUS_SCRATCHED = 1;
const TICKET_STATUS_CLAIMED = 2;
const SUPPORTED_SCRATCH_CHAIN_IDS = [11155111, 31337] as const satisfies readonly AllowedChainIds[];

const parseTicketIds = (raw: string) => [
  ...new Set(
    raw
      .split(",")
      .map(value => value.trim())
      .filter(value => /^\d+$/.test(value)),
  ),
];

const buildUnknownResult = (ticketId: string): TicketResult => ({
  ticketId,
  isWin: false,
  prize: 0,
  isKnown: false,
});

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Reward decryption failed.";
};

export const ScratchPage: React.FC<ScratchPageProps> = ({ poolId }) => {
  const searchParams = useSearchParams();
  const { address, chainId } = useAccount();
  const scratchChainId = SUPPORTED_SCRATCH_CHAIN_IDS.find(supportedChainId => supportedChainId === chainId);
  const publicClient = usePublicClient({ chainId: scratchChainId });
  const queryClient = useQueryClient();
  const poolQuery = useLuckyScratchPool(poolId);
  const { data: coreContract, isLoading: isCoreContractLoading } = useDeployedContractInfo({
    contractName: "LuckyScratchCore",
    chainId: scratchChainId,
  });
  const { data: ticketContract, isLoading: isTicketContractLoading } = useDeployedContractInfo({
    contractName: "LuckyScratchTicket",
    chainId: scratchChainId,
  });
  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
    chainId: scratchChainId,
  });

  const ticketIds = useMemo(() => parseTicketIds(searchParams.get("tickets") || ""), [searchParams]);
  const ticketIdsKey = ticketIds.join(",");
  const [resultsByTicketId, setResultsByTicketId] = useState<Record<string, TicketResult>>({});
  const [prepareStage, setPrepareStage] = useState("");
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [isPreparingResults, setIsPreparingResults] = useState(false);
  const [areResultsReady, setAreResultsReady] = useState(false);
  const preparationRunKeyRef = useRef("");
  const pool = poolQuery.data;
  const poolName = pool?.metadata?.name || `Pool #${poolId}`;
  const ticketPrice = fromMicroUsdc(pool?.ticketPrice);
  const maxPrize = fromMicroUsdc(pool?.maxPrize);
  const results = useMemo(
    () => ticketIds.map(ticketId => resultsByTicketId[ticketId] ?? buildUnknownResult(ticketId)),
    [resultsByTicketId, ticketIds],
  );

  useEffect(() => {
    setResultsByTicketId({});
    setPrepareStage("");
    setPrepareError(null);
    setIsPreparingResults(false);
    setAreResultsReady(false);
    preparationRunKeyRef.current = "";
  }, [ticketIdsKey]);

  const prepareScratchResults = useCallback(async () => {
    if (!address) {
      return;
    }
    if (!chainId) {
      setPrepareError("Connect to a supported network before opening tickets.");
      return;
    }
    if (!scratchChainId) {
      setPrepareError("Switch to Sepolia before opening tickets.");
      return;
    }
    if (!publicClient || !coreContract || !ticketContract) {
      setPrepareError("Contract info is not available yet.");
      return;
    }
    if (ticketIds.length === 0) {
      return;
    }

    setIsPreparingResults(true);
    setAreResultsReady(false);
    setPrepareError(null);
    const prepareToastId = notification.loading(
      ticketIds.length === 1 ? "Preparing ticket result..." : "Preparing ticket results...",
    );

    try {
      setPrepareStage("Checking ticket state");
      const revealStates = await Promise.all(
        ticketIds.map(async ticketId => {
          const state = await publicClient.readContract({
            address: coreContract.address,
            abi: coreContract.abi,
            functionName: "getTicketRevealState",
            args: [BigInt(ticketId)],
          });
          const [status, revealAuthorized] = state as readonly [number, boolean];
          return { ticketId, status: Number(status), revealAuthorized };
        }),
      );

      const invalidTicket = revealStates.find(
        state =>
          state.status !== TICKET_STATUS_UNSCRATCHED &&
          state.status !== TICKET_STATUS_SCRATCHED &&
          state.status !== TICKET_STATUS_CLAIMED,
      );
      if (invalidTicket) {
        throw new Error(`Ticket #${invalidTicket.ticketId} is not ready to reveal.`);
      }

      setPrepareStage("Checking ticket owner");
      const ticketOwners = await Promise.all(
        ticketIds.map(async ticketId => {
          const owner = await publicClient.readContract({
            address: ticketContract.address,
            abi: ticketContract.abi,
            functionName: "ownerOf",
            args: [BigInt(ticketId)],
          });
          return { ticketId, owner: owner as `0x${string}` };
        }),
      );
      const ticketNotOwned = ticketOwners.find(ownerInfo => !isAddressEqual(ownerInfo.owner, address));
      if (ticketNotOwned) {
        throw new Error(`Ticket #${ticketNotOwned.ticketId} is owned by another wallet.`);
      }

      const scratchableTicketIds = revealStates
        .filter(state => state.status === TICKET_STATUS_UNSCRATCHED)
        .map(state => state.ticketId);
      if (scratchableTicketIds.length > 0) {
        setPrepareStage("Confirming scratch transaction");
        let scratchTxHash: string | undefined;
        if (scratchableTicketIds.length === 1) {
          scratchTxHash = await writeContractAsync({
            functionName: "scratchTicket",
            args: [BigInt(scratchableTicketIds[0])],
          });
        } else {
          scratchTxHash = await writeContractAsync({
            functionName: "batchScratch",
            args: [scratchableTicketIds.map(ticketId => BigInt(ticketId))],
          });
        }
        if (!scratchTxHash) {
          throw new Error("Scratch transaction was not submitted.");
        }

        for (const ticketId of scratchableTicketIds) {
          queryClient.setQueryData<LuckyScratchTicket>(["lucky-scratch", "tickets", ticketId], old => {
            if (!old) return old;
            return { ...old, status: "Scratched", revealAuthorized: true };
          });
        }

        try {
          await luckyScratchAPI.syncTransaction(scratchTxHash);
        } catch {
          console.warn("Backend tx sync failed; cache will update on next poll");
        }
      }

      const unauthorizedTicket = revealStates.find(
        state => state.status !== TICKET_STATUS_UNSCRATCHED && !state.revealAuthorized,
      );
      if (unauthorizedTicket) {
        throw new Error(`Ticket #${unauthorizedTicket.ticketId} is not authorized for reveal yet.`);
      }

      setPrepareStage("Decrypting result");
      const settledResults = await Promise.allSettled(
        ticketIds.map(async ticketId => {
          const handle = await publicClient.readContract({
            address: coreContract.address,
            abi: coreContract.abi,
            functionName: "getTicketPrizeHandle",
            args: [BigInt(ticketId)],
          });
          const claimProof = await buildTicketClaimProofDirect({ chainId: scratchChainId, handle: handle as string });
          return {
            ticketId,
            isWin: claimProof.clearRewardAmount > 0n,
            prize: fromMicroUsdc(claimProof.clearRewardAmount),
            isKnown: true,
          } satisfies TicketResult;
        }),
      );

      const nextResults: Record<string, TicketResult> = {};
      let failedCount = 0;
      let firstFailure: unknown;

      settledResults.forEach((settledResult, index) => {
        const ticketId = ticketIds[index];
        if (settledResult.status === "fulfilled") {
          nextResults[ticketId] = settledResult.value;
          return;
        }

        failedCount += 1;
        firstFailure ??= settledResult.reason;
        nextResults[ticketId] = buildUnknownResult(ticketId);
      });

      setResultsByTicketId(nextResults);

      if (failedCount > 0) {
        throw new Error(`${failedCount} ticket result(s) could not be decrypted now. ${toErrorMessage(firstFailure)}`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", poolId] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
        ...ticketIds.map(ticketId =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId] }),
        ),
      ]);

      setAreResultsReady(true);
      setPrepareStage("Ready");
      notification.success(ticketIds.length === 1 ? "Ticket result is ready to reveal." : "Ticket results are ready.");
    } catch (error) {
      const message = getParsedError(error) || toErrorMessage(error);
      setPrepareError(message);
      setPrepareStage("");
      throw error;
    } finally {
      setIsPreparingResults(false);
      notification.remove(prepareToastId);
    }
  }, [
    address,
    chainId,
    coreContract,
    poolId,
    publicClient,
    queryClient,
    scratchChainId,
    ticketContract,
    ticketIds,
    writeContractAsync,
  ]);

  useEffect(() => {
    if (!address || !chainId || ticketIds.length === 0) {
      return;
    }
    if (!scratchChainId) {
      setPrepareError("Switch to Sepolia before opening tickets.");
      return;
    }
    if (!publicClient) {
      return;
    }
    if (!coreContract || !ticketContract) {
      if (!isCoreContractLoading && !isTicketContractLoading) {
        setPrepareError("LuckyScratch contracts are not deployed on the connected network. Switch to Sepolia.");
      }
      return;
    }
    const runKey = `${address.toLowerCase()}:${scratchChainId}:${coreContract.address}:${ticketIdsKey}`;
    if (preparationRunKeyRef.current === runKey) {
      return;
    }
    preparationRunKeyRef.current = runKey;
    prepareScratchResults().catch(error => {
      console.warn("Scratch result preparation failed", error);
    });
  }, [
    address,
    chainId,
    coreContract,
    isCoreContractLoading,
    isTicketContractLoading,
    prepareScratchResults,
    publicClient,
    scratchChainId,
    ticketContract,
    ticketIds.length,
    ticketIdsKey,
  ]);

  const retryPrepareScratchResults = useCallback(() => {
    preparationRunKeyRef.current = "";
    prepareScratchResults().catch(error => {
      console.warn("Scratch result preparation failed", error);
    });
  }, [prepareScratchResults]);

  const revealPreparedScratch = useCallback(async () => {
    if (!areResultsReady) {
      throw new Error("Ticket result is still being prepared.");
    }
  }, [areResultsReady]);

  const preparationStageLabel =
    prepareError ||
    (isPreparingResults ? prepareStage || "Preparing result" : areResultsReady ? "Result ready" : "Preparing result");

  if (ticketIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#0C1323] px-4 pb-16 pt-24 font-body text-[#DCE2F9] md:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-dashed border-white/15 bg-[#11192B] p-10 text-center">
          <p className="font-headline text-2xl font-bold text-white">No ticket ids were provided</p>
          <p className="mt-2 text-sm text-[#9FB0D0]">
            Return to the purchase flow or open your wallet inventory to select tickets.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/purchase/${poolId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#FFD66D]/40 hover:text-[#FFD66D]"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back to purchase
            </Link>
            <Link
              href="/my-tickets"
              className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-4 py-3 text-sm font-bold text-[#705E00]"
            >
              <TicketIcon className="h-5 w-5" />
              Open inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (ticketIds.length === 1) {
    return (
      <SingleScratchView
        poolId={poolId}
        poolName={poolName}
        ticketPrice={ticketPrice}
        maxPrize={maxPrize}
        ticketId={ticketIds[0]}
        ticketArtUrl={pool?.metadata?.ticketArtUrl}
        result={results[0]}
        isReadyToScratch={areResultsReady}
        preparationStage={preparationStageLabel}
        preparationError={prepareError}
        onRetryPrepare={retryPrepareScratchResults}
        onScratch={revealPreparedScratch}
      />
    );
  }

  return (
    <BatchScratchView
      poolName={poolName}
      ticketPrice={ticketPrice}
      ticketIds={ticketIds}
      ticketArtUrl={pool?.metadata?.ticketArtUrl}
      results={results}
      isReadyToScratch={areResultsReady}
      preparationStage={preparationStageLabel}
      preparationError={prepareError}
      onRetryPrepare={retryPrepareScratchResults}
      onScratchAll={revealPreparedScratch}
    />
  );
};
