"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { BuildingLibraryIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { StoreBottomNav } from "~~/components/store/StoreBottomNav";
import { StoreFilterBar } from "~~/components/store/StoreFilterBar";
import type { StoreSortOption } from "~~/components/store/StoreFilterBar";
import { StorePagination } from "~~/components/store/StorePagination";
import { StorePoolCard } from "~~/components/store/StorePoolCard";
import type { StorePoolBadgeType, StorePoolCardData, StorePoolTheme } from "~~/components/store/StorePoolCard";
import { StoreSidebar } from "~~/components/store/StoreSidebar";
import { useLuckyScratchPlatformOverview, useLuckyScratchPools } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import {
  formatCompactMicroUsdc,
  formatPoolPriceCompactLabel,
  getPoolDisplayImage,
  getPoolDisplayName,
  getPoolTicketSales,
  getPoolVisualProfile,
} from "~~/services/luckyScratch/display";
import { fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchPool } from "~~/services/luckyScratch/types";

const ITEMS_PER_PAGE = 8;

type StoreTab = "official" | "community";

const isStoreVisible = (pool: LuckyScratchPool) => pool.status !== "Closed" && !pool.paused;

const toStoreCard = (pool: LuckyScratchPool): StorePoolCardData => {
  const profile = getPoolVisualProfile(pool);
  const badgeType: StorePoolBadgeType = pool.hitRateBps >= 3_500 ? "high-win-rate" : "big-prize";

  return {
    id: String(pool.poolId),
    name: getPoolDisplayName(pool),
    image: getPoolDisplayImage(pool),
    theme: profile.storeTheme as StorePoolTheme,
    themeLabel: profile.themeLabel,
    price: formatPoolPriceCompactLabel(pool),
    badgeType,
    ticketsSold: getPoolTicketSales(pool),
    totalTickets: pool.currentRoundState?.totalTickets ?? pool.totalTicketsPerRound,
  };
};

const sortPools = (pools: LuckyScratchPool[], sort: StoreSortOption) => {
  const items = [...pools];

  switch (sort) {
    case "popular":
      return items.sort(
        (left, right) =>
          getPoolTicketSales(right) - getPoolTicketSales(left) || right.realizedRevenue - left.realizedRevenue,
      );
    case "price":
      return items.sort((left, right) => left.ticketPrice - right.ticketPrice || right.poolId - left.poolId);
    case "winrate":
      return items.sort((left, right) => right.hitRateBps - left.hitRateBps || right.poolId - left.poolId);
    case "latest":
    default:
      return items.sort((left, right) => right.poolId - left.poolId);
  }
};

const StorePage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<StoreTab>("official");
  const [activeSort, setActiveSort] = useState<StoreSortOption>("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const { data: poolsData, isLoading: poolsLoading } = useLuckyScratchPools();
  const { data: overview } = useLuckyScratchPlatformOverview();

  const minPriceValue = minPrice === "" ? null : Number(minPrice);
  const maxPriceValue = maxPrice === "" ? null : Number(maxPrice);

  const filteredPools = useMemo(() => {
    const pools = poolsData?.items.filter(isStoreVisible) ?? [];
    return pools.filter(pool => {
      if (activeTab === "official" ? !pool.protocolOwned : pool.protocolOwned) {
        return false;
      }

      const ticketPrice = fromMicroUsdc(pool.ticketPrice);
      if (minPriceValue != null && !Number.isNaN(minPriceValue) && ticketPrice < minPriceValue) {
        return false;
      }
      if (maxPriceValue != null && !Number.isNaN(maxPriceValue) && ticketPrice > maxPriceValue) {
        return false;
      }
      return true;
    });
  }, [activeTab, maxPriceValue, minPriceValue, poolsData?.items]);

  const sortedPools = useMemo(() => sortPools(filteredPools, activeSort), [activeSort, filteredPools]);

  const totalPages = Math.max(1, Math.ceil(sortedPools.length / ITEMS_PER_PAGE));
  const paginatedPools = sortedPools
    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    .map(toStoreCard);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSort, activeTab, maxPrice, minPrice]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summaryValue = overview ? formatCompactMicroUsdc(overview.totalRealizedRevenue) : "--";
  const summaryHint = overview ? `${overview.activePools} live pools indexed` : "Waiting for backend sync";

  return (
    <div className="bg-ns-background text-ns-on-surface font-body selection:bg-ns-primary selection:text-ns-primary-container min-h-screen">
      <StoreSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        summaryLabel="Platform Sales"
        summaryValue={summaryValue}
        summarySuffix="USDC"
        summaryHint={summaryHint}
      />

      <div className="lg:ml-64 pb-20 px-6">
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-ns-secondary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-ns-primary/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="font-headline text-4xl font-bold tracking-tight mb-2 text-white drop-shadow-[0_0_10px_rgba(255,231,146,0.3)]">
                Lottery Store
              </h1>
              <p className="text-ns-on-surface-variant max-w-md text-sm">
                Browse live pools sourced from the LuckyScratch backend read model and current onchain accounting.
              </p>
            </div>

            <div className="bg-ns-surface-container-low p-1.5 rounded-xl border border-ns-outline-variant/15 flex gap-1">
              <button
                onClick={() => setActiveTab("official")}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "official"
                    ? "bg-ns-surface-container-highest text-[#00BCD4]"
                    : "text-ns-on-surface-variant hover:text-white"
                }`}
              >
                <BuildingLibraryIcon aria-hidden="true" className="h-4 w-4" />
                Official Pools
              </button>
              <button
                onClick={() => setActiveTab("community")}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "community"
                    ? "bg-ns-surface-container-highest text-[#00BCD4]"
                    : "text-ns-on-surface-variant hover:text-white"
                }`}
              >
                <UserGroupIcon aria-hidden="true" className="h-4 w-4" />
                Community Pools
              </button>
            </div>
          </div>

          <StoreFilterBar
            activeSort={activeSort}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onSortChange={setActiveSort}
            onMinPriceChange={setMinPrice}
            onMaxPriceChange={setMaxPrice}
          />

          {poolsLoading ? (
            <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">
              Loading live pool inventory from the backend read model.
            </div>
          ) : paginatedPools.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-sm text-ns-on-surface-variant">
              No {activeTab} pools are currently available for purchase.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {paginatedPools.map(pool => (
                <StorePoolCard key={pool.id} {...pool} />
              ))}
            </div>
          )}

          <StorePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      <StoreBottomNav />
    </div>
  );
};

export default StorePage;
