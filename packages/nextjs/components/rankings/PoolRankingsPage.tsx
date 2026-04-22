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

type PoolMetric = "winRate" | "salesVolume";
type PoolType = "Official" | "Community";

type PoolLeaderboardEntry = {
  rank: number;
  name: string;
  identity: string;
  type: PoolType;
  metricWinRate: number;
  metricSales: string;
  accent: string;
  image: string;
};

const podiumPools: PoolLeaderboardEntry[] = [
  {
    rank: 1,
    name: "Dragon Rise",
    identity: "DR-001-AX",
    type: "Official",
    metricWinRate: 94.8,
    metricSales: "18.6K",
    accent: "#FFD700",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAYsGDrgU02SFZYsHcqm32f9HkMeKulrBZlNZquU7BRrWhT3fPGUbftOJVRZneilb0UIhi_PnMqaQOD_Qo9-nfM8H6Q01QfUza3isuN-sc5Im5lItqwaTJNXNEgaAl6qXPjnDpIHF5zKaoHModvLOJ0i6zNg9ozVXNk3GKVeeHlx7ntzZNjbTMhY3MEoHQSLT2qnMWauX26Pv7_qM4FhEeeykGcJFDhqUFWzu19MZZNswNQUXE5k-0c7ECIR2-ldSgKwtEVknzUX75R",
  },
  {
    rank: 2,
    name: "Cosmic Jackpot",
    identity: "CJ-9942-PX",
    type: "Official",
    metricWinRate: 85.1,
    metricSales: "14.2K",
    accent: "#94A3B8",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCZ9Lx2WpQuen-WhT95jshFfu5vVVczXcjlJRt-z3d2dWD70MR2vAKeLbB6C0M8cAYi0H8sMn_fSr8rQs41Ki3LGjKGitFCs2sT-u8YT1LcA_UmlG5UruzOYfjvk8M967GrzLhStc7zwqEUkqIXC0pZR7xbt2oilvvwF4RtlzCDDzTtq8Tj4AwZnCrRf9z4Rw8KLvwxZYD0BXNLUe8Ix1VW5bM4HQKDUEN6-zirH2vEexPkAsmaNtZIbXsXbKwE7_EhoYyCsgURRxHk",
  },
  {
    rank: 3,
    name: "Neon Pulse",
    identity: "NP-1102-GE",
    type: "Community",
    metricWinRate: 81.6,
    metricSales: "11.2K",
    accent: "#7D5FFF",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDfEUpLGLhuZ3WTFuZMaxYJiyZWzCpgW1CkiSJzRPW1dnJmFwAfHiWVRlKUVNJtYG21dzt6JqQCv6OAF8ghmYwTMsAhlop3QyWc7LMYXuP8iKJee89jDwOmG9RenKzE0rIMaArrOEZs3ptma_i0uxTRQCI0C5DId_zsuEU7MabuiEP2A2tkLdCespU1ieXz2SRxY7W6WT0AHBUkbPc-YDKyKipzKUPMuf7Q-7RTCchbTfM1F0YkevP2Z6CTsMvKgNn9FD2V9zCNFcQx",
  },
];

const leaderboardPools: PoolLeaderboardEntry[] = [
  ...podiumPools,
  {
    rank: 4,
    name: "Cyber Sentinels V2",
    identity: "ID: 9942-PX",
    type: "Official",
    metricWinRate: 78.4,
    metricSales: "9.6K",
    accent: "#FFD700",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCBD3ng1JakIoFpvAYqvbWV8x5_P9jXhfRxdz-vbfv_cRxdJVgb87TFsPF-6nzZruR1u1TKJ46vTHdTmsR_tG882ssp3BOjLIEC3Wy9Bq3sGEi_ooVQj2BSZ4GJJNUhkrjU0yC4RsS_jr9bK56-x7ukUAJxYldSu8syvajhIYRwH8iX0B1zba-7LvDgKnaD1pcESfK_E2bIa57L3TlwTJsKCTaK-l6CySYFuE_z-x86jMsRIsBEU8Wb55UZ8xNV1jANYjKAl8-CPEZ5",
  },
  {
    rank: 5,
    name: "Ghost Engine SCR",
    identity: "ID: 1102-GE",
    type: "Community",
    metricWinRate: 75.2,
    metricSales: "8.8K",
    accent: "#7D5FFF",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBQfZTJFL6l2x2wAVhg3KrAXtklqkORGyf_Ecnae4FV6k_zEDSIrkc4uWDIIJHeLjq7l5MAdPoI_dbYNRD001udf5f1qORSXmYpSyP6FKZ38Id-hpGfJe24pvc6E5y7GHmDyjsuzhMS9jt5lJ_q8G91jghEbtvJGfUZ1OefVoXHV8T6CX6s0NvEVBYf47ZqcGR9Xct8CpcM37nZwkVBgPAtKrEY5OCoDoGHQbKEMWRkGtxX-bLhX39dZ0lhqDpZUey0FfD6SKQktUC9",
  },
  {
    rank: 6,
    name: "Solar Vault Prime",
    identity: "ID: 3021-SV",
    type: "Official",
    metricWinRate: 71.9,
    metricSales: "7.1K",
    accent: "#FFD700",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  },
  {
    rank: 7,
    name: "Aether Bloom",
    identity: "ID: 4407-AB",
    type: "Community",
    metricWinRate: 69.7,
    metricSales: "6.4K",
    accent: "#7D5FFF",
    image: "https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?auto=format&fit=crop&w=800&q=80",
  },
];

const metricOptions: { key: PoolMetric; label: string }[] = [
  { key: "winRate", label: "Win Rate" },
  { key: "salesVolume", label: "Sales Volume" },
];

const podiumHeights: Record<number, string> = {
  1: "h-24 w-40 md:w-64",
  2: "h-16 w-32 md:w-48",
  3: "h-12 w-32 md:w-48",
};

export function PoolRankingsPage() {
  const [metric, setMetric] = useState<PoolMetric>("winRate");

  const leaderboard = useMemo(() => {
    const pools = [...leaderboardPools];
    return pools.sort((a, b) =>
      metric === "winRate"
        ? b.metricWinRate - a.metricWinRate
        : Number.parseFloat(b.metricSales) - Number.parseFloat(a.metricSales),
    );
  }, [metric]);

  return (
    <div className="min-h-screen bg-[#0C1323] text-ns-on-surface selection:bg-ns-primary selection:text-ns-background">
      <main className="pt-20">
        <section className="relative flex min-h-[840px] flex-col items-center justify-end overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              alt="Celebratory arena"
              className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-screen saturate-50"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAntrS5245PDcBJmyIISXF-5dTr_wm6PE033tzloATeCYN0dPGOXCQjcz7nOwchgQUU0iNXzPFnhNmx10VJiNPTYEII-ySR3skFiWwO10DQ7Ogz7MXiQbY83Bil8P9zExroPCKIGg5TtoXNrlhIPuBV4XD5DlPQ5Ehnj90fP-eRZfhcI_zow4YusX-cDhalIWoCniRIJQQNztMg2YDV_XVRC4iQXE9kzTlDM59lA1OaxzbzfW12Q8EPsp_t1X6SvOD9w_U6TWJs4Jlv"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C1323] via-[#0C1323]/55 to-transparent" />
            <div className="absolute inset-0 flex justify-around opacity-40">
              <div className="h-full w-1/4 -rotate-12 bg-gradient-to-t from-[#FFD700]/10 to-transparent blur-3xl" />
              <div className="h-full w-1/4 rotate-12 bg-gradient-to-t from-[#7D5FFF]/10 to-transparent blur-3xl" />
            </div>
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  className="absolute h-2 w-2 rounded-sm bg-[#FFD700] opacity-70 shadow-[0_0_12px_rgba(255,215,0,0.8)]"
                  style={{
                    left: `${12 + index * 10}%`,
                    top: `${8 + (index % 4) * 12}%`,
                    animation: `pool-rank-gold-fall ${4.5 + index * 0.3}s linear ${index * 0.4}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-4 py-1 text-[10px] uppercase tracking-[0.2em] text-[#FFD700]">
              <TrophyIcon className="h-3.5 w-3.5" />
              Season 4 Grand Championship
            </div>
            <h1 className="font-headline text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,215,0,0.5)] md:text-8xl">
              Pool <span className="italic text-[#FFD700]">Rankings</span>
            </h1>
          </div>

          <div className="relative z-10 flex w-full max-w-6xl items-end justify-center gap-4 px-6 pb-16 md:gap-12">
            {[2, 1, 3].map(rank => {
              const pool = podiumPools.find(entry => entry.rank === rank);
              if (!pool) return null;

              const isChampion = rank === 1;
              const frameClass = isChampion
                ? "border-4 border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.4)]"
                : rank === 2
                  ? "border-2 border-slate-400/50 shadow-[0_0_28px_rgba(148,163,184,0.2)]"
                  : "border-2 border-[#7D5FFF]/50 shadow-[0_0_28px_rgba(125,95,255,0.2)]";

              const podiumClass =
                rank === 1
                  ? "from-[#FFD700]/30 border-[#FFD700]/50"
                  : rank === 2
                    ? "from-slate-400/20 border-slate-400/30"
                    : "from-[#7D5FFF]/20 border-[#7D5FFF]/30";

              return (
                <div key={rank} className={`group flex flex-col items-center ${isChampion ? "mb-8 scale-110" : ""}`}>
                  <div
                    className={`relative aspect-[3/4] transition-transform duration-500 group-hover:-translate-y-4 ${isChampion ? "w-48 md:w-72" : "w-40 md:w-56"}`}
                  >
                    <div className={`absolute inset-0 overflow-hidden rounded-xl bg-[#161E31] ${frameClass}`}>
                      <img alt={pool.name} className="h-full w-full object-cover" src={pool.image} />
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0)_100%)] bg-[length:200%_200%] animate-[pool-rank-shimmer_3s_infinite]" />
                      <div
                        className="absolute left-3 top-3 rounded-sm px-3 py-1 font-headline font-black"
                        style={{
                          backgroundColor: pool.accent,
                          color: rank === 2 ? "#0C1323" : rank === 3 ? "#FFFFFF" : "#0C1323",
                        }}
                      >
                        #{rank}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-4">
                        <p
                          className={`font-headline font-black uppercase ${isChampion ? "text-lg text-[#FFD700]" : "text-sm text-white"}`}
                        >
                          {pool.name}
                        </p>
                        <p className="text-xs uppercase tracking-widest text-white/70">
                          {metric === "winRate"
                            ? `${pool.metricWinRate.toFixed(1)}% win rate`
                            : `${pool.metricSales} sales`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`mt-4 border-t bg-gradient-to-b to-transparent backdrop-blur-md [clip-path:polygon(10%_0%,100%_0%,100%_85%,90%_100%,0%_100%,0%_15%)] ${podiumHeights[rank]} ${podiumClass}`}
                  />
                </div>
              );
            })}
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

          <div className="space-y-3">
            <div className="hidden grid-cols-[80px_1fr_150px_200px_150px] items-center border-l-4 border-[#FFD700] bg-[#FFD700]/5 px-8 py-4 font-label text-[10px] font-black uppercase tracking-[0.3em] text-[#FFD700] lg:grid">
              <div>Rank</div>
              <div>Identity Node</div>
              <div className="text-center">Protocol</div>
              <div className="text-right">Victory Metric</div>
              <div className="text-right">Interrogate</div>
            </div>

            {leaderboard.map((pool, index) => (
              <article
                key={pool.identity}
                className="grid gap-4 border border-[#FFD700]/10 bg-[rgba(22,30,49,0.4)] p-5 backdrop-blur-2xl transition-all hover:border-[#FFD700]/30 hover:bg-[#232F4E]/60 lg:grid-cols-[80px_1fr_150px_200px_150px] lg:items-center lg:px-8"
              >
                <div className="font-headline text-3xl font-black italic text-white/30 transition-colors hover:text-[#FFD700]">
                  {String(index + 1).padStart(2, "0")}
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
                        {pool.metricSales}
                        <span className="ml-1 text-sm text-[#7D5FFF]">sales</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-start lg:justify-end">
                  <Link
                    href="/store"
                    className="inline-flex items-center gap-2 rounded-sm border border-[#181F30] px-5 py-2 font-headline text-[10px] font-bold uppercase tracking-widest text-[#D0C6AB] transition-all hover:border-[#FFD700] hover:bg-[#FFD700] hover:text-[#0C1323]"
                  >
                    Details
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#FFD700]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <BuildingLibraryIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Protocol Pools</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Official pools dominate the top ladder with stronger retention and higher verified yield.
              </p>
            </div>
            <div className="rounded-2xl border border-[#7D5FFF]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#CABEFF]">
                <SparklesIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Momentum Spike</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Community pools keep the highest week-over-week volatility and surface breakout performers faster.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/10 bg-[#121A2B]/70 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <FireIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Hot Streak</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                The current champion pool is converting at nearly 95% win rate while sustaining top-tier volume.
              </p>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes pool-rank-gold-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }

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
