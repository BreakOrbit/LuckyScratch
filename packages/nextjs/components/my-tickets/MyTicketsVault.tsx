"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { TicketCard, type TicketStatus } from "~~/components/my-tickets/TicketCard";
import { TicketFilterBar } from "~~/components/my-tickets/TicketFilterBar";
import { type VaultStat, VaultStatsBar } from "~~/components/my-tickets/VaultStatsBar";
import { MyTicketsIcon, type PoolIconName } from "~~/components/my-tickets/icons";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { buildTicketClaimProofDirect } from "~~/services/luckyScratch/claim";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import { ticketRewardCache } from "~~/services/luckyScratch/ticketCache";
import type { LuckyScratchPool, LuckyScratchTicket, UserTicketsResponse } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

type TicketTab = "all" | "unrevealed" | "revealed" | "winning" | "to-claim";

type MyTicketsVaultProps = {
  embedded?: boolean;
};

const PAGE_SIZE = 24;
const API_PAGE_SIZE = 100;
const MAX_TICKET_PAGES = 50;
const POOL_ICON_NAMES: PoolIconName[] = ["diamond", "stars", "auto_awesome", "light", "star"];

const ticketSearchText = (ticket: LuckyScratchTicket) =>
  [ticket.ticketId, ticket.poolId, ticket.roundId, ticket.ticketIndex, ticket.status].join(" ").toLowerCase();

const isTicketReadyForClaim = (ticket: LuckyScratchTicket, address?: string, cachedRewardAmount?: number) =>
  Boolean(
    address &&
      ticket.status !== "Claimed" &&
      (cachedRewardAmount != null
        ? cachedRewardAmount > 0
        : ticket.status === "Scratched" && ticket.revealAuthorized) &&
      ticket.owner.toLowerCase() === address.toLowerCase(),
  );

const getKnownRewardAmount = (ticket: LuckyScratchTicket, cachedRewardAmount?: number) =>
  cachedRewardAmount ?? ticket.claimClearRewardAmount;

const isTicketInTab = (ticket: LuckyScratchTicket, tab: TicketTab, address?: string, cachedRewardAmount?: number) => {
  const knownRewardAmount = getKnownRewardAmount(ticket, cachedRewardAmount);
  switch (tab) {
    case "all":
      return true;
    case "unrevealed":
      return ticket.status === "Unscratched";
    case "revealed":
      return ticket.status !== "Unscratched";
    case "winning":
      return knownRewardAmount > 0;
    case "to-claim":
      return isTicketReadyForClaim(ticket, address, knownRewardAmount);
  }
};

const listAllUserTickets = async (address: string): Promise<UserTicketsResponse> => {
  const items: LuckyScratchTicket[] = [];
  let offset = 0;
  let totalCount = 0;

  for (let page = 0; page < MAX_TICKET_PAGES; page++) {
    const response = await luckyScratchAPI.listUserTickets(address, {
      limit: API_PAGE_SIZE,
      offset,
      view: "all",
    });
    items.push(...response.items);
    totalCount = response.totalCount;
    if (!response.hasMore || response.items.length === 0) {
      break;
    }
    offset = response.nextOffset;
  }

  return {
    items,
    limit: items.length,
    offset: 0,
    nextOffset: items.length,
    totalCount,
    hasMore: items.length < totalCount,
  };
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Reward claim failed.";
};

const getPoolIcon = (poolId: number, pool?: LuckyScratchPool): PoolIconName => {
  const theme = `${pool?.metadata?.themeKey ?? ""} ${pool?.metadata?.themeId ?? ""}`.toLowerCase();
  if (theme.includes("diamond") || theme.includes("crystal")) {
    return "diamond";
  }
  if (theme.includes("star")) {
    return "star";
  }
  if (theme.includes("light") || theme.includes("sun")) {
    return "light";
  }
  if (theme.includes("magic") || theme.includes("spark")) {
    return "auto_awesome";
  }
  return POOL_ICON_NAMES[poolId % POOL_ICON_NAMES.length];
};

const getTicketCardStatus = (
  ticket: LuckyScratchTicket,
  canClaim: boolean,
  cachedRewardAmount?: number,
): TicketStatus => {
  if (ticket.status === "Unscratched") {
    return "unrevealed";
  }
  if (canClaim) {
    return "claimable";
  }
  const knownRewardAmount = cachedRewardAmount ?? ticket.claimClearRewardAmount;
  if (knownRewardAmount > 0) {
    return "winning";
  }
  if (ticket.status === "Claimed" || cachedRewardAmount === 0) {
    return "no-win";
  }
  return "revealed";
};

const getRevealedSubtitle = (ticket: LuckyScratchTicket) => {
  if (ticket.status === "Claimed") {
    return "BETTER LUCK NEXT TIME";
  }
  if (ticket.revealAuthorized) {
    return "READY TO DECRYPT";
  }
  return "REVEAL AUTH PENDING";
};

class ZeroRewardClaimError extends Error {}

type ClaimMutationResult = {
  claimedTickets: LuckyScratchTicket[];
  skippedZeroCount: number;
};

const SEPOLIA_CHAIN_ID = 11155111 as const;

export const MyTicketsVault = ({ embedded = false }: MyTicketsVaultProps) => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const queryClient = useQueryClient();
  const { data: coreContract } = useDeployedContractInfo({
    contractName: "LuckyScratchCore",
    chainId: SEPOLIA_CHAIN_ID,
  });
  const { writeContractAsync, isMining: isClaimMining } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
    chainId: SEPOLIA_CHAIN_ID,
  });
  const { writeContractAsync: writeRevealContractAsync, isMining: isRevealMining } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
    chainId: SEPOLIA_CHAIN_ID,
  });
  const { data: ticketContract } = useDeployedContractInfo({
    contractName: "LuckyScratchTicket",
    chainId: SEPOLIA_CHAIN_ID,
  });
  const [activeTab, setActiveTab] = useState<TicketTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());
  const [claimingTicketId, setClaimingTicketId] = useState<number | null>(null);
  const [claimStage, setClaimStage] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["lucky-scratch", "users", address?.toLowerCase(), "tickets", "all-pages"],
    queryFn: () => listAllUserTickets(address!),
    enabled: Boolean(address),
    staleTime: 10_000,
  });
  const rewardCacheScope = useMemo(
    () => (coreContract && address ? { contractAddress: coreContract.address, owner: address } : undefined),
    [address, coreContract],
  );
  const allTickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data?.items]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTickets = useMemo(
    () =>
      allTickets.filter(ticket => {
        const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
        if (!isTicketInTab(ticket, activeTab, address, cachedReward?.clearRewardAmount)) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        return ticketSearchText(ticket).includes(normalizedSearch);
      }),
    [activeTab, address, allTickets, normalizedSearch, rewardCacheScope],
  );
  const visibleTickets = useMemo(
    () => filteredTickets.slice(pageOffset, pageOffset + PAGE_SIZE),
    [filteredTickets, pageOffset],
  );
  const visiblePoolIds = useMemo(() => [...new Set(visibleTickets.map(ticket => ticket.poolId))], [visibleTickets]);
  const visiblePoolQueries = useQueries({
    queries: visiblePoolIds.map(poolId => ({
      queryKey: ["lucky-scratch", "pools", String(poolId)],
      queryFn: () => luckyScratchAPI.getPool(poolId),
      enabled: Boolean(address),
      staleTime: 10_000,
    })),
  });
  const poolById = new Map<number, LuckyScratchPool>();
  visiblePoolQueries.forEach(query => {
    if (query.data) {
      poolById.set(query.data.poolId, query.data);
    }
  });

  const totalWinnings = allTickets
    .filter(ticket => ticket.status === "Claimed")
    .reduce((sum, ticket) => sum + ticket.claimClearRewardAmount, 0);
  const pendingRewards = allTickets
    .filter(ticket => {
      const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
      return isTicketInTab(ticket, "to-claim", address, cachedReward?.clearRewardAmount);
    })
    .reduce((sum, ticket) => {
      const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
      return sum + getKnownRewardAmount(ticket, cachedReward?.clearRewardAmount);
    }, 0);
  const totalCount = filteredTickets.length;
  const toClaimCount = allTickets.filter(ticket => {
    const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
    return isTicketInTab(ticket, "to-claim", address, cachedReward?.clearRewardAmount);
  }).length;
  const selectedTickets = visibleTickets.filter(ticket => selectedTicketIds.has(ticket.ticketId));
  const allClaimableTickets = allTickets.filter(ticket => {
    const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
    return isTicketInTab(ticket, "to-claim", address, cachedReward?.clearRewardAmount);
  });
  const hasPreviousPage = pageOffset > 0;
  const hasNextPage = pageOffset + PAGE_SIZE < totalCount;
  const pageIndex = Math.floor(pageOffset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstVisibleTicketNumber = visibleTickets.length === 0 ? 0 : pageOffset + 1;
  const lastVisibleTicketNumber =
    visibleTickets.length === 0 ? 0 : Math.min(pageOffset + visibleTickets.length, totalCount);
  const vaultStats: VaultStat[] = [
    {
      label: "TOTAL WINNINGS",
      value: ticketsQuery.isLoading ? "--" : `${formatUsdcFromMicro(totalWinnings)} USDC`,
      icon: "payments",
      valueColor: "text-[#ffe16d]",
    },
    {
      label: "PENDING REWARDS",
      value: ticketsQuery.isLoading ? "--" : `${formatUsdcFromMicro(pendingRewards)} USDC`,
      icon: "pending",
      valueColor: "text-[#00DAF3]",
    },
    {
      label: "TOTAL TICKETS",
      value: ticketsQuery.isLoading ? "--" : String(allTickets.length),
      icon: "confirmation_number",
      valueColor: "text-[#cabeff]",
    },
  ];
  const selectedUnrevealedTickets = selectedTickets.filter(ticket => ticket.status === "Unscratched");
  const allUnrevealedTickets = filteredTickets.filter(ticket => ticket.status === "Unscratched");
  const allFilteredSelected =
    visibleTickets.length > 0 && visibleTickets.every(ticket => selectedTicketIds.has(ticket.ticketId));

  useEffect(() => {
    setPageOffset(0);
    setSelectedTicketIds(new Set());
  }, [activeTab, address, normalizedSearch]);

  useEffect(() => {
    if (pageOffset > 0 && pageOffset >= totalCount) {
      setPageOffset(Math.max(0, Math.floor(Math.max(totalCount - 1, 0) / PAGE_SIZE) * PAGE_SIZE));
    }
  }, [pageOffset, totalCount]);

  useEffect(() => {
    setSelectedTicketIds(new Set());
  }, [pageOffset]);

  const toggleTicket = (ticketId: number) => {
    setSelectedTicketIds(current => {
      const next = new Set(current);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const setAllFilteredSelected = (checked: boolean) => {
    setSelectedTicketIds(current => {
      const next = new Set(current);
      visibleTickets.forEach(ticket => {
        if (checked) {
          next.add(ticket.ticketId);
        } else {
          next.delete(ticket.ticketId);
        }
      });
      return next;
    });
  };

  const claimRewardMutation = useMutation({
    mutationFn: async (ticketsToClaim: LuckyScratchTicket[]): Promise<ClaimMutationResult> => {
      if (!address) {
        throw new Error("Connect your wallet before claiming rewards.");
      }
      if (!coreContract || !publicClient) {
        throw new Error("Contract info is not available.");
      }
      const claimableTickets = ticketsToClaim.filter(ticket => {
        const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
        return isTicketReadyForClaim(ticket, address, cachedReward?.clearRewardAmount);
      });
      if (claimableTickets.length === 0) {
        throw new Error("This ticket is not ready for wallet-driven reward claim.");
      }

      setClaimingTicketId(claimableTickets.length === 1 ? claimableTickets[0].ticketId : null);
      const claimInputs: {
        ticket: LuckyScratchTicket;
        clearRewardAmount: bigint;
        decryptionProof: `0x${string}`;
      }[] = [];
      let skippedZeroCount = 0;
      for (const [idx, ticket] of claimableTickets.entries()) {
        const suffix = claimableTickets.length > 1 ? ` ${idx + 1}/${claimableTickets.length}` : "";
        const cached = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);

        // Use cached proof if available — skip decryption entirely
        if (cached && cached.decryptionProof && cached.clearRewardAmount > 0) {
          // Verify on-chain state when backend data may be stale
          setClaimStage(`Verifying${suffix}`);
          const state = await publicClient.readContract({
            address: coreContract.address,
            abi: coreContract.abi,
            functionName: "getTicketRevealState",
            args: [BigInt(ticket.ticketId)],
          });
          const [onChainStatus, onChainRevealAuthorized] = state as readonly [number, boolean];
          console.log("[claim-cached]", {
            ticketId: ticket.ticketId,
            walletChainId: SEPOLIA_CHAIN_ID,
            contractAddress: coreContract.address,
            onChainStatus: Number(onChainStatus),
            onChainRevealAuthorized,
            cachedAmount: cached.clearRewardAmount,
            proofLen: cached.decryptionProof.length,
          });
          if (onChainStatus !== 1 || !onChainRevealAuthorized) {
            skippedZeroCount += 1;
            continue;
          }
          claimInputs.push({
            ticket,
            clearRewardAmount: BigInt(cached.clearRewardAmount),
            decryptionProof: cached.decryptionProof as `0x${string}`,
          });
          continue;
        }

        // No cache — decrypt fresh
        setClaimStage(`Reading handle${suffix}`);
        const handle = await publicClient.readContract({
          address: coreContract.address,
          abi: coreContract.abi,
          functionName: "getTicketPrizeHandle",
          args: [BigInt(ticket.ticketId)],
        });

        setClaimStage(`Decrypting${suffix}`);
        const claimProof = await buildTicketClaimProofDirect({ chainId: SEPOLIA_CHAIN_ID, handle: handle as string });
        const clearRewardAmount = Number(claimProof.clearRewardAmount);
        ticketRewardCache.set(
          SEPOLIA_CHAIN_ID,
          ticket.ticketId,
          clearRewardAmount,
          claimProof.decryptionProof,
          rewardCacheScope,
        );
        const userPrefix = ["lucky-scratch", "users", address.toLowerCase(), "tickets"];
        queryClient.getQueriesData<UserTicketsResponse>({ queryKey: userPrefix }).forEach(([key, data]) => {
          if (!data?.items.some(item => item.ticketId === ticket.ticketId)) return;
          queryClient.setQueryData<UserTicketsResponse>(key, old => {
            if (!old) return old;
            return {
              ...old,
              items: old.items.map(item =>
                item.ticketId === ticket.ticketId ? { ...item, claimClearRewardAmount: clearRewardAmount } : item,
              ),
            };
          });
        });
        console.log("[claim-fresh]", {
          ticketId: ticket.ticketId,
          walletChainId: SEPOLIA_CHAIN_ID,
          contractAddress: coreContract.address,
          handle: handle as string,
          clearRewardAmount: claimProof.clearRewardAmount.toString(),
          proofLen: claimProof.decryptionProof.length,
        });
        if (claimProof.clearRewardAmount === 0n) {
          skippedZeroCount += 1;
          continue;
        }
        claimInputs.push({
          ticket,
          clearRewardAmount: claimProof.clearRewardAmount,
          decryptionProof: claimProof.decryptionProof,
        });
      }

      if (claimInputs.length === 0) {
        throw new ZeroRewardClaimError(
          skippedZeroCount > 1
            ? "Selected tickets decrypted to zero rewards. No claim transaction is needed."
            : "This ticket decrypted to a zero reward. No claim transaction is needed.",
        );
      }

      setClaimStage("Submitting");
      try {
        let claimTxHash: string | undefined;
        if (claimInputs.length === 1) {
          const claimInput = claimInputs[0];
          claimTxHash = await writeContractAsync(
            {
              functionName: "claimReward",
              args: [BigInt(claimInput.ticket.ticketId), claimInput.clearRewardAmount, claimInput.decryptionProof],
            },
            { blockConfirmations: 1 },
          );
        } else {
          claimTxHash = await writeContractAsync(
            {
              functionName: "batchClaimRewards",
              args: [
                claimInputs.map(claimInput => BigInt(claimInput.ticket.ticketId)),
                claimInputs.map(claimInput => claimInput.clearRewardAmount),
                claimInputs.map(claimInput => claimInput.decryptionProof),
              ],
            },
            { blockConfirmations: 1 },
          );
        }

        if (claimTxHash) {
          try {
            await luckyScratchAPI.syncTransaction(claimTxHash);
          } catch {
            console.warn("Backend tx sync failed; cache will update on next poll");
          }
        }

        return {
          claimedTickets: claimInputs.map(claimInput => claimInput.ticket),
          skippedZeroCount,
        };
      } catch (txError) {
        const txMsg = txError instanceof Error ? txError.message : "";
        // Cached proof was stale — clear cache and tell user to retry with fresh decryption
        if (
          txMsg.includes("TicketNotClaimable") &&
          claimInputs.some(
            c =>
              ticketRewardCache.get(SEPOLIA_CHAIN_ID, c.ticket.ticketId, rewardCacheScope)?.decryptionProof ===
              c.decryptionProof,
          )
        ) {
          for (const claimInput of claimInputs) {
            ticketRewardCache.remove(SEPOLIA_CHAIN_ID, claimInput.ticket.ticketId, rewardCacheScope);
          }
          throw new Error("Claim proof expired. Cache cleared — please try again to decrypt fresh.");
        }
        throw txError;
      }
    },
    onSuccess: async (result: ClaimMutationResult) => {
      // Clear reward cache for claimed tickets
      for (const ticket of result.claimedTickets) {
        ticketRewardCache.remove(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
      }

      // Optimistic update: mark claimed tickets as Claimed in cache
      for (const ticket of result.claimedTickets) {
        queryClient.setQueryData<LuckyScratchTicket>(["lucky-scratch", "tickets", String(ticket.ticketId)], old => {
          if (!old) return old;
          return { ...old, status: "Claimed" };
        });
      }

      const lowerAddress = address?.toLowerCase();
      const poolIds = [...new Set(result.claimedTickets.map(ticket => ticket.poolId))];
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        ...result.claimedTickets.map(ticket =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", String(ticket.ticketId)] }),
        ),
        ...poolIds.map(poolId =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", String(poolId)] }),
        ),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "stats", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "wins", "recent"] }),
        lowerAddress
          ? queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", lowerAddress, "tickets"] })
          : Promise.resolve(),
        lowerAddress
          ? queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", lowerAddress, "wins"] })
          : Promise.resolve(),
      ]);
      if (result.skippedZeroCount > 0) {
        notification.info(`${result.skippedZeroCount} zero-reward ticket(s) did not need a claim transaction.`);
      }
      notification.success(
        result.claimedTickets.length === 1
          ? `Ticket #${result.claimedTickets[0].ticketId} reward claim submitted.`
          : `${result.claimedTickets.length} reward claims submitted.`,
      );
    },
    onError: error => {
      if (error instanceof ZeroRewardClaimError) {
        notification.info(error.message);
        return;
      }
      const message = toErrorMessage(error);
      if (message.includes("Claim proof expired")) {
        notification.info(message);
        return;
      }
      if (message.includes("TicketNotClaimable")) {
        notification.warning("Ticket state has changed. Refreshing data — please try again.");
        const lowerAddress = address?.toLowerCase();
        if (lowerAddress) {
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", lowerAddress, "tickets"] });
        }
        return;
      }
      notification.error(message);
    },
    onSettled: () => {
      setClaimingTicketId(null);
      setClaimStage("");
    },
  });

  const batchRevealMutation = useMutation({
    mutationFn: async (ticketsToReveal: LuckyScratchTicket[]) => {
      if (!address) {
        throw new Error("Connect your wallet before revealing tickets.");
      }
      if (!coreContract || !publicClient || !ticketContract) {
        throw new Error("Contract info is not available.");
      }
      const unrevealedTickets = ticketsToReveal.filter(
        ticket => ticket.status === "Unscratched" && ticket.owner.toLowerCase() === address.toLowerCase(),
      );
      if (unrevealedTickets.length === 0) {
        throw new Error("No unrevealed tickets selected.");
      }

      setClaimingTicketId(unrevealedTickets.length === 1 ? unrevealedTickets[0].ticketId : null);

      // Scratch on-chain
      setClaimStage("Confirming scratch");
      let scratchTxHash: string | undefined;
      if (unrevealedTickets.length === 1) {
        scratchTxHash = await writeRevealContractAsync({
          functionName: "scratchTicket",
          args: [BigInt(unrevealedTickets[0].ticketId)],
        });
      } else {
        scratchTxHash = await writeRevealContractAsync({
          functionName: "batchScratch",
          args: [unrevealedTickets.map(t => BigInt(t.ticketId))],
        });
      }
      if (!scratchTxHash) {
        throw new Error("Scratch transaction was not submitted.");
      }

      // Optimistic cache update
      const scratchedIdSet = new Set(unrevealedTickets.map(t => t.ticketId));
      const userPrefix = ["lucky-scratch", "users", address.toLowerCase(), "tickets"];
      queryClient.getQueriesData<UserTicketsResponse>({ queryKey: userPrefix }).forEach(([key, data]) => {
        if (!data?.items) return;
        const hasTarget = data.items.some(t => scratchedIdSet.has(t.ticketId));
        if (!hasTarget) return;
        queryClient.setQueryData<UserTicketsResponse>(key, old => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map(t =>
              scratchedIdSet.has(t.ticketId) ? { ...t, status: "Scratched", revealAuthorized: true } : t,
            ),
          };
        });
      });

      try {
        await luckyScratchAPI.syncTransaction(scratchTxHash);
      } catch {
        console.warn("Backend tx sync failed; cache will update on next poll");
      }

      // Decrypt prize handles and cache results
      setClaimStage("Decrypting prizes");
      const cacheEntries: { ticketId: number; clearRewardAmount: number; decryptionProof: string }[] = [];
      let failedCount = 0;
      for (const [idx, ticket] of unrevealedTickets.entries()) {
        const suffix = unrevealedTickets.length > 1 ? ` ${idx + 1}/${unrevealedTickets.length}` : "";
        setClaimStage(`Decrypting${suffix}`);
        try {
          const handle = await publicClient.readContract({
            address: coreContract.address,
            abi: coreContract.abi,
            functionName: "getTicketPrizeHandle",
            args: [BigInt(ticket.ticketId)],
          });
          const claimProof = await buildTicketClaimProofDirect({ chainId: SEPOLIA_CHAIN_ID, handle: handle as string });
          cacheEntries.push({
            ticketId: ticket.ticketId,
            clearRewardAmount: Number(claimProof.clearRewardAmount),
            decryptionProof: claimProof.decryptionProof,
          });
        } catch {
          failedCount += 1;
        }
      }

      if (cacheEntries.length > 0) {
        ticketRewardCache.setBatch(SEPOLIA_CHAIN_ID, cacheEntries, rewardCacheScope);

        // Update user tickets list cache with decrypted prize amounts
        const rewardMap = new Map(cacheEntries.map(e => [e.ticketId, e.clearRewardAmount]));
        queryClient.getQueriesData<UserTicketsResponse>({ queryKey: userPrefix }).forEach(([key, data]) => {
          if (!data?.items) return;
          const hasTarget = data.items.some(t => rewardMap.has(t.ticketId));
          if (!hasTarget) return;
          queryClient.setQueryData<UserTicketsResponse>(key, old => {
            if (!old) return old;
            return {
              ...old,
              items: old.items.map(t => {
                const reward = rewardMap.get(t.ticketId);
                return reward != null ? { ...t, claimClearRewardAmount: reward } : t;
              }),
            };
          });
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readContract"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
        ...unrevealedTickets.map(t =>
          queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "tickets", String(t.ticketId)] }),
        ),
      ]);

      // Re-invalidate after delay to catch backend indexer lag
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"],
        });
      }, 3000);

      return { revealedCount: unrevealedTickets.length, failedCount };
    },
    onSuccess: (result: { revealedCount: number; failedCount: number }) => {
      if (result.failedCount > 0) {
        notification.warning(
          `${result.revealedCount - result.failedCount} ticket(s) revealed. ${result.failedCount} decryption(s) failed — try again later.`,
        );
      } else {
        notification.success(
          result.revealedCount === 1 ? "Ticket revealed!" : `${result.revealedCount} tickets revealed!`,
        );
      }
    },
    onError: error => {
      const message = error instanceof Error && error.message.trim() !== "" ? error.message : "Batch reveal failed.";
      notification.error(message);
    },
    onSettled: () => {
      setClaimingTicketId(null);
      setClaimStage("");
    },
  });

  const handleRevealAll = () => {
    const ticketsToReveal = allUnrevealedTickets.length > 0 ? allUnrevealedTickets : selectedUnrevealedTickets;
    if (ticketsToReveal.length === 0) {
      notification.info("No unrevealed tickets to reveal.");
      return;
    }
    batchRevealMutation.mutate(ticketsToReveal);
  };

  const handleBatchReveal = () => {
    if (selectedUnrevealedTickets.length === 0) {
      notification.info("Select unrevealed tickets first.");
      return;
    }
    batchRevealMutation.mutate(selectedUnrevealedTickets);
  };

  const handleClaimAll = () => {
    if (allClaimableTickets.length === 0) {
      notification.info("No claimable winning tickets yet.");
      return;
    }
    claimRewardMutation.mutate(allClaimableTickets);
  };

  const isRevealPending = batchRevealMutation.isPending || isRevealMining;
  const isClaimPending = claimRewardMutation.isPending || isClaimMining;

  return (
    <div className={embedded ? "w-full bg-[#0C1323] text-[#DCE2F9]" : "min-h-screen bg-[#0C1323] text-[#DCE2F9]"}>
      <div className={embedded ? "w-full p-6 md:p-8" : "mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8"}>
        <VaultStatsBar stats={vaultStats} />

        <section className="rounded-xl border border-[#4d4732]/20 bg-[#181f30]/70 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl overflow-hidden">
          <TicketFilterBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectAll={allFilteredSelected}
            onSelectAllChange={setAllFilteredSelected}
            claimCount={toClaimCount}
            onRevealAll={handleRevealAll}
            onBatchReveal={handleBatchReveal}
            onClaimAll={handleClaimAll}
            isRevealPending={isRevealPending}
            isClaimPending={isClaimPending}
            canClaimAll={allClaimableTickets.length > 0}
          />

          {!address ? (
            <div className="rounded-xl border border-dashed border-[#4d4732]/40 bg-[#070e1d] p-8 text-center text-sm text-[#9FB0D0]">
              Connect your wallet to load indexed tickets from the backend.
            </div>
          ) : null}

          {address && ticketsQuery.isError ? (
            <div className="rounded-xl border border-[#8E4A74] bg-[#2A1521] p-5 text-sm text-[#FFB4AB]">
              {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Failed to load ticket inventory."}
            </div>
          ) : null}

          {address && ticketsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(index => (
                <div
                  key={index}
                  className="h-[32rem] animate-pulse rounded-xl border border-[#4d4732]/30 bg-[#070e1d]"
                />
              ))}
            </div>
          ) : null}

          {address && ticketsQuery.isSuccess && filteredTickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#4d4732]/40 bg-[#070e1d] p-8 text-center text-sm text-[#9FB0D0]">
              No tickets match this view.
            </div>
          ) : null}

          {visibleTickets.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTickets.map(ticket => {
                const ticketHref = `/scratch/${ticket.poolId}?tickets=${ticket.ticketId}`;
                const checked = selectedTicketIds.has(ticket.ticketId);
                const cachedReward = ticketRewardCache.get(SEPOLIA_CHAIN_ID, ticket.ticketId, rewardCacheScope);
                const canClaim = isTicketReadyForClaim(ticket, address, cachedReward?.clearRewardAmount);
                const isClaiming = claimRewardMutation.isPending && claimingTicketId === ticket.ticketId;
                const claimDisabled = claimRewardMutation.isPending || isClaimMining || !canClaim;
                const pool = poolById.get(ticket.poolId);
                const poolName = pool?.metadata?.name?.trim() || `Pool #${ticket.poolId}`;
                const isRevealed = ticket.status !== "Unscratched" || cachedReward != null;
                const ticketArtUrl = isRevealed ? pool?.metadata?.ticketArtUrl : undefined;
                const cardStatus = getTicketCardStatus(ticket, canClaim, cachedReward?.clearRewardAmount);
                const prizeAmount =
                  cardStatus === "winning" || cardStatus === "no-win"
                    ? `${formatUsdcFromMicro(cachedReward?.clearRewardAmount ?? ticket.claimClearRewardAmount)} USDC`
                    : cardStatus === "claimable" && cachedReward != null
                      ? `${formatUsdcFromMicro(cachedReward.clearRewardAmount)} USDC`
                      : cardStatus === "claimable"
                        ? "ENCRYPTED"
                        : undefined;
                const action = canClaim ? (
                  <button
                    type="button"
                    disabled={claimDisabled}
                    onClick={() => claimRewardMutation.mutate([ticket])}
                    className="w-full py-2 bg-[#ffd700] text-[#705e00] font-black rounded-lg text-xs shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-[#232a3b] disabled:text-[#d0c6ab]/35 disabled:shadow-none"
                  >
                    <MyTicketsIcon name="payments" className="h-4 w-4" />
                    {isClaiming ? claimStage || "CLAIMING" : cachedReward != null ? "CLAIM" : "DECRYPT & CLAIM"}
                  </button>
                ) : (
                  <Link
                    href={ticketHref}
                    className="w-full py-2 bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] font-bold rounded-lg text-xs hover:bg-[#ffd700] hover:text-[#705e00] transition-all flex items-center justify-center gap-2"
                  >
                    <MyTicketsIcon name="visibility" className="h-4 w-4" />
                    {ticket.status === "Unscratched"
                      ? "REVEAL"
                      : ticket.status === "Claimed"
                        ? "VIEW TICKET"
                        : "VIEW RESULT"}
                  </Link>
                );

                return (
                  <TicketCard
                    key={ticket.ticketId}
                    ticketId={String(ticket.ticketId)}
                    poolName={poolName}
                    poolIcon={getPoolIcon(ticket.poolId, pool)}
                    cost={`#${ticket.ticketIndex + 1}`}
                    costLabel="INDEX"
                    status={cardStatus}
                    prizeAmount={prizeAmount}
                    image={ticketArtUrl}
                    selected={checked}
                    revealedSubtitle={getRevealedSubtitle(ticket)}
                    action={action}
                    onSelectedChange={() => toggleTicket(ticket.ticketId)}
                  />
                );
              })}
            </div>
          ) : null}

          {address && ticketsQuery.isSuccess && totalCount > 0 ? (
            <div className="mt-8 flex flex-col gap-3 border-t border-[#4d4732]/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#9FB0D0]">
                {firstVisibleTicketNumber}-{lastVisibleTicketNumber} of {totalCount}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!hasPreviousPage || ticketsQuery.isFetching}
                  onClick={() => setPageOffset(current => Math.max(0, current - PAGE_SIZE))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#4d4732]/30 bg-[#070e1d] text-[#d0c6ab] transition hover:border-[#ffd700]/40 hover:text-white disabled:cursor-not-allowed disabled:border-[#4d4732]/10 disabled:text-[#d0c6ab]/25"
                  aria-label="Previous page"
                >
                  <MyTicketsIcon name="chevron_left" className="h-5 w-5" />
                </button>
                <span className="min-w-24 text-center text-sm font-bold text-[#DCE2F9]">
                  Page {pageIndex} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={!hasNextPage || ticketsQuery.isFetching}
                  onClick={() => setPageOffset(current => current + PAGE_SIZE)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#4d4732]/30 bg-[#070e1d] text-[#d0c6ab] transition hover:border-[#ffd700]/40 hover:text-white disabled:cursor-not-allowed disabled:border-[#4d4732]/10 disabled:text-[#d0c6ab]/25"
                  aria-label="Next page"
                >
                  <MyTicketsIcon name="chevron_right" className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
