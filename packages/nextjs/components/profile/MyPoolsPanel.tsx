"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { BanknotesIcon, MagnifyingGlassIcon, PlusCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";
import { useLuckyScratchCreatorSummary, useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatPercentFromBps, formatUsdcFromMicro, fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchPool } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

const summaryCardClassName =
  "rounded-2xl border border-white/10 bg-[#141B2C] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]";

const statusClassName = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-[#0A3322] text-[#8AF4C5] border border-[#0F5B3A]";
    case "Initializing":
      return "bg-[#2D2546] text-[#CABEFF] border border-[#5E4E92]";
    case "SoldOut":
      return "bg-[#493916] text-[#FFD66D] border border-[#8D6C1D]";
    case "Closing":
      return "bg-[#3A2234] text-[#FFB4AB] border border-[#8E4A74]";
    case "Closed":
      return "bg-[#232A3B] text-[#D0C6AB] border border-[#3B455B]";
    default:
      return "bg-[#232A3B] text-[#DCE2F9] border border-[#3B455B]";
  }
};

const modeLabel = (mode: string) => (mode === "Loop" ? "LOOP" : "ONE-TIME");

const roundProgress = (pool: LuckyScratchPool) => {
  const soldCount = pool.currentRoundState?.soldCount ?? 0;
  const totalTickets = pool.currentRoundState?.totalTickets ?? pool.totalTicketsPerRound ?? 0;
  const percent = totalTickets > 0 ? Math.min(100, (soldCount / totalTickets) * 100) : 0;
  return {
    soldCount,
    totalTickets,
    percent,
  };
};

const poolTitle = (pool: LuckyScratchPool) => pool.metadata?.name || `Pool #${pool.poolId}`;

const poolSubtitle = (pool: LuckyScratchPool) => {
  const status = pool.currentRoundState?.status || pool.status;
  return `Pool #${pool.poolId} • Round ${pool.currentRound || 1} • ${status}`;
};

type PoolAction = "withdraw-profit" | "refund-bond" | "close-pool" | "roll-round";

const poolActionLabel = (action: PoolAction) => {
  switch (action) {
    case "withdraw-profit":
      return "Withdraw Profit";
    case "refund-bond":
      return "Refund Bond";
    case "close-pool":
      return "Close Pool";
    case "roll-round":
      return "Roll Round";
  }
};

type SummaryCardProps = {
  label: string;
  value: string;
  caption: string;
};

const SummaryCard = ({ label, value, caption }: SummaryCardProps) => (
  <div className={summaryCardClassName}>
    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#D0C6AB]">{label}</p>
    <p className="mt-3 font-headline text-3xl font-bold text-[#DCE2F9]">{value}</p>
    <p className="mt-2 text-sm text-[#9FB0D0]">{caption}</p>
  </div>
);

export function MyPoolsPanel() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "LuckyScratchCore" });
  const [query, setQuery] = useState("");
  const [selectedPool, setSelectedPool] = useState<LuckyScratchPool | null>(null);

  const { data: summary, isLoading: summaryLoading } = useLuckyScratchCreatorSummary(address);
  const { data: poolsResponse, isLoading: poolsLoading, isError, error } = useLuckyScratchPools(address);
  const poolActionMutation = useMutation({
    mutationFn: async ({ pool, action }: { pool: LuckyScratchPool; action: PoolAction }) => {
      if (!address) {
        throw new Error("Connect your wallet before managing creator pools.");
      }

      if (action === "withdraw-profit") {
        if (pool.claimableCreatorProfit <= 0) {
          throw new Error("This pool has no claimable creator profit.");
        }
        return writeContractAsync({
          functionName: "withdrawCreatorProfit",
          args: [BigInt(pool.poolId), BigInt(pool.claimableCreatorProfit)],
        });
      }

      if (action === "refund-bond") {
        if (pool.status !== "Closed" || pool.lockedBond <= 0) {
          throw new Error("Bond refund is only available after the pool is closed.");
        }
        return writeContractAsync({
          functionName: "refundBond",
          args: [BigInt(pool.poolId)],
        });
      }

      if (action === "close-pool") {
        if (pool.status === "Closed" || pool.closeRequested) {
          throw new Error("This pool is already closed or closing.");
        }
        return writeContractAsync({
          functionName: "closePool",
          args: [BigInt(pool.poolId)],
        });
      }

      if (pool.mode !== "Loop" || pool.currentRoundState?.status !== "Settled" || pool.closeRequested) {
        throw new Error("This loop pool is not ready to roll.");
      }
      return writeContractAsync({
        functionName: "rollToNextRound",
        args: [BigInt(pool.poolId)],
      });
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", address?.toLowerCase() || "all"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", String(variables.pool.poolId)] }),
        queryClient.invalidateQueries({
          queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "created-pools", "summary"],
        }),
      ]);
      setSelectedPool(null);
      notification.success(`${poolActionLabel(variables.action)} transaction submitted.`);
    },
    onError: error => {
      notification.error(error instanceof Error ? error.message : "Pool action failed.");
    },
  });

  const pools =
    poolsResponse?.items.filter(pool => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return true;
      }
      return (
        poolTitle(pool).toLowerCase().includes(normalized) ||
        String(pool.poolId).includes(normalized) ||
        pool.creator.toLowerCase().includes(normalized)
      );
    }) ?? [];

  if (!address) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#11192B] p-8 text-[#DCE2F9] shadow-[0_32px_80px_rgba(0,0,0,0.28)]">
        <h1 className="font-headline text-4xl font-bold tracking-tight">MY POOLS</h1>
        <p className="mt-3 max-w-xl text-sm text-[#9FB0D0]">
          Connect your wallet to read creator-side pool metrics from the backend read model and jump into pool creation.
        </p>
        <Link
          href="/create-pool"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-5 py-3 font-headline font-bold text-[#705E00]"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Create New Pool
        </Link>
      </div>
    );
  }

  const currentSold = summaryLoading ? "--" : `${summary?.currentRoundSoldCount ?? 0}`;
  const currentTotal = summaryLoading ? "--" : `${summary?.currentRoundTotalTickets ?? 0}`;

  return (
    <div className="space-y-8 bg-[#0C1323] text-[#DCE2F9]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-[#DCE2F9]">MY POOLS</h1>
          <p className="mt-1 text-sm text-[#D0C6AB]">
            Creator-side pool performance now only uses fields the backend can truly source.
          </p>
        </div>
        <Link
          href="/create-pool"
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-6 py-3 font-headline font-bold text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-transform active:scale-95"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Create New Pool
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Pools"
          value={summaryLoading ? "--" : String(summary?.totalPools ?? 0)}
          caption={summaryLoading ? "loading..." : `${summary?.activePools ?? 0} currently active`}
        />
        <SummaryCard
          label="Sales Amount"
          value={summaryLoading ? "--" : `${formatUsdcFromMicro(summary?.totalRealizedRevenue)} USDC`}
          caption="Realized revenue from indexed purchases"
        />
        <SummaryCard
          label="Sold / Total"
          value={`${currentSold} / ${currentTotal}`}
          caption="Current round capacity across your pools"
        />
        <SummaryCard
          label="Claimable Profit"
          value={summaryLoading ? "--" : `${formatUsdcFromMicro(summary?.totalClaimableProfit)} USDC`}
          caption={summaryLoading ? "loading..." : `${formatUsdcFromMicro(summary?.totalLockedBond)} USDC bond locked`}
        />
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8290AE]" />
        <input
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search by pool name, pool ID, or creator address"
          className="w-full rounded-2xl border border-white/10 bg-[#11192B] py-3 pl-12 pr-4 text-sm text-[#DCE2F9] outline-none transition focus:border-[#FFD700]/40"
        />
      </div>

      {isError ? (
        <div className="rounded-2xl border border-[#8E4A74] bg-[#2A1521] p-5 text-sm text-[#FFB4AB]">
          {error.message}
        </div>
      ) : null}

      {poolsLoading ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {[0, 1].map(index => (
            <div key={index} className="h-[320px] animate-pulse rounded-3xl border border-white/10 bg-[#11192B]" />
          ))}
        </div>
      ) : null}

      {!poolsLoading && pools.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-[#11192B] p-10 text-center">
          <p className="font-headline text-2xl font-bold text-[#DCE2F9]">No creator pools found</p>
          <p className="mt-2 text-sm text-[#9FB0D0]">
            Once you create a pool and the backend indexes it, the card grid will show real sales and accounting data
            here.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {pools.map(pool => {
          const progress = roundProgress(pool);
          const actionPending = poolActionMutation.isPending || isMining;
          const canWithdrawProfit = pool.claimableCreatorProfit > 0;
          const canRefundBond = pool.status === "Closed" && pool.lockedBond > 0;
          const canClosePool = pool.status !== "Closed" && !pool.closeRequested;
          const canRollRound =
            pool.mode === "Loop" && pool.currentRoundState?.status === "Settled" && !pool.closeRequested;
          return (
            <article
              key={pool.poolId}
              className="overflow-hidden rounded-3xl border border-white/10 bg-[#11192B] shadow-[0_28px_80px_rgba(0,0,0,0.24)]"
            >
              <div className={POOL_COVER_FRAME_CLASS}>
                {pool.metadata?.coverImageUrl ? (
                  <img src={pool.metadata.coverImageUrl} alt={poolTitle(pool)} className={POOL_COVER_IMAGE_CLASS} />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,#cabeff_0%,#1f2940_45%,#0c1323_100%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C1323] via-[#0C1323]/40 to-transparent" />
                <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.2em] ${statusClassName(pool.status)}`}
                  >
                    {pool.status.toUpperCase()}
                  </span>
                  <span className="rounded-full border border-[#4A587B] bg-[#10192D]/80 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-[#9FB0D0]">
                    {modeLabel(pool.mode)}
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="font-headline text-2xl font-bold text-white">{poolTitle(pool)}</p>
                  <p className="mt-1 text-sm text-[#D0C6AB]">{poolSubtitle(pool)}</p>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#9FB0D0]">
                    <span>Current Round Progress</span>
                    <span>
                      {progress.soldCount} / {progress.totalTickets}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#1B2741]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffd700_0%,#ffe16d_100%)]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#0B1120] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Sales Amount</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.realizedRevenue)} USDC
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#0B1120] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Platform Fee</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#9CF0FF]">
                      {formatUsdcFromMicro(pool.accruedPlatformFee)} USDC
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#0B1120] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Claimable Profit</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#FFD66D]">
                      {formatUsdcFromMicro(pool.claimableCreatorProfit)} USDC
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#0B1120] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#8290AE]">Locked Bond</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.lockedBond)} USDC
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-[#9FB0D0]">
                  <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-4">
                    <p>Ticket Price</p>
                    <p className="mt-1 font-headline text-lg font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.ticketPrice)} USDC
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-4">
                    <p>Target RTP / Hit Rate</p>
                    <p className="mt-1 font-headline text-lg font-bold text-[#DCE2F9]">
                      {formatPercentFromBps(pool.targetRtpBps)}% / {formatPercentFromBps(pool.hitRateBps)}%
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canWithdrawProfit || actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "withdraw-profit" })}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#FFD66D]/30 bg-[#2A2312] px-4 py-3 text-sm font-bold text-[#FFD66D] transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Withdraw Profit
                  </button>
                  <button
                    type="button"
                    disabled={!canRollRound || actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "roll-round" })}
                    className="inline-flex items-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:border-[#FFD700]/30 hover:text-[#FFD66D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Roll Round
                  </button>
                  <button
                    type="button"
                    disabled={!canClosePool || actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "close-pool" })}
                    className="inline-flex items-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:border-[#FFD700]/30 hover:text-[#FFD66D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Close Pool
                  </button>
                  <button
                    type="button"
                    disabled={!canRefundBond || actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "refund-bond" })}
                    className="inline-flex items-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:border-[#FFD700]/30 hover:text-[#FFD66D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refund Bond
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPool(pool)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1F2940] px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:bg-[#273553]"
                  >
                    <BanknotesIcon className="h-5 w-5 text-[#FFD66D]" />
                    Profit Breakdown
                  </button>
                  <Link
                    href={`/pool-detail/${pool.poolId}`}
                    className="inline-flex items-center rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:border-[#FFD700]/30 hover:text-[#FFD66D]"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedPool ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0E1628] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9FB0D0]">Creator Profit Breakdown</p>
                <h2 className="mt-2 font-headline text-3xl font-bold text-[#DCE2F9]">{poolTitle(selectedPool)}</h2>
                <p className="mt-2 text-sm text-[#9FB0D0]">
                  Claimable creator profit = realized revenue - prize liabilities - protocol costs - platform fee -
                  already claimed creator profit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPool(null)}
                className="rounded-full border border-white/10 p-2 text-[#9FB0D0] transition hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ["Realized revenue", selectedPool.realizedRevenue],
                ["Settled prize cost", selectedPool.settledPrizeCost],
                ["Settled protocol cost", selectedPool.settledProtocolCost],
                ["Accrued platform fee", selectedPool.accruedPlatformFee],
                ["Reserved prize budget", selectedPool.reservedPrizeBudget],
                ["Locked next round budget", selectedPool.lockedNextRoundBudget],
                ["Creator profit claimed", selectedPool.creatorProfitClaimed],
                ["Current claimable", selectedPool.claimableCreatorProfit],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-[#131D31] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8290AE]">{label}</p>
                  <p className="mt-2 font-headline text-2xl font-bold text-[#DCE2F9]">
                    {formatUsdcFromMicro(value as number)} USDC
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#4A587B] bg-[#11192B] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8290AE]">Treasury snapshot</p>
              <p className="mt-3 text-sm text-[#9FB0D0]">
                Current available treasury balance estimate:
                <span className="ml-2 font-bold text-[#DCE2F9]">
                  {(
                    fromMicroUsdc(selectedPool.realizedRevenue) -
                    fromMicroUsdc(selectedPool.settledPrizeCost) -
                    fromMicroUsdc(selectedPool.settledProtocolCost) -
                    fromMicroUsdc(selectedPool.accruedPlatformFee) -
                    fromMicroUsdc(selectedPool.creatorProfitClaimed)
                  ).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  USDC
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
