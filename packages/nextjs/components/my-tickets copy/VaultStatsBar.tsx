"use client";

import React from "react";
import { MyTicketsIcon, type MyTicketsIconName } from "~~/components/my-tickets/icons";

type StatCardProps = {
  label: string;
  value: string;
  icon: MyTicketsIconName;
  valueColor: string;
};

const StatCard = ({ label, value, icon, valueColor }: StatCardProps) => (
  <div className="bg-[#181f30]/70 backdrop-blur-xl p-6 rounded-xl border border-[#4d4732]/20 flex flex-col gap-1 relative overflow-hidden group">
    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <MyTicketsIcon name={icon} className="h-28 w-28" />
    </div>
    <span className="text-[#d0c6ab] text-xs font-label uppercase tracking-widest">{label}</span>
    <span className={`text-3xl font-headline font-bold ${valueColor}`}>{value}</span>
  </div>
);

export const VaultStatsBar = () => {
  return (
    <section className="mb-12">
      <h1 className="text-5xl md:text-6xl font-headline font-black text-[#ffd700] tracking-tighter mb-8 drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] uppercase">
        MY TICKET VAULT
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="TOTAL WINNINGS" value="156.00 USDC" icon="payments" valueColor="text-[#ffe16d]" />
        <StatCard label="PENDING REWARDS" value="25.00 USDC" icon="pending" valueColor="text-[#00DAF3]" />
        <StatCard label="TOTAL TICKETS" value="42" icon="confirmation_number" valueColor="text-[#cabeff]" />
      </div>
    </section>
  );
};
