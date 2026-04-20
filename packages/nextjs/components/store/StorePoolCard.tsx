"use client";

import React from "react";
import Link from "next/link";

export type StorePoolTheme = "cosmic" | "sakura" | "diamond" | "dragon" | "lantern" | "star" | "crown" | "rainbow";

export type StorePoolBadgeType = "big-prize" | "high-win-rate";

export type StorePoolCardData = {
  id: string;
  name: string;
  image: string;
  theme: StorePoolTheme;
  themeLabel: string;
  themeIcon: string;
  price: string;
  badgeType: StorePoolBadgeType;
  ticketsSold: number;
  totalTickets: number;
};

/* Theme-specific color mappings */
const themeColors: Record<StorePoolTheme, { text: string; border: string }> = {
  cosmic: { text: "text-[#A18EFF]", border: "border-[#A18EFF]/20" },
  sakura: { text: "text-[#A694FF]", border: "border-[#A18EFF]/20" },
  diamond: { text: "text-[#D4D2ED]", border: "border-[#D4D2ED]/20" },
  dragon: { text: "text-[#FF7351]", border: "border-[#FF7351]/20" },
  lantern: { text: "text-ns-primary", border: "border-ns-primary/20" },
  star: { text: "text-[#E2E0FC]", border: "border-[#E2E0FC]/20" },
  crown: { text: "text-[#FFD709]", border: "border-[#FFD709]/20" },
  rainbow: { text: "text-[#A18EFF]", border: "border-[#A18EFF]/20" },
};

export const StorePoolCard = ({
  id,
  name,
  image,
  theme,
  themeLabel,
  themeIcon,
  price,
  badgeType,
  ticketsSold,
  totalTickets,
}: StorePoolCardData) => {
  const progress = Math.round((ticketsSold / totalTickets) * 100);
  const colors = themeColors[theme];

  return (
    <div className="group relative glass-panel rounded-2xl overflow-hidden hover:border-ns-primary/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,215,0,0.08)]">
      {/* Image Section */}
      <div className="h-40 overflow-hidden relative">
        <img
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          src={image}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ns-surface-container-high via-transparent to-transparent" />

        {/* Theme badge */}
        <div className="absolute top-4 left-4">
          <span
            className={`px-3 py-1 bg-ns-surface-container-highest/80 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-tighter ${colors.text} ${colors.border} border`}
          >
            <span className="material-symbols-outlined text-[12px] align-middle mr-1">{themeIcon}</span>
            {themeLabel}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute top-4 right-4 bg-ns-primary text-ns-on-primary font-headline font-bold text-xs px-2 py-1 rounded">
          {price}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-headline text-lg font-bold text-white mb-1">{name}</h3>
            {badgeType === "big-prize" ? (
              <span className="text-[10px] uppercase tracking-widest text-[#FF7351] font-bold">💥 Big Prize</span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-[#7658F8] font-bold">🎯 High Win Rate</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-[10px] mb-1.5 uppercase font-bold tracking-wider text-ns-on-surface-variant">
              <span>Tickets Sold</span>
              <span>
                {ticketsSold.toLocaleString()}/{totalTickets.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full bg-ns-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ns-secondary to-ns-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Purchase Button */}
          <Link
            href={`/purchase/${id}`}
            className="block w-full bg-gradient-to-r from-[#00BCD4] to-[#4DD0E1] text-white font-headline font-bold py-3 rounded-lg uppercase tracking-widest text-xs transition-all hover:shadow-[0_0_20px_rgba(0,188,212,0.4)] active:scale-95 text-center"
          >
            Purchase
          </Link>
        </div>
      </div>
    </div>
  );
};
