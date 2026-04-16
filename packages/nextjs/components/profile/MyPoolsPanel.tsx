import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  KeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";

type PoolAction = {
  label: string;
  className: string;
};

type SummaryCard = {
  label: string;
  value: string;
  valueSuffix?: string;
  accent?: string;
  accentClassName?: string;
  borderClassName: string;
};

type PoolCard = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  statusLabel: string;
  statusClassName: string;
  modeLabel: string;
  modeClassName: string;
  progressLabel: string;
  progressValue: number;
  revenue: string;
  platformFee: string;
  paidPrizes: string;
  summaryLabel: string;
  summaryValue: string;
  summaryValueClassName: string;
  bondStatusLabel: string;
  bondStatusValue: string;
  bondStatusClassName: string;
  bondIcon: "lock" | "key";
  actions: PoolAction[];
};

const summaryCards: SummaryCard[] = [
  {
    label: "Total Pools",
    value: "12",
    accent: "+2 active",
    accentClassName: "text-[#00DAF3]",
    borderClassName: "border-[#FFD700]/30",
  },
  {
    label: "Total Revenue",
    value: "4.8k",
    valueSuffix: "USDC",
    borderClassName: "border-[#CABEFF]/30",
  },
  {
    label: "Tickets Sold",
    value: "1,248",
    accent: "84% fill",
    accentClassName: "text-[#CABEFF]",
    borderClassName: "border-[#00DAF3]/30",
  },
  {
    label: "Bonds Locked",
    value: "650",
    valueSuffix: "USDC",
    borderClassName: "border-[#FFB4AB]/30",
  },
] as const;

const sortOptions = ["Latest", "Popular", "Win Rate", "Price"] as const;

const poolCards: PoolCard[] = [
  {
    id: "8842",
    title: "Ancient Solar Engine",
    subtitle: "Pool #8842 • Launched 3 days ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA3ND9YwXzvEoy3V0VhPWUL4xZDOPxvB7oQvyiQq8M-GQNs8bEcc5Exu3lblAXRMeVSsW3TBzC3094B3ZoHnI3Ls0873740p0LaamHc7lrpIqD4bLf6UJBgo2ofzmDXhhFGq72ceGuXCfCPOltcNpR7oNfypwhtGt1MEffMbwn95hGDUpiklWcNrhtP-K9DLCLcb_ag1ihg14wSi6jJMj7vFA8aMPgxeK7M1o-QwqEz8pkhi5wkx7n_6ksluD25VR9gN9TbuOGFUBJV",
    statusLabel: "OPERATING",
    statusClassName: "bg-[#FFD700]/90 text-[#705E00]",
    modeLabel: "LOOP",
    modeClassName: "bg-[#4719C9]/90 text-[#B8AAFF]",
    progressLabel: "34 / 56",
    progressValue: 60,
    revenue: "68 USDC",
    platformFee: "5.44 USDC",
    paidPrizes: "45 USDC",
    summaryLabel: "Claimable",
    summaryValue: "12.56 USDC",
    summaryValueClassName: "text-[#FFE16D]",
    bondStatusLabel: "BOND STATUS",
    bondStatusValue: "LOCKED",
    bondStatusClassName: "text-[#FFB4AB]",
    bondIcon: "lock",
    actions: [
      { label: "Withdraw", className: "bg-[#FFD700] text-[#705E00]" },
      { label: "Close", className: "bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20" },
      { label: "Details", className: "bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20" },
    ],
  },
  {
    id: "8712",
    title: "Shadow Realm Gate",
    subtitle: "Pool #8712 • Finalized 2h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBs2K1Ua8xWrOfweu3nv-_D86oeNbbIZRtDkirECJhvX03fj4KjQgCsZxwdCHZaYPvpXEoF4Cst6f8SXQyfHRnEnnh_grgxsZa5Pff1ZqX6zOhZJLsHUJLl8P1wpUGZ7Tzq7UqziRFu_t46jeByNb8VpOk8tYPu2Ma2oLGRpo4M1ZP6gmRdnOZsl1CpREoRxooisEEqX8c9-woKtho719H0wnYdctvVmnS2LBnQ2pbryFoXukRgfhk_rhcWzvkHY-UnRrpnvxVT8HD4",
    statusLabel: "CLOSED",
    statusClassName: "bg-[#D0C6AB]/90 text-[#0C1323]",
    modeLabel: "ONE-TIME",
    modeClassName: "bg-[#4719C9]/90 text-[#B8AAFF]",
    progressLabel: "100 / 100",
    progressValue: 100,
    revenue: "450 USDC",
    platformFee: "36.00 USDC",
    paidPrizes: "300 USDC",
    summaryLabel: "Total Profit",
    summaryValue: "114.00 USDC",
    summaryValueClassName: "text-[#FFE16D]",
    bondStatusLabel: "BOND STATUS",
    bondStatusValue: "REFUNDABLE",
    bondStatusClassName: "text-[#00DAF3]",
    bondIcon: "key",
    actions: [
      { label: "Refund Bond", className: "bg-[#72EBFF] text-[#004F58]" },
      { label: "Details", className: "bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20" },
    ],
  },
  {
    id: "8901",
    title: "Void Shard Lottery",
    subtitle: "Pool #8901 • Just Launched",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCQzFh1u-R5nYyGV80XUOVVDxMQOf0FFjbsZQUqzqV1z3uOlbfHrtN77Q_u7SgjBjfu23i7XPiVY2btZh6Hh_SgQW40WyF3wlZ0W0IZNFXZ-CZejoQ4sLK5dWRo0Nc_UR82wVCc4SM76kJdBj7gEOb1SLBiLZrHxiuvqpimePgiNxlYvGso7t1Y6oUNFoB4u5l2zvpbUDgla8lHPfIaHRoN3SUNAY6crOYUIL1QChX1ZAt6p0nWZkIPX8LBVDqrVCKv7svKjYAszc4t",
    statusLabel: "OPERATING",
    statusClassName: "bg-[#FFD700]/90 text-[#705E00]",
    modeLabel: "LOOP",
    modeClassName: "bg-[#4719C9]/90 text-[#B8AAFF]",
    progressLabel: "2 / 200",
    progressValue: 1,
    revenue: "5 USDC",
    platformFee: "0.40 USDC",
    paidPrizes: "0 USDC",
    summaryLabel: "Claimable",
    summaryValue: "0.60 USDC",
    summaryValueClassName: "text-[#FFE16D]",
    bondStatusLabel: "BOND STATUS",
    bondStatusValue: "LOCKED",
    bondStatusClassName: "text-[#FFB4AB]",
    bondIcon: "lock",
    actions: [
      { label: "Withdraw", className: "bg-[#FFD700]/20 text-[#D0C6AB] cursor-not-allowed" },
      { label: "Close", className: "bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20" },
      { label: "Details", className: "bg-[#2E3546] text-[#DCE2F9] border border-[#4D4732]/20" },
    ],
  },
];

export function MyPoolsPanel() {
  return (
    <div className="space-y-8 bg-[#0C1323] text-[#DCE2F9]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-[#DCE2F9]">MY POOLS</h1>
          <p className="mt-1 text-sm text-[#D0C6AB]">Manage and track your issued liquidity pools</p>
        </div>
        <Link
          href="/create-pool"
          className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_50%,#ffe16d_100%)] px-6 py-3 font-headline font-bold text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.2)] transition-transform active:scale-95"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Create New Pool
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-xl border-l-2 ${card.borderClassName} bg-[#141B2C] p-6`}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#D0C6AB]">{card.label}</p>
            <div className="flex items-end gap-2">
              <p className="font-headline text-3xl font-bold text-[#DCE2F9]">
                {card.value}
                {card.valueSuffix ? (
                  <span className="ml-1 text-sm font-normal text-[#D0C6AB]">{card.valueSuffix}</span>
                ) : null}
              </p>
              {card.accent ? <span className={`mb-1 text-xs ${card.accentClassName}`}>{card.accent}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 md:flex-row">
        <div className="relative w-full flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D0C6AB]" />
          <input
            className="w-full rounded-xl border border-[#4D4732]/20 bg-[#070E1D] py-3 pl-12 pr-4 text-[#DCE2F9] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none transition-all placeholder:text-[#D0C6AB]/50 focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/50"
            placeholder="Search by pool name, ID, or asset..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[#4D4732]/10 bg-[#232A3B] px-4 py-2 shadow-[0_0_15px_rgba(255,215,0,0.15)]">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-[#D0C6AB]">Sort By</span>
          <div className="flex flex-wrap gap-1">
            {sortOptions.map(option => {
              const active = option === "Latest";
              return (
                <button
                  key={option}
                  type="button"
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "border border-[#FFD700]/50 bg-[#1A2133] text-[#FFE16D] shadow-inner"
                      : "text-[#D0C6AB] hover:bg-[#2E3546]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {poolCards.map(card => {
          const BondIcon = card.bondIcon === "lock" ? LockClosedIcon : KeyIcon;

          return (
            <article
              key={card.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#4D4732]/10 bg-[#232A3B] shadow-2xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.08)]"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  alt={card.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  src={card.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#232A3B] via-transparent to-transparent" />
                <div className="absolute left-4 top-4 flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tighter backdrop-blur-md ${card.statusClassName}`}
                  >
                    {card.statusLabel}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tighter backdrop-blur-md ${card.modeClassName}`}
                  >
                    {card.modeLabel}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4">
                <h3 className="mb-1 font-headline text-xl font-bold uppercase tracking-tight text-[#FFE16D]">
                  {card.title}
                </h3>
                <p className="mb-4 text-xs text-[#D0C6AB]">{card.subtitle}</p>

                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs font-bold">
                    <span className="text-[#DCE2F9]">SALES PROGRESS</span>
                    <span className="text-[#00DAF3]">{card.progressLabel}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#070E1D]">
                    <div
                      className="h-full bg-[#00DAF3] shadow-[0_0_8px_rgba(0,218,243,0.5)]"
                      style={{ width: `${card.progressValue}%` }}
                    />
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Revenue</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">{card.revenue}</p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Platform Fee</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">{card.platformFee}</p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#D0C6AB]">Paid Prizes</p>
                    <p className="font-headline text-sm font-bold text-[#DCE2F9]">{card.paidPrizes}</p>
                  </div>
                  <div className="rounded-lg border border-[#4D4732]/5 bg-[#181F30] p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#00DAF3]">{card.summaryLabel}</p>
                    <p className={`font-headline text-sm font-bold ${card.summaryValueClassName}`}>
                      {card.summaryValue}
                    </p>
                  </div>
                </div>

                <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#4D4732]/10 bg-[#070E1D]/50 px-3 py-2">
                  <BondIcon className={`h-4 w-4 ${card.bondStatusClassName}`} />
                  <span className="text-[10px] font-bold text-[#D0C6AB]">
                    {card.bondStatusLabel}: <span className={card.bondStatusClassName}>{card.bondStatusValue}</span>
                  </span>
                </div>
              </div>

              <div
                className={`mt-auto grid gap-2 px-4 pb-6 ${card.actions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
              >
                {card.actions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    className={`rounded py-2 text-[10px] font-bold uppercase transition-transform active:scale-95 ${action.className}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-12 flex items-center justify-center gap-6">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#4D4732]/20 bg-[#232A3B] text-[#D0C6AB] transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            className="h-10 w-10 rounded-full bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_50%,#ffe16d_100%)] font-headline font-bold text-[#705E00]"
          >
            1
          </button>
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-[#4D4732]/10 bg-[#232A3B] font-headline font-bold text-[#DCE2F9] transition-colors hover:border-[#FFD700]"
          >
            2
          </button>
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-[#4D4732]/10 bg-[#232A3B] font-headline font-bold text-[#DCE2F9] transition-colors hover:border-[#FFD700]"
          >
            3
          </button>
          <span className="flex h-10 w-10 items-center justify-center text-[#D0C6AB]">...</span>
          <button
            type="button"
            className="h-10 w-10 rounded-full border border-[#4D4732]/10 bg-[#232A3B] font-headline font-bold text-[#DCE2F9] transition-colors hover:border-[#FFD700]"
          >
            8
          </button>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#4D4732]/20 bg-[#232A3B] text-[#D0C6AB] transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
