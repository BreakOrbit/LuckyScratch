"use client";

import { MyTicketsIcon } from "~~/components/my-tickets/icons";

type TicketTab = "all" | "unrevealed" | "revealed" | "winning" | "to-claim";

type TicketFilterBarProps = {
  activeTab: TicketTab;
  onTabChange: (tab: TicketTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectAll: boolean;
  onSelectAllChange: (checked: boolean) => void;
  claimCount?: number;
  onRevealAll?: () => void;
  onBatchReveal?: () => void;
  onClaimAll?: () => void;
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
  selectAll,
  onSelectAllChange,
  claimCount = 0,
  onRevealAll,
  onBatchReveal,
  onClaimAll,
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

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-4 w-full md:w-auto items-center">
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

          <div className="relative w-full md:w-96 flex-1">
            <MyTicketsIcon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d0c6ab]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search Ticket ID or Pool Name..."
              className="w-full bg-[#070e1d] border border-[#4d4732]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-[#ffd700]/50 outline-none transition-all placeholder:text-[#d0c6ab]/40 text-[#dce2f9]"
            />
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onRevealAll}
            className="flex-1 md:flex-none px-6 py-2.5 bg-[#232a3b] border border-[#4d4732]/50 text-[#dce2f9] rounded-lg font-bold text-sm hover:bg-[#32394a] transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="content_cut" className="h-4 w-4" />
            REVEAL ALL
          </button>
          <button
            type="button"
            onClick={onBatchReveal}
            className="flex-1 md:flex-none px-6 py-2.5 bg-[#232a3b] border border-[#4d4732]/50 text-[#dce2f9] rounded-lg font-bold text-sm hover:bg-[#32394a] transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="layers" className="h-4 w-4" />
            BATCH REVEAL
          </button>
          <button
            type="button"
            onClick={onClaimAll}
            className="flex-1 md:flex-none px-6 py-2.5 bg-[#ffd700] text-[#705e00] rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <MyTicketsIcon name="auto_awesome" className="h-4 w-4" />
            CLAIM ALL
          </button>
        </div>
      </div>
    </section>
  );
};
