"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { TicketCard, type TicketStatus } from "~~/components/my-tickets/TicketCard";
import { TicketFilterBar } from "~~/components/my-tickets/TicketFilterBar";
import { type VaultStat, VaultStatsBar } from "~~/components/my-tickets/VaultStatsBar";
import { MyTicketsIcon, type PoolIconName } from "~~/components/my-tickets/icons";
import { useLuckyScratchUserTickets } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { buildTicketClaimProof } from "~~/services/luckyScratch/claim";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchPool, LuckyScratchTicket } from "~~/services/luckyScratch/types";
import { notification } from "~~/utils/scaffold-eth";

type TicketTab = "all" | "unrevealed" | "revealed" | "winning" | "to-claim";

type MyTicketsVaultProps = {
  embedded?: boolean;
};

const PAGE_SIZE = 24;
const POOL_ICON_NAMES: PoolIconName[] = ["diamond", "stars", "auto_awesome", "light", "star"];

const matchesTab = (ticket: LuckyScratchTicket, tab: TicketTab) => {
  switch (tab) {
    case "unrevealed":
      return ticket.status === "Unscratched";
    case "revealed":
      return ticket.status !== "Unscratched";
    case "winning":
      return ticket.claimClearRewardAmount > 0;
    case "to-claim":
      return ticket.status === "Scratched" && ticket.revealAuthorized;
    default:
      return true;
  }
};

const ticketSearchText = (ticket: LuckyScratchTicket) =>
  [ticket.ticketId, ticket.poolId, ticket.roundId, ticket.ticketIndex, ticket.status].join(" ").toLowerCase();

const isTicketReadyForClaim = (ticket: LuckyScratchTicket, address?: string) =>
  Boolean(
    address &&
      ticket.status === "Scratched" &&
      ticket.revealAuthorized &&
      ticket.owner.toLowerCase() === address.toLowerCase(),
  );

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

const getTicketCardStatus = (ticket: LuckyScratchTicket, canClaim: boolean): TicketStatus => {
  if (ticket.status === "Unscratched") {
    return "unrevealed";
  }
  if (canClaim) {
    return "claimable";
  }
  if (ticket.claimClearRewardAmount > 0) {
    return "winning";
  }
  if (ticket.status === "Claimed") {
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

export const MyTicketsVault = ({ embedded = false }: MyTicketsVaultProps) => {
  const { address, chainId } = useAccount();
  const queryClient = useQueryClient();
  const { targetNetwork } = useTargetNetwork();
  const { writeContractAsync, isMining: isClaimMining } = useScaffoldWriteContract({
    contractName: "LuckyScratchCore",
  });
  const [activeTab, setActiveTab] = useState<TicketTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [poolFilterInput, setPoolFilterInput] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());
  const [claimingTicketId, setClaimingTicketId] = useState<number | null>(null);
  const [claimStage, setClaimStage] = useState("");

  const poolFilterId = useMemo(() => {
    const trimmed = poolFilterInput.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }, [poolFilterInput]);

  const ticketsQuery = useLuckyScratchUserTickets(address, {
    limit: PAGE_SIZE,
    offset: pageOffset,
    view: activeTab,
    poolId: poolFilterId,
  });
  const tickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data?.items]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTickets = useMemo(
    () =>
      tickets.filter(ticket => {
        if (!normalizedSearch) {
          return true;
        }
        return ticketSearchText(ticket).includes(normalizedSearch);
      }),
    [normalizedSearch, tickets],
  );
  const visiblePoolIds = useMemo(() => [...new Set(filteredTickets.map(ticket => ticket.poolId))], [filteredTickets]);
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

  const totalClaimedRewards = tickets.reduce((sum, ticket) => sum + ticket.claimClearRewardAmount, 0);
  const revealedCount = tickets.filter(ticket => ticket.status !== "Unscratched").length;
  const toClaimCount = tickets.filter(ticket => matchesTab(ticket, "to-claim")).length;
  const selectedTickets = tickets.filter(ticket => selectedTicketIds.has(ticket.ticketId));
  const selectedClaimableTickets = selectedTickets.filter(ticket => isTicketReadyForClaim(ticket, address));
  const selectedPoolIds = new Set(selectedTickets.map(ticket => ticket.poolId));
  const canOpenSelected = selectedTickets.length > 0 && selectedPoolIds.size === 1;
  const scratchQueueHref = canOpenSelected
    ? `/scratch/${selectedTickets[0].poolId}?tickets=${selectedTickets.map(ticket => ticket.ticketId).join(",")}`
    : "/my-tickets";
  const totalCount = ticketsQuery.data?.totalCount ?? 0;
  const hasPreviousPage = pageOffset > 0;
  const hasNextPage = Boolean(ticketsQuery.data?.hasMore);
  const pageIndex = Math.floor(pageOffset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstVisibleTicketNumber = tickets.length === 0 ? 0 : pageOffset + 1;
  const lastVisibleTicketNumber = tickets.length === 0 ? 0 : Math.min(pageOffset + tickets.length, totalCount);
  const vaultStats: VaultStat[] = [
    {
      label: "MATCHING TICKETS",
      value: ticketsQuery.isLoading ? "--" : String(totalCount),
      icon: "confirmation_number",
      valueColor: "text-[#cabeff]",
    },
    {
      label: "PAGE REVEALED",
      value: ticketsQuery.isLoading ? "--" : String(revealedCount),
      icon: "visibility",
      valueColor: "text-[#00DAF3]",
    },
    {
      label: "READY TO CLAIM",
      value: ticketsQuery.isLoading ? "--" : String(toClaimCount),
      icon: "pending",
      valueColor: "text-[#ffe16d]",
    },
    {
      label: "PAGE REWARDS",
      value: ticketsQuery.isLoading ? "--" : `${formatUsdcFromMicro(totalClaimedRewards)} USDC`,
      icon: "payments",
      valueColor: "text-[#ffe16d]",
    },
  ];
  const allFilteredSelected =
    filteredTickets.length > 0 && filteredTickets.every(ticket => selectedTicketIds.has(ticket.ticketId));

  useEffect(() => {
    setPageOffset(0);
    setSelectedTicketIds(new Set());
  }, [activeTab, poolFilterId, address]);

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
      filteredTickets.forEach(ticket => {
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
      if (!chainId) {
        throw new Error("Connect to a supported network before claiming rewards.");
      }
      const claimableTickets = ticketsToClaim.filter(ticket => isTicketReadyForClaim(ticket, address));
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
        setClaimStage(`Authorizing${suffix}`);
        const revealAuth = await luckyScratchAPI.buildRevealAuth(String(ticket.ticketId), address);

        setClaimStage(`Decrypting${suffix}`);
        const claimProof = await buildTicketClaimProof({ chainId, revealAuth });
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
      if (claimInputs.length === 1) {
        const claimInput = claimInputs[0];
        await writeContractAsync(
          {
            functionName: "claimReward",
            args: [BigInt(claimInput.ticket.ticketId), claimInput.clearRewardAmount, claimInput.decryptionProof],
          },
          {
            blockConfirmations: 1,
          },
        );
      } else {
        await writeContractAsync(
          {
            functionName: "batchClaimRewards",
            args: [
              claimInputs.map(claimInput => BigInt(claimInput.ticket.ticketId)),
              claimInputs.map(claimInput => claimInput.clearRewardAmount),
              claimInputs.map(claimInput => claimInput.decryptionProof),
            ],
          },
          {
            blockConfirmations: 1,
          },
        );
      }

      return {
        claimedTickets: claimInputs.map(claimInput => claimInput.ticket),
        skippedZeroCount,
      };
    },
    onSuccess: async (result: ClaimMutationResult) => {
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
      notification.error(toErrorMessage(error));
    },
    onSettled: () => {
      setClaimingTicketId(null);
      setClaimStage("");
    },
  });

  const claimSelectedLabel =
    claimRewardMutation.isPending && claimingTicketId === null
      ? claimStage || "CLAIMING"
      : selectedClaimableTickets.length > 0
        ? `CLAIM SELECTED (${selectedClaimableTickets.length})`
        : "CLAIM SELECTED";

  return (
    <div className={embedded ? "w-full bg-[#0C1323] text-[#DCE2F9]" : "min-h-screen bg-[#0C1323] text-[#DCE2F9]"}>
      <div className={embedded ? "w-full p-6 md:p-8" : "mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8"}>
        <VaultStatsBar
          stats={vaultStats}
          wallet={
            <div className="rounded-xl border border-[#4d4732]/20 bg-[#181f30]/70 p-4 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#d0c6ab]">Connected Wallet</p>
              <div className="mt-2">
                {address ? (
                  <Address address={address} chain={targetNetwork} />
                ) : (
                  <span className="text-sm text-[#9FB0D0]">Connect a wallet to load tickets.</span>
                )}
              </div>
            </div>
          }
        />

        <section className="rounded-xl border border-[#4d4732]/20 bg-[#181f30]/70 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <TicketFilterBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            poolFilterInput={poolFilterInput}
            onPoolFilterChange={setPoolFilterInput}
            onPoolFilterClear={() => setPoolFilterInput("")}
            selectAll={allFilteredSelected}
            onSelectAllChange={setAllFilteredSelected}
            claimCount={toClaimCount}
            selectedCount={selectedTickets.length}
            canOpenSelected={canOpenSelected}
            openSelectedHref={scratchQueueHref}
            openSelectedTitle={
              selectedTickets.length > 0 && !canOpenSelected
                ? "Select tickets from one pool to open a scratch queue."
                : undefined
            }
            selectedClaimableCount={selectedClaimableTickets.length}
            claimSelectedLabel={claimSelectedLabel}
            claimSelectedDisabled={claimRewardMutation.isPending || isClaimMining}
            onClaimSelected={() => claimRewardMutation.mutate(selectedClaimableTickets)}
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

          {filteredTickets.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTickets.map(ticket => {
                const ticketHref = `/scratch/${ticket.poolId}?tickets=${ticket.ticketId}`;
                const checked = selectedTicketIds.has(ticket.ticketId);
                const canClaim = isTicketReadyForClaim(ticket, address);
                const isClaiming = claimRewardMutation.isPending && claimingTicketId === ticket.ticketId;
                const claimDisabled = claimRewardMutation.isPending || isClaimMining || !canClaim;
                const pool = poolById.get(ticket.poolId);
                const poolName = pool?.metadata?.name?.trim() || `Pool #${ticket.poolId}`;
                const isRevealed = ticket.status !== "Unscratched";
                const ticketArtUrl = isRevealed ? pool?.metadata?.ticketArtUrl : undefined;
                const cardStatus = getTicketCardStatus(ticket, canClaim);
                const prizeAmount =
                  cardStatus === "winning" || cardStatus === "no-win"
                    ? `${formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC`
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
                    {isClaiming ? claimStage || "CLAIMING" : "DECRYPT & CLAIM"}
                  </button>
                ) : (
                  <Link
                    href={ticketHref}
                    className="w-full py-2 bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] font-bold rounded-lg text-xs hover:bg-[#ffd700] hover:text-[#705e00] transition-all flex items-center justify-center gap-2"
                  >
                    <MyTicketsIcon
                      name={ticket.status === "Unscratched" ? "visibility" : "content_cut"}
                      className="h-4 w-4"
                    />
                    {ticket.status === "Unscratched"
                      ? "REVEAL"
                      : ticket.status === "Claimed"
                        ? "VIEW TICKET"
                        : "OPEN QUEUE"}
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
                  onClick={() => setPageOffset(ticketsQuery.data?.nextOffset ?? pageOffset + PAGE_SIZE)}
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
