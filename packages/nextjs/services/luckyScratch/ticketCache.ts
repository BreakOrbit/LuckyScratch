const STORAGE_KEY = "lucky-scratch:decrypted-rewards";

type CachedReward = {
  clearRewardAmount: number;
  decryptionProof: string;
  cachedAt: number;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const readCache = (): Record<string, CachedReward> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CachedReward>;
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, CachedReward>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — ignore
  }
};

const cacheKey = (chainId: number, ticketId: number) => `${chainId}:${ticketId}`;

export const ticketRewardCache = {
  get(chainId: number, ticketId: number): CachedReward | undefined {
    const cache = readCache();
    const entry = cache[cacheKey(chainId, ticketId)];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
    return entry;
  },

  set(chainId: number, ticketId: number, clearRewardAmount: number, decryptionProof: string) {
    const cache = readCache();
    cache[cacheKey(chainId, ticketId)] = { clearRewardAmount, decryptionProof, cachedAt: Date.now() };
    writeCache(cache);
  },

  setBatch(chainId: number, entries: { ticketId: number; clearRewardAmount: number; decryptionProof: string }[]) {
    const cache = readCache();
    const now = Date.now();
    for (const entry of entries) {
      cache[cacheKey(chainId, entry.ticketId)] = {
        clearRewardAmount: entry.clearRewardAmount,
        decryptionProof: entry.decryptionProof,
        cachedAt: now,
      };
    }
    writeCache(cache);
  },

  remove(chainId: number, ticketId: number) {
    const cache = readCache();
    delete cache[cacheKey(chainId, ticketId)];
    writeCache(cache);
  },
};
