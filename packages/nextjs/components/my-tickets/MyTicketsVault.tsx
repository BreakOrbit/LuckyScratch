"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { useLuckyScratchUserTickets } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchTicket } from "~~/services/luckyScratch/types";

type TicketTab = "all" | "unrevealed" | "revealed" | "winning" | "to-claim";

type MyTicketsVaultProps = {
  embedded?: boolean;
};

const tabs: { key: TicketTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unrevealed", label: "Unrevealed" },
  { key: "revealed", label: "Revealed" },
  { key: "winning", label: "Winning" },
  { key: "to-claim", label: "To Claim" },
];

const ticketStatusLabel = (ticket: LuckyScratchTicket) => {
  if (ticket.status === "Unscratched") {
    return "Ready to Scratch";
  }
  if (ticket.status === "Claimed") {
    return "Claimed";
  }
  if (ticket.revealAuthorized) {
    return "Ready to Decrypt";
  }
  return ticket.status;
};

const ticketToneClassName = (ticket: LuckyScratchTicket) => {
  if (ticket.status === "Claimed") {
    return "border-[#FFD700]/50 bg-[#2A2312] text-[#FFD700]";
  }
  if (ticket.status === "Scratched") {
    return "border-[#00DAF3]/35 bg-[#062A34] text-[#9CF0FF]";
  }
  return "border-[#CABEFF]/35 bg-[#211A39] text-[#CABEFF]";
};

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

export const MyTicketsVault = ({ embedded = false }: MyTicketsVaultProps) => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const ticketsQuery = useLuckyScratchUserTickets(address);
  const [activeTab, setActiveTab] = useState<TicketTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());

  const tickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data?.items]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTickets = useMemo(
    () =>
      tickets.filter(ticket => {
        if (!matchesTab(ticket, activeTab)) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        return ticketSearchText(ticket).includes(normalizedSearch);
      }),
    [activeTab, normalizedSearch, tickets],
  );

  const totalClaimedRewards = tickets.reduce((sum, ticket) => sum + ticket.claimClearRewardAmount, 0);
  const revealedCount = tickets.filter(ticket => ticket.status !== "Unscratched").length;
  const toClaimCount = tickets.filter(ticket => matchesTab(ticket, "to-claim")).length;
  const selectedTickets = tickets.filter(ticket => selectedTicketIds.has(ticket.ticketId));
  const scratchQueueHref =
    selectedTickets.length > 0
      ? `/scratch/${selectedTickets[0].poolId}?tickets=${selectedTickets.map(ticket => ticket.ticketId).join(",")}`
      : "/my-tickets";

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

  const allFilteredSelected =
    filteredTickets.length > 0 && filteredTickets.every(ticket => selectedTicketIds.has(ticket.ticketId));

  return (
    <div className={embedded ? "w-full bg-[#0C1323] text-[#DCE2F9]" : "min-h-screen bg-[#0C1323] text-[#DCE2F9]"}>
      <div className={embedded ? "w-full p-6 md:p-8" : "mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8"}>
        <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#D0C6AB]">Wallet Ticket Vault</p>
            <h1 className="mt-3 font-headline text-4xl font-black tracking-tight text-[#FFD700] md:text-5xl">
              My Tickets
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9FB0D0]">
              Wallet-indexed LuckyScratch tickets. Open selected tickets in the scratch queue and track their indexed
              onchain status.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#11192B] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8290AE]">Connected Wallet</p>
            <div className="mt-2">
              {address ? (
                <Address address={address} chain={targetNetwork} />
              ) : (
                <span className="text-sm text-[#9FB0D0]">Connect a wallet to load tickets.</span>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: "Total Tickets", value: ticketsQuery.isLoading ? "--" : String(tickets.length), icon: TicketIcon },
            { label: "Revealed", value: ticketsQuery.isLoading ? "--" : String(revealedCount), icon: SparklesIcon },
            {
              label: "Claimed Rewards",
              value: ticketsQuery.isLoading ? "--" : `${formatUsdcFromMicro(totalClaimedRewards)} USDC`,
              icon: CheckCircleIcon,
            },
          ].map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="relative overflow-hidden rounded-xl border border-white/10 bg-[#11192B] p-5"
            >
              <Icon className="absolute -right-5 -top-5 h-24 w-24 text-[#FFD700]/10" />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#D0C6AB]">{label}</p>
              <p className="mt-3 font-headline text-3xl font-black text-white">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#11192B] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition ${
                    activeTab === tab.key
                      ? "bg-[#FFD700] text-[#705E00]"
                      : "text-[#D0C6AB] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {tab.label}
                  {tab.key === "to-claim" && toClaimCount > 0 ? (
                    <span className="ml-2 rounded-full bg-[#705E00]/20 px-2 py-0.5 text-[10px]">{toClaimCount}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B1120] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#D0C6AB]">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={event => setAllFilteredSelected(event.target.checked)}
                  className="checkbox checkbox-xs border-[#4D4732] [--chkbg:#FFD700] [--chkfg:#705E00]"
                />
                Select Visible
              </label>

              <div className="relative min-w-0 md:w-72">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D0C6AB]" />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search ticket, pool, status..."
                  className="w-full rounded-lg border border-white/10 bg-[#0B1120] py-2 pl-10 pr-3 text-sm text-[#DCE2F9] outline-none transition placeholder:text-[#8290AE] focus:border-[#FFD700]/40"
                />
              </div>

              <Link
                href={scratchQueueHref}
                aria-disabled={selectedTickets.length === 0}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                  selectedTickets.length > 0
                    ? "bg-[#FFD700] text-[#705E00] hover:brightness-105"
                    : "pointer-events-none bg-[#26314A] text-[#8290AE]"
                }`}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Open Selected
              </Link>
            </div>
          </div>

          {!address ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-[#0B1120] p-8 text-center text-sm text-[#9FB0D0]">
              Connect your wallet to load indexed tickets from the backend.
            </div>
          ) : null}

          {address && ticketsQuery.isError ? (
            <div className="mt-6 rounded-xl border border-[#8E4A74] bg-[#2A1521] p-5 text-sm text-[#FFB4AB]">
              {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Failed to load ticket inventory."}
            </div>
          ) : null}

          {address && ticketsQuery.isLoading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map(index => (
                <div key={index} className="h-72 animate-pulse rounded-xl border border-white/10 bg-[#0B1120]" />
              ))}
            </div>
          ) : null}

          {address && ticketsQuery.isSuccess && filteredTickets.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-[#0B1120] p-8 text-center text-sm text-[#9FB0D0]">
              No tickets match this view.
            </div>
          ) : null}

          {filteredTickets.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredTickets.map(ticket => {
                const ticketHref = `/scratch/${ticket.poolId}?tickets=${ticket.ticketId}`;
                const checked = selectedTicketIds.has(ticket.ticketId);

                return (
                  <article
                    key={ticket.ticketId}
                    className={`overflow-hidden rounded-xl border bg-[#0B1120] transition ${
                      checked ? "border-[#FFD700]/70 shadow-[0_0_0_1px_rgba(255,215,0,0.25)]" : "border-white/10"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#171F31]">
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,#1B2440_0%,#0B1120_48%,#332814_100%)]" />
                      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
                      <div className="absolute left-4 top-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${ticketToneClassName(
                            ticket,
                          )}`}
                        >
                          {ticketStatusLabel(ticket)}
                        </span>
                      </div>
                      <label className="absolute right-4 top-4 rounded-lg bg-black/35 p-2 backdrop-blur">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTicket(ticket.ticketId)}
                          className="checkbox checkbox-sm border-[#FFD700] [--chkbg:#FFD700] [--chkfg:#705E00]"
                        />
                      </label>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <TicketIcon className="h-16 w-16 text-[#FFD700]/80" />
                        <p className="mt-3 font-headline text-4xl font-black text-white">#{ticket.ticketId}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[#D0C6AB]">
                          Pool {ticket.poolId} / Round {ticket.roundId}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-[#11192B] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8290AE]">Index</p>
                          <p className="mt-1 font-bold text-[#DCE2F9]">{ticket.ticketIndex + 1}</p>
                        </div>
                        <div className="rounded-lg bg-[#11192B] p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8290AE]">Claimed</p>
                          <p className="mt-1 font-bold text-[#FFD700]">
                            {formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC
                          </p>
                        </div>
                      </div>

                      <Link
                        href={ticketHref}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFD700] px-4 py-3 text-sm font-black text-[#705E00] transition hover:brightness-105"
                      >
                        {ticket.status === "Unscratched" ? "Scratch Ticket" : "Open Scratch Queue"}
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
