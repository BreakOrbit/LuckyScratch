"use client";

import React from "react";
import { MyTicketsIcon, type PoolIconName } from "~~/components/my-tickets/icons";

export type TicketStatus = "unrevealed" | "winning" | "no-win";

export type TicketCardData = {
  id: string;
  ticketId: string;
  poolName: string;
  poolIcon: PoolIconName;
  cost: string;
  status: TicketStatus;
  /** Prize amount for winning tickets */
  prizeAmount?: string;
  /** Image URL for revealed tickets */
  image?: string;
};

/* ── Unrevealed Ticket ── */
const UnrevealedTicket = ({ poolName, poolIcon, ticketId, cost }: TicketCardData) => (
  <div
    className="group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border border-[#4d4732]/30 hover:scale-[1.02] transition-all duration-300"
    style={{ boxShadow: "inset 0 0 0 1px rgba(255, 215, 0, 0.2), 0 0 15px rgba(0, 0, 0, 0.5)" }}
  >
    <div className="aspect-[4/5] relative overflow-hidden bg-[#1a2333]">
      <div className="absolute inset-0 bg-gradient-to-tr from-[#1a2333] via-[#2e3546] to-[#1a2333]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 100%)",
          backgroundSize: "200% 200%",
          animation: "card-shimmer 3s infinite",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border-2 border-[#ffd700]/30 flex items-center justify-center bg-[#181f30]/40 backdrop-blur-md">
          <MyTicketsIcon name="lock" className="h-12 w-12 animate-pulse text-[#ffe16d]" />
        </div>
      </div>
    </div>
    <div className="p-4 bg-[#232a3b]/50">
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5 text-[#ffd700] font-headline font-bold text-sm">
          <MyTicketsIcon name={poolIcon} className="h-4 w-4" />
          {poolName}
        </div>
        <div className="text-[10px] text-[#d0c6ab]/60 font-bold">COST</div>
      </div>
      <div className="flex justify-between items-end">
        <div className="text-xs text-[#d0c6ab]">Ticket ID: #{ticketId}</div>
        <div className="text-sm font-black text-[#dce2f9]">{cost}</div>
      </div>
    </div>
    <div className="p-3 bg-[#070e1d]">
      <button className="w-full py-2 bg-[#ffd700]/10 border border-[#ffd700]/30 text-[#ffd700] font-bold rounded-lg text-xs hover:bg-[#ffd700] hover:text-[#705e00] transition-all flex items-center justify-center gap-2">
        <MyTicketsIcon name="visibility" className="h-4 w-4" />
        REVEAL
      </button>
    </div>
  </div>
);

/* ── Winning Ticket ── */
const WinningTicket = ({ poolName, poolIcon, ticketId, cost, prizeAmount, image }: TicketCardData) => (
  <div className="group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border-2 border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:scale-[1.02] transition-all duration-300">
    <div className="aspect-[4/5] relative overflow-hidden">
      {image && <img src={image} alt={poolName} className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute top-3 right-3 bg-[#ffd700] text-[#705e00] font-black px-2 py-0.5 rounded text-[10px] tracking-widest shadow-lg">
        WINNER
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-8">
        <div
          className="text-4xl font-headline font-black text-[#ffd700]"
          style={{ textShadow: "0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3)" }}
        >
          {prizeAmount}
        </div>
        <div className="text-[10px] font-bold text-[#ffd700]/80 tracking-widest uppercase">WINNING REVEAL</div>
      </div>
    </div>
    <div className="p-4 bg-[#232a3b]/50">
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5 text-[#ffd700] font-headline font-bold text-sm">
          <MyTicketsIcon name={poolIcon} className="h-4 w-4" />
          {poolName}
        </div>
        <div className="text-[10px] text-[#d0c6ab]/60 font-bold">COST</div>
      </div>
      <div className="flex justify-between items-end">
        <div className="text-xs text-[#d0c6ab]">Ticket ID: #{ticketId}</div>
        <div className="text-sm font-black text-[#dce2f9]">{cost}</div>
      </div>
    </div>
    <div className="p-3 bg-[#070e1d]">
      <button className="w-full py-2 bg-[#ffd700] text-[#705e00] font-black rounded-lg text-xs shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
        <MyTicketsIcon name="payments" className="h-4 w-4" />
        CLAIM REWARD
      </button>
    </div>
  </div>
);

/* ── No-Win Ticket ── */
const NoWinTicket = ({ poolName, poolIcon, ticketId, cost, image }: TicketCardData) => (
  <div className="group relative flex flex-col bg-[#070e1d] rounded-xl overflow-hidden border border-[#4d4732]/30 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
    <div className="aspect-[4/5] relative overflow-hidden bg-black">
      {image && <img src={image} alt={poolName} className="absolute inset-0 w-full h-full object-cover opacity-50" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-headline font-bold text-[#d0c6ab]/40">0 USDC</div>
        <div className="text-[9px] font-bold text-[#d0c6ab]/30 tracking-widest uppercase mt-2">
          BETTER LUCK NEXT TIME
        </div>
      </div>
    </div>
    <div className="p-4 bg-[#232a3b]/50">
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5 text-[#d0c6ab] font-headline font-bold text-sm">
          <MyTicketsIcon name={poolIcon} className="h-4 w-4" />
          {poolName}
        </div>
        <div className="text-[10px] text-[#d0c6ab]/40 font-bold">COST</div>
      </div>
      <div className="flex justify-between items-end">
        <div className="text-xs text-[#d0c6ab]/40">Ticket ID: #{ticketId}</div>
        <div className="text-sm font-black text-[#d0c6ab]/40">{cost}</div>
      </div>
    </div>
    <div className="p-3 bg-[#070e1d]">
      <button
        disabled
        className="w-full py-2 bg-[#181f30] text-[#d0c6ab]/40 font-bold rounded-lg text-xs cursor-default flex items-center justify-center gap-2"
      >
        REVEALED
      </button>
    </div>
  </div>
);

/* ── Dispatcher ── */
export const TicketCard = (props: TicketCardData) => {
  switch (props.status) {
    case "unrevealed":
      return <UnrevealedTicket {...props} />;
    case "winning":
      return <WinningTicket {...props} />;
    case "no-win":
      return <NoWinTicket {...props} />;
    default:
      return null;
  }
};
