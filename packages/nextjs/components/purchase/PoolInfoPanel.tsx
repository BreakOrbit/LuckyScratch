"use client";

import React, { useCallback, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";

type PoolInfoPanelProps = {
  poolName: string;
  poolEmoji: string;
  poolId?: string;
  ticketPrice: number;
  maxPrize: number;
  winRate: number;
  poolTotal: number;
  poolType: string;
  issuer: string;
  description: string;
  totalTickets?: number;
  soldTickets?: number;
  prizes?: { amountLabel: string; count: number; icon: string }[];
  isPrizeStructureLoading?: boolean;
  coverImage?: string;
  onGoBack: () => void;
};

/**
 * Compact pool info panel:
 *   Row 1: [Store-sized cover]
 *   Row 2: [Name + subtitle] ——— [PRICE] [WIN RATE] [MAX PRIZE]
 *   Row 3: Remaining | Win Type | Pool Total | Issuer | Description
 *   Row 4: Prize Structure (expanded by default)
 */
export const PoolInfoPanel: React.FC<PoolInfoPanelProps> = ({
  poolName,
  poolEmoji,
  poolId = "A1",
  ticketPrice,
  maxPrize,
  winRate,
  poolTotal,
  poolType,
  issuer,
  description,
  totalTickets = 56,
  soldTickets = 0,
  prizes,
  isPrizeStructureLoading = false,
  coverImage,
  onGoBack,
}) => {
  const [expanded, setExpanded] = useState(true); // default expanded

  const handleGoBack = useCallback(() => {
    onGoBack();
  }, [onGoBack]);

  const remaining = totalTickets - soldTickets;

  return (
    <div className="relative mb-6 rounded-2xl overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgba(15,22,38,0.97) 0%, rgba(27,37,61,0.95) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 px-5 md:px-7 py-4 md:py-5">
        {/* Back button */}
        <button
          onClick={handleGoBack}
          className="flex items-center gap-1.5 text-white/40 hover:text-[#FFD700] transition-colors mb-4 group"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] font-headline uppercase tracking-[0.2em]">Back to Store</span>
        </button>

        {/* ═══ Row 1: Store-sized Pool Cover ═══ */}
        <div
          className={`${POOL_COVER_FRAME_CLASS} mb-4 rounded-xl border border-white/10`}
          style={{
            boxShadow: "0 0 16px rgba(198,40,40,0.12)",
          }}
        >
          {coverImage ? (
            <img src={coverImage} alt={poolName} className={POOL_COVER_IMAGE_CLASS} />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C62828 0%, #8B1A1A 60%, #5D0F0F 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,215,0,0.4) 0%, transparent 50%)",
                }}
              />
              <span className="relative z-10 text-4xl drop-shadow-lg md:text-5xl">{poolEmoji}</span>
            </div>
          )}
        </div>

        {/* ═══ Row 2: Name + Stats ═══ */}
        <div className="mb-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          {/* Name + Subtitle */}
          <div className="min-w-0">
            <h1 className="font-headline font-black text-lg md:text-xl text-white tracking-tight truncate leading-tight">
              {poolName}
            </h1>
            <div className="text-[11px] text-white/35 mt-0.5">
              {poolType} · {issuer === "Official" ? "Official Draw" : "Community Draw"} · #{poolId}
            </div>
          </div>

          {/* Stats: PRICE / WIN RATE / MAX PRIZE */}
          <div className="flex flex-wrap items-end gap-6 md:gap-10">
            <div className="text-center">
              <div className="text-[9px] text-white/30 uppercase tracking-[0.25em] font-bold mb-0.5">PRICE</div>
              <div className="font-headline font-black text-lg md:text-xl text-[#FFD700] neon-text-gold leading-tight">
                {ticketPrice} USDC
              </div>
            </div>

            <div className="text-center">
              <div className="text-[9px] text-white/30 uppercase tracking-[0.25em] font-bold mb-0.5">WIN RATE</div>
              <div className="font-headline font-black text-lg md:text-xl text-[#00DAF3] neon-text-cyan leading-tight">
                {winRate}%
              </div>
            </div>

            <div className="text-center">
              <div className="text-[9px] text-white/30 uppercase tracking-[0.25em] font-bold mb-0.5">MAX PRIZE</div>
              <div className="font-headline font-black text-lg md:text-xl text-[#FFD700] leading-tight">
                {maxPrize} USDC
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent mb-3" />

        {/* ═══ Row 2: Secondary Info (single line) ═══ */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40 mb-3">
          <span>
            Remaining:{" "}
            <span className="text-white/65 font-semibold">
              {remaining}/{totalTickets}
            </span>
          </span>
          <span className="text-white/10">|</span>
          <span>
            Win Type: <span className="text-white/65">{poolType}</span>
          </span>
          <span className="text-white/10">|</span>
          <span>
            Pool Total: <span className="text-white/65">{poolTotal}U</span>
          </span>
          <span className="text-white/10">|</span>
          <span>
            Issuer: <span className="text-white/65">{issuer}</span>
          </span>
          {description && (
            <>
              <span className="text-white/10">|</span>
              <span className="truncate max-w-[300px] text-white/35">{description}</span>
            </>
          )}
        </div>

        {/* ═══ Row 3: Prize Structure (expanded by default) ═══ */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[#FFD700]/60 hover:text-[#FFD700] text-[11px] font-bold uppercase tracking-[0.15em] transition-colors mb-2"
        >
          Prize Structure
          {expanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
        </button>

        {expanded && isPrizeStructureLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[54px] animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
            ))}
          </div>
        ) : null}

        {expanded && !isPrizeStructureLoading && prizes?.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 gap-2">
            {prizes.map((prize, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
              >
                <span className="text-base">{prize.icon}</span>
                <div>
                  <div className="font-headline font-bold text-sm text-white leading-tight">{prize.amountLabel}</div>
                  <div className="text-[9px] text-white/35">×{prize.count}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {expanded && !isPrizeStructureLoading && !prizes?.length ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/45">
            Prize tier breakdown is unavailable for this pool metadata. The real purchase flow below only relies on
            ticket price, hit rate, RTP, max prize, and current round availability.
          </div>
        ) : null}
      </div>
    </div>
  );
};
