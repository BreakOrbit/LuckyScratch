"use client";

import { useLuckyScratchPlatformOverview } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { formatCompactCount, formatCompactMicroUsdc } from "~~/services/luckyScratch/display";

type StatCardProps = {
  label: string;
  value: string;
  valueColor: string;
  accentColor: string;
};

const StatCard = ({ label, value, valueColor, accentColor }: StatCardProps) => {
  return (
    <div className="glass-panel p-8 group hover:bg-ns-surface-container-high transition-colors">
      <div className="text-ns-on-surface-variant/60 text-[10px] uppercase font-label tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-headline font-bold tracking-tight ${valueColor}`}>{value}</div>
      <div className={`mt-4 h-1 w-12 ${accentColor} group-hover:w-full transition-all duration-500`} />
    </div>
  );
};

export const StatsSection = () => {
  const { data } = useLuckyScratchPlatformOverview();

  const stats: StatCardProps[] = [
    {
      label: "Total Volume",
      value: data ? `${formatCompactMicroUsdc(data.totalRealizedRevenue)} USDC` : "--",
      valueColor: "text-ns-primary",
      accentColor: "bg-ns-primary/40",
    },
    {
      label: "Claimed Rewards",
      value: data ? `${formatCompactMicroUsdc(data.totalClaimedRewards)} USDC` : "--",
      valueColor: "text-ns-on-surface",
      accentColor: "bg-ns-secondary/40",
    },
    {
      label: "Active Pools",
      value: data ? formatCompactCount(data.activePools) : "--",
      valueColor: "text-ns-on-surface",
      accentColor: "bg-ns-primary/40",
    },
    {
      label: "Tickets Revealed",
      value: data ? formatCompactCount(data.totalRevealedTickets) : "--",
      valueColor: "text-ns-on-surface",
      accentColor: "bg-ns-secondary/40",
    },
  ];

  return (
    <section id="stats-section" className="max-w-7xl mx-auto px-8 -mt-20 relative z-30">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
};
