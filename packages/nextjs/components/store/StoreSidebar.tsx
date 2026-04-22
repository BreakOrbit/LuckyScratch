"use client";

import React from "react";
import { BuildingLibraryIcon, UserGroupIcon } from "@heroicons/react/24/outline";

type StoreSidebarProps = {
  activeTab: "official" | "community";
  onTabChange: (tab: "official" | "community") => void;
};

export const StoreSidebar = ({ activeTab, onTabChange }: StoreSidebarProps) => {
  return (
    <aside className="h-full w-64 fixed left-0 top-0 hidden lg:flex flex-col py-24 px-4 bg-ns-surface-container-low z-40">
      {/* Vault Header */}
      <div className="px-4 mb-8">
        <h2 className="text-[#FFD700] font-headline uppercase text-xs tracking-[0.2em] mb-1">The Vault</h2>
        <p className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest opacity-60">Celestial Tier</p>
      </div>

      {/* Navigation */}
      <div className="space-y-1 mb-8">
        <button
          onClick={() => onTabChange("official")}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ease-in-out font-medium font-body text-left ${
            activeTab === "official"
              ? "bg-gradient-to-r from-[#00BCD4]/10 to-transparent text-[#00BCD4] border-l-4 border-[#00BCD4]"
              : "text-ns-on-surface-variant hover:bg-ns-surface-container-high hover:text-white"
          }`}
        >
          <BuildingLibraryIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="text-sm">Official Pools</span>
        </button>
        <button
          onClick={() => onTabChange("community")}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 ease-in-out font-medium font-body text-left ${
            activeTab === "community"
              ? "bg-gradient-to-r from-[#00BCD4]/10 to-transparent text-[#00BCD4] border-l-4 border-[#00BCD4]"
              : "text-ns-on-surface-variant hover:bg-ns-surface-container-high hover:text-white"
          }`}
        >
          <UserGroupIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="text-sm">Community Pools</span>
        </button>
      </div>

      {/* Vault Balance */}
      <div className="mt-auto px-4">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-[10px] text-ns-on-surface-variant uppercase mb-2">Vault Balance</p>
          <div className="flex items-end gap-1 mb-4">
            <span className="text-xl font-headline font-bold text-[#00BCD4]">1,420.50</span>
            <span className="text-[10px] text-[#00BCD4] pb-1">GOLD</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
