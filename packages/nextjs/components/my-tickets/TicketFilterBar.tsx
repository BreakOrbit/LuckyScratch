"use client";

import Link from "next/link";
import { MyTicketsIcon } from "~~/components/my-tickets/icons";

type TicketTab = "all" | "unrevealed" | "revealed" | "winning" | "to-claim";

type TicketFilterBarProps = {
  activeTab: TicketTab;
  onTabChange: (tab: TicketTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  poolFilterInput: string;
  onPoolFilterChange: (query: string) => void;
  onPoolFilterClear: () => void;
  selectAll: boolean;
  onSelectAllChange: (checked: boolean) => void;
  claimCount?: number;
  selectedCount: number;
  canOpenSelected: boolean;
  openSelectedHref: string;
  openSelectedTitle?: string;
  selectedClaimableCount: number;
  claimSelectedLabel: string;
  claimSelectedDisabled: boolean;
  onClaimSelected: () => void;
};

const TABS: { key: TicketTab; label: string; badge?: boolean }[] = [
  { key: "all", label: "ALL" },
  { key: "unrevealed", label: "UNREVEALED" },
  { key: "revealed", label: "REVEALED" },
  { key: "winning", label: "WINNING" },
  { key: "to-claim", label: "TO CLAIM", badge: true },
];

export const TicketFilterBar = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  poolFilterInput,
  onPoolFilterChange,
  onPoolFilterClear,
  selectAll,
  onSelectAllChange,
  claimCount = 0,
  selectedCount,
  canOpenSelected,
  openSelectedHref,
  openSelectedTitle,
  selectedClaimableCount,
  claimSelectedLabel,
  claimSelectedDisabled,
  onClaimSelected,
}: TicketFilterBarProps) => {
  return (
    <section className="mb-10 space-y-4">
      <div className="flex items-center gap-1 border-b border-[#4d4732]/20 pb-2 overflow-x-auto scrollbar-hide">
        {TABS.map(({ key, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={`px-6 py-2 text-sm whitespace-nowrap transition-colors ${
              activeTab === key
                ? "font-bold text-[#ffd700] border-b-2 border-[#ffd700]"
                : "font-medium text-[#d0c6ab] hover:text-[#fff6df]"
            }`}
          >
            <span className="flex items-center gap-2">
              {label}
              {badge && claimCount > 0 && (
                <span className="bg-[#ffd700] text-[#705e00] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {claimCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div className="flex flex-col gap-3 w-full xl:w-auto md:flex-row md:items-center">
          <div className="flex items-center gap-2 shrink-0 bg-[#232a3b]/50 px-3 py-2 rounded-lg border border-[#4d4732]/30">
            <input
              id="select-all-tickets"
              type="checkbox"
              checked={selectAll}
              onChange={e => onSelectAllChange(e.target.checked)}
              className="w-4 h-4 rounded border-[#4d4732] text-[#ffd700] focus:ring-[#ffd700] bg-[#070e1d] transition-all accent-[#ffd700]"
            />
            <label
              htmlFor="select-all-tickets"
              className="text-xs font-bold text-[#d0c6ab] uppercase tracking-wider cursor-pointer select-none"
            >
              Select All
            </label>
          </div>

          <div className="relative w-full md:w-80">
            <MyTicketsIcon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d0c6ab]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search Ticket ID or status..."
              className="w-full bg-[#070e1d] border border-[#4d4732]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-[#ffd700]/50 outline-none transition-all placeholder:text-[#d0c6ab]/40 text-[#dce2f9]"
            />
          </div>

          <div className="relative w-full md:w-32">
            <input
              type="text"
              inputMode="numeric"
              value={poolFilterInput}
              onChange={e => onPoolFilterChange(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Pool #"
              className="w-full bg-[#070e1d] border border-[#4d4732]/30 rounded-lg pl-3 pr-9 py-2.5 text-sm focus:ring-1 focus:ring-[#ffd700]/50 outline-none transition-all placeholder:text-[#d0c6ab]/40 text-[#dce2f9]"
            />
            {poolFilterInput ? (
              <button
                type="button"
                onClick={onPoolFilterClear}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#d0c6ab]/60 transition hover:bg-white/10 hover:text-[#fff6df]"
                aria-label="Clear pool filter"
              >
                <MyTicketsIcon name="close" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full xl:w-auto sm:flex-row">
          <div className="flex-1 md:flex-none px-5 py-2.5 bg-[#232a3b]/60 border border-[#4d4732]/30 text-[#d0c6ab] rounded-lg font-bold text-sm flex items-center justify-center gap-2">
            <MyTicketsIcon name="confirmation_number" className="h-4 w-4" />
            SELECTED {selectedCount}
          </div>
          <Link
            href={openSelectedHref}
            aria-disabled={!canOpenSelected}
            title={openSelectedTitle}
            className={`flex-1 md:flex-none px-6 py-2.5 border rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              canOpenSelected
                ? "bg-[#232a3b] border-[#4d4732]/50 text-[#dce2f9] hover:bg-[#32394a]"
                : "pointer-events-none bg-[#181f30] border-[#4d4732]/20 text-[#d0c6ab]/35"
            }`}
          >
            <MyTicketsIcon name="content_cut" className="h-4 w-4" />
            OPEN SELECTED
          </Link>
          <Link
            href={openSelectedHref}
            aria-disabled={!canOpenSelected}
            title={openSelectedTitle}
            className={`flex-1 md:flex-none px-6 py-2.5 border rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              canOpenSelected
                ? "bg-[#232a3b] border-[#4d4732]/50 text-[#dce2f9] hover:bg-[#32394a]"
                : "pointer-events-none bg-[#181f30] border-[#4d4732]/20 text-[#d0c6ab]/35"
            }`}
          >
            <MyTicketsIcon name="layers" className="h-4 w-4" />
            BATCH REVEAL
          </Link>
          <button
            type="button"
            disabled={selectedClaimableCount === 0 || claimSelectedDisabled}
            onClick={onClaimSelected}
            className="flex-1 md:flex-none px-6 py-2.5 bg-[#ffd700] text-[#705e00] rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-[#232a3b] disabled:text-[#d0c6ab]/35 disabled:shadow-none disabled:hover:scale-100"
          >
            <MyTicketsIcon name="auto_awesome" className="h-4 w-4" />
            {claimSelectedLabel}
          </button>
        </div>
      </div>
    </section>
  );
};
