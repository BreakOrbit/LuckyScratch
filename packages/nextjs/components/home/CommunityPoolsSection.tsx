"use client";

import Link from "next/link";
import { useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import {
  formatPoolMaxPrizeLabel,
  formatPoolPriceLabel,
  formatPoolRtpLabel,
  getPoolDisplayImage,
  getPoolDisplayName,
  sortPoolsByRevenue,
} from "~~/services/luckyScratch/display";

type CommunityPoolData = {
  id: string;
  name: string;
  image: string;
  returnRate: string;
  maxPrize: string;
  price: string;
};

const CommunityPoolCard = ({ id, name, image, returnRate, maxPrize, price }: CommunityPoolData) => (
  <div className="bg-ns-surface-container-low group relative rounded-lg overflow-hidden border border-white/5 hover:border-ns-secondary/20 transition-all">
    <div className="aspect-[3/4] overflow-hidden relative">
      <img
        alt={`Community Pool '${name}'`}
        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 saturate-50"
        src={image}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ns-surface-container-low via-transparent to-transparent" />
      <div className="absolute top-4 right-4 bg-ns-surface-container-high px-3 py-1 text-ns-secondary font-label text-[10px] font-black uppercase">
        LIVE COMMUNITY
      </div>
    </div>
    <div className="p-6">
      <h3 className="font-headline font-bold text-xl text-ns-on-surface mb-1 uppercase">{name}</h3>
      <div className="flex justify-between items-center mb-6">
        <span className="text-ns-on-surface-variant text-sm font-body">{returnRate} RTP</span>
        <span className="text-ns-primary font-headline font-bold">Max {maxPrize}</span>
      </div>
      <Link
        href={`/purchase/${id}`}
        className="block w-full rounded-sm border border-ns-secondary/20 bg-ns-surface-container-high py-3 text-center font-headline font-bold uppercase tracking-widest text-ns-on-surface transition-all group-hover:bg-ns-secondary group-hover:text-white"
      >
        Purchase ({price})
      </Link>
    </div>
  </div>
);

export const CommunityPoolsSection = () => {
  const { data, isLoading } = useLuckyScratchPools();

  const communityPools = sortPoolsByRevenue(
    (data?.items ?? []).filter(pool => !pool.protocolOwned && pool.status !== "Closed" && !pool.paused),
  )
    .slice(0, 4)
    .map(pool => ({
      id: String(pool.poolId),
      name: getPoolDisplayName(pool),
      image: getPoolDisplayImage(pool),
      returnRate: formatPoolRtpLabel(pool),
      maxPrize: formatPoolMaxPrizeLabel(pool),
      price: formatPoolPriceLabel(pool),
    }));

  return (
    <section id="community-pools" className="max-w-7xl mx-auto px-8 py-32 border-t border-ns-outline-variant/10">
      <div className="flex justify-between items-end mb-16 gap-6">
        <div>
          <h2 className="font-headline font-black text-4xl uppercase tracking-tight text-ns-on-surface mb-2">
            Community Pools
          </h2>
          <p className="text-ns-on-surface-variant font-body">
            Creator-launched pools, ranked by current realized sales and fetched directly from the backend index.
          </p>
        </div>
        <Link
          href="/store"
          className="text-ns-secondary font-label uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all"
        >
          View Community Pools <span className="material-symbols-outlined">trending_flat</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">Loading community pools.</div>
      ) : communityPools.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">
          No community pools are currently available.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {communityPools.map(pool => (
            <CommunityPoolCard key={pool.id} {...pool} />
          ))}
        </div>
      )}
    </section>
  );
};
