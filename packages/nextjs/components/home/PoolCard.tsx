"use client";

import React from "react";
import Link from "next/link";
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";

export type PoolRarity = "Common" | "Rare" | "Super Rare" | "Legendary";
export type PoolAnimationType =
  | "lantern"
  | "crystal"
  | "sakura"
  | "starlight"
  | "dragon"
  | "diamond"
  | "golden"
  | "cosmic";

export type PoolCardData = {
  id: string;
  name: string;
  image: string;
  rarity: PoolRarity;
  price: string;
  winRate: string;
  maxPrize: string;
  animationType: PoolAnimationType;
  hiddenOnMobile?: boolean;
};

const rarityBadgeStyles: Record<PoolRarity, string> = {
  Common: "bg-ns-surface-container-high text-ns-on-surface-variant",
  Rare: "bg-ns-secondary/80 text-white",
  "Super Rare": "bg-ns-secondary text-white",
  Legendary: "bg-ns-primary text-ns-background",
};

/* Card border/glow style per rarity */
const rarityCardStyles: Record<PoolRarity, string> = {
  Common: "border border-white/5 hover:border-ns-primary/30",
  Rare: "border border-white/5 hover:border-ns-secondary/30",
  "Super Rare": "border border-white/5 hover:border-ns-secondary/30",
  Legendary: "border border-ns-primary/20 hover:border-ns-primary purple-glow",
};

/* Button style per rarity */
const rarityButtonStyles: Record<PoolRarity, string> = {
  Common:
    "bg-ns-surface-container-high border border-ns-primary/20 text-ns-on-surface group-hover:bg-ns-primary group-hover:text-ns-background",
  Rare: "bg-ns-surface-container-high border border-ns-secondary/20 text-ns-on-surface group-hover:bg-ns-secondary group-hover:text-white",
  "Super Rare":
    "bg-ns-surface-container-high border border-ns-secondary/20 text-ns-on-surface group-hover:bg-ns-secondary group-hover:text-white",
  Legendary: "bg-gradient-to-r from-ns-primary to-[#B8860B] text-ns-background",
};

/* ---------- Animation Overlays ---------- */

const LanternOverlay = () => (
  <div className="animated-overlay">
    <div
      className="absolute top-[20%] left-[15%] w-8 h-10 bg-red-600/40 rounded-sm blur-[1px]"
      style={{ animation: "float-lantern 4s ease-in-out infinite" }}
    />
    <div
      className="particle w-1 h-1 bg-ns-primary"
      style={{ left: "30%", top: "70%", animation: "drift-sparkle 3s linear infinite" }}
    />
  </div>
);

const CrystalOverlay = () => (
  <div className="animated-overlay">
    <div
      className="absolute inset-0 bg-gradient-to-tr from-ns-secondary/10 via-ns-primary/10 to-ns-secondary/10 mix-blend-overlay"
      style={{ animation: "shimmer-crystal 3s infinite" }}
    />
  </div>
);

const SakuraOverlay = () => (
  <div className="animated-overlay">
    <div
      className="particle w-2 h-2 bg-ns-secondary rounded-sm opacity-60"
      style={{ left: "20%", top: "-5%", animation: "fall-sakura 7s linear infinite" }}
    />
  </div>
);

const StarlightOverlay = () => (
  <div className="animated-overlay">
    <div className="particle w-1 h-1 bg-white" style={{ left: "15%", top: "20%", animation: "twinkle 3s infinite" }} />
    <div
      className="absolute w-[100px] h-[1px] bg-gradient-to-r from-ns-primary to-transparent"
      style={{ animation: "shooting-star 6s linear infinite 1s" }}
    />
  </div>
);

const DragonOverlay = () => (
  <div className="animated-overlay">
    <div
      className="particle w-1 h-1 bg-ns-primary blur-[1px]"
      style={{ left: "30%", bottom: "10%", animation: "ember-rise 4s linear infinite" }}
    />
  </div>
);

const DiamondOverlay = () => (
  <div className="animated-overlay">
    <div
      className="absolute top-[40%] left-[60%] w-4 h-4 bg-white"
      style={{
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
        animation: "glint 3s infinite 1s",
      }}
    />
  </div>
);

const GoldenOverlay = () => (
  <div className="animated-overlay">
    <div
      className="particle w-1 h-3 bg-ns-primary/80"
      style={{ left: "10%", top: "-10%", animation: "gold-rain 3s linear infinite" }}
    />
    <div
      className="absolute top-[40%] left-1/2 -translate-x-1/2 w-32 h-32 rounded-full"
      style={{ animation: "aura-pulse 3s infinite" }}
    />
  </div>
);

const CosmicOverlay = () => (
  <div className="animated-overlay">
    <div
      className="absolute top-1/4 left-1/4 w-[200px] h-[200px] bg-ns-secondary/10 blur-[60px] rounded-full"
      style={{ animation: "nebula-swirl 20s linear infinite" }}
    />
    <div className="particle w-1 h-1 bg-white" style={{ left: "20%", top: "30%", animation: "twinkle 4s infinite" }} />
  </div>
);

const overlayMap: Record<PoolAnimationType, React.FC> = {
  lantern: LanternOverlay,
  crystal: CrystalOverlay,
  sakura: SakuraOverlay,
  starlight: StarlightOverlay,
  dragon: DragonOverlay,
  diamond: DiamondOverlay,
  golden: GoldenOverlay,
  cosmic: CosmicOverlay,
};

export const PoolCard = ({
  id,
  name,
  image,
  rarity,
  price,
  winRate,
  maxPrize,
  animationType,
  hiddenOnMobile,
}: PoolCardData) => {
  const AnimOverlay = overlayMap[animationType];
  const badgeClasses = rarityBadgeStyles[rarity];
  const cardClasses = rarityCardStyles[rarity];
  const buttonClasses = rarityButtonStyles[rarity];
  const isDragon = animationType === "dragon";

  return (
    <div
      className={`bg-ns-surface-container-low group relative rounded-lg overflow-hidden transition-all ${cardClasses} ${hiddenOnMobile ? "lg:flex flex-col hidden" : ""}`}
    >
      <div className={POOL_COVER_FRAME_CLASS}>
        <img
          alt={`Theme Pool '${name}'`}
          className={`${POOL_COVER_IMAGE_CLASS} transition-all duration-500 ${rarity === "Common" ? "saturate-[0.8]" : ""}`}
          src={image}
          style={isDragon ? { animation: "dragon-breath 5s ease-in-out infinite" } : undefined}
        />
        <AnimOverlay />
        <div className="absolute inset-0 bg-gradient-to-t from-ns-surface-container-low via-transparent to-transparent" />
        <div className={`absolute top-4 right-4 px-3 py-1 font-label text-[10px] font-black uppercase ${badgeClasses}`}>
          {rarity}
        </div>
      </div>
      <div className="p-6">
        <h3 className="font-headline font-bold text-xl text-ns-on-surface mb-1 uppercase">{name}</h3>
        <div className="flex justify-between items-center mb-6">
          <span className="text-ns-on-surface-variant text-sm font-body">{winRate} Win Rate</span>
          <span className="text-ns-primary font-headline font-bold">Max {maxPrize}</span>
        </div>
        <Link
          href={`/purchase/${id}`}
          className={`block w-full py-3 text-center font-headline font-bold uppercase tracking-widest transition-all rounded-sm ${buttonClasses}`}
        >
          Purchase ({price})
        </Link>
      </div>
    </div>
  );
};
