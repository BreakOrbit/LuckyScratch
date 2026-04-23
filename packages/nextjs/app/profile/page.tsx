"use client";

import { type ReactNode, useCallback, useState } from "react";
import { useAccount } from "wagmi";
import {
  Cog8ToothIcon,
  DocumentDuplicateIcon,
  RectangleGroupIcon,
  SparklesIcon,
  StarIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import MyTicketsPage from "~~/app/my-tickets/page";
import { MyPoolsPanel } from "~~/components/profile/MyPoolsPanel";
import { OverviewPanel } from "~~/components/profile/OverviewPanel";
import { SettingsPanel } from "~~/components/profile/SettingsPanel";
import {
  useLuckyScratchCreatorSummary,
  useLuckyScratchUserTickets,
  useLuckyScratchUserWins,
} from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { notification } from "~~/utils/scaffold-eth";

const formatShortAddress = (address?: string) => {
  if (!address) {
    return "WALLET_NOT_CONNECTED";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const playerLabel = (address?: string) => {
  if (!address) {
    return "WALLET_NOT_CONNECTED";
  }
  return `PLAYER_${address.slice(2, 8).toUpperCase()}`;
};

const profileRoleLabel = (poolCount: number, winCount: number) => {
  if (poolCount > 0 && winCount > 0) {
    return "CREATOR + PLAYER";
  }
  if (poolCount > 0) {
    return "CREATOR";
  }
  if (winCount > 0) {
    return "WINNING PLAYER";
  }
  return "ACTIVE PLAYER";
};

export default function ProfilePage() {
  const { address } = useAccount();
  const [activeSection, setActiveSection] = useState("overview");
  const ticketsQuery = useLuckyScratchUserTickets(address);
  const winsQuery = useLuckyScratchUserWins(address);
  const creatorSummaryQuery = useLuckyScratchCreatorSummary(address);

  const totalTickets = ticketsQuery.data?.items.length ?? 0;
  const claimedWins = winsQuery.data?.items.length ?? 0;
  const createdPools = creatorSummaryQuery.data?.totalPools ?? 0;
  const revealedTickets = ticketsQuery.data?.items.filter(ticket => ticket.status !== "Unscratched").length ?? 0;

  const copyAddress = useCallback(async () => {
    if (!address) {
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      notification.success("Wallet address copied.");
    } catch {
      notification.error("Failed to copy wallet address.");
    }
  }, [address]);

  const renderSectionShell = (content: ReactNode, options?: { padded?: boolean; framed?: boolean }) => {
    const padded = options?.padded ?? true;
    const framed = options?.framed ?? true;

    if (!framed) {
      return <div className={padded ? "w-full p-6 md:p-8" : "w-full"}>{content}</div>;
    }

    return (
      <div className="relative z-20 w-full overflow-hidden rounded-xl border border-ns-outline-variant/30 bg-[#0c1323] shadow-2xl">
        <div className={padded ? "w-full p-6 md:p-8" : "w-full"}>{content}</div>
      </div>
    );
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-12 pt-32 font-body text-ns-on-surface md:px-8">
      <div className="absolute left-1/2 top-1/4 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-ns-secondary-container opacity-5 blur-[120px]" />

      <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
        <aside className="space-y-6 lg:col-span-3">
          <div className="glass-panel group relative overflow-hidden rounded-xl p-8">
            <div className="pointer-events-none absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] !bg-[length:100%_2px,_3px_100%]" />
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(135deg,rgba(255,215,0,0.1)_0%,rgba(255,215,0,0)_50%,rgba(255,215,0,0.1)_100%)]" />
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-tr from-ns-primary-container via-ns-surface-bright to-ns-primary p-1 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0C1323] font-headline text-4xl font-black text-ns-primary-container">
                    {address ? address.slice(2, 4).toUpperCase() : "LS"}
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ns-primary-container px-4 py-0.5 text-[10px] font-black uppercase tracking-widest text-ns-on-primary">
                  {address ? "CONNECTED" : "OFFLINE"}
                </div>
              </div>

              <h2 className="mb-1 font-headline text-2xl font-bold text-ns-on-surface">{playerLabel(address)}</h2>
              <div className="mb-6 flex items-center gap-2">
                <span className="rounded bg-ns-surface-container-lowest px-2 py-1 font-mono text-xs text-ns-on-surface-variant">
                  {formatShortAddress(address)}
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  disabled={!address}
                  className="text-ns-tertiary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-8 w-full rounded-lg border-l-4 border-ns-primary-container bg-ns-surface-container-low p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-tighter text-ns-on-surface-variant">
                    Account Role
                  </span>
                  <StarIcon className="h-5 w-5 text-ns-primary-container" />
                </div>
                <div className="text-xl font-bold italic tracking-tight text-ns-primary">
                  {profileRoleLabel(createdPools, claimedWins)}
                </div>
                <p className="mt-2 text-xs text-ns-on-surface-variant">
                  {creatorSummaryQuery.isLoading || ticketsQuery.isLoading || winsQuery.isLoading
                    ? "Loading wallet profile..."
                    : `${createdPools} created pools • ${revealedTickets} revealed tickets • ${claimedWins} claimed wins`}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-4">
                <div className="rounded-lg border border-ns-outline-variant/10 bg-ns-surface-container-lowest p-3">
                  <div className="mb-1 text-[10px] uppercase text-ns-on-surface-variant">Total Tickets</div>
                  <div className="text-xl font-headline font-bold text-ns-on-surface">
                    {ticketsQuery.isLoading ? "--" : totalTickets}
                  </div>
                </div>
                <div className="rounded-lg border border-ns-outline-variant/10 bg-ns-surface-container-lowest p-3">
                  <div className="mb-1 text-[10px] uppercase text-ns-on-surface-variant">Claimed Wins</div>
                  <div className="text-xl font-headline font-bold text-ns-tertiary">
                    {winsQuery.isLoading ? "--" : claimedWins}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel overflow-hidden rounded-xl py-4">
            <nav className="flex flex-col">
              <button
                onClick={() => setActiveSection("overview")}
                className={`${activeSection === "overview" ? "mr-4 rounded-r-full bg-ns-primary text-[#0C1323] shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant duration-200 hover:translate-x-1 hover:bg-ns-surface-bright"} flex w-full items-center gap-4 px-6 py-3 text-left transition-all`}
              >
                <RectangleGroupIcon className="h-5 w-5" />
                <span className="font-body text-sm font-medium">Overview</span>
              </button>
              <button
                onClick={() => setActiveSection("my-tickets")}
                className={`${activeSection === "my-tickets" ? "mr-4 rounded-r-full bg-ns-primary text-[#0C1323] shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant duration-200 hover:translate-x-1 hover:bg-ns-surface-bright"} flex w-full items-center gap-4 px-6 py-3 text-left transition-all`}
              >
                <TicketIcon className="h-5 w-5" />
                <span className="font-body text-sm font-medium">My Tickets</span>
              </button>
              <button
                onClick={() => setActiveSection("my-pools")}
                className={`${activeSection === "my-pools" ? "mr-4 rounded-r-full bg-ns-primary text-[#0C1323] shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant duration-200 hover:translate-x-1 hover:bg-ns-surface-bright"} flex w-full items-center gap-4 px-6 py-3 text-left transition-all`}
              >
                <SparklesIcon className="h-5 w-5" />
                <span className="font-body text-sm font-medium">My Pools</span>
              </button>
              <button
                onClick={() => setActiveSection("setting")}
                className={`${activeSection === "setting" ? "mr-4 rounded-r-full bg-ns-primary text-[#0C1323] shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant duration-200 hover:translate-x-1 hover:bg-ns-surface-bright"} flex w-full items-center gap-4 px-6 py-3 text-left transition-all`}
              >
                <Cog8ToothIcon className="h-5 w-5" />
                <span className="font-body text-sm font-medium">Setting</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="space-y-8 lg:col-span-9">
          {activeSection === "overview" && renderSectionShell(<OverviewPanel />)}
          {activeSection === "my-tickets" && renderSectionShell(<MyTicketsPage />, { padded: false })}
          {activeSection === "my-pools" && renderSectionShell(<MyPoolsPanel />, { framed: false })}
          {activeSection === "setting" && renderSectionShell(<SettingsPanel />)}
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-0 right-0 p-8 opacity-20">
        <div className="h-64 w-64 rounded-br-3xl border-b-2 border-r-2 border-ns-primary-container" />
      </div>
      <div className="pointer-events-none fixed bottom-0 left-0 p-8 opacity-20">
        <div className="h-32 w-32 rounded-bl-3xl border-b-2 border-l-2 border-ns-tertiary" />
      </div>
    </main>
  );
}
