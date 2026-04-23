"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  ArrowRightIcon,
  CommandLineIcon,
  CpuChipIcon,
  TicketIcon,
  TrophyIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import {
  useLuckyScratchCreatorSummary,
  useLuckyScratchUserTickets,
  useLuckyScratchUserWins,
} from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";

type ActivityItem = {
  timestamp: string;
  operation: string;
  details: string;
  status: string;
};

const formatTimestamp = (value?: string) => {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
};

const formatClaimRate = (claimedWins: number, totalTickets: number) => {
  if (totalTickets <= 0) {
    return "0.0";
  }
  return ((claimedWins / totalTickets) * 100).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

export function OverviewPanel() {
  const { address } = useAccount();
  const ticketsQuery = useLuckyScratchUserTickets(address);
  const winsQuery = useLuckyScratchUserWins(address);
  const creatorSummaryQuery = useLuckyScratchCreatorSummary(address);
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const paymentBalanceQuery = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && paymentTokenContract?.address),
    },
  });

  const tickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data?.items]);
  const claimedWins = useMemo(() => winsQuery.data?.items ?? [], [winsQuery.data?.items]);
  const creatorSummary = creatorSummaryQuery.data;
  const balanceMicro = paymentBalanceQuery.data;

  const ticketCount = tickets.length;
  const revealedCount = tickets.filter(ticket => ticket.status !== "Unscratched").length;
  const claimedWinCount = claimedWins.length;
  const totalWinningsMicro = claimedWins.reduce((sum, ticket) => sum + ticket.claimClearRewardAmount, 0);
  const bestClaimedRewardMicro = claimedWins.reduce(
    (maxReward, ticket) => Math.max(maxReward, ticket.claimClearRewardAmount),
    0,
  );
  const claimRate = formatClaimRate(claimedWinCount, ticketCount);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const ticketEvents = tickets.map(ticket => ({
      timestamp: ticket.createdAt,
      operation: "TICKET_PURCHASED",
      details: `Ticket #${ticket.ticketId} • Pool #${ticket.poolId} • Round ${ticket.roundId}`,
      status: ticket.status.toUpperCase(),
    }));
    const claimEvents = claimedWins.map(ticket => ({
      timestamp: ticket.updatedAt,
      operation: "REWARD_CLAIMED",
      details: `+${formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC • Ticket #${ticket.ticketId}`,
      status: "CLAIMED",
    }));

    return [...claimEvents, ...ticketEvents]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 10);
  }, [claimedWins, tickets]);

  if (!address) {
    return (
      <div className="rounded-2xl border border-dashed border-ns-outline-variant/20 bg-ns-surface-container-lowest p-10 text-center">
        <p className="font-headline text-2xl font-bold text-ns-on-surface">Connect your wallet</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-ns-on-surface-variant">
          The overview now reads cUSDC balance, indexed tickets, claimed wins, and creator summary from the live backend
          or contract sources.
        </p>
        <Link
          href="/store"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ns-primary-container px-5 py-3 font-bold text-ns-on-primary"
        >
          Browse Pools
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-panel rounded-xl border-t-2 border-ns-primary-container/20 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high p-8">
          <div className="mb-4 flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-ns-on-surface-variant">
              Available Credits
            </span>
            <WalletIcon className="h-6 w-6 text-ns-primary" />
          </div>
          <div className="mb-2 flex items-baseline gap-3">
            <h3 className="font-headline text-4xl font-black tracking-tighter text-ns-on-surface">
              {paymentBalanceQuery.isLoading ? "--" : formatUsdcFromMicro(balanceMicro)}
            </h3>
            <span className="text-sm font-bold text-ns-primary-container">USDC</span>
          </div>
          <p className="mb-6 text-xs text-ns-on-surface-variant">
            {paymentTokenContract?.address
              ? "Direct contract balance from the current network."
              : "cUSDC metadata is not available on the current network."}
          </p>
          <Link
            href="/store"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ns-primary-container py-3 text-sm font-bold text-ns-on-primary transition-all hover:brightness-110 active:scale-95"
          >
            BUY TICKETS
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-xl bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high p-8">
          <div className="mb-4 flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-ns-on-surface-variant">
              Total Winnings
            </span>
            <TrophyIcon className="h-6 w-6 text-ns-secondary" />
          </div>
          <div className="mb-6 flex items-baseline gap-3">
            <h3 className="font-headline text-4xl font-black tracking-tighter text-ns-on-surface">
              {winsQuery.isLoading ? "--" : formatUsdcFromMicro(totalWinningsMicro)}
            </h3>
            <span className="text-sm font-bold text-ns-secondary">USDC</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-ns-on-surface-variant">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ns-surface-container-lowest">
              <div
                className="h-full rounded-full bg-ns-secondary"
                style={{ width: `${Math.min(100, Number(claimRate))}%` }}
              />
            </div>
            <span className="font-bold text-ns-secondary">{claimRate}% claimed</span>
          </div>
          <p className="mt-3 text-xs text-ns-on-surface-variant">
            Based on indexed claimed wins only. Unclaimed scratched winners are not inferred here.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-ns-outline-variant/30" />
          <h4 className="font-headline text-xs font-bold uppercase tracking-widest text-ns-on-surface-variant">
            Performance Matrix
          </h4>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-ns-outline-variant/30" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-ns-outline-variant/10 p-5 transition-colors hover:bg-ns-surface-container-highest">
            <div className="mb-2 text-[10px] font-semibold uppercase text-ns-on-surface-variant">Purchased</div>
            <div className="font-headline text-2xl font-bold">
              {ticketsQuery.isLoading ? "--" : ticketCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">TIX</span>
            </div>
          </div>
          <div className="rounded-xl border border-ns-outline-variant/10 p-5 transition-colors hover:bg-ns-surface-container-highest">
            <div className="mb-2 text-[10px] font-semibold uppercase text-ns-primary">Revealed</div>
            <div className="font-headline text-2xl font-bold text-ns-primary">
              {ticketsQuery.isLoading ? "--" : revealedCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">TIX</span>
            </div>
          </div>
          <div className="rounded-xl border border-ns-outline-variant/10 p-5 transition-colors hover:bg-ns-surface-container-highest">
            <div className="mb-2 text-[10px] font-semibold uppercase text-ns-tertiary">Claimed Wins</div>
            <div className="font-headline text-2xl font-bold text-ns-tertiary">
              {winsQuery.isLoading ? "--" : claimedWinCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">CLAIMS</span>
            </div>
          </div>
          <div className="rounded-xl border border-ns-outline-variant/10 p-5 transition-colors hover:bg-ns-surface-container-highest">
            <div className="mb-2 text-[10px] font-semibold uppercase text-ns-primary-container">Best Claimed</div>
            <div className="font-headline text-2xl font-bold text-ns-primary-container">
              {winsQuery.isLoading ? "--" : formatUsdcFromMicro(bestClaimedRewardMicro)}{" "}
              <span className="text-xs text-ns-on-surface-variant">USDC</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold text-ns-primary-container/80">Highest settled reward</div>
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="glass-panel overflow-hidden rounded-xl border border-ns-tertiary/20 p-8">
          <div className="absolute right-0 top-0 p-4">
            <CommandLineIcon className="h-24 w-24 text-ns-tertiary opacity-10" />
          </div>
          <div className="relative z-10">
            <div className="mb-6 flex items-center gap-3">
              <CpuChipIcon className="h-6 w-6 text-ns-tertiary" />
              <h4 className="font-headline text-lg font-bold">CREATOR_TERMINAL_V1.2</h4>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant">Active Pools</div>
                <div className="font-headline text-3xl font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.activePools ?? 0)}
                </div>
                <div className="text-[10px] font-mono text-ns-tertiary">
                  STATUS: {(creatorSummary?.activePools ?? 0) > 0 ? "ONLINE" : "IDLE"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant">Sales Amount</div>
                <div className="font-headline text-3xl font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalRealizedRevenue)}{" "}
                  <span className="text-sm">USDC</span>
                </div>
                <div className="text-[10px] font-mono text-ns-tertiary">INDEXED_REVENUE: LIVE</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant">Tickets Sold</div>
                <div className="font-headline text-3xl font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.currentRoundSoldCount ?? 0)}/
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.currentRoundTotalTickets ?? 0)}
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-ns-surface-container-lowest">
                  <div
                    className="h-full rounded-full bg-ns-tertiary"
                    style={{
                      width: `${
                        creatorSummary && creatorSummary.currentRoundTotalTickets > 0
                          ? (creatorSummary.currentRoundSoldCount / creatorSummary.currentRoundTotalTickets) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant">Claimable Profit</div>
                <div className="font-headline text-3xl font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalClaimableProfit)}{" "}
                  <span className="text-sm">USDC</span>
                </div>
                <div className="text-[10px] font-mono text-ns-tertiary">
                  LOCKED_BOND:{" "}
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalLockedBond)}U
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end border-t border-ns-outline-variant/10 pt-6">
              <Link
                href="/create-pool"
                className="flex items-center gap-2 text-xs font-bold text-ns-tertiary transition hover:underline"
              >
                LAUNCH POOL CREATOR
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-headline text-sm font-bold uppercase tracking-widest">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ns-primary-container" />
            Live Activity Logs
          </h4>
          <span className="text-[10px] font-mono text-ns-on-surface-variant">SOURCE: TICKETS + WINS</span>
        </div>
        <div className="h-64 overflow-y-auto rounded-xl border border-ns-outline-variant/10 bg-ns-surface-container-lowest font-mono text-xs">
          {ticketsQuery.isLoading || winsQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-ns-on-surface-variant">
              Loading activity...
            </div>
          ) : activityItems.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 border-b border-ns-outline-variant/20 bg-ns-surface-container-lowest">
                <tr>
                  <th className="p-3 font-medium text-ns-on-surface-variant">TIMESTAMP</th>
                  <th className="p-3 font-medium text-ns-on-surface-variant">OPERATION</th>
                  <th className="p-3 font-medium text-ns-on-surface-variant">DETAILS</th>
                  <th className="p-3 text-right font-medium text-ns-on-surface-variant">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ns-outline-variant/5">
                {activityItems.map(item => (
                  <tr
                    key={`${item.operation}-${item.timestamp}-${item.details}`}
                    className="transition-colors hover:bg-ns-surface-container/50"
                  >
                    <td className="p-3 text-ns-on-surface-variant">{formatTimestamp(item.timestamp)}</td>
                    <td className="p-3 font-semibold text-ns-primary">{item.operation}</td>
                    <td className="p-3">{item.details}</td>
                    <td className="p-3 text-right text-ns-tertiary">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <TicketIcon className="mb-4 h-12 w-12 text-ns-on-surface-variant/30" />
              <p className="font-headline text-lg font-bold text-ns-on-surface">No indexed activity yet</p>
              <p className="mt-2 max-w-lg text-sm text-ns-on-surface-variant">
                Purchase or claim a ticket first. Once the backend indexes those events, this table will fill with live
                inventory and reward activity.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
