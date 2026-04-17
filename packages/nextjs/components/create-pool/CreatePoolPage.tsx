"use client";

import { useMemo, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ListBulletIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";

type PoolType = "official" | "community";
type LotteryWinType = "highWinRate" | "highMultiplier" | "balanced";

type RewardTier = {
  id: string;
  amount: number;
  quantity: number;
};

const INITIAL_REWARD_TIERS: RewardTier[] = [
  { id: "tier-1", amount: 100, quantity: 2 },
  { id: "tier-2", amount: 25, quantity: 12 },
];

const COVER_ART =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDahNGQr2ASL2Nl09sPhBwtt2FnXQOv1tcdwwb06RZ1yV-etg_hg1OkdbLtnpv4U1yIxaXqN67JCjtta16LjTDdd9yFKjBKnzIc3Q3TdyrLickqnz4FzibCs5UDTKYVfilLVW1xm6be7KKlwJbExyLW1geMjeGIZjCx_rEaVwdVw2LF2onKkNfnttar6ykkUQ1tC6OPIdzYMcnlvYli-bWxg--CPnKEQo2saahac8AR3QjMZ0x3S3v5mfEzFIIFHg9nJdqpUB9zka7U";

const TICKET_ART =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCTOSBhYYPgkqv07FmM5mq8BHyOsXJl7MjV7Zs0Jffonj_Wz9x_4X0KnVJxwq26ALm5HILaYzao-9xB50ADtxtl1kc1zJhcKODp3saif0RzXNO8mxSV-HvixeLIGT-kEHY9MVulaAFMZ6nbN7haU1T3wt_t-ZGz-2fsum9Rz-aQcjABJFPrOFVfEmTzobvsqRj3zvvInyEXrBlxo6BnJFVk303c0qAGooZZ9O63G97Rf3MopI_9V3dIVb7zksV3q8bJ3AE2uhP70_NX";

const inputClassName =
  "w-full rounded-lg bg-[#070E1D] px-3 py-3 text-sm text-[#DCE2F9] outline-none transition-all placeholder:text-[#D0C6AB]/50 focus:ring-2 focus:ring-[#00DAF3]";

const panelClassName = "rounded-xl border border-[#4D4732]/15 bg-[rgba(24,31,48,0.7)] p-6 backdrop-blur-[24px]";

const tierAccentClasses = ["border-[#FFD700]", "border-[#CABEFF]", "border-[#00DAF3]"];

export function CreatePoolPage() {
  const [poolType, setPoolType] = useState<PoolType>("official");
  const [lotteryWinType, setLotteryWinType] = useState<LotteryWinType>("balanced");
  const [poolName, setPoolName] = useState("Celestial Legends #1");
  const [ticketPrice, setTicketPrice] = useState(5);
  const [description, setDescription] = useState("Legend-grade scratch vault tuned for cinematic prize reveals.");
  const [prizePool, setPrizePool] = useState(500);
  const [totalTickets, setTotalTickets] = useState(1000);
  const [winRate, setWinRate] = useState(35);
  const [loopMode, setLoopMode] = useState(false);

  const LOTTERY_WIN_TYPES: {
    key: LotteryWinType;
    label: string;
    subtitle: string;
    description: string;
    icon: string;
    accent: string;
    defaultWinRate: number;
  }[] = [
    {
      key: "highWinRate",
      label: "High Win Rate",
      subtitle: "Frequent small wins",
      description: "High win probability with smaller prize amounts — most players win often.",
      icon: "🎯",
      accent: "#00DAF3",
      defaultWinRate: 60,
    },
    {
      key: "highMultiplier",
      label: "High Multiplier",
      subtitle: "Rare big jackpots",
      description: "Low win rate but massive prize payouts — fortune favors the bold.",
      icon: "💎",
      accent: "#CABEFF",
      defaultWinRate: 25,
    },
    {
      key: "balanced",
      label: "Balanced",
      subtitle: "Even distribution",
      description: "Prizes spread across big and small tiers — the best of both worlds.",
      icon: "⚖️",
      accent: "#FFD700",
      defaultWinRate: 35,
    },
  ];

  const handleLotteryWinTypeChange = (type: LotteryWinType) => {
    setLotteryWinType(type);
    const selected = LOTTERY_WIN_TYPES.find(t => t.key === type);
    if (selected) {
      setWinRate(selected.defaultWinRate);
    }
  };
  const [rewardTiers, setRewardTiers] = useState(INITIAL_REWARD_TIERS);

  const allocatedPrize = useMemo(
    () => rewardTiers.reduce((total, tier) => total + tier.amount * tier.quantity, 0),
    [rewardTiers],
  );
  const isPrizeValidated = allocatedPrize === prizePool;
  const bondAmount = useMemo(() => (prizePool * 1.1).toFixed(2), [prizePool]);
  const creationBondAmount = useMemo(() => prizePool * 1.2, [prizePool]);
  const grossRevenue = useMemo(() => ticketPrice * totalTickets, [ticketPrice, totalTickets]);
  const platformFeeAmount = useMemo(() => grossRevenue * 0.08, [grossRevenue]);
  const estimatedProfit = useMemo(
    () => grossRevenue - prizePool - platformFeeAmount,
    [grossRevenue, prizePool, platformFeeAmount],
  );
  const rtp = useMemo(() => (grossRevenue > 0 ? (prizePool / grossRevenue) * 100 : 0), [grossRevenue, prizePool]);

  const handleTierChange = (id: string, field: "amount" | "quantity", value: number) => {
    setRewardTiers(current =>
      current.map(tier => (tier.id === id ? { ...tier, [field]: Math.max(0, value || 0) } : tier)),
    );
  };

  const handleAddTier = () => {
    setRewardTiers(current => [
      ...current,
      {
        id: `tier-${Date.now()}`,
        amount: 10,
        quantity: 1,
      },
    ]);
  };

  const handleDeleteTier = (id: string) => {
    setRewardTiers(current => current.filter(tier => tier.id !== id));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0C1323] text-[#DCE2F9]">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-20">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[#4719C9] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[600px] w-[600px] rounded-full bg-[#2E3546] blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 md:px-8 md:pt-12">
        <header className="mb-10">
          <div className="mb-2 flex items-center gap-3 text-[#9CF0FF]">
            <CommandLineIcon className="h-4 w-4" />
            <span className="font-headline text-xs uppercase tracking-widest">Terminal Protocol v2.4</span>
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-[#DCE2F9] md:text-5xl">
            Initialize New <span className="text-[#FFD700]">Prize Pool</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[#D0C6AB]">
            Configure the parameters of your celestial reward vault. Ensure all financial variables align with your
            creator tier limits.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <ShieldCheckIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Pool Type Selection</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPoolType("official")}
                  className={`flex items-center justify-between rounded-lg p-4 text-left transition-all ${
                    poolType === "official" ? "bg-[#2E3546] ring-2 ring-[#FFD700]" : "bg-[#181F30] hover:bg-[#232A3B]"
                  }`}
                >
                  <div>
                    <p className={`font-bold ${poolType === "official" ? "text-[#FFD700]" : "text-[#DCE2F9]"}`}>
                      Official Platform Pool
                    </p>
                    <p className="mt-1 text-xs text-[#D0C6AB]">Verified by LuckyScratch Core</p>
                  </div>
                  {poolType === "official" ? (
                    <CheckCircleSolidIcon className="h-6 w-6 text-[#FFD700]" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-[#D0C6AB]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPoolType("community")}
                  className={`flex items-center justify-between rounded-lg p-4 text-left transition-all ${
                    poolType === "community" ? "bg-[#2E3546] ring-2 ring-[#FFD700]" : "bg-[#181F30] hover:bg-[#232A3B]"
                  }`}
                >
                  <div>
                    <p className={`font-bold ${poolType === "community" ? "text-[#FFD700]" : "text-[#DCE2F9]"}`}>
                      Community Creator Pool
                    </p>
                    <p className="mt-1 text-xs text-[#D0C6AB]">User-generated and autonomous</p>
                  </div>
                  {poolType === "community" ? (
                    <CheckCircleSolidIcon className="h-6 w-6 text-[#FFD700]" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-[#D0C6AB]" />
                  )}
                </button>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <SparklesIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Lottery Win Type</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {LOTTERY_WIN_TYPES.map(type => {
                  const isSelected = lotteryWinType === type.key;
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => handleLotteryWinTypeChange(type.key)}
                      className={`group relative flex flex-col rounded-xl p-5 text-left transition-all duration-200 ${
                        isSelected ? "bg-[#2E3546] shadow-lg" : "bg-[#181F30] hover:bg-[#232A3B] hover:shadow-md"
                      }`}
                      style={
                        isSelected
                          ? {
                              boxShadow: `0 0 24px ${type.accent}22`,
                              outline: `2px solid ${type.accent}`,
                              outlineOffset: "-2px",
                            }
                          : undefined
                      }
                    >
                      {isSelected && (
                        <div
                          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                          style={{ backgroundColor: type.accent, color: "#0C1323" }}
                        >
                          ✓
                        </div>
                      )}

                      <span className="mb-2 text-2xl">{type.icon}</span>

                      <p
                        className="font-headline text-lg font-bold transition-colors"
                        style={{ color: isSelected ? type.accent : "#DCE2F9" }}
                      >
                        {type.label}
                      </p>
                      <p className="text-[11px] font-medium text-[#D0C6AB]">{type.subtitle}</p>

                      <p className="mt-3 text-[11px] leading-relaxed text-[#D0C6AB]/80">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <AdjustmentsHorizontalIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Core Configuration</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="pool-name" className="text-sm font-medium text-[#D0C6AB]">
                    Pool Name
                  </label>
                  <input
                    id="pool-name"
                    className={inputClassName}
                    maxLength={20}
                    placeholder="e.g. Celestial Legends #1"
                    value={poolName}
                    onChange={event => setPoolName(event.target.value)}
                  />
                  <p className="text-right text-[10px] text-[#D0C6AB]">2-20 characters</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ticket-price" className="text-sm font-medium text-[#D0C6AB]">
                    Ticket Price (USDC)
                  </label>
                  <input
                    id="ticket-price"
                    className={inputClassName}
                    min={0.1}
                    step={0.1}
                    type="number"
                    value={ticketPrice}
                    onChange={event => setTicketPrice(Number(event.target.value) || 0)}
                  />
                  <p className="text-right text-[10px] text-[#D0C6AB]">creator-defined price per ticket</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="pool-description" className="text-sm font-medium text-[#D0C6AB]">
                    Description
                  </label>
                  <textarea
                    id="pool-description"
                    className={inputClassName}
                    maxLength={100}
                    placeholder="Describe the lore or utility of this pool..."
                    rows={3}
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                  />
                  <p className="text-right text-[10px] text-[#D0C6AB]">max 100 characters</p>
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <BuildingLibraryIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Financial Architecture</h2>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="prize-pool" className="text-sm font-medium text-[#D0C6AB]">
                      Total Prize Pool (USDC)
                    </label>
                    <input
                      id="prize-pool"
                      className={inputClassName}
                      max={2000}
                      min={50}
                      type="number"
                      value={prizePool}
                      onChange={event => setPrizePool(Number(event.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="total-tickets" className="text-sm font-medium text-[#D0C6AB]">
                      Total Tickets
                    </label>
                    <input
                      id="total-tickets"
                      className={inputClassName}
                      min={1}
                      type="number"
                      value={totalTickets}
                      onChange={event => setTotalTickets(Number(event.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-xl bg-[#141B2C] p-5">
                  <p className="mb-4 font-headline text-xs tracking-widest text-[#9CF0FF]">BOND CALCULATION</p>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <span className="text-sm text-[#D0C6AB]">Collateral Locked</span>
                    <span className="font-headline text-2xl font-bold text-[#DCE2F9]">
                      {bondAmount} <span className="text-xs font-normal text-[#D0C6AB]">USDC</span>
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[#2E3546]">
                    <div className="h-full w-3/4 bg-[#00DAF3]" />
                  </div>
                  <p className="mt-4 text-[10px] italic text-[#D0C6AB]">
                    *Includes 10% platform protocol safety margin.
                  </p>
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <ChartBarIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Hit Rate &amp; Logic</h2>
              </div>

              <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between gap-4">
                    <label htmlFor="win-rate" className="text-sm font-medium text-[#D0C6AB]">
                      Win Rate
                    </label>
                    <span className="font-bold text-[#FFD700]">{winRate}%</span>
                  </div>
                  <input
                    id="win-rate"
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#070E1D] accent-[#FFD700]"
                    max={70}
                    min={20}
                    type="range"
                    value={winRate}
                    onChange={event => setWinRate(Number(event.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-[#D0C6AB]">
                    <span>20% (Elite)</span>
                    <span>70% (Common)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-[#141B2C] p-4">
                  <div>
                    <p className="font-bold text-[#DCE2F9]">Loop Mode</p>
                    <p className="text-xs text-[#D0C6AB]">
                      {loopMode
                        ? "Loop mode (auto-refreshes the next round when sold out)"
                        : "One-time mode (ends when sold out)"}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={loopMode}
                    onClick={() => setLoopMode(current => !current)}
                    className={`relative flex h-7 w-16 items-center rounded-full px-1 transition-colors ${
                      loopMode ? "bg-[#FFD700]" : "bg-[#2E3546]"
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full shadow-sm transition-transform ${
                        loopMode ? "translate-x-9 bg-[#705E00]" : "translate-x-0 bg-[#D0C6AB]"
                      }`}
                    />
                    <span
                      className={`absolute text-[9px] font-black tracking-[0.2em] ${
                        loopMode ? "left-2 text-[#705E00]" : "right-2 text-[#D0C6AB]"
                      }`}
                    >
                      {loopMode ? "ON" : "OFF"}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ListBulletIcon className="h-6 w-6 text-[#E9C400]" />
                  <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Reward Tiers</h2>
                </div>
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="flex items-center gap-2 rounded-full border border-[#00DAF3]/20 bg-[#72EBFF]/10 px-3 py-1.5 text-xs font-bold text-[#9CF0FF] transition-all hover:bg-[#72EBFF]/20"
                >
                  <PlusIcon className="h-4 w-4" />
                  ADD TIER
                </button>
              </div>

              <div className="space-y-3">
                {rewardTiers.map((tier, index) => (
                  <div
                    key={tier.id}
                    className={`flex items-end gap-4 rounded-lg border-l-4 ${tierAccentClasses[index % tierAccentClasses.length]} bg-[#232A3B] p-4`}
                  >
                    <div className="grid flex-1 grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-tighter text-[#D0C6AB]">Amount (USDC)</p>
                        <input
                          className={`${inputClassName} mt-2 py-2`}
                          min={0}
                          step={0.01}
                          type="number"
                          value={tier.amount}
                          onChange={event => handleTierChange(tier.id, "amount", Number(event.target.value))}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-tighter text-[#D0C6AB]">Quantity</p>
                        <input
                          className={`${inputClassName} mt-2 py-2`}
                          min={0}
                          step={1}
                          type="number"
                          value={tier.quantity}
                          onChange={event => handleTierChange(tier.id, "quantity", Number(event.target.value))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="mb-[1px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#D0C6AB] transition-colors hover:bg-[#070E1D] hover:text-[#FFB4AB]"
                      aria-label={`Delete ${tier.id}`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-lg bg-[#070E1D] p-4">
                <span className="text-sm text-[#D0C6AB]">
                  Allocated Prizes:{" "}
                  <span className="font-bold text-[#DCE2F9]">
                    {allocatedPrize.toFixed(2)} / {prizePool.toFixed(2)} USDC
                  </span>
                </span>
                <div
                  className={`flex items-center gap-2 text-xs font-bold ${
                    isPrizeValidated ? "text-emerald-400" : "text-amber-300"
                  }`}
                >
                  {isPrizeValidated ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  )}
                  {isPrizeValidated ? "VALIDATED" : "CHECK TOTALS"}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <PhotoIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Visual Assets</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#D0C6AB]">Pool Cover Art</label>
                  <button
                    type="button"
                    className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#4D4732]/30 bg-[#070E1D] transition-all hover:border-[#FFD700]/50 group"
                  >
                    <img
                      alt="Pool cover artwork"
                      className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-60"
                      src={COVER_ART}
                    />
                    <ArrowUpTrayIcon className="relative z-10 mb-2 h-8 w-8" />
                    <span className="relative z-10 text-xs font-bold">Replace Artwork</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#D0C6AB]">Ticket Back Illustration</label>
                  <button
                    type="button"
                    className="relative mx-auto flex aspect-[3/4] w-full max-w-[180px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#4D4732]/30 bg-[#070E1D] transition-all hover:border-[#9CF0FF]/50 group"
                  >
                    <img
                      alt="Ticket back illustration"
                      className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity group-hover:opacity-50"
                      src={TICKET_ART}
                    />
                    <PencilSquareIcon className="relative z-10 mb-1 h-7 w-7" />
                    <span className="relative z-10 text-[10px] font-bold">Upload Design</span>
                  </button>
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <CalculatorIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-[#DCE2F9]">
                  Cost Preview
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#4D4732]/10 pb-2">
                  <span className="text-xs font-medium text-[#D0C6AB]">Bond</span>
                  <span className="font-headline font-bold text-[#DCE2F9]">
                    {creationBondAmount.toFixed(2)} USDC{" "}
                    <span className="text-[10px] font-normal text-[#D0C6AB]">
                      (Prize {prizePool.toFixed(2)}U + 20%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#4D4732]/10 pb-2">
                  <span className="text-xs font-medium text-[#D0C6AB]">Platform Fee</span>
                  <span className="font-headline font-bold text-[#DCE2F9]">
                    8% <span className="text-[10px] font-normal text-[#D0C6AB]">≈ {platformFeeAmount.toFixed(2)}U</span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#4D4732]/10 pb-2">
                  <span className="text-xs font-medium text-[#D0C6AB]">Estimated Profit</span>
                  <span
                    className={`font-headline font-bold ${estimatedProfit >= 0 ? "text-emerald-400" : "text-[#FFB4AB]"}`}
                  >
                    {estimatedProfit.toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#D0C6AB]">RTP</span>
                  <span className="font-headline font-bold text-[#FFD700]">{rtp.toFixed(1)}%</span>
                </div>
              </div>
            </section>

            <div className="space-y-4">
              <div className="rounded-xl border border-[#FFD700]/20 bg-[rgba(24,31,48,0.7)] p-6 shadow-[0_0_30px_rgba(255,215,0,0.1)] backdrop-blur-[24px]">
                <div className="mb-4 flex items-center gap-2 text-[#FFD700]">
                  <InformationCircleIcon className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Protocol Confirmation</span>
                </div>

                <ul className="mb-8 space-y-3">
                  <li className="flex items-start gap-2 text-xs text-[#D0C6AB]">
                    <ShieldCheckIcon className="h-4 w-4 shrink-0 text-[#E9C400]" />
                    <span>Smart contract will be deployed to Mainnet upon initialization.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[#D0C6AB]">
                    <ShieldCheckIcon className="h-4 w-4 shrink-0 text-[#E9C400]" />
                    <span>Bonded USDC will be locked until the pool is closed or drained.</span>
                  </li>
                </ul>

                <button
                  type="button"
                  className="w-full rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFE16D] to-[#FFD700] py-4 font-headline font-black text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-3">
                    <RocketLaunchIcon className="h-5 w-5" />
                    CONFIRM CREATION - LOCK BOND {creationBondAmount.toFixed(2)} USDC
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="w-full rounded-xl py-3 font-headline font-bold text-[#D0C6AB] transition-colors hover:text-[#DCE2F9]"
              >
                SAVE AS DRAFT
              </button>

              <div className="mt-6 border-t border-[#4D4732]/10 pt-6">
                <h3 className="mb-4 font-headline text-[10px] font-black uppercase tracking-[0.2em] text-[#D0C6AB]">
                  Creation Notes
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#E9C400]" />
                    <p className="text-[11px] leading-relaxed text-[#D0C6AB]">
                      Bond will be locked in the contract until the pool ends.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#E9C400]" />
                    <p className="text-[11px] leading-relaxed text-[#D0C6AB]">
                      Prize structure is encrypted via FHE and cannot be tampered with.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <BanknotesIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#E9C400]" />
                    <p className="text-[11px] leading-relaxed text-[#D0C6AB]">Platform charges an 8% sales fee.</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
