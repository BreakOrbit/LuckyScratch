"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, SparklesIcon, TicketIcon } from "@heroicons/react/24/outline";
import { TicketRevealWorkspace } from "~~/components/luckyScratch/TicketRevealWorkspace";
import { useLuckyScratchPool } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { formatPercentFromBps, formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchTicket } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

type ScratchPageProps = {
  poolId: string;
};

const ticketStatusLabel = (status: string) => {
  switch (status) {
    case "Unscratched":
      return "Ready To Reveal";
    case "Scratched":
      return "Revealed";
    case "Claimed":
      return "Claimed";
    default:
      return status;
  }
};

const ticketStatusClassName = (status: string) => {
  switch (status) {
    case "Unscratched":
      return "border-[#5E4E92] bg-[#2D2546] text-[#CABEFF]";
    case "Scratched":
      return "border-[#0F5B3A] bg-[#0A3322] text-[#8AF4C5]";
    case "Claimed":
      return "border-[#8D6C1D] bg-[#493916] text-[#FFD66D]";
    default:
      return "border-[#3B455B] bg-[#232A3B] text-[#DCE2F9]";
  }
};

export const ScratchPage: React.FC<ScratchPageProps> = ({ poolId }) => {
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { writeContractAsync, isMining: isBatchScratchMining } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
  });
  const ticketIds = useMemo(() => {
    const raw = searchParams.get("tickets") || "";
    return [
      ...new Set(
        raw
          .split(",")
          .map(value => value.trim())
          .filter(Boolean),
      ),
    ];
  }, [searchParams]);
  const poolQuery = useLuckyScratchPool(poolId);
  const ticketQueries = useQueries({
    queries: ticketIds.map(ticketId => ({
      queryKey: ["lucky-scratch", "tickets", ticketId],
      queryFn: () => luckyScratchAPI.getTicket(ticketId),
      staleTime: 10_000,
      enabled: Boolean(ticketId),
    })),
  });
  const ticketItems = ticketQueries
    .map(query => query.data)
    .filter((ticket): ticket is LuckyScratchTicket => Boolean(ticket));
  const scratchableTicketIds = ticketItems
    .filter(
      ticket =>
        ticket.status === "Unscratched" && Boolean(address && ticket.owner.toLowerCase() === address.toLowerCase()),
    )
    .map(ticket => String(ticket.ticketId));
  const batchScratchMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Connect your wallet before scratching tickets.");
      }
      if (scratchableTicketIds.length === 0) {
        throw new Error("No owned unscratched tickets are ready for batch scratch.");
      }

      return writeContractAsync({
        functionName: "batchScratch",
        args: [scratchableTicketIds.map(ticketId => BigInt(ticketId))],
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", poolId] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "tickets"] }),
        ...scratchableTicketIds.map(ticketId =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", ticketId] }),
        ),
      ]);
      notification.success("Batch scratch transaction submitted.");
    },
    onError: error => {
      notification.error(error instanceof Error ? error.message : "Batch scratch failed.");
    },
  });

  if (ticketIds.length === 1) {
    return <TicketRevealWorkspace ticketId={ticketIds[0]} />;
  }

  const pool = poolQuery.data;
  const isLoadingTickets = ticketQueries.some(query => query.isLoading);
  const hasTicketError = ticketQueries.find(query => query.isError);
  const isBatchScratchPending = batchScratchMutation.isPending || isBatchScratchMining;

  return (
    <div className="min-h-screen bg-[#0C1323] font-body text-[#DCE2F9]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-24 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#11192B] shadow-[0_32px_80px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,#cabeff22_0%,#11192B_40%,#0C1323_100%)] p-8">
            <Link
              href={`/purchase/${poolId}`}
              className="inline-flex items-center gap-2 text-sm text-[#D0C6AB] transition-colors hover:text-[#FFD66D]"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to purchase
            </Link>
            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D0C6AB]">Scratch Queue</p>
                <h1 className="mt-2 font-headline text-4xl font-black tracking-tight text-white">
                  {pool?.metadata?.name || `Pool #${poolId}`}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9FB0D0]">
                  The purchase flow is now live. Batch scratch no longer fabricates reveal results here. Open each
                  ticket to run the real backend `reveal-auth` and decrypt flow.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
                <div className="rounded-2xl border border-white/8 bg-[#0B1120] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Ticket Price</p>
                  <p className="mt-2 font-headline text-2xl font-bold text-[#FFD66D]">
                    {formatUsdcFromMicro(pool?.ticketPrice)} USDC
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-[#0B1120] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Hit Rate</p>
                  <p className="mt-2 font-headline text-2xl font-bold text-[#9CF0FF]">
                    {formatPercentFromBps(pool?.hitRateBps)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/my-tickets"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#FFD66D]/40 hover:text-[#FFD66D]"
              >
                <TicketIcon className="h-5 w-5" />
                Open inventory
              </Link>
              <Link
                href={`/purchase/${poolId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-4 py-3 text-sm font-bold text-[#705E00]"
              >
                <SparklesIcon className="h-5 w-5" />
                Buy more tickets
              </Link>
              {ticketItems.length > 0 ? (
                <button
                  type="button"
                  disabled={scratchableTicketIds.length === 0 || isBatchScratchPending}
                  onClick={() => batchScratchMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#FFD66D]/35 bg-[#2A2312] px-4 py-3 text-sm font-bold text-[#FFD66D] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SparklesIcon className="h-5 w-5" />
                  {isBatchScratchPending ? "Scratching..." : `Scratch Ready Tickets (${scratchableTicketIds.length})`}
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-8">
            {ticketIds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#0B1120] p-10 text-center">
                <p className="font-headline text-2xl font-bold text-white">No ticket ids were provided</p>
                <p className="mt-2 text-sm text-[#9FB0D0]">
                  Return to the purchase flow or open your wallet inventory to select a ticket.
                </p>
              </div>
            ) : null}

            {ticketIds.length > 0 && isLoadingTickets ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ticketIds.map(ticketId => (
                  <div key={ticketId} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-[#0B1120]" />
                ))}
              </div>
            ) : null}

            {ticketIds.length > 0 && hasTicketError ? (
              <div className="rounded-2xl border border-[#8E4A74] bg-[#2A1521] p-5 text-sm text-[#FFB4AB]">
                {hasTicketError.error instanceof Error
                  ? hasTicketError.error.message
                  : "Failed to load ticket details."}
              </div>
            ) : null}

            {ticketItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ticketItems.map(ticket => (
                  <article
                    key={ticket.ticketId}
                    className="rounded-2xl border border-white/10 bg-[#0B1120] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#D0C6AB]">Ticket</p>
                        <h2 className="mt-2 font-headline text-3xl font-bold text-white">#{ticket.ticketId}</h2>
                        <p className="mt-2 text-sm text-[#9FB0D0]">
                          Pool #{ticket.poolId} • Round {ticket.roundId} • Index {ticket.ticketIndex + 1}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${ticketStatusClassName(ticket.status)}`}
                      >
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-white/8 bg-[#11192B] p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Owner</p>
                        <p className="mt-2 truncate font-semibold text-[#DCE2F9]">{ticket.owner}</p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-[#11192B] p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Claimed Reward</p>
                        <p className="mt-2 font-semibold text-[#FFD66D]">
                          {formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/tickets/${ticket.ticketId}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-4 py-3 text-sm font-bold text-[#705E00]"
                      >
                        Open reveal flow
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/tickets/${ticket.ticketId}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#FFD66D]/40 hover:text-[#FFD66D]"
                      >
                        View ticket workspace
                        <TicketIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};
