"use client";

import { useQuery } from "@tanstack/react-query";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";

export const useLuckyScratchUserTickets = (address?: string) =>
  useQuery({
    queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "tickets"],
    queryFn: () => luckyScratchAPI.listUserTickets(address!),
    enabled: Boolean(address),
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
