"use client";

type StatCardProps = {
  label: string;
  value: string;
  valueColor: string;
  accentColor: string;
};

const StatCard = ({ label, value, valueColor, accentColor }: StatCardProps) => {
  return (
    <div className="glass-panel p-8 group hover:bg-ns-surface-container-high transition-colors">
      <div className="text-ns-on-surface-variant/60 text-[10px] uppercase font-label tracking-widest mb-2">
        {label}
      </div>
      <div className={`text-3xl font-headline font-bold tracking-tight ${valueColor}`}>
        {value}
      </div>
      <div
        className={`mt-4 h-1 w-12 ${accentColor} group-hover:w-full transition-all duration-500`}
      />
    </div>
  );
};

const stats: StatCardProps[] = [
  { label: "Total Volume", value: "$42,982,105", valueColor: "text-ns-primary", accentColor: "bg-ns-primary/40" },
  { label: "Tickets Scratched", value: "1.2M+", valueColor: "text-ns-on-surface", accentColor: "bg-ns-secondary/40" },
  { label: "Active Pools", value: "852", valueColor: "text-ns-on-surface", accentColor: "bg-ns-primary/40" },
  { label: "Total Winners", value: "156,092", valueColor: "text-ns-on-surface", accentColor: "bg-ns-secondary/40" },
];

export const StatsSection = () => {
  return (
    <section id="stats-section" className="max-w-7xl mx-auto px-8 -mt-20 relative z-30">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </section>
  );
};
