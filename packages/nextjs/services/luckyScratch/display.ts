import { formatPercentFromBps, formatUsdcFromMicro, fromMicroUsdc } from "./poolMath";
import type { LuckyScratchPool, LuckyScratchTicket } from "./types";

const POOL_THEME_PRESETS = [
  {
    keywords: ["dragon", "flame", "ember"],
    storeTheme: "dragon",
    themeLabel: "Dragon",
    animationType: "dragon",
  },
  {
    keywords: ["sakura", "blossom", "petal"],
    storeTheme: "sakura",
    themeLabel: "Sakura",
    animationType: "sakura",
  },
  {
    keywords: ["diamond", "crystal", "gem"],
    storeTheme: "diamond",
    themeLabel: "Diamond",
    animationType: "diamond",
  },
  {
    keywords: ["lantern", "fortune", "lucky"],
    storeTheme: "lantern",
    themeLabel: "Lantern",
    animationType: "lantern",
  },
  {
    keywords: ["star", "starlight", "astral"],
    storeTheme: "star",
    themeLabel: "Star",
    animationType: "starlight",
  },
  {
    keywords: ["crown", "royal", "king"],
    storeTheme: "crown",
    themeLabel: "Crown",
    animationType: "golden",
  },
  {
    keywords: ["rainbow", "prism", "aurora"],
    storeTheme: "rainbow",
    themeLabel: "Rainbow",
    animationType: "crystal",
  },
  {
    keywords: ["cosmic", "nebula", "space", "void"],
    storeTheme: "cosmic",
    themeLabel: "Cosmic",
    animationType: "cosmic",
  },
];

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const themeSearchText = (pool: LuckyScratchPool) =>
  [pool.themeId, pool.metadata?.themeKey, pool.metadata?.name, pool.metadata?.description, pool.metadata?.themeId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const getPoolDisplayName = (pool: LuckyScratchPool) => pool.metadata?.name?.trim() || `Pool #${pool.poolId}`;

export const getPoolShortCreator = (creator: string, lead = 6, tail = 4) => {
  const normalized = creator.trim();
  if (normalized.length <= lead + tail + 2) {
    return normalized;
  }
  return `${normalized.slice(0, lead)}...${normalized.slice(-tail)}`;
};

export const getPoolVisualProfile = (pool: LuckyScratchPool) => {
  const text = themeSearchText(pool);
  const match =
    POOL_THEME_PRESETS.find(preset => preset.keywords.some(keyword => text.includes(keyword))) || POOL_THEME_PRESETS[7];

  return {
    storeTheme: match.storeTheme,
    themeLabel: match.themeLabel,
    animationType: match.animationType,
  } as const;
};

export const getPoolDisplayImage = (pool: LuckyScratchPool) => {
  const image = pool.metadata?.coverImageUrl || pool.metadata?.ticketArtUrl;
  if (image) {
    return image;
  }

  const name = getPoolDisplayName(pool);
  const profile = getPoolVisualProfile(pool);
  const accent =
    profile.storeTheme === "dragon"
      ? "#FF7351"
      : profile.storeTheme === "crown"
        ? "#FFD709"
        : profile.storeTheme === "diamond"
          ? "#D4D2ED"
          : profile.storeTheme === "sakura"
            ? "#A694FF"
            : "#00BCD4";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0C1323"/>
        <stop offset="100%" stop-color="${accent}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1600" fill="url(#g)"/>
    <circle cx="950" cy="320" r="220" fill="${accent}" opacity="0.22"/>
    <circle cx="280" cy="1280" r="280" fill="#ffffff" opacity="0.08"/>
    <text x="96" y="1280" fill="#ffffff" font-family="Arial, sans-serif" font-size="112" font-weight="700">${name
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const getPoolRarity = (pool: LuckyScratchPool) => {
  const maxPrizeUsdc = fromMicroUsdc(pool.maxPrize);
  if (maxPrizeUsdc >= 400) {
    return "Legendary" as const;
  }
  if (maxPrizeUsdc >= 150) {
    return "Super Rare" as const;
  }
  if (maxPrizeUsdc >= 50) {
    return "Rare" as const;
  }
  return "Common" as const;
};

export const formatPoolPriceLabel = (pool: LuckyScratchPool) => `${formatUsdcFromMicro(pool.ticketPrice)} USDC`;

export const formatPoolPriceCompactLabel = (pool: LuckyScratchPool) => `${formatUsdcFromMicro(pool.ticketPrice)}U`;

export const formatPoolWinRateLabel = (pool: LuckyScratchPool) => `${formatPercentFromBps(pool.hitRateBps)}%`;

export const formatPoolRtpLabel = (pool: LuckyScratchPool) => `${formatPercentFromBps(pool.targetRtpBps)}%`;

export const formatPoolMaxPrizeLabel = (pool: LuckyScratchPool) => `${formatUsdcFromMicro(pool.maxPrize)}U`;

export const formatCompactMicroUsdc = (value?: number | bigint | null) => {
  const usdc = fromMicroUsdc(value);
  if (usdc === 0) {
    return "0";
  }
  return compactCurrencyFormatter.format(usdc);
};

export const formatCompactCount = (value?: number | null) => compactNumberFormatter.format(value ?? 0);

export const sortPoolsByRevenue = (pools: LuckyScratchPool[]) =>
  [...pools].sort((left, right) => right.realizedRevenue - left.realizedRevenue || right.poolId - left.poolId);

export const getPoolTicketSales = (pool: LuckyScratchPool) => pool.currentRoundState?.soldCount ?? 0;

export const getRecentWinLabel = (ticket: LuckyScratchTicket, poolName?: string) => {
  const claimer = getPoolShortCreator(ticket.claimedBy || ticket.owner);
  const amount = `${formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC`;
  return `${claimer} won ${amount}${poolName ? ` in ${poolName}` : ""}`;
};

export const getAddressAvatarGradient = (address: string) => {
  const hue = hashString(address) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 42) % 360} 72% 44%))`;
};

export const getAddressBadgeText = (address: string) => getPoolShortCreator(address, 4, 2).replace("...", "");
