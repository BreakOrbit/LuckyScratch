"use client";

import { SparklesIcon } from "@heroicons/react/24/solid";
import { useLuckyScratchPools, useLuckyScratchRecentWins } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { getPoolDisplayName, getRecentWinLabel } from "~~/services/luckyScratch/display";

export const LiveWinnersTicker = () => {
  const { data: winsData, isLoading } = useLuckyScratchRecentWins(8);
  const { data: poolsData } = useLuckyScratchPools();

  const poolNames = new Map((poolsData?.items ?? []).map(pool => [pool.poolId, getPoolDisplayName(pool)]));
  const winners =
    winsData?.items.map(ticket => ({
      key: ticket.ticketId,
      label: getRecentWinLabel(ticket, poolNames.get(ticket.poolId)),
    })) ?? [];

  const items =
    winners.length > 0
      ? winners
      : [
          {
            key: "placeholder",
            label: isLoading
              ? "Loading recent claimed wins..."
              : "No claimed wins yet. The next claim will appear here.",
          },
        ];

  return (
    <div
      id="live-winners-ticker"
      className="w-full bg-ns-surface-container-lowest py-3 border-y border-ns-primary/10 overflow-hidden flex items-center"
    >
      <div className="flex whitespace-nowrap gap-12 text-xs font-label uppercase tracking-widest text-ns-primary px-8 animate-marquee">
        {[...items, ...items].map((item, index) => (
          <div key={`${item.key}-${index}`} className="flex items-center gap-2">
            <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
