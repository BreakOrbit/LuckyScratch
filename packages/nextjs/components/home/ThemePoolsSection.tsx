"use client";

import Link from "next/link";
import { PoolCard } from "./PoolCard";
import type { PoolAnimationType } from "./PoolCard";
import { useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import {
  formatPoolMaxPrizeLabel,
  formatPoolPriceCompactLabel,
  formatPoolWinRateLabel,
  getPoolDisplayImage,
  getPoolDisplayName,
  getPoolRarity,
  getPoolVisualProfile,
  sortPoolsByRevenue,
} from "~~/services/luckyScratch/display";

export const ThemePoolsSection = () => {
  const { data, isLoading } = useLuckyScratchPools();

  const pools = sortPoolsByRevenue(
    (data?.items ?? []).filter(pool => pool.protocolOwned && pool.status !== "Closed" && !pool.paused),
  )
    .slice(0, 8)
    .map((pool, index) => ({
      id: String(pool.poolId),
      name: getPoolDisplayName(pool),
      image: getPoolDisplayImage(pool),
      rarity: getPoolRarity(pool),
      price: formatPoolPriceCompactLabel(pool),
      winRate: formatPoolWinRateLabel(pool),
      maxPrize: formatPoolMaxPrizeLabel(pool),
      animationType: getPoolVisualProfile(pool).animationType as PoolAnimationType,
      hiddenOnMobile: index >= 4,
    }));

  return (
    <section id="theme-pools" className="max-w-7xl mx-auto px-8 py-32">
      <div className="flex justify-between items-end mb-16 gap-6">
        <div>
          <h2 className="font-headline font-black text-4xl uppercase tracking-tight text-ns-on-surface mb-2">
            Official Theme Pools
          </h2>
          <p className="text-ns-on-surface-variant font-body">
            Live protocol-owned pools ranked by realized sales and surfaced from the backend read model.
          </p>
        </div>
        <Link
          href="/store"
          className="text-ns-primary font-label uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all"
        >
          View All Pools <span className="material-symbols-outlined">trending_flat</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">
          Loading official pool inventory.
        </div>
      ) : pools.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">
          No official pools are currently indexed.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {pools.map(pool => (
            <PoolCard key={pool.id} {...pool} />
          ))}
        </div>
      )}
    </section>
  );
};
