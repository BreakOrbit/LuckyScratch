"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  BanknotesIcon,
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  KeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLuckyScratchCreatorSummary, useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchPool } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

type SummaryCardConfig = {
  label: string;
  value: string;
  valueSuffix?: string;
  accent?: string;
  accentClassName?: string;
  borderClassName: string;
};

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
  return { soldCount, totalTickets, percent };
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
      return "Withdraw";
    case "refund-bond":
      return "Refund Bond";
    case "close-pool":
      return "Close";
    case "roll-round":
      return "Roll Round";
  }
};

const sortOptions = ["Latest", "Popular", "Win Rate", "Price"] as const;

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
      <div className="space-y-8 bg-[#0C1323] text-[#DCE2F9]">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-[#DCE2F9]">MY POOLS</h1>
          <p className="mt-1 text-sm text-[#D0C6AB]">
            Connect your wallet to manage your creator pools and track performance.
          </p>
        </div>
        <Link
          href="/create-pool"
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_50%,#ffe16d_100%)] px-6 py-3 font-headline font-bold text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-transform active:scale-95"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Create New Pool
        </Link>
      </div>
    );
  }

  const summaryCards: SummaryCardConfig[] = [
    {
      label: "Total Pools",
      value: summaryLoading ? "--" : String(summary?.totalPools ?? 0),
      accent: summaryLoading ? undefined : `${summary?.activePools ?? 0} active`,
      accentClassName: "text-[#00DAF3]",
      borderClassName: "border-[#FFD700]/30",
    },
    {
      label: "Total Revenue",
      value: summaryLoading ? "--" : formatUsdcFromMicro(summary?.totalRealizedRevenue),
      valueSuffix: "USDC",
      borderClassName: "border-[#CABEFF]/30",
    },
    {
      label: "Tickets Sold",
      value: summaryLoading ? "--" : `${summary?.currentRoundSoldCount ?? 0}/${summary?.currentRoundTotalTickets ?? 0}`,
      borderClassName: "border-[#00DAF3]/30",
    },
    {
      label: "Claimable Profit",
      value: summaryLoading ? "--" : formatUsdcFromMicro(summary?.totalClaimableProfit),
      valueSuffix: "USDC",
      accent: summaryLoading ? undefined : `${formatUsdcFromMicro(summary?.totalLockedBond)}U locked`,
      accentClassName: "text-[#FFB4AB]",
      borderClassName: "border-[#FFB4AB]/30",
    },
  ];

  return (
    <div className="space-y-8 bg-[#0C1323] text-[#DCE2F9]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-[#DCE2F9]">MY POOLS</h1>
          <p className="mt-1 text-sm text-[#D0C6AB]">Manage and track your issued liquidity pools</p>
        </div>
        <Link
          href="/create-pool"
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_50%,#ffe16d_100%)] px-6 py-3 font-headline font-bold text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-transform active:scale-95"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Create New Pool
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-xl border-l-2 ${card.borderClassName} bg-[#141B2C] p-6`}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#D0C6AB]">{card.label}</p>
            <div className="flex items-end gap-2">
              <p className="font-headline text-3xl font-bold text-[#DCE2F9]">
                {card.value}
                {card.valueSuffix ? (
                  <span className="ml-1 text-sm font-normal text-[#D0C6AB]">{card.valueSuffix}</span>
                ) : null}
              </p>
              {card.accent ? <span className={`mb-1 text-xs ${card.accentClassName}`}>{card.accent}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col items-center gap-4 md:flex-row">
        <div className="relative w-full flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D0C6AB]" />
          <input
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="w-full rounded-xl border border-[#4D4732]/20 bg-[#070E1D] py-3 pl-12 pr-4 text-[#DCE2F9] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none transition-all placeholder:text-[#D0C6AB]/50 focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/50"
            placeholder="Search by pool name, ID, or asset..."
          />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#4D4732]/10 bg-[#232A3B] px-4 py-2 shadow-[0_0_15px_rgba(255,215,0,0.15)]">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-[#D0C6AB]">Sort By</span>
          <div className="flex flex-wrap gap-1">
            {sortOptions.map(option => {
              const active = option === "Latest";
              return (
                <button
                  key={option}
                  type="button"
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "border border-[#FFD700]/50 bg-[#1A2133] text-[#FFE16D] shadow-inner"
                      : "text-[#D0C6AB] hover:bg-[#2E3546]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {isError ? (
        <div className="rounded-2xl border border-[#8E4A74] bg-[#2A1521] p-5 text-sm text-[#FFB4AB]">
          {error.message}
        </div>
      ) : null}

      {/* Loading */}
      {poolsLoading ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(index => (
            <div key={index} className="h-[420px] animate-pulse rounded-xl border border-[#4D4732]/10 bg-[#232A3B]" />
          ))}
        </div>
      ) : null}

      {/* Empty */}
      {!poolsLoading && pools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#4D4732]/20 bg-[#141B2C] p-10 text-center">
          <p className="font-headline text-2xl font-bold text-[#DCE2F9]">No creator pools found</p>
          <p className="mt-2 text-sm text-[#D0C6AB]">
            Create a pool to start tracking sales, revenue, and bond status here.
          </p>
        </div>
      ) : null}

      {/* Pool Cards */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {pools.map(pool => {
          const progress = roundProgress(pool);
          const actionPending = poolActionMutation.isPending || isMining;
          const canWithdrawProfit = pool.claimableCreatorProfit > 0;
          const canRefundBond = pool.status === "Closed" && pool.lockedBond > 0;
          const canClosePool = pool.status !== "Closed" && !pool.closeRequested;
          const canRollRound =
            pool.mode === "Loop" && pool.currentRoundState?.status === "Settled" && !pool.closeRequested;
          const BondIcon = canRefundBond ? KeyIcon : LockClosedIcon;
          const bondLabel = canRefundBond ? "REFUNDABLE" : "LOCKED";
          const bondColor = canRefundBond ? "text-[#00DAF3]" : "text-[#FFB4AB]";

          return (
            <article
              key={pool.poolId}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#4D4732]/10 bg-[#232A3B] shadow-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.08)]"
            >
              {/* Cover */}
              <div className="relative h-48 overflow-hidden">
                {pool.metadata?.coverImageUrl ? (
                  <img
                    src={pool.metadata.coverImageUrl}
                    alt={poolTitle(pool)}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,#cabeff_0%,#1f2940_45%,#0c1323_100%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#232A3B] via-transparent to-transparent" />
                <div className="absolute left-4 top-4 flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tighter backdrop-blur-md ${statusClassName(pool.status)}`}
                  >
                    {pool.status.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-[#4719C9]/90 px-3 py-1 text-[10px] font-bold uppercase tracking-tighter backdrop-blur-md text-[#B8AAFF]">
                    {modeLabel(pool.mode)}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <h3 className="mb-1 font-headline text-xl font-bold uppercase tracking-tight text-[#FFE16D]">
                  {poolTitle(pool)}
                </h3>
                <p className="mb-4 text-xs text-[#D0C6AB]">{poolSubtitle(pool)}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs font-bold">
                    <span className="text-[#DCE2F9]">SALES PROGRESS</span>
                    <span className="text-[#00DAF3]">
                      {progress.soldCount} / {progress.totalTickets}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070E1D]">
                    <div
                      className="h-full bg-[#00DAF3] shadow-[0_0_8px_rgba(0,218,243,0.5)]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Revenue</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.realizedRevenue)} USDC
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Platform Fee</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.accruedPlatformFee)} USDC
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Paid Prizes</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(pool.settledPrizeCost)} USDC
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#00DAF3]">Claimable</p>
                    <p className="font-headline text-sm font-bold text-[#FFE16D]">
                      {formatUsdcFromMicro(pool.claimableCreatorProfit)} USDC
                    </p>
                  </div>
                </div>

                {/* Bond Status */}
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#4D4732]/10 bg-[#070E1D]/50 px-3 py-2">
                  <BondIcon className={`h-4 w-4 ${bondColor}`} />
                  <span className="text-[10px] font-bold text-[#D0C6AB]">
                    BOND STATUS: <span className={bondColor}>{bondLabel}</span>
                  </span>
                  <span className="ml-auto text-[10px] font-bold text-[#D0C6AB]">
                    {formatUsdcFromMicro(pool.lockedBond)} USDC
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto grid grid-cols-3 gap-2 px-4 pb-6">
                <button
                  type="button"
                  disabled={!canWithdrawProfit || actionPending}
                  onClick={() => poolActionMutation.mutate({ pool, action: "withdraw-profit" })}
                  className="rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 bg-[#FFD700] text-[#705E00] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  disabled={!canClosePool || actionPending}
                  onClick={() => poolActionMutation.mutate({ pool, action: "close-pool" })}
                  className="rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
                <Link
                  href={`/pool-detail/${pool.poolId}`}
                  className="flex items-center justify-center rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20"
                >
                  Details
                </Link>
                {canRollRound ? (
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "roll-round" })}
                    className="col-span-3 rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 bg-[#2E3546] text-[#B8AAFF] border border-[#4719C9]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Roll Round
                  </button>
                ) : null}
                {canRefundBond ? (
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => poolActionMutation.mutate({ pool, action: "refund-bond" })}
                    className="col-span-3 rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 bg-[#2E3546] text-[#00DAF3] border border-[#00DAF3]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refund Bond
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination (decorative) */}
      {pools.length > 0 ? (
        <div className="mt-12 flex items-center justify-center gap-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#4D4732]/20 bg-[#232A3B] text-[#D0C6AB] transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-10 w-10 rounded-full bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_50%,#ffe16d_100%)] font-headline font-bold text-[#705E00]"
            >
              1
            </button>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#4D4732]/20 bg-[#232A3B] text-[#D0C6AB] transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      {/* Profit Breakdown Modal */}
      {selectedPool ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020611]/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#FFD700]/20 bg-[#10192B] shadow-[0_0_40px_rgba(255,215,0,0.08)]">
            <button
              type="button"
              onClick={() => setSelectedPool(null)}
              className="absolute right-4 top-4 rounded-full border border-[#4D4732]/20 bg-[#181F30] p-2 text-[#D0C6AB] transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="border-b border-[#4D4732]/10 px-6 py-5 md:px-8">
              <div className="mb-2 flex items-center gap-2 text-[#FFD700]">
                <BanknotesIcon className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Withdraw Profit</span>
              </div>
              <h2 className="font-headline text-2xl font-bold text-[#FFE16D]">{poolTitle(selectedPool)}</h2>
              <p className="mt-1 text-sm text-[#D0C6AB]">Profit withdrawal breakdown</p>
            </div>

            <div className="space-y-6 px-6 py-6 md:px-8">
              <div className="rounded-xl border border-[#FFD700]/10 bg-[#181F30] p-4">
                <div className="mb-3 flex items-center gap-2 text-[#9CF0FF]">
                  <CalculatorIcon className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">收益计算公式</span>
                </div>
                <p className="font-headline text-lg font-bold text-[#DCE2F9]">
                  盈亏合计 = 持仓币值 + 累计入账金额 - 累计出账金额 - 费用合计
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#D0C6AB]">
                  Current treasury balance + cumulative ticket inflow - cumulative pool outflow - total protocol fees
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  {
                    label: "持仓币值",
                    value: formatUsdcFromMicro(
                      selectedPool.realizedRevenue -
                        selectedPool.settledPrizeCost -
                        selectedPool.settledProtocolCost -
                        selectedPool.accruedPlatformFee -
                        selectedPool.creatorProfitClaimed,
                    ),
                    sublabel: "当前奖池/库存内尚未转出的余额价值",
                  },
                  {
                    label: "累计入账金额",
                    value: formatUsdcFromMicro(selectedPool.realizedRevenue),
                    sublabel: "售票与入池累计流入金额",
                  },
                  {
                    label: "累计出账金额",
                    value: formatUsdcFromMicro(selectedPool.settledPrizeCost + selectedPool.settledProtocolCost),
                    sublabel: "奖池派奖、结算转出等累计支出",
                  },
                  {
                    label: "费用合计",
                    value: formatUsdcFromMicro(selectedPool.accruedPlatformFee),
                    sublabel: "平台费、协议服务费等累计费用",
                  },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-[#4D4732]/10 bg-[#141B2C] p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#D0C6AB]">{item.label}</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#DCE2F9]">{item.value} USDC</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#D0C6AB]/70">{item.sublabel}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#FFD700]/20 bg-[linear-gradient(135deg,rgba(255,215,0,0.12)_0%,rgba(255,215,0,0.04)_100%)] p-5">
                <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                  <CurrencyDollarIcon className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">当前可提取收益</span>
                </div>
                <p className="font-headline text-3xl font-black text-[#FFE16D]">
                  {formatUsdcFromMicro(selectedPool.claimableCreatorProfit)} USDC
                </p>
              </div>

              <div className="rounded-xl border border-[#4D4732]/10 bg-[#0C1323] p-4">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#9CF0FF]" />
                  <p className="text-sm leading-relaxed text-[#D0C6AB]">
                    本弹窗展示的是当前可提取收益的计算明细。各项值是按当前奖池持仓、累计入账、累计出账与累计费用汇总后计算得到；
                    最终收益按上述公式直接相加减得出。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
