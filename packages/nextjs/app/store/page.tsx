"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { BuildingLibraryIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { StoreBottomNav } from "~~/components/store/StoreBottomNav";
import { StoreFilterBar } from "~~/components/store/StoreFilterBar";
import { StorePagination } from "~~/components/store/StorePagination";
import { StorePoolCard } from "~~/components/store/StorePoolCard";
import type { StorePoolCardData } from "~~/components/store/StorePoolCard";
import { StoreSidebar } from "~~/components/store/StoreSidebar";

/* ─── Demo Pool Data ─── */
const DEMO_POOLS: StorePoolCardData[] = [
  {
    id: "cosmic-nebula",
    name: "Cosmic Nebula",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCUC7drvZI5-QEJzMgM_pFf_uBTrwaeqxH4mkzJ4ZykOmYUncJdMx5RAWG9twwwvWuH6hsKptVhCXwL5S3nHJm9iljxftx7NBHJ6Gxi9M0y5FgKRxGsZ_YNV-R86a5cSH19iYBz6fS7eUzoEz-iLY3pQ7AjMG1UHQpDWNMNafsSrx0DilcQihxdw9lfy7I7G2e1j3CfM5jermN85mG05HckYH4wYQXpz3JRdiH9qK7kl1T0TCzp1ErgBDaeqeg6ZdgDKE_9x8z54QQ",
    theme: "cosmic",
    themeLabel: "Cosmic",
    price: "2U",
    badgeType: "big-prize",
    ticketsSold: 8400,
    totalTickets: 10000,
  },
  {
    id: "zen-fortune",
    name: "Zen Fortune",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA0vwXivzl9kAPMqyD6rpK8UWjbzjwCBXuXMy_nsmpeUSvBjSjddNV4cd8lbfSHP9VJEz7t-Hn8jyv0_sMEgK-y1iAA5bCMGKIR7hcQst8iPsYDiievQtCJ7gzypwdI_rfi4CJNDQND1BwpfTSPtLrrfcvKIpb3Z8Ffz2XY-yhOTGB6CvqIvhZfntIc2pYPb7ChjKhIBJjMzVdlUEfW5VgOmnTbdGMN0Ng5L0vpjzVxHsnkXSC0Vuq6PWrqaj5S5expbAt6GCX-Gbs",
    theme: "sakura",
    themeLabel: "Sakura",
    price: "5U",
    badgeType: "high-win-rate",
    ticketsSold: 2100,
    totalTickets: 5000,
  },
  {
    id: "heirloom-vault",
    name: "Heirloom Vault",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD1sEvarwQ2ciFIotj5t5325PyYtCEOXgEG0wrTlENvY3klI_ov9V6D8Qk7rsb3Om140RzIU67NCWvmazWyVnEHtaZox0j4DkbBMNR8JRjtJ3UfLcC8jLKckiF_B_ANRBlygFO0QoD7hg7vHHmdfZwxi_M6ZAzix4-1BDs5ceHASegkxjuU001qI75Bk2ZqvkZDiGoSqUqEIgSSyqK8bI9JE4l-Vs31gWit9yaTzNa1PQhDqSCeWboa8KmaFMlkp-AHXMTbrJmaKfY",
    theme: "diamond",
    themeLabel: "Diamond",
    price: "10U",
    badgeType: "big-prize",
    ticketsSold: 450,
    totalTickets: 1000,
  },
  {
    id: "flame-fortune",
    name: "Flame of Fortune",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDm81VlH9DG-VXbupInP72dCUx3Tj_mWF2eDHEg3QtaK_VI7wrnwHRYuv3wtQ1ME25sWIDWLib-c2R2KFKu_WoGuxp0hDDeC9jIB3tVbu9Z_ZrpX5KhTaFIrgVscn20SZGheJkY1oZ2A_g19b-Le3spvKOnbomTHB_w9lDCiMlSWwBA5u_y6t27SU_PyWtWXsRQ83q7vjwAglZT6lY6XlPSuQw9F1VEoWG6t075unx-eKkIStet2T3452eC-V17JfYQAoP6gujbF-c",
    theme: "dragon",
    themeLabel: "Dragon",
    price: "2U",
    badgeType: "high-win-rate",
    ticketsSold: 9800,
    totalTickets: 10000,
  },
  {
    id: "spirit-guide",
    name: "Spirit Guide",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCjkjtSLpwvGAdIJQh4wfnjWErkLMphDU07A0S2hV6v0ndy4c1HpAJzgm6pG5Vc-XNCXKp_pvGeoRUMMKoTfKYiX9vnTQLLoZlG1ODWhHlk7ExpHYWd1KqqPYQQC_cv8OK5O_5QUrJKNkanzaq_KL8DCDYO9Xrufm3hrn9NgiGXYAicc83MclfAotxu3i2pBx7WsxdwzJ4XXj4ZaZt8YityOiBGvaCJ7KkRckp9RPTQm7nnRjdczQ_nF0lvqfyVKP9sbS9VZzYxziI",
    theme: "lantern",
    themeLabel: "Lantern",
    price: "2U",
    badgeType: "high-win-rate",
    ticketsSold: 4200,
    totalTickets: 10000,
  },
  {
    id: "starlight-path",
    name: "Starlight Path",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDVz9XgOT9svMd_pKUadePlbx4Sxj8f59dv6F9iu8f4dIjw1tRBodL9ON2xXcwBvPav9V9zaKiOUZ6dmooHskM2jOgWIuKViCc7-ZDQ6qKfChFcmmlf3RJxARDVRJ-aG_inERHEFnGXhMShserP5B-hKGZw_hi547YCblwdNhCCQdvX-HKcu31B5aToMu_Vo-gLLAf4UaXYoUnS47bB1WYyLqiy_znGc34s5zwzRKqZaY9zAi8UAFrekS4V5jo7_Te0-e-Xh8C52Hc",
    theme: "star",
    themeLabel: "Star",
    price: "5U",
    badgeType: "big-prize",
    ticketsSold: 1200,
    totalTickets: 5000,
  },
  {
    id: "royal-jackpot",
    name: "Royal Jackpot",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGZ5z2cin_07HZTEwsjImO0Vs-Ehz2CpqqL7IpE0ONeyE_MEObBoGMVrMLUf2HDbtBtVHhxlntbRtkLSXthUgdPhf5GXkhebTvD7OZmnKtArU1QfURQkH61KRqN4j195CkI-TYeOho0cUxOJks_1fYizgF2qpv9o1ERdcoJqukMvyqH02vM4QvBBehXemMTbcjGAn90Jek0QcMkQV2Fo5E9VX6izSpBnkOiRdT87edqPLtr5KgL0celD4vhjQ-glVLUYjV9n_r8wo",
    theme: "crown",
    themeLabel: "Crown",
    price: "20U",
    badgeType: "big-prize",
    ticketsSold: 210,
    totalTickets: 500,
  },
  {
    id: "rainbow-prism",
    name: "Rainbow Prism",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCymZqasDuSTYmb64z2s1KjGyscNsgXc92dZakY8nXzPr2RJi77Sdu3tszvEPYxVwhs4pZpTgNxJN9UL-X2VRnDzMUqGtIA6nLA63_NUxQj5uzkrS6W_1HVylo6xTOzp2xg0K1Xc4v3nokz07FzvTgOXvbn-NagzWwIK--G--zOZl28Ne3UMhnfpNDe9Kizc1OAzMbU-wqyHHCc41XB9fQGRHodYwdz95vp5Wi7WxHH46zSnlapQq5VkawyCMcjwCWc6X8ipz517-Q",
    theme: "rainbow",
    themeLabel: "Rainbow",
    price: "5U",
    badgeType: "high-win-rate",
    ticketsSold: 3500,
    totalTickets: 5000,
  },
];

const ITEMS_PER_PAGE = 4;

const StorePage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<"official" | "community">("official");
  const [activeSort, setActiveSort] = useState<"latest" | "popular" | "winrate" | "price">("latest");
  const [currentPage, setCurrentPage] = useState(1);

  const sortedPools = useMemo(() => {
    const pools = [...DEMO_POOLS];

    switch (activeSort) {
      case "popular":
        return pools.sort((a, b) => b.ticketsSold - a.ticketsSold);
      case "price":
        return pools.sort((a, b) => Number.parseInt(a.price, 10) - Number.parseInt(b.price, 10));
      case "winrate":
        return pools.sort((a, b) => {
          const aProgress = a.ticketsSold / a.totalTickets;
          const bProgress = b.ticketsSold / b.totalTickets;
          return aProgress - bProgress;
        });
      case "latest":
      default:
        return pools;
    }
  }, [activeSort]);

  const totalPages = Math.ceil(sortedPools.length / ITEMS_PER_PAGE);
  const paginatedPools = sortedPools.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSort, activeTab]);

  return (
    <div className="bg-ns-background text-ns-on-surface font-body selection:bg-ns-primary selection:text-ns-primary-container min-h-screen">
      {/* Sidebar — desktop only */}
      <StoreSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="lg:ml-64 pb-20 px-6">
        {/* Background Cosmic Accents */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-ns-secondary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-ns-primary/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header & Tabs */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="font-headline text-4xl font-bold tracking-tight mb-2 text-white drop-shadow-[0_0_10px_rgba(255,231,146,0.3)]">
                Lottery Store
              </h1>
              <p className="text-ns-on-surface-variant max-w-md text-sm">
                Experience the thrill of the celestial vault. Choose your path to fortune through curated official
                pools.
              </p>
            </div>

            {/* Tab Switcher */}
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

          {/* Filter Bar */}
          <StoreFilterBar activeSort={activeSort} onSortChange={setActiveSort} />

          {/* Pool Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {paginatedPools.map(pool => (
              <StorePoolCard key={pool.id} {...pool} />
            ))}
          </div>

          <StorePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <StoreBottomNav />
    </div>
  );
};

export default StorePage;
