"use client";

import { useMemo, useState } from "react";
import { BellIcon, BoltIcon, ShieldCheckIcon, TrophyIcon } from "@heroicons/react/24/outline";

type Timeframe = "weekly" | "allTime";

type PlayerEntry = {
  rank: number;
  alias: string;
  winsWeekly: number;
  winsAllTime: number;
  yieldWeekly: string;
  yieldAllTime: string;
  avatar: string;
  accent: string;
};

const podiumPlayers: PlayerEntry[] = [
  {
    rank: 1,
    alias: "NEON_VOID_99",
    winsWeekly: 182,
    winsAllTime: 1284,
    yieldWeekly: "88.5K",
    yieldAllTime: "542.3K",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAc9A8IowQygw2T24FYgYGUUJyUIrCOeGwRYQNSGwVu08qy3LPahT4quvYzCF6rMSJJ55-s1BNrxWv5cDRBpGyxNlbkTK7ZqBU4I8oMyZGfjUYewsaIFMnuKrHrMYUFsYCpRuWlpFOEwTxQj5IH3H8bhSD5YSLOVObK8l8UdupPNHoTw1H76wWSxvEqc90aee11W3ZcxEyW738uaGk9mBDalWNfGtyeFkTwshCeHd42yisdKfo5E1DX3VmzUTPvf5_vOCj4gUiDy38r",
    accent: "#FFD700",
  },
  {
    rank: 2,
    alias: "KRYPTO_QUEEN",
    winsWeekly: 141,
    winsAllTime: 934,
    yieldWeekly: "42.8K",
    yieldAllTime: "311.9K",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDP88gDfoAtp7i_3KdBZhCoGFLtIedI9K_5Y461QqrN1h9Tmb-_sgXI-MYQ4switZboyeZdqEA7BhDYSeDAgvatTCd0i2i6UAas6uCm4SsrpGrKvksUibhJnBmIeo6vdD-oENTmhLl9te3pNcWXUcyiVhJm98XQ9hKXbP0s5Xxtx9sCleUZvxACqmBhlk95be-cWWst6DRcZmew4evoa967hTckTvo7sQM7M3cLXJmT9Otsk-6jQYsB6L8u0oQoqixsW3S2LekfDcCs",
    accent: "#CBD5E1",
  },
  {
    rank: 3,
    alias: "ZERO_PROTOCOL",
    winsWeekly: 129,
    winsAllTime: 870,
    yieldWeekly: "31.2K",
    yieldAllTime: "286.4K",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBiKFtarStU04uk8bVaxHp2FVU-XzSY8Kq_Z1iQ-0D-hJJzZA8hT_8QsEc19pphPipdmEx7JGy_Oq-DW-e5U_q2eFDEAKpcXyX0YREydbAfe0TtSsFZmMajljWMaCXhtwKvaGIh521q1clCvFDp_z6yDaW9-BdwZZVEY3P9JkN3UJGGzRcu7r8_nCv2RdZpQ49eb_SF60ZcYhLkxoQiluMgx_I5B5fZAb03jNO729KtxdnsM7hU-6_-5xuDK15DZDqtOWZ8eyE7Chij",
    accent: "#D97706",
  },
];

const leaderboardPlayers: PlayerEntry[] = [
  ...podiumPlayers,
  {
    rank: 4,
    alias: "SOLAR_FABLE",
    winsWeekly: 116,
    winsAllTime: 792,
    yieldWeekly: "27.4K",
    yieldAllTime: "221.3K",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
    accent: "#FFD700",
  },
  {
    rank: 5,
    alias: "AETHER_RUNNER",
    winsWeekly: 104,
    winsAllTime: 761,
    yieldWeekly: "23.1K",
    yieldAllTime: "210.8K",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
    accent: "#7D5FFF",
  },
  {
    rank: 6,
    alias: "VOID_ORACLE",
    winsWeekly: 96,
    winsAllTime: 688,
    yieldWeekly: "18.9K",
    yieldAllTime: "188.2K",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
    accent: "#FFD700",
  },
  {
    rank: 7,
    alias: "STATIC_RIDER",
    winsWeekly: 88,
    winsAllTime: 632,
    yieldWeekly: "16.5K",
    yieldAllTime: "170.6K",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
    accent: "#7D5FFF",
  },
];

const CHAMPIONS_HALL_BACKGROUND =
  "https://lh3.googleusercontent.com/aida/ADBb0uiidBHqA5ZSCmlWayFUDoIrKHnjsdTA0A1yPTbnYMCpms2R8Il3P-9ZvFh-3rHe_-OM9sA7Umb3fdP83scGr6L4g2YIN-mRMwnGXzFvtZKy6IO4e7TTQJD8rqmVjjJsQbuag3Ei5o0VMiRGiUr17CDXn63-Avtm3P92Z2VS0NGxz5Sxv87su5gruFNJkDtlNvCCpQB8kw6vO7MNONVmQIuMetcC2d61XHpqYNchPDxp1eAiXPhuLEl88Cjb";

const podiumLayouts: Record<
  number,
  { positionClass: string; avatarSize: string; badgeSize: string; titleClass: string; valueClass: string }
> = {
  1: {
    positionClass:
      "left-[50.2%] bottom-[31%] sm:bottom-[34%] md:bottom-[36%] lg:bottom-[40%] xl:bottom-[41%] 2xl:bottom-[46%] z-20",
    avatarSize: "h-32 w-32 sm:h-40 sm:w-40 md:h-56 md:w-56",
    badgeSize:
      "h-14 w-14 -top-4 -right-4 text-3xl sm:h-16 sm:w-16 sm:-top-5 sm:-right-5 sm:text-4xl md:h-20 md:w-20 md:-top-6 md:-right-6 md:text-5xl",
    titleClass: "border-[#FFD700]/30 bg-[#0F1626]/80 text-xl text-[#FFD700] sm:text-2xl md:text-3xl",
    valueClass: "text-2xl sm:text-3xl md:text-4xl",
  },
  2: {
    positionClass:
      "left-[29.5%] sm:left-[27.5%] md:left-[24.5%] lg:left-[20.5%] bottom-[25%] sm:bottom-[28%] md:bottom-[30%] lg:bottom-[34%] xl:bottom-[35%] 2xl:left-[16.5%] 2xl:bottom-[40%]",
    avatarSize: "h-24 w-24 sm:h-28 sm:w-28 md:h-40 md:w-40",
    badgeSize:
      "h-10 w-10 -top-3 -right-3 text-xl sm:h-11 sm:w-11 sm:text-xl md:h-12 md:w-12 md:-top-4 md:-right-4 md:text-2xl",
    titleClass: "border-white/10 bg-[#0F1626]/80 text-sm text-white sm:text-base md:text-lg",
    valueClass: "text-lg sm:text-xl md:text-xl",
  },
  3: {
    positionClass:
      "left-[70.5%] sm:left-[72.5%] md:left-[75.5%] lg:left-[79.5%] bottom-[22%] sm:bottom-[25%] md:bottom-[27%] lg:bottom-[31%] xl:bottom-[32%] 2xl:left-[83.5%] 2xl:bottom-[37%]",
    avatarSize: "h-24 w-24 sm:h-28 sm:w-28 md:h-36 md:w-36",
    badgeSize: "h-10 w-10 -top-3 -right-3 text-xl sm:h-11 sm:w-11 sm:text-xl md:h-11 md:w-11 md:text-xl",
    titleClass: "border-white/10 bg-[#0F1626]/80 text-sm text-white sm:text-base md:text-lg",
    valueClass: "text-lg sm:text-xl md:text-xl",
  },
};

export function PlayerRankingsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");

  const leaderboard = useMemo(() => {
    const players = [...leaderboardPlayers];
    return players.sort((a, b) =>
      timeframe === "weekly" ? b.winsWeekly - a.winsWeekly : b.winsAllTime - a.winsAllTime,
    );
  }, [timeframe]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0F1626] text-[#F2F4F7] selection:bg-[#FFD700]/30">
      <main>
        <section className="relative flex min-h-screen flex-col items-center overflow-hidden pb-20 pt-32">
          <div className="absolute inset-0">
            <img
              alt="Champions hall background"
              className="h-full w-full object-cover saturate-125"
              src={CHAMPIONS_HALL_BACKGROUND}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(15,22,38,0.6)] to-[rgba(15,22,38,1)]" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-10">
            {Array.from({ length: 8 }).map((_, index) => (
              <span
                key={index}
                className="absolute rounded-full bg-[#FFD700] shadow-[0_0_5px_#FFD700]"
                style={{
                  width: `${index % 3 === 0 ? 12 : 8}px`,
                  height: `${index % 3 === 0 ? 12 : 8}px`,
                  left: `${15 + index * 9}%`,
                  bottom: `${20 + (index % 4) * 8}%`,
                  animation: `hero-rise 3s ${index * 0.35}s infinite ease-out`,
                }}
              />
            ))}
          </div>

          <div className="relative z-20 mb-12 text-center">
            <h1 className="font-headline text-6xl font-black uppercase tracking-tighter text-white md:text-8xl">
              Champions{" "}
              <span className="italic text-[#FFD700] [text-shadow:0_0_10px_rgba(255,215,0,0.6),0_0_20px_rgba(255,215,0,0.3)]">
                Hall
              </span>
            </h1>
            <div className="mt-3 flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-[#FFD700]/50" />
              <p className="font-headline text-sm font-bold uppercase tracking-[0.3em] text-[#FFD700]">
                Season 04: Aetheric Gilded
              </p>
              <div className="h-px w-12 bg-[#FFD700]/50" />
            </div>
          </div>

          <div className="relative z-20 flex w-full max-w-7xl flex-grow items-end justify-center px-4 pb-6 sm:px-6 sm:pb-8">
            <div className="relative h-[380px] w-full sm:h-[470px] md:h-[560px] lg:h-[620px] 2xl:h-[720px]">
              {[2, 1, 3].map(rank => {
                const player = podiumPlayers.find(entry => entry.rank === rank);
                if (!player) return null;

                const layout = podiumLayouts[rank];
                const ringClass =
                  rank === 1
                    ? "from-yellow-300 via-[#FFD700] to-amber-700 shadow-[0_0_50px_rgba(255,215,0,0.5)]"
                    : rank === 2
                      ? "from-slate-300 to-slate-500 shadow-[0_0_30px_rgba(148,163,184,0.4)]"
                      : "from-amber-400 to-amber-800 shadow-[0_0_30px_rgba(194,65,12,0.4)]";
                const value = timeframe === "weekly" ? player.yieldWeekly : player.yieldAllTime;

                return (
                  <div
                    key={rank}
                    className={`absolute -translate-x-1/2 ${layout.positionClass} flex flex-col items-center`}
                  >
                    <div
                      className="relative mb-4 animate-[hero-float_5s_ease-in-out_infinite]"
                      style={{ animationDelay: `${rank * 0.4}s` }}
                    >
                      <div
                        className="absolute inset-0 scale-150 rounded-full blur-[48px]"
                        style={{
                          backgroundColor: `${player.accent}33`,
                          filter: "drop-shadow(0 0 15px currentColor)",
                          color: player.accent,
                        }}
                      />
                      <div className={`relative overflow-hidden rounded-full bg-gradient-to-b p-1.5 ${ringClass}`}>
                        <img
                          alt={player.alias}
                          className={`${layout.avatarSize} rounded-full border-4 border-white/20 object-cover`}
                          src={player.avatar}
                        />
                      </div>
                      <div
                        className={`absolute ${layout.badgeSize} flex items-center justify-center rounded-full border-4 border-white/20 bg-[#FFD700] font-headline font-black text-[#0F1626] shadow-xl`}
                      >
                        {rank}
                      </div>
                    </div>

                    <div className="text-center">
                      <h3
                        className={`rounded border px-3 py-1 font-headline font-black uppercase tracking-tight backdrop-blur-sm sm:px-4 ${layout.titleClass}`}
                      >
                        {player.alias}
                      </h3>
                      <div className={`mt-1 font-headline font-black text-[#FFD700] ${layout.valueClass}`}>
                        {value} <span className="text-xs text-white/50">LS</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="relative mx-auto max-w-6xl px-6 py-20 md:px-8"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,215,0,0.05) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-[hero-scan_8s_linear_infinite] bg-[#FFD700]/10" />

          <div className="mb-8 flex items-center justify-between border-l-4 border-[#FFD700] pl-6">
            <div>
              <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                Ranking <span className="text-[#FFD700]">Data</span>
              </h2>
              <p className="mt-1 text-xs uppercase tracking-widest text-[#D0C6AB]">
                Verified sanctum records • Updated 2m ago
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTimeframe("weekly")}
                className={`px-4 py-2 font-headline text-[10px] font-bold uppercase tracking-widest [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)] ${
                  timeframe === "weekly"
                    ? "border border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]"
                    : "border border-white/5 bg-[#232F4E] text-[#D0C6AB]"
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("allTime")}
                className={`px-4 py-2 font-headline text-[10px] font-bold uppercase tracking-widest [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)] ${
                  timeframe === "allTime"
                    ? "border border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]"
                    : "border border-white/5 bg-[#232F4E] text-[#D0C6AB]"
                }`}
              >
                All-Time
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#FFD700]/20 bg-[#121A2B]/40 shadow-2xl shadow-yellow-900/10 backdrop-blur-md">
            <div className="hidden grid-cols-12 border-b border-[#FFD700]/10 bg-[#FFD700]/5 px-8 py-5 lg:grid">
              <div className="col-span-1 font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                Rank
              </div>
              <div className="col-span-5 font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                Duelist Entity
              </div>
              <div className="col-span-3 text-right font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                Victories
              </div>
              <div className="col-span-3 text-right font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                Total Sanctum Yield
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {leaderboard.map((player, index) => {
                const wins = timeframe === "weekly" ? player.winsWeekly : player.winsAllTime;
                const yieldValue = timeframe === "weekly" ? player.yieldWeekly : player.yieldAllTime;

                return (
                  <article
                    key={player.alias}
                    className="grid gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] lg:grid-cols-12 lg:items-center lg:px-8"
                  >
                    <div className="col-span-1 font-headline text-3xl font-black italic text-white/35">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-5 flex items-center gap-4">
                      <img
                        alt={player.alias}
                        className="h-14 w-14 rounded-full border border-white/10 object-cover"
                        src={player.avatar}
                      />
                      <div>
                        <p className="font-headline text-lg font-black uppercase tracking-tight text-white">
                          {player.alias}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-[#D0C6AB]">Hero class verified</p>
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center justify-between lg:block lg:text-right">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 lg:hidden">Victories</span>
                      <span className="font-headline text-2xl font-black text-white">{wins}</span>
                    </div>
                    <div className="col-span-3 flex items-center justify-between lg:block lg:text-right">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 lg:hidden">Yield</span>
                      <span className="font-headline text-2xl font-black text-[#FFD700]">{yieldValue} LS</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <TrophyIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Crown Holder</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                The top hero holds the highest verified sanctum yield across the current season ladder.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <ShieldCheckIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Verified Records</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Every win and yield value is sourced from the current LuckyScratch ranking feed and season ledger.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <BoltIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Momentum</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Weekly mode surfaces fast climbers, while all-time mode exposes the long-run dominance hierarchy.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-end gap-3 text-[#D0C6AB]">
            <BellIcon className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Broadcast synced to arena feed</span>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes hero-float {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
          100% {
            transform: translateY(0px);
          }
        }

        @keyframes hero-scan {
          from {
            top: 0;
          }
          to {
            top: 100%;
          }
        }

        @keyframes hero-rise {
          0% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-120px) scale(0.5) rotate(180deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
