"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, TicketIcon } from "@heroicons/react/24/outline";
import { BatchScratchView } from "~~/components/scratch/BatchScratchView";
import { SingleScratchView } from "~~/components/scratch/SingleScratchView";
import { useLuckyScratchPool } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { buildTicketClaimProof } from "~~/services/luckyScratch/claim";
import { fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchTicket } from "~~/services/luckyScratch/types";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type ScratchPageProps = {
  poolId: string;
};

type TicketResult = {
  ticketId: string;
  isWin: boolean;
  prize: number;
  isKnown?: boolean;
};

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
  const queryClient = useQueryClient();
  const poolQuery = useLuckyScratchPool(poolId);
  const { writeContractAsync } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
  });

  const ticketIds = useMemo(() => parseTicketIds(searchParams.get("tickets") || ""), [searchParams]);
  const ticketIdsKey = ticketIds.join(",");
  const [resultsByTicketId, setResultsByTicketId] = useState<Record<string, TicketResult>>({});
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
  }, [ticketIdsKey]);

  const decryptScratchResults = useCallback(async () => {
    if (!address) {
      return;
    }
    if (!chainId) {
      notification.warning("Scratch confirmed, but no connected chain id is available for reward decryption.");
      return;
    }

    const decryptToastId = notification.loading(
      ticketIds.length === 1 ? "Decrypting scratch result..." : "Decrypting scratch results...",
    );

    try {
      const settledResults = await Promise.allSettled(
        ticketIds.map(async ticketId => {
          const revealAuth = await luckyScratchAPI.buildRevealAuth(ticketId, address);
          const claimProof = await buildTicketClaimProof({ chainId, revealAuth });
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
        notification.warning(
          `${failedCount} ticket result(s) could not be decrypted now. ${toErrorMessage(firstFailure)}`,
        );
        return;
      }

      notification.success(ticketIds.length === 1 ? "Scratch result decrypted." : "Scratch results decrypted.");
    } finally {
      notification.remove(decryptToastId);
    }
  }, [address, chainId, ticketIds]);

  const submitScratch = useCallback(async () => {
    if (!address) {
      const error = new Error("Connect your wallet before scratching tickets.");
      notification.error(error.message);
      throw error;
    }
    if (ticketIds.length === 0) {
      const error = new Error("No ticket ids were provided.");
      notification.error(error.message);
      throw error;
    }

    try {
      let scratchTxHash: string | undefined;
      if (ticketIds.length === 1) {
        scratchTxHash = await writeContractAsync({
          functionName: "scratchTicket",
          args: [BigInt(ticketIds[0])],
        });
      } else {
        scratchTxHash = await writeContractAsync({
          functionName: "batchScratch",
          args: [ticketIds.map(ticketId => BigInt(ticketId))],
        });
      }
      if (!scratchTxHash) {
        throw new Error("Scratch transaction was not submitted.");
      }

      // Optimistic update: mark tickets as Scratched in cache
      for (const ticketId of ticketIds) {
        queryClient.setQueryData<LuckyScratchTicket>(["lucky-scratch", "tickets", ticketId], old => {
          if (!old) return old;
          return { ...old, status: "Scratched" };
        });
      }
      // Sync this tx to backend before invalidating so the refetch gets authoritative data
      try {
        await luckyScratchAPI.syncTransaction(scratchTxHash);
      } catch {
        console.warn("Backend tx sync failed; cache will update on next poll");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", poolId] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
        ...ticketIds.map(ticketId =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId] }),
        ),
      ]);
      notification.success(
        ticketIds.length === 1 ? "Scratch transaction confirmed." : "Batch scratch transaction confirmed.",
      );

      try {
        await decryptScratchResults();
      } catch (error) {
        notification.warning(`Scratch confirmed, but reward decryption did not complete. ${toErrorMessage(error)}`);
      }
    } catch (error) {
      const message = getParsedError(error) || "Scratch transaction failed.";
      notification.error(message);
      throw error;
    }
  }, [address, decryptScratchResults, poolId, queryClient, ticketIds, writeContractAsync]);

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
        onScratch={submitScratch}
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
      onScratchAll={submitScratch}
    />
  );
};
