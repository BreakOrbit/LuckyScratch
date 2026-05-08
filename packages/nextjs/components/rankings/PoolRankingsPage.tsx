"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  BuildingLibraryIcon,
  FireIcon,
  SparklesIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";
import { useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import {
  formatCompactMicroUsdc,
  getPoolDisplayImage,
  getPoolDisplayName,
  getPoolShortCreator,
  getPoolTicketSales,
} from "~~/services/luckyScratch/display";
import { formatPercentFromBps } from "~~/services/luckyScratch/poolMath";

type PoolMetric = "winRate" | "salesVolume";
type PoolType = "Official" | "Community";

type RankedPool = {
  rank: number;
  poolId: number;
  name: string;
  identity: string;
  type: PoolType;
  metricWinRate: number;
  metricSales: number;
  metricSalesLabel: string;
  soldCount: number;
  accent: string;
  image: string;
};

const metricOptions: { key: PoolMetric; label: string }[] = [
  { key: "winRate", label: "Hit Rate" },
  { key: "salesVolume", label: "Sales Volume" },
];

const podiumHeights: Record<number, string> = {
  1: "h-24 w-40 md:w-64",
  2: "h-16 w-32 md:w-48",
  3: "h-12 w-32 md:w-48",
};

export function PoolRankingsPage() {
  const [metric, setMetric] = useState<PoolMetric>("winRate");
  const { data, isLoading } = useLuckyScratchPools();

  const leaderboard = useMemo<RankedPool[]>(() => {
    const pools = (data?.items ?? []).filter(pool => pool.status !== "Closed" && !pool.paused);
    const ranked = [...pools].sort((left, right) =>
      metric === "winRate"
        ? right.hitRateBps - left.hitRateBps || right.realizedRevenue - left.realizedRevenue
        : right.realizedRevenue - left.realizedRevenue || right.hitRateBps - left.hitRateBps,
    );

    return ranked.map((pool, index) => ({
      rank: index + 1,
      poolId: pool.poolId,
      name: getPoolDisplayName(pool),
      identity: `Pool #${pool.poolId} • ${getPoolShortCreator(pool.creator, 4, 4)}`,
      type: pool.protocolOwned ? "Official" : "Community",
      metricWinRate: pool.hitRateBps / 100,
      metricSales: pool.realizedRevenue,
      metricSalesLabel: formatCompactMicroUsdc(pool.realizedRevenue),
      soldCount: getPoolTicketSales(pool),
      accent: pool.protocolOwned ? "#FFD700" : "#7D5FFF",
      image: getPoolDisplayImage(pool),
    }));
  }, [data?.items, metric]);

  const podiumEntries = useMemo(
    () =>
      [
        { displayRank: 2, pool: leaderboard[1] },
        { displayRank: 1, pool: leaderboard[0] },
        { displayRank: 3, pool: leaderboard[2] },
      ].filter(entry => Boolean(entry.pool)),
    [leaderboard],
  );

  const topWindow = leaderboard.slice(0, 10);
  const officialCount = topWindow.filter(pool => pool.type === "Official").length;
  const communityCount = topWindow.length - officialCount;
  const champion = leaderboard[0];

  return (
    <div className="min-h-screen bg-[#0C1323] text-ns-on-surface selection:bg-ns-primary selection:text-ns-background">
      <main className="pt-20">
        <section className="relative flex min-h-[840px] flex-col items-center justify-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              alt="Celebratory arena"
              className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen saturate-50"
              src="/images/pool-rankings-bg.png"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C1323] via-[#0C1323]/55 to-transparent" />
            <div className="absolute inset-0 flex justify-around opacity-40">
              <div className="h-full w-1/4 -rotate-12 bg-gradient-to-t from-[#FFD700]/10 to-transparent blur-3xl" />
              <div className="h-full w-1/4 rotate-12 bg-gradient-to-t from-[#7D5FFF]/10 to-transparent blur-3xl" />
            </div>
          </div>

          <div className="relative z-10 mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-4 py-1 text-[10px] uppercase tracking-[0.2em] text-[#FFD700]">
              <TrophyIcon className="h-3.5 w-3.5" />
              Live protocol ladder
            </div>
            <h1 className="font-headline text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,215,0,0.5)] md:text-8xl">
              Pool <span className="italic text-[#FFD700]">Rankings</span>
            </h1>
            <p className="mt-4 text-sm uppercase tracking-[0.25em] text-[#D0C6AB]">
              Indexed from LuckyScratch claims, rounds, and creator accounting
            </p>
          </div>

          <div className="relative z-10 flex w-full max-w-6xl items-end justify-center gap-4 px-6 pb-16 md:gap-12">
            {podiumEntries.length === 0 ? (
              <div className="glass-panel rounded-3xl px-8 py-6 text-sm text-[#D0C6AB]">
                {isLoading ? "Loading live pool rankings." : "No ranked pools are currently indexed."}
              </div>
            ) : (
              podiumEntries.map(({ displayRank, pool }) => {
                if (!pool) {
                  return null;
                }

                const isChampion = displayRank === 1;
                const frameClass = isChampion
                  ? "border-4 border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.4)]"
                  : displayRank === 2
                    ? "border-2 border-slate-400/50 shadow-[0_0_28px_rgba(148,163,184,0.2)]"
                    : "border-2 border-[#7D5FFF]/50 shadow-[0_0_28px_rgba(125,95,255,0.2)]";

                const podiumClass =
                  displayRank === 1
                    ? "from-[#FFD700]/30 border-[#FFD700]/50"
                    : displayRank === 2
                      ? "from-slate-400/20 border-slate-400/30"
                      : "from-[#7D5FFF]/20 border-[#7D5FFF]/30";

                return (
                  <div
                    key={`${pool.poolId}-${displayRank}`}
                    className={`group flex flex-col items-center ${isChampion ? "mb-8 scale-110" : ""}`}
                  >
                    <div
                      className={`${POOL_COVER_FRAME_CLASS} transition-transform duration-500 group-hover:-translate-y-4 ${isChampion ? "w-48 md:w-72" : "w-40 md:w-56"}`}
                    >
                      <div className={`absolute inset-0 overflow-hidden rounded-xl bg-[#161E31] ${frameClass}`}>
                        <img alt={pool.name} className={POOL_COVER_IMAGE_CLASS} src={pool.image} />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0)_100%)] bg-[length:200%_200%] animate-[pool-rank-shimmer_3s_infinite]" />
                        <div
                          className="absolute left-3 top-3 rounded-sm px-3 py-1 font-headline font-black"
                          style={{
                            backgroundColor: pool.accent,
                            color: displayRank === 3 ? "#FFFFFF" : "#0C1323",
                          }}
                        >
                          #{displayRank}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-4">
                          <p
                            className={`font-headline font-black uppercase ${isChampion ? "text-lg text-[#FFD700]" : "text-sm text-white"}`}
                          >
                            {pool.name}
                          </p>
                          <p className="text-xs uppercase tracking-widest text-white/70">
                            {metric === "winRate"
                              ? `${pool.metricWinRate.toFixed(1)}% hit rate`
                              : `${pool.metricSalesLabel} USDC sales`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`mt-4 border-t bg-gradient-to-b to-transparent backdrop-blur-md [clip-path:polygon(10%_0%,100%_0%,100%_85%,90%_100%,0%_100%,0%_15%)] ${podiumHeights[displayRank]} ${podiumClass}`}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="pointer-events-none absolute bottom-0 h-1/4 w-full bg-gradient-to-b from-transparent via-[#070E1D]/80 to-[#070E1D]" />
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-24 md:px-8">
          <div className="mb-16 flex justify-center">
            <div className="relative flex gap-1 overflow-hidden rounded-lg border border-[#FFD700]/20 bg-[#121A2B]/80 p-1">
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-[#FFD700]/5 to-transparent" />
              {metricOptions.map(option => {
                const active = metric === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMetric(option.key)}
                    className={`rounded-sm px-8 py-3 font-headline text-xs font-black uppercase tracking-[0.2em] transition-all ${
                      active
                        ? "bg-[#FFD700] text-[#0C1323] shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                        : "text-[#D0C6AB] hover:text-[#FFD700]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-3xl border border-[#FFD700]/10 bg-[#121A2B]/60 p-8 text-sm text-[#D0C6AB] backdrop-blur-xl">
              {isLoading ? "Loading rankings from the backend read model." : "No ranking records are available yet."}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="hidden grid-cols-[80px_1fr_150px_200px_150px] items-center border-l-4 border-[#FFD700] bg-[#FFD700]/5 px-8 py-4 font-label text-[10px] font-black uppercase tracking-[0.3em] text-[#FFD700] lg:grid">
                <div>Rank</div>
                <div>Identity Node</div>
                <div className="text-center">Protocol</div>
                <div className="text-right">Victory Metric</div>
                <div className="text-right">Interrogate</div>
              </div>

              {leaderboard.map(pool => (
                <article
                  key={pool.poolId}
                  className="grid gap-4 border border-[#FFD700]/10 bg-[rgba(22,30,49,0.4)] p-5 backdrop-blur-2xl transition-all hover:border-[#FFD700]/30 hover:bg-[#232F4E]/60 lg:grid-cols-[80px_1fr_150px_200px_150px] lg:items-center lg:px-8"
                >
                  <div className="font-headline text-3xl font-black italic text-white/30 transition-colors hover:text-[#FFD700]">
                    {String(pool.rank).padStart(2, "0")}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-sm border border-white/10 bg-[#161E31]">
                      <img alt={pool.name} className="h-full w-full object-cover" src={pool.image} />
                    </div>
                    <div>
                      <div className="font-headline text-base font-bold uppercase tracking-wide text-white">
                        {pool.name}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/50">{pool.identity}</div>
                    </div>
                  </div>

                  <div className="flex justify-start lg:justify-center">
                    <span
                      className={`rounded-sm border px-4 py-1 text-[9px] font-black uppercase tracking-widest ${
                        pool.type === "Official"
                          ? "border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]"
                          : "border-[#7D5FFF]/20 bg-[#7D5FFF]/10 text-[#CABEFF]"
                      }`}
                    >
                      {pool.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between lg:block lg:text-right">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 lg:hidden">Metric</span>
                    <div className="font-headline text-2xl font-black text-white">
                      {metric === "winRate" ? (
                        <>
                          {pool.metricWinRate.toFixed(1)}
                          <span className="ml-1 text-sm text-[#FFD700]">%</span>
                        </>
                      ) : (
                        <>
                          {pool.metricSalesLabel}
                          <span className="ml-1 text-sm text-[#7D5FFF]">USDC</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">
                      {pool.soldCount} sold this round
                    </div>
                  </div>

                  <div className="flex justify-start lg:justify-end">
                    <Link
                      href={`/pool-detail/${pool.poolId}`}
                      className="inline-flex items-center gap-2 rounded-sm border border-[#181F30] px-5 py-2 font-headline text-[10px] font-bold uppercase tracking-widest text-[#D0C6AB] transition-all hover:border-[#FFD700] hover:bg-[#FFD700] hover:text-[#0C1323]"
                    >
                      Details
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#FFD700]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <BuildingLibraryIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Protocol Split</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                {officialCount} official pools and {communityCount} community pools currently occupy the top{" "}
                {topWindow.length || 0} ranking slots.
              </p>
            </div>
            <div className="rounded-2xl border border-[#7D5FFF]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#CABEFF]">
                <SparklesIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Metric Source</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Hit rate uses the current pool configuration. Sales volume uses realized revenue already indexed from
                onchain purchases.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <FireIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Current Leader</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                {champion
                  ? `${champion.name} leads with ${formatPercentFromBps(Math.round(champion.metricWinRate * 100))}% hit rate and ${champion.metricSalesLabel} USDC realized sales.`
                  : "Waiting for the first ranked pool to surface."}
              </p>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes pool-rank-shimmer {
          0% {
            background-position: -200% -200%;
          }
          100% {
            background-position: 200% 200%;
          }
        }
      `}</style>
    </div>
  );
}
