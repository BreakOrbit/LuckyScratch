"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BatchScratchView } from "./BatchScratchView";
import { SingleScratchView } from "./SingleScratchView";

/* ─── Demo pool data (to be replaced by contract reads) ─── */
const DEMO_POOLS: Record<
  string,
  { name: string; emoji: string; themeColor: string; ticketPrice: number; maxPrize: number }
> = {
  "1": { name: "鸿运当头", emoji: "🏮", themeColor: "#C62828", ticketPrice: 2, maxPrize: 20 },
  "2": { name: "钻石猎人", emoji: "💎", themeColor: "#1565C0", ticketPrice: 5, maxPrize: 50 },
  "3": { name: "星云探秘", emoji: "🌌", themeColor: "#6A1B9A", ticketPrice: 2, maxPrize: 15 },
};

const DEFAULT_POOL = { name: "Lucky Fortune", emoji: "🏮", themeColor: "#C62828", ticketPrice: 2, maxPrize: 20 };

/** Demo: simulate random prize results for tickets */
function generateDemoResults(ticketIds: string[]): { ticketId: string; isWin: boolean; prize: number }[] {
  return ticketIds.map(id => {
    const rand = Math.random();
    if (rand < 0.3) return { ticketId: id, isWin: true, prize: 20 };
    if (rand < 0.5) return { ticketId: id, isWin: true, prize: 5 };
    if (rand < 0.65) return { ticketId: id, isWin: true, prize: 2 };
    return { ticketId: id, isWin: false, prize: 0 };
  });
}

type ScratchPageProps = {
  poolId: string;
};

/**
 * Main scratch page orchestrator.
 * Reads ticket IDs from query params, determines single vs batch mode.
 */
export const ScratchPage: React.FC<ScratchPageProps> = ({ poolId }) => {
  const searchParams = useSearchParams();
  const ticketsParam = searchParams.get("tickets") || "";
  const ticketIds = useMemo(() => ticketsParam.split(",").filter(Boolean), [ticketsParam]);

  const pool = DEMO_POOLS[poolId] || DEFAULT_POOL;

  /* Pre-generate results for demo */
  const [results] = useState(() => generateDemoResults(ticketIds));

  const isSingleMode = ticketIds.length === 1;

  return (
    <div className="relative min-h-screen bg-[#0c1323] text-[#dce2f9] font-body overflow-x-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 30% 20%, ${pool.themeColor}15 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(125,95,255,0.06) 0%, transparent 50%)
            `,
          }}
        />
        {/* Scan lines */}
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            background: "linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.03) 50%)",
            backgroundSize: "100% 4px",
          }}
        />
      </div>

      {/* Ambient Overlay */}
      <div className="fixed inset-0 bg-black/30 pointer-events-none" />

      {isSingleMode ? (
        <SingleScratchView
          poolId={poolId}
          poolName={pool.name}
          ticketPrice={pool.ticketPrice}
          maxPrize={pool.maxPrize}
          ticketId={ticketIds[0]}
          result={results[0]}
        />
      ) : (
        <BatchScratchView poolName={pool.name} ticketPrice={pool.ticketPrice} ticketIds={ticketIds} results={results} />
      )}
    </div>
  );
};
