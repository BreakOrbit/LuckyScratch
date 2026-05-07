"use client";

import { useMemo, useState } from "react";
import { BellIcon, BoltIcon, ShieldCheckIcon, TrophyIcon } from "@heroicons/react/24/outline";
import { useLuckyScratchPlayerLeaderboard } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import {
  formatCompactMicroUsdc,
  getAddressAvatarGradient,
  getAddressBadgeText,
  getPoolShortCreator,
} from "~~/services/luckyScratch/display";

type Timeframe = "weekly" | "all-time";

const CHAMPIONS_HALL_BACKGROUND = "/player-rankings-pg.jpg";

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

const formatLastWin = (value?: string) => {
  if (!value) {
    return "No recent claim";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No recent claim";
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

type AddressAvatarProps = {
  address: string;
  className: string;
  badgeClassName?: string;
  avatarUrl?: string;
};

const AddressAvatar = ({ address, className, badgeClassName, avatarUrl }: AddressAvatarProps) => (
  <div
    className={`flex items-center justify-center overflow-hidden rounded-full border border-white/15 text-white shadow-[0_0_30px_rgba(255,215,0,0.12)] ${className} ${badgeClassName || ""}`}
    style={avatarUrl ? undefined : { background: getAddressAvatarGradient(address) }}
  >
    {avatarUrl ? (
      <img src={avatarUrl} alt="Player avatar" className="h-full w-full object-cover" />
    ) : (
      <span className="font-headline text-xl font-black uppercase tracking-[0.2em]">
        {getAddressBadgeText(address)}
      </span>
    )}
  </div>
);

export function PlayerRankingsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const { data, isLoading } = useLuckyScratchPlayerLeaderboard(timeframe, 20);

  const leaderboard = useMemo(() => data?.items ?? [], [data?.items]);
  const podiumEntries = useMemo(
    () =>
      [
        { displayRank: 2, player: leaderboard[1] },
        { displayRank: 1, player: leaderboard[0] },
        { displayRank: 3, player: leaderboard[2] },
      ].filter(entry => Boolean(entry.player)),
    [leaderboard],
  );
  const crownHolder = leaderboard[0];

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
                Claimed reward leaderboard
              </p>
              <div className="h-px w-12 bg-[#FFD700]/50" />
            </div>
          </div>

          <div className="relative z-20 flex w-full max-w-7xl flex-grow items-end justify-center px-4 pb-6 sm:px-6 sm:pb-8">
            <div className="relative h-[380px] w-full sm:h-[470px] md:h-[560px] lg:h-[620px] 2xl:h-[720px]">
              {podiumEntries.length === 0 ? (
                <div className="absolute inset-x-0 bottom-24 mx-auto w-fit rounded-3xl border border-[#FFD700]/15 bg-[#0F1626]/75 px-8 py-5 text-sm text-[#D0C6AB] backdrop-blur-xl">
                  {isLoading ? "Loading claimed reward leaderboard." : "No claimed winners have been indexed yet."}
                </div>
              ) : (
                podiumEntries.map(({ displayRank, player }) => {
                  if (!player) {
                    return null;
                  }

                  const layout = podiumLayouts[displayRank];
                  const ringClass =
                    displayRank === 1
                      ? "from-yellow-300 via-[#FFD700] to-amber-700 shadow-[0_0_50px_rgba(255,215,0,0.5)]"
                      : displayRank === 2
                        ? "from-slate-300 to-slate-500 shadow-[0_0_30px_rgba(148,163,184,0.4)]"
                        : "from-amber-400 to-amber-800 shadow-[0_0_30px_rgba(194,65,12,0.4)]";

                  const address = player.playerAddress || player.displayAddress;
                  const displayName =
                    player.nickname || getPoolShortCreator(player.displayAddress || player.playerAddress, 6, 4);

                  return (
                    <div
                      key={`${address}-${displayRank}`}
                      className={`absolute -translate-x-1/2 ${layout.positionClass} flex flex-col items-center`}
                    >
                      <div
                        className="relative mb-4 animate-[hero-float_5s_ease-in-out_infinite]"
                        style={{ animationDelay: `${displayRank * 0.4}s` }}
                      >
                        <div
                          className="absolute inset-0 scale-150 rounded-full blur-[48px]"
                          style={{
                            backgroundColor:
                              displayRank === 1 ? "#FFD70033" : displayRank === 2 ? "#CBD5E133" : "#D9770633",
                          }}
                        />
                        <div className={`relative rounded-full bg-gradient-to-b p-1.5 ${ringClass}`}>
                          <AddressAvatar
                            address={address}
                            className={`${layout.avatarSize}`}
                            avatarUrl={player.avatarUrl}
                          />
                        </div>
                        <div
                          className={`absolute ${layout.badgeSize} flex items-center justify-center rounded-full border-4 border-white/20 bg-[#FFD700] font-headline font-black text-[#0F1626] shadow-xl`}
                        >
                          {displayRank}
                        </div>
                      </div>

                      <div className="text-center">
                        <h3
                          className={`rounded border px-3 py-1 font-headline font-black uppercase tracking-tight backdrop-blur-sm sm:px-4 ${layout.titleClass}`}
                        >
                          {displayName}
                        </h3>
                        <div className={`mt-1 font-headline font-black text-[#FFD700] ${layout.valueClass}`}>
                          {formatCompactMicroUsdc(player.totalRewardAmount)}{" "}
                          <span className="text-xs text-white/50">USDC</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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
                Sourced from claimed reward events and backend indexing
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
                onClick={() => setTimeframe("all-time")}
                className={`px-4 py-2 font-headline text-[10px] font-bold uppercase tracking-widest [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)] ${
                  timeframe === "all-time"
                    ? "border border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]"
                    : "border border-white/5 bg-[#232F4E] text-[#D0C6AB]"
                }`}
              >
                All-Time
              </button>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-3xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-8 text-sm text-[#D0C6AB] backdrop-blur-xl">
              {isLoading ? "Loading leaderboard entries." : "No winning claim records are available yet."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#FFD700]/20 bg-[#121A2B]/40 shadow-2xl shadow-yellow-900/10 backdrop-blur-md">
              <div className="hidden grid-cols-12 border-b border-[#FFD700]/10 bg-[#FFD700]/5 px-8 py-5 lg:grid">
                <div className="col-span-1 font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                  Rank
                </div>
                <div className="col-span-5 font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                  Winner
                </div>
                <div className="col-span-3 text-right font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                  Victories
                </div>
                <div className="col-span-3 text-right font-headline text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                  Total Claimed
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {leaderboard.map(player => {
                  const address = player.playerAddress || player.displayAddress;
                  const label =
                    player.nickname || getPoolShortCreator(player.displayAddress || player.playerAddress, 6, 4);

                  return (
                    <article
                      key={address}
                      className="grid gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] lg:grid-cols-12 lg:items-center lg:px-8"
                    >
                      <div className="col-span-1 font-headline text-3xl font-black italic text-white/35">
                        {String(player.rank).padStart(2, "0")}
                      </div>
                      <div className="col-span-5 flex items-center gap-4">
                        <AddressAvatar address={address} className="h-14 w-14" avatarUrl={player.avatarUrl} />
                        <div>
                          <p className="font-headline text-lg font-black uppercase tracking-tight text-white">
                            {label}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-[#D0C6AB]">
                            Last claim {formatLastWin(player.lastWinAt)}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-3 flex items-center justify-between lg:block lg:text-right">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 lg:hidden">
                          Victories
                        </span>
                        <span className="font-headline text-2xl font-black text-white">{player.winCount}</span>
                      </div>
                      <div className="col-span-3 flex items-center justify-between lg:block lg:text-right">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 lg:hidden">Yield</span>
                        <span className="font-headline text-2xl font-black text-[#FFD700]">
                          {formatCompactMicroUsdc(player.totalRewardAmount)} USDC
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <TrophyIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Crown Holder</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                {crownHolder
                  ? `${crownHolder.nickname || getPoolShortCreator(crownHolder.displayAddress || crownHolder.playerAddress, 6, 4)} currently leads with ${formatCompactMicroUsdc(crownHolder.totalRewardAmount)} USDC claimed.`
                  : "Waiting for the first claimed winner to reach the board."}
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <ShieldCheckIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Verified Records</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Every entry is aggregated from claimed winning tickets already indexed by the backend read model.
              </p>
            </div>
            <div className="rounded-2xl border border-[#FFD700]/15 bg-[#121A2B]/60 p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 text-[#FFD700]">
                <BoltIcon className="h-5 w-5" />
                <span className="font-headline text-xs uppercase tracking-[0.2em]">Momentum</span>
              </div>
              <p className="text-sm text-[#D0C6AB]">
                Weekly mode isolates the last 7 days of claimed rewards. All-time mode ranks the full indexed payout
                history.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-end gap-3 text-[#D0C6AB]">
            <BellIcon className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Synced from the claim ledger</span>
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
