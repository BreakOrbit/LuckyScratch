const STORAGE_KEY = "lucky-scratch:decrypted-rewards";

type CachedReward = {
  clearRewardAmount: number;
  decryptionProof?: string;
  cachedAt: number;
  contractAddress?: string;
  owner?: string;
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

type TicketRewardCacheScope = {
  contractAddress?: string;
  owner?: string;
};

const normalizeScopeValue = (value?: string) => value?.toLowerCase();

const cacheKey = (chainId: number, ticketId: number, scope?: TicketRewardCacheScope) => {
  const contractAddress = normalizeScopeValue(scope?.contractAddress);
  const owner = normalizeScopeValue(scope?.owner);
  if (contractAddress && owner) {
    return `${chainId}:${contractAddress}:${owner}:${ticketId}`;
  }
  if (contractAddress) {
    return `${chainId}:${contractAddress}:${ticketId}`;
  }
  return `${chainId}:${ticketId}`;
};

const buildCacheEntry = (
  clearRewardAmount: number,
  decryptionProof: string | undefined,
  cachedAt: number,
  scope?: TicketRewardCacheScope,
): CachedReward => ({
  clearRewardAmount,
  decryptionProof,
  cachedAt,
  contractAddress: normalizeScopeValue(scope?.contractAddress),
  owner: normalizeScopeValue(scope?.owner),
});

export const ticketRewardCache = {
  get(chainId: number, ticketId: number, scope?: TicketRewardCacheScope): CachedReward | undefined {
    const cache = readCache();
    const entry = cache[cacheKey(chainId, ticketId, scope)];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
    return entry;
  },

  set(
    chainId: number,
    ticketId: number,
    clearRewardAmount: number,
    decryptionProof?: string,
    scope?: TicketRewardCacheScope,
  ) {
    const cache = readCache();
    cache[cacheKey(chainId, ticketId, scope)] = buildCacheEntry(clearRewardAmount, decryptionProof, Date.now(), scope);
    writeCache(cache);
  },

  setBatch(
    chainId: number,
    entries: { ticketId: number; clearRewardAmount: number; decryptionProof?: string }[],
    scope?: TicketRewardCacheScope,
  ) {
    const cache = readCache();
    const now = Date.now();
    for (const entry of entries) {
      cache[cacheKey(chainId, entry.ticketId, scope)] = buildCacheEntry(
        entry.clearRewardAmount,
        entry.decryptionProof,
        now,
        scope,
      );
    }
    writeCache(cache);
  },

  remove(chainId: number, ticketId: number, scope?: TicketRewardCacheScope) {
    const cache = readCache();
    delete cache[cacheKey(chainId, ticketId, scope)];
    writeCache(cache);
  },
};
