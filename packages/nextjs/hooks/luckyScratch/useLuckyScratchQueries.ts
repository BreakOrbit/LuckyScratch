"use client";

import { useQuery } from "@tanstack/react-query";
import type { ListUserTicketsParams } from "~~/services/luckyScratch/api";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";

export const useLuckyScratchHealth = () =>
  useQuery({
    queryKey: ["lucky-scratch", "health"],
    queryFn: () => luckyScratchAPI.getHealth(),
    staleTime: 10_000,
  });

export const useLuckyScratchUserTickets = (address?: string, params?: ListUserTicketsParams) =>
  useQuery({
    queryKey: [
      "lucky-scratch",
      "users",
      address?.toLowerCase(),
      "tickets",
      params?.limit ?? 50,
      params?.offset ?? 0,
      params?.view ?? "all",
      params?.poolId ?? 0,
    ],
    queryFn: () => luckyScratchAPI.listUserTickets(address!, params),
    enabled: Boolean(address),
    staleTime: 10_000,
  });

export const useLuckyScratchUserWins = (address?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "wins"],
    queryFn: () => luckyScratchAPI.listUserWins(address!),
    enabled: Boolean(address),
    staleTime: 10_000,
  });

export const useLuckyScratchRecentWins = (limit = 12) =>
  useQuery({
    queryKey: ["lucky-scratch", "wins", "recent", limit],
    queryFn: () => luckyScratchAPI.listRecentWins(limit),
    staleTime: 10_000,
  });

export const useLuckyScratchPlatformOverview = () =>
  useQuery({
    queryKey: ["lucky-scratch", "stats", "overview"],
    queryFn: () => luckyScratchAPI.getPlatformOverview(),
    staleTime: 10_000,
  });

export const useLuckyScratchPlayerLeaderboard = (timeframe: "weekly" | "all-time", limit = 20) =>
  useQuery({
    queryKey: ["lucky-scratch", "leaderboards", "players", timeframe, limit],
    queryFn: () => luckyScratchAPI.getPlayerLeaderboard(timeframe, limit),
    staleTime: 10_000,
  });

export const useLuckyScratchTicket = (ticketId?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "tickets", ticketId],
    queryFn: () => luckyScratchAPI.getTicket(ticketId!),
    enabled: Boolean(ticketId),
    staleTime: 10_000,
  });

export const useLuckyScratchClaimPrecheck = (ticketId?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "tickets", ticketId, "claim-precheck"],
    queryFn: () => luckyScratchAPI.getClaimPrecheck(ticketId!),
    enabled: Boolean(ticketId),
    staleTime: 10_000,
  });

export const useLuckyScratchPools = (creator?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "pools", creator?.toLowerCase() || "all"],
    queryFn: () => luckyScratchAPI.listPools({ creator }),
    staleTime: 10_000,
  });

export const useLuckyScratchPool = (poolId?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "pools", poolId],
    queryFn: () => luckyScratchAPI.getPool(poolId!),
    enabled: Boolean(poolId),
    staleTime: 10_000,
  });

export const useLuckyScratchPoolCurrentRound = (poolId?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "pools", poolId, "current-round"],
    queryFn: () => luckyScratchAPI.getPoolCurrentRound(poolId!),
    enabled: Boolean(poolId),
    staleTime: 10_000,
  });

export const useLuckyScratchPurchaseContext = (poolId?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "pools", poolId, "purchase-context"],
    queryFn: () => luckyScratchAPI.getPurchaseContext(poolId!),
    enabled: Boolean(poolId),
    staleTime: 5_000,
  });

export const useLuckyScratchCreatorSummary = (address?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "created-pools", "summary"],
    queryFn: () => luckyScratchAPI.getCreatorSummary(address!),
    enabled: Boolean(address),
    staleTime: 10_000,
  });
