import { getLuckyScratchBackendBaseURL, resolveLuckyScratchIPFSURL } from "./config";
import type {
  ClaimPrecheckResponse,
  CreatePoolDraftInput,
  FinalizePoolInput,
  LuckyScratchCreatorSummary,
  LuckyScratchHealth,
  LuckyScratchPlatformOverview,
  LuckyScratchPlayerLeaderboardResponse,
  LuckyScratchPool,
  LuckyScratchPoolMetadata,
  LuckyScratchPoolMetadataDocument,
  LuckyScratchPoolRound,
  LuckyScratchPoolsResponse,
  LuckyScratchPurchaseContext,
  LuckyScratchTicket,
  PoolDraft,
  PrizeTierPreview,
  RecentWinsResponse,
  RevealAuthResponse,
  UploadedImageAsset,
  UserTicketsResponse,
  UserWinsResponse,
} from "./types";

const MICRO_USDC = 1_000_000;

type APIErrorPayload = {
  error?: string;
  message?: string;
};

export type ListUserTicketsParams = {
  limit?: number;
  offset?: number;
  view?: "all" | "unrevealed" | "revealed" | "winning" | "to-claim";
  poolId?: number;
};

const parseErrorMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as APIErrorPayload;
    return payload.error || payload.message || `LuckyScratch API request failed with ${response.status}`;
  }

  const text = await response.text();
  return text || `LuckyScratch API request failed with ${response.status}`;
};

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${getLuckyScratchBackendBaseURL()}${path}`, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response;
};

const requestJSON = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await request(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  return (await response.json()) as T;
};

const numberFromUnknown = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizePrizeTiers = (value: unknown): PrizeTierPreview[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(tier => {
      if (!tier || typeof tier !== "object") {
        return null;
      }

      const record = tier as Record<string, unknown>;
      const count = numberFromUnknown(record.count ?? record.quantity);
      const prizeAmountUsdc = numberFromUnknown(record.prizeAmountUsdc ?? record.amountUsdc ?? record.amount);
      const prizeAmount =
        numberFromUnknown(record.prizeAmount) ??
        (prizeAmountUsdc != null ? Math.round(prizeAmountUsdc * MICRO_USDC) : undefined);

      if (count == null || prizeAmount == null || count <= 0 || prizeAmount < 0) {
        return null;
      }

      return {
        prizeAmount,
        count,
        ...(prizeAmountUsdc != null ? { prizeAmountUsdc } : {}),
      };
    })
    .filter((tier): tier is PrizeTierPreview => tier != null);
};

const normalizePoolMetadata = (
  metadata?: LuckyScratchPoolMetadata | null,
): LuckyScratchPoolMetadata | null | undefined => {
  if (!metadata) {
    return metadata;
  }

  return {
    ...metadata,
    metadataGatewayUrl: resolveLuckyScratchIPFSURL(metadata.metadataGatewayUrl) || metadata.metadataGatewayUrl,
    coverImageUrl: resolveLuckyScratchIPFSURL(metadata.coverImageUrl) || metadata.coverImageUrl,
    ticketArtUrl: resolveLuckyScratchIPFSURL(metadata.ticketArtUrl) || metadata.ticketArtUrl,
    prizeTiers: metadata.prizeTiers ? normalizePrizeTiers(metadata.prizeTiers) : undefined,
  };
};

const normalizePoolMetadataDocument = (payload: unknown): LuckyScratchPoolMetadataDocument => {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    prizeTiers: normalizePrizeTiers(record.prizeTiers),
  };
};

const normalizePool = (pool: LuckyScratchPool): LuckyScratchPool => ({
  ...pool,
  metadata: normalizePoolMetadata(pool.metadata),
});

const normalizePoolsResponse = (response: LuckyScratchPoolsResponse): LuckyScratchPoolsResponse => ({
  ...response,
  items: response.items.map(normalizePool),
});

const normalizePurchaseContext = (response: LuckyScratchPurchaseContext): LuckyScratchPurchaseContext => ({
  ...response,
  pool: normalizePool(response.pool),
});

const normalizeUploadedImageAsset = (asset: UploadedImageAsset): UploadedImageAsset => ({
  ...asset,
  gatewayUrl: resolveLuckyScratchIPFSURL(asset.gatewayUrl) || asset.gatewayUrl,
});

const normalizePoolDraft = (draft: PoolDraft): PoolDraft => ({
  ...draft,
  metadataGatewayUrl: resolveLuckyScratchIPFSURL(draft.metadataGatewayUrl) || draft.metadataGatewayUrl,
});

export const luckyScratchAPI = {
  getHealth: () => requestJSON<LuckyScratchHealth>(`/healthz`),
  getTicket: (ticketId: string) => requestJSON<LuckyScratchTicket>(`/api/v1/tickets/${ticketId}`),
  listUserTickets: (address: string, params?: ListUserTicketsParams) => {
    const search = new URLSearchParams();
    search.set("limit", String(params?.limit ?? 50));
    search.set("offset", String(params?.offset ?? 0));
    if (params?.view && params.view !== "all") {
      search.set("view", params.view);
    }
    if (params?.poolId) {
      search.set("poolId", String(params.poolId));
    }
    return requestJSON<UserTicketsResponse>(`/api/v1/users/${address}/tickets?${search.toString()}`);
  },
  listUserWins: (address: string) => requestJSON<UserWinsResponse>(`/api/v1/users/${address}/wins?limit=50&offset=0`),
  listRecentWins: (limit = 20) => requestJSON<RecentWinsResponse>(`/api/v1/wins/recent?limit=${limit}&offset=0`),
  getPlatformOverview: () => requestJSON<LuckyScratchPlatformOverview>(`/api/v1/stats/overview`),
  getPlayerLeaderboard: (timeframe: "weekly" | "all-time", limit = 20) =>
    requestJSON<LuckyScratchPlayerLeaderboardResponse>(
      `/api/v1/leaderboards/players?timeframe=${timeframe}&limit=${limit}`,
    ),
  buildRevealAuth: (ticketId: string, address: string) =>
    requestJSON<RevealAuthResponse>(`/api/v1/tickets/${ticketId}/reveal-auth`, {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  getClaimPrecheck: (ticketId: string) =>
    requestJSON<ClaimPrecheckResponse>(`/api/v1/tickets/${ticketId}/claim-precheck`),
  listPools: (params?: { creator?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.creator) {
      search.set("creator", params.creator);
    }
    search.set("limit", String(params?.limit ?? 50));
    search.set("offset", String(params?.offset ?? 0));
    return requestJSON<LuckyScratchPoolsResponse>(`/api/v1/pools?${search.toString()}`).then(normalizePoolsResponse);
  },
  getPool: (poolId: string | number) => requestJSON<LuckyScratchPool>(`/api/v1/pools/${poolId}`).then(normalizePool),
  getPoolCurrentRound: (poolId: string | number) =>
    requestJSON<LuckyScratchPoolRound>(`/api/v1/pools/${poolId}/rounds/current`),
  getPurchaseContext: (poolId: string | number) =>
    requestJSON<LuckyScratchPurchaseContext>(`/api/v1/pools/${poolId}/purchase-context`).then(normalizePurchaseContext),
  getPoolMetadataDocument: async (metadataGatewayUrl: string) => {
    const response = await fetch(resolveLuckyScratchIPFSURL(metadataGatewayUrl) || metadataGatewayUrl, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Pool metadata request failed with ${response.status}`);
    }
    return normalizePoolMetadataDocument(await response.json());
  },
  getCreatorSummary: (address: string) =>
    requestJSON<LuckyScratchCreatorSummary>(`/api/v1/users/${address}/created-pools/summary`),
  uploadImage: async (file: File, ownerAddress: string, kind: string) => {
    const formData = new FormData();
    formData.set("ownerAddress", ownerAddress);
    formData.set("kind", kind);
    formData.set("file", file);

    const response = await request(`/api/v1/uploads/images`, {
      method: "POST",
      body: formData,
    });

    return normalizeUploadedImageAsset((await response.json()) as UploadedImageAsset);
  },
  createPoolDraft: (payload: CreatePoolDraftInput) =>
    requestJSON<PoolDraft>(`/api/v1/pool-drafts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(normalizePoolDraft),
  finalizePool: (poolId: string | number, payload: FinalizePoolInput) =>
    requestJSON(`/api/v1/pools/${poolId}/finalize`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  syncTransaction: (txHash: string) =>
    requestJSON<{ txHash: string; status: string }>(`/api/v1/sync/tx`, {
      method: "POST",
      body: JSON.stringify({ txHash }),
    }),
};
