"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import {
  AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CommandLineIcon,
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
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import {
  MAX_HIT_RATE_BPS,
  MAX_PRIZE_SHARE_BPS,
  MAX_RTP_BPS,
  MAX_TICKETS_PER_ROUND,
  MAX_TOTAL_PRIZE_BUDGET_USDC,
  MIN_HIT_RATE_BPS,
  MIN_RTP_BPS,
  MIN_TOTAL_PRIZE_BUDGET_USDC,
  PLATFORM_FEE_BPS,
  SUPPORTED_TICKET_PRICES_USDC,
  computeBondRequirementMicro,
  formatPercentFromBps,
  formatUsdcFromMicro,
  toMicroUsdc,
} from "~~/services/luckyScratch/poolMath";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type PoolType = "official" | "community";

type LotteryWinTypeKey = "highWinRate" | "balanced" | "highMultiplier";

type RewardTierDraft = {
  id: string;
  amountUsdc: number;
  quantity: number;
};

type LotteryWinType = {
  key: LotteryWinTypeKey;
  label: string;
  subtitle: string;
  description: string;
  accent: string;
  conditions: string[];
};

const inputClassName =
  "w-full rounded-lg bg-[#070E1D] px-3 py-3 text-sm text-[#DCE2F9] outline-none transition-all placeholder:text-[#D0C6AB]/50 focus:ring-2 focus:ring-[#00DAF3]";
const panelClassName = "rounded-xl border border-[#4D4732]/15 bg-[rgba(24,31,48,0.7)] p-6 backdrop-blur-[24px]";
const tierAccentClasses = ["border-[#FFD700]", "border-[#CABEFF]", "border-[#00DAF3]"];
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_COVER_ART = "/images/default-cover-art.png";

const createTierId = () => `tier-${Math.random().toString(36).slice(2, 10)}`;

const defaultRewardTiers: RewardTierDraft[] = [
  { id: createTierId(), amountUsdc: 50, quantity: 1 },
  { id: createTierId(), amountUsdc: 20, quantity: 5 },
  { id: createTierId(), amountUsdc: 10, quantity: 10 },
  { id: createTierId(), amountUsdc: 5, quantity: 10 },
];

const lotteryWinTypes: LotteryWinType[] = [
  {
    key: "highWinRate",
    label: "High Win Rate",
    subtitle: "Frequent small wins",
    description: "Many winning tickets with lower top-prize concentration.",
    accent: "#00DAF3",
    conditions: ["Winning tickets >= 50% of total tickets", "Max prize <= 20% of total prize pool"],
  },
  {
    key: "balanced",
    label: "Balanced",
    subtitle: "Even distribution",
    description: "A middle profile between frequent wins and jackpot-heavy payouts.",
    accent: "#FFD700",
    conditions: ["Winning tickets from 30% to 49.99%", "Max prize below 25% of total prize pool"],
  },
  {
    key: "highMultiplier",
    label: "High Multiplier",
    subtitle: "Rare larger prizes",
    description: "Fewer winning tickets or a larger share assigned to the top prize.",
    accent: "#CABEFF",
    conditions: ["Winning tickets < 30% of total tickets", "Or max prize >= 25% of total prize pool"],
  },
];

const useFilePreview = (file: File | null) => {
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewURL(null);
      return;
    }

    const objectURL = URL.createObjectURL(file);
    setPreviewURL(objectURL);

    return () => {
      URL.revokeObjectURL(objectURL);
    };
  }, [file]);

  return previewURL;
};

const deriveLotteryWinType = (hitRateBps: number, maxPrizeShareBps: number): LotteryWinTypeKey => {
  if (hitRateBps >= 5_000 && maxPrizeShareBps <= 2_000) {
    return "highWinRate";
  }
  if (hitRateBps < 3_000 || maxPrizeShareBps >= 2_500) {
    return "highMultiplier";
  }
  return "balanced";
};

export function CreatePoolPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "LuckyScratchCore" });
  const { data: coreContract } = useDeployedContractInfo({ contractName: "LuckyScratchCore" });
  const { data: treasuryContract } = useDeployedContractInfo({ contractName: "LuckyScratchTreasury" });
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const { writeContractAsync: setOperatorAsync, isMining: isAuthorizingToken } = useScaffoldWriteContract({
    contractName: "CUSDCToken",
  });

  const [poolType, setPoolType] = useState<PoolType>("community");
  const [poolName, setPoolName] = useState("Celestial Relay Vault");
  const [description, setDescription] = useState(
    "Loop-ready scratch pool with creator-defined artwork and real backend metadata.",
  );
  const [ticketPriceUsdc, setTicketPriceUsdc] = useState<number>(5);
  const [totalTickets, setTotalTickets] = useState<number>(100);
  const [loopMode, setLoopMode] = useState<boolean>(false);
  const [loopSubpoolCount, setLoopSubpoolCount] = useState<number>(3);
  const [rewardTiers, setRewardTiers] = useState<RewardTierDraft[]>(defaultRewardTiers);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [ticketArtFile, setTicketArtFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAuthorizingOperator, setIsAuthorizingOperator] = useState<boolean>(false);
  const [submissionStage, setSubmissionStage] = useState<string>("");

  const coverPreviewURL = useFilePreview(coverFile);
  const ticketPreviewURL = useFilePreview(ticketArtFile);

  const sanitizedTiers = rewardTiers.filter(tier => tier.amountUsdc > 0 && tier.quantity > 0);
  const winningTicketCount = sanitizedTiers.reduce((sum, tier) => sum + tier.quantity, 0);
  const remainingTicketCount = totalTickets - winningTicketCount;
  const prizePoolMicro = sanitizedTiers.reduce((sum, tier) => sum + toMicroUsdc(tier.amountUsdc) * tier.quantity, 0);
  const grossRevenueMicro = toMicroUsdc(ticketPriceUsdc) * totalTickets;
  const maxPrizeMicro = sanitizedTiers.reduce((max, tier) => Math.max(max, toMicroUsdc(tier.amountUsdc)), 0);
  const hitRateBps = totalTickets > 0 ? Math.round((winningTicketCount * 10_000) / totalTickets) : 0;
  const targetRtpBps = grossRevenueMicro > 0 ? Math.round((prizePoolMicro * 10_000) / grossRevenueMicro) : 0;
  const maxPrizeShareBps = prizePoolMicro > 0 ? Math.round((maxPrizeMicro * 10_000) / prizePoolMicro) : 0;
  const estimatedBondMicro = computeBondRequirementMicro(prizePoolMicro);
  const platformFeeMicro = Math.floor((grossRevenueMicro * PLATFORM_FEE_BPS) / 10_000);
  const estimatedProfitMicro = grossRevenueMicro - prizePoolMicro - platformFeeMicro;
  const derivedLotteryWinType = deriveLotteryWinType(hitRateBps, maxPrizeShareBps);
  const selectedLotteryWinType = lotteryWinTypes.find(type => type.key === derivedLotteryWinType) ?? lotteryWinTypes[1];
  const operatorAvailable = Boolean(address && treasuryContract?.address && paymentTokenContract?.address);
  const { data: treasuryIsOperator } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "isOperator",
    args: [address, treasuryContract?.address],
    query: {
      enabled: operatorAvailable,
    },
  });
  const { data: adminRole } = useScaffoldReadContract({
    contractName: "LuckyScratchCore",
    functionName: "ADMIN_ROLE",
  });
  const { data: isCoreAdmin } = useScaffoldReadContract({
    contractName: "LuckyScratchCore",
    functionName: "hasRole",
    args: [adminRole, address],
    query: {
      enabled: Boolean(poolType === "official" && adminRole && address),
    },
  });
  const operatorReady = treasuryIsOperator === true;
  const officialAdminReady = poolType !== "official" || isCoreAdmin === true;
  const totalPrizeBudgetOutOfRange =
    prizePoolMicro < toMicroUsdc(MIN_TOTAL_PRIZE_BUDGET_USDC) ||
    prizePoolMicro > toMicroUsdc(MAX_TOTAL_PRIZE_BUDGET_USDC);

  const validationErrors = [
    !address ? "Connect the creator wallet before creating a pool." : null,
    poolType === "official" && !isCoreAdmin ? "Only an ADMIN_ROLE wallet can create an official pool." : null,
    poolName.trim().length < 2 || poolName.trim().length > 48 ? "Pool name must be between 2 and 48 characters." : null,
    description.trim().length > 280 ? "Description must be 280 characters or fewer." : null,
    !coverFile ? "Upload a cover image that will be pinned to IPFS." : null,
    !ticketArtFile ? "Upload a ticket artwork image that will be pinned to IPFS." : null,
    !Number.isInteger(totalTickets) || totalTickets < 1 || totalTickets > MAX_TICKETS_PER_ROUND
      ? `Total tickets must be an integer between 1 and ${MAX_TICKETS_PER_ROUND}.`
      : null,
    !SUPPORTED_TICKET_PRICES_USDC.includes(ticketPriceUsdc as (typeof SUPPORTED_TICKET_PRICES_USDC)[number])
      ? `Ticket price must be one of ${SUPPORTED_TICKET_PRICES_USDC.join(", ")} USDC.`
      : null,
    sanitizedTiers.length === 0 ? "Add at least one winning tier." : null,
    rewardTiers.some(tier => tier.amountUsdc <= 0 || tier.quantity <= 0)
      ? "Every visible reward tier needs a positive amount and quantity."
      : null,
    winningTicketCount > totalTickets ? "Winning tier quantities cannot exceed total tickets." : null,
    totalPrizeBudgetOutOfRange
      ? `Total prize pool must be between ${MIN_TOTAL_PRIZE_BUDGET_USDC} and ${MAX_TOTAL_PRIZE_BUDGET_USDC} USDC.`
      : null,
    hitRateBps < MIN_HIT_RATE_BPS || hitRateBps > MAX_HIT_RATE_BPS
      ? `Win rate must be between ${formatPercentFromBps(MIN_HIT_RATE_BPS)}% and ${formatPercentFromBps(MAX_HIT_RATE_BPS)}%.`
      : null,
    targetRtpBps < MIN_RTP_BPS || targetRtpBps > MAX_RTP_BPS
      ? `RTP must be between ${formatPercentFromBps(MIN_RTP_BPS)}% and ${formatPercentFromBps(MAX_RTP_BPS)}%. Adjust prize pool or ticket count.`
      : null,
    maxPrizeShareBps > MAX_PRIZE_SHARE_BPS
      ? `Max prize cannot exceed ${formatPercentFromBps(MAX_PRIZE_SHARE_BPS)}% of the total prize pool.`
      : null,
  ].filter(Boolean) as string[];

  const updateTier = (id: string, field: "amountUsdc" | "quantity", value: number) => {
    setRewardTiers(current =>
      current.map(tier =>
        tier.id === id ? { ...tier, [field]: Math.max(field === "quantity" ? 1 : 0, value || 0) } : tier,
      ),
    );
  };

  const addTier = () => {
    setRewardTiers(current => [...current, { id: createTierId(), amountUsdc: 2, quantity: 5 }]);
  };

  const removeTier = (id: string) => {
    setRewardTiers(current => current.filter(tier => tier.id !== id));
  };

  const handleFileChange = (setter: (file: File | null) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setter(null);
      event.target.value = "";
      notification.error("Image upload limit is 10 MB. Choose a smaller image before creating the pool.");
      return;
    }
    setter(file);
  };

  const handleAuthorizeTreasury = async () => {
    if (!treasuryContract?.address) {
      notification.error("LuckyScratchTreasury deployment metadata is unavailable on the current network.");
      return;
    }

    setIsAuthorizingOperator(true);
    setSubmissionStage("Authorizing LuckyScratchTreasury as a confidential cUSDC operator...");

    try {
      await setOperatorAsync({
        functionName: "setOperator",
        args: [treasuryContract.address, Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365],
      });
      await queryClient.invalidateQueries({ queryKey: ["readContract"] });
      notification.success("cUSDC operator authorization completed.");
    } catch (error) {
      const message = getParsedError(error) || "Failed to authorize cUSDC operator.";
      notification.error(message);
    } finally {
      setIsAuthorizingOperator(false);
      setSubmissionStage("");
    }
  };

  const handleCreatePool = async () => {
    if (!address) {
      notification.error("Connect your wallet first.");
      return;
    }
    if (!coreContract) {
      notification.error("LuckyScratchCore deployment metadata is unavailable.");
      return;
    }
    if (poolType === "official" && !officialAdminReady) {
      notification.error("Only an ADMIN_ROLE wallet can create an official pool.");
      return;
    }
    if (!operatorAvailable) {
      notification.error("cUSDC contract or treasury metadata is unavailable on the current network.");
      return;
    }
    if (validationErrors.length > 0) {
      notification.error(validationErrors[0]);
      return;
    }
    if (!operatorReady) {
      notification.error("Authorize LuckyScratchTreasury as your cUSDC operator before creating the pool.");
      return;
    }

    const finalPrizeTiers = sanitizedTiers.map(tier => ({
      prizeAmount: toMicroUsdc(tier.amountUsdc),
      count: tier.quantity,
      prizeAmountUsdc: tier.amountUsdc,
    }));

    if (remainingTicketCount > 0) {
      finalPrizeTiers.push({
        prizeAmount: 0,
        count: remainingTicketCount,
        prizeAmountUsdc: 0,
      });
    }

    setIsSubmitting(true);

    try {
      setSubmissionStage("Uploading cover artwork to backend IPFS...");
      const coverAsset = await luckyScratchAPI.uploadImage(coverFile!, address, "pool-cover");

      setSubmissionStage("Uploading ticket artwork to backend IPFS...");
      const ticketAsset = await luckyScratchAPI.uploadImage(ticketArtFile!, address, "ticket-art");

      setSubmissionStage("Creating backend metadata draft...");
      const draft = await luckyScratchAPI.createPoolDraft({
        ownerAddress: address,
        name: poolName.trim(),
        description: description.trim(),
        coverAssetId: coverAsset.assetId,
        ticketArtAssetId: ticketAsset.assetId,
        poolConfigPreview: {
          mode: loopMode ? "Loop" : "OneTime",
          modeValue: loopMode ? 1 : 0,
          ticketPriceUsdc,
          ticketPrice: toMicroUsdc(ticketPriceUsdc),
          totalTicketsPerRound: totalTickets,
          totalPrizeBudgetUsdc: prizePoolMicro / 1_000_000,
          totalPrizeBudget: prizePoolMicro,
          poolInstanceGroupSize: loopMode ? loopSubpoolCount : 1,
          feeBps: PLATFORM_FEE_BPS,
          targetRtpBps,
          hitRateBps,
          maxPrizeUsdc: maxPrizeMicro / 1_000_000,
          maxPrize: maxPrizeMicro,
          selectable: true,
          estimatedBondUsdc: estimatedBondMicro / 1_000_000,
          estimatedBond: estimatedBondMicro,
        },
        prizeTiers: finalPrizeTiers,
      });

      let createdPoolId: string | null = null;

      setSubmissionStage("Submitting createPool transaction...");
      const txHash = await writeContractAsync(
        {
          functionName: "createPool",
          args: [
            {
              mode: loopMode ? 1 : 0,
              creator: address,
              protocolOwned: poolType === "official",
              poolInstanceGroupSize: loopMode ? loopSubpoolCount : 1,
              ticketPrice: BigInt(toMicroUsdc(ticketPriceUsdc)),
              totalTicketsPerRound: totalTickets,
              totalPrizeBudget: BigInt(prizePoolMicro),
              feeBps: PLATFORM_FEE_BPS,
              targetRtpBps,
              hitRateBps,
              maxPrize: BigInt(maxPrizeMicro),
              themeId: draft.themeId as `0x${string}`,
              selectable: true,
            },
            finalPrizeTiers.map(tier => ({
              prizeAmount: BigInt(tier.prizeAmount),
              count: tier.count,
            })),
          ],
        },
        {
          onBlockConfirmation: receipt => {
            const events = parseEventLogs({
              abi: coreContract.abi,
              logs: receipt.logs,
              eventName: "PoolCreated",
            });
            const createdEvent = events[0];
            if (createdEvent?.args?.poolId != null) {
              createdPoolId = createdEvent.args.poolId.toString();
            }
          },
        },
      );

      if (!txHash || !createdPoolId) {
        throw new Error("Pool creation receipt did not include PoolCreated.");
      }

      setSubmissionStage("Finalizing backend metadata binding...");
      await luckyScratchAPI.finalizePool(createdPoolId, {
        draftId: draft.draftId,
        ownerAddress: address,
        createTxHash: txHash,
      });

      // Sync this tx to backend before invalidating so the refetch gets authoritative data
      try {
        await luckyScratchAPI.syncTransaction(txHash);
      } catch {
        console.warn("Backend tx sync failed; cache will update on next poll");
      }
      await queryClient.invalidateQueries({ queryKey: ["lucky-scratch"] });
      notification.success("Pool created and metadata finalized.");
      router.push(`/pool-detail/${createdPoolId}`);
    } catch (error) {
      const message = getParsedError(error) || "Failed to create pool.";
      notification.error(message);
    } finally {
      setIsSubmitting(false);
      setSubmissionStage("");
    }
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
            Configure a creator reward vault with backend-pinned artwork, IPFS metadata, and wallet-submitted on-chain
            pool creation.
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
                {[
                  {
                    key: "official" as const,
                    title: "Official Platform Pool",
                    subtitle: isCoreAdmin
                      ? "ADMIN_ROLE verified for this wallet"
                      : "Requires LuckyScratchCore ADMIN_ROLE",
                  },
                  {
                    key: "community" as const,
                    title: "Community Creator Pool",
                    subtitle: "User-generated and autonomous",
                  },
                ].map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPoolType(option.key)}
                    className={`flex items-center justify-between rounded-lg p-4 text-left transition-all ${
                      poolType === option.key ? "bg-[#2E3546] ring-2 ring-[#FFD700]" : "bg-[#181F30] hover:bg-[#232A3B]"
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${poolType === option.key ? "text-[#FFD700]" : "text-[#DCE2F9]"}`}>
                        {option.title}
                      </p>
                      <p className="mt-1 text-xs text-[#D0C6AB]">{option.subtitle}</p>
                    </div>
                    {poolType === option.key ? (
                      <CheckCircleSolidIcon className="h-6 w-6 text-[#FFD700]" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-[#D0C6AB]" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SparklesIcon className="h-6 w-6 text-[#E9C400]" />
                  <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Lottery Win Type</h2>
                </div>
                <span className="rounded-full border border-[#FFD700]/25 bg-[#2A2312] px-3 py-1 text-xs font-bold text-[#FFD700]">
                  Auto-derived
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {lotteryWinTypes.map(type => {
                  const isSelected = selectedLotteryWinType.key === type.key;
                  return (
                    <div
                      key={type.key}
                      className={`group relative flex flex-col rounded-xl p-5 text-left transition-all duration-200 ${
                        isSelected ? "bg-[#2E3546] shadow-lg" : "bg-[#181F30]"
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
                      {isSelected ? (
                        <div
                          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                          style={{ backgroundColor: type.accent, color: "#0C1323" }}
                        >
                          OK
                        </div>
                      ) : null}

                      <p
                        className="font-headline text-lg font-bold"
                        style={{ color: isSelected ? type.accent : "#DCE2F9" }}
                      >
                        {type.label}
                      </p>
                      <p className="text-[11px] font-medium text-[#D0C6AB]">{type.subtitle}</p>
                      <p className="mt-3 text-[11px] leading-relaxed text-[#D0C6AB]/80">{type.description}</p>
                      <ul className="mt-4 space-y-2">
                        {type.conditions.map(condition => (
                          <li
                            key={condition}
                            className="flex items-start gap-2 text-[10px] leading-relaxed text-[#9FB0D0]"
                          >
                            <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: type.accent }} />
                            <span>{condition}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                    maxLength={48}
                    placeholder="e.g. Celestial Legends #1"
                    value={poolName}
                    onChange={event => setPoolName(event.target.value)}
                  />
                  <p className="text-right text-[10px] text-[#D0C6AB]">2-48 characters</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ticket-price" className="text-sm font-medium text-[#D0C6AB]">
                    Ticket Price
                  </label>
                  <select
                    id="ticket-price"
                    className={inputClassName}
                    value={ticketPriceUsdc}
                    onChange={event => setTicketPriceUsdc(Number(event.target.value))}
                  >
                    {SUPPORTED_TICKET_PRICES_USDC.map(price => (
                      <option key={price} value={price}>
                        {price} USDC
                      </option>
                    ))}
                  </select>
                  <p className="text-right text-[10px] text-[#D0C6AB]">contract-supported price preset</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="pool-description" className="text-sm font-medium text-[#D0C6AB]">
                    Description
                  </label>
                  <textarea
                    id="pool-description"
                    className={inputClassName}
                    maxLength={280}
                    placeholder="Describe the artwork theme, reward feel, or creator intent."
                    rows={3}
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                  />
                  <p className="text-right text-[10px] text-[#D0C6AB]">max 280 characters</p>
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
                    <label htmlFor="total-tickets" className="text-sm font-medium text-[#D0C6AB]">
                      Total Tickets
                    </label>
                    <input
                      id="total-tickets"
                      className={inputClassName}
                      min={1}
                      max={MAX_TICKETS_PER_ROUND}
                      step={1}
                      type="number"
                      value={totalTickets}
                      onChange={event => setTotalTickets(Math.max(1, Number(event.target.value) || 1))}
                    />
                    <p className="text-[10px] text-[#D0C6AB]">current contract cap: {MAX_TICKETS_PER_ROUND}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#D0C6AB]">Total Prize Pool</p>
                    <div className="rounded-lg bg-[#070E1D] px-3 py-3 font-headline text-2xl font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(prizePoolMicro)}{" "}
                      <span className="text-xs font-normal text-[#D0C6AB]">USDC</span>
                    </div>
                    <p className="text-[10px] text-[#D0C6AB]">derived from reward tier amounts and quantities</p>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-xl bg-[#141B2C] p-5">
                  <p className="mb-4 font-headline text-xs tracking-widest text-[#9CF0FF]">BOND CALCULATION</p>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <span className="text-sm text-[#D0C6AB]">Collateral Locked</span>
                    <span className="font-headline text-2xl font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(estimatedBondMicro)}{" "}
                      <span className="text-xs font-normal text-[#D0C6AB]">USDC</span>
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[#2E3546]">
                    <div className="h-full w-3/4 bg-[#00DAF3]" />
                  </div>
                  <p className="mt-4 text-[10px] italic text-[#D0C6AB]">
                    Bond is computed from the prize pool by the LuckyScratch contract schedule.
                  </p>
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center gap-3">
                <ChartBarIcon className="h-6 w-6 text-[#E9C400]" />
                <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Hit Rate &amp; Logic</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                {[
                  ["Winning tickets", `${winningTicketCount}/${totalTickets}`],
                  ["Win rate", `${formatPercentFromBps(hitRateBps)}%`],
                  ["RTP", `${formatPercentFromBps(targetRtpBps)}%`],
                  ["Max prize share", `${formatPercentFromBps(maxPrizeShareBps)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-[#141B2C] p-4">
                    <p className="text-xs font-medium text-[#D0C6AB]">{label}</p>
                    <p className="mt-2 font-headline text-2xl font-bold text-[#DCE2F9]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-[#141B2C] p-4">
                <div>
                  <p className="font-bold text-[#DCE2F9]">Loop Mode</p>
                  <p className="text-xs text-[#D0C6AB]">
                    {loopMode
                      ? "Loop mode prepares the next round when funds allow."
                      : "One-time mode ends after settlement."}
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

              {loopMode ? (
                <div className="mt-5 space-y-2 rounded-lg border border-[#FFD700]/15 bg-[#141B2C] p-4">
                  <label htmlFor="loop-subpool-count" className="text-sm font-medium text-[#D0C6AB]">
                    Loop Sub-Pool Count
                  </label>
                  <input
                    id="loop-subpool-count"
                    className={inputClassName}
                    min={1}
                    step={1}
                    type="number"
                    value={loopSubpoolCount}
                    onChange={event => setLoopSubpoolCount(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              ) : null}
            </section>

            <section className={panelClassName}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ListBulletIcon className="h-6 w-6 text-[#E9C400]" />
                  <h2 className="font-headline text-xl font-bold text-[#DCE2F9]">Reward Tiers</h2>
                </div>
                <button
                  type="button"
                  onClick={addTier}
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
                          value={tier.amountUsdc}
                          onChange={event => updateTier(tier.id, "amountUsdc", Number(event.target.value))}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-tighter text-[#D0C6AB]">Quantity</p>
                        <input
                          className={`${inputClassName} mt-2 py-2`}
                          min={1}
                          step={1}
                          type="number"
                          value={tier.quantity}
                          onChange={event => updateTier(tier.id, "quantity", Number(event.target.value))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(tier.id)}
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
                  <span className="font-bold text-[#DCE2F9]">{formatUsdcFromMicro(prizePoolMicro)} USDC</span>
                </span>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircleIcon className="h-4 w-4" />
                  DERIVED
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
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#D0C6AB]">Pool Cover Art</span>
                  <div
                    className={`group ${POOL_COVER_FRAME_CLASS} flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#4D4732]/30 bg-[#070E1D] transition-all hover:border-[#FFD700]/50`}
                  >
                    <img
                      alt="Pool cover artwork"
                      className={`absolute inset-0 ${POOL_COVER_IMAGE_CLASS} transition-opacity ${
                        coverPreviewURL ? "opacity-60 group-hover:opacity-75" : "opacity-40 group-hover:opacity-60"
                      }`}
                      src={coverPreviewURL || DEFAULT_COVER_ART}
                    />
                    <ArrowUpTrayIcon className="relative z-10 mb-2 h-8 w-8" />
                    <span className="relative z-10 text-xs font-bold">
                      {coverPreviewURL ? "Replace Artwork" : "Upload Artwork"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={handleFileChange(setCoverFile)}
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#D0C6AB]">Ticket Back Illustration</span>
                  <div
                    className={`group ${TICKET_ART_FRAME_CLASS} mx-auto flex w-full max-w-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#4D4732]/30 bg-[#070E1D] transition-all hover:border-[#9CF0FF]/50`}
                  >
                    <img
                      alt="Ticket back illustration"
                      className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} transition-opacity ${
                        ticketPreviewURL ? "opacity-50 group-hover:opacity-65" : "opacity-30 group-hover:opacity-50"
                      }`}
                      src={ticketPreviewURL || TICKET_ART_FALLBACK_URL}
                    />
                    <PencilSquareIcon className="relative z-10 mb-1 h-7 w-7" />
                    <span className="relative z-10 text-[10px] font-bold">
                      {ticketPreviewURL ? "Replace Design" : "Upload Design"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={handleFileChange(setTicketArtFile)}
                    />
                  </div>
                </label>
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
                {[
                  ["Pool Type", poolType === "official" ? "Official" : "Community"],
                  ["Win Type", selectedLotteryWinType.label],
                  ["Bond", `${formatUsdcFromMicro(estimatedBondMicro)} USDC`],
                  ["Gross Revenue", `${formatUsdcFromMicro(grossRevenueMicro)} USDC`],
                  [
                    "Platform Fee",
                    `${formatPercentFromBps(PLATFORM_FEE_BPS)}% approx ${formatUsdcFromMicro(platformFeeMicro)}U`,
                  ],
                  ["Estimated Profit", `${formatUsdcFromMicro(estimatedProfitMicro)} USDC`],
                  ["RTP", `${formatPercentFromBps(targetRtpBps)}%`],
                  ["Unallocated Tickets", `${Math.max(remainingTicketCount, 0)}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-[#4D4732]/10 pb-2">
                    <span className="text-xs font-medium text-[#D0C6AB]">{label}</span>
                    <span className="text-right font-headline font-bold text-[#DCE2F9]">{value}</span>
                  </div>
                ))}
                {loopMode ? (
                  <div className="flex items-center justify-between border-b border-[#4D4732]/10 pb-2">
                    <span className="text-xs font-medium text-[#D0C6AB]">Loop Sub-Pools</span>
                    <span className="font-headline font-bold text-[#9CF0FF]">{loopSubpoolCount}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#D0C6AB]">cUSDC Operator</span>
                  <span className={`font-headline font-bold ${operatorReady ? "text-emerald-400" : "text-[#FFB4AB]"}`}>
                    {operatorAvailable ? (operatorReady ? "Authorized" : "Required") : "Unavailable"}
                  </span>
                </div>
              </div>
            </section>

            <div className="space-y-4">
              <div className="rounded-xl border border-[#FFD700]/20 bg-[rgba(24,31,48,0.7)] p-6 shadow-[0_0_30px_rgba(255,215,0,0.1)] backdrop-blur-[24px]">
                <div className="mb-4 flex items-center gap-2 text-[#FFD700]">
                  <InformationCircleIcon className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Protocol Confirmation</span>
                </div>

                <ul className="mb-6 space-y-3">
                  <li className="flex items-start gap-2 text-xs text-[#D0C6AB]">
                    <ShieldCheckIcon className="h-4 w-4 shrink-0 text-[#E9C400]" />
                    <span>Official pools require the connected wallet to hold LuckyScratchCore ADMIN_ROLE.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[#D0C6AB]">
                    <LockClosedIcon className="h-4 w-4 shrink-0 text-[#E9C400]" />
                    <span>Bonded cUSDC is locked by LuckyScratchTreasury during createPool.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[#D0C6AB]">
                    <BanknotesIcon className="h-4 w-4 shrink-0 text-[#E9C400]" />
                    <span>Platform charges an 8% sales fee on ticket revenue.</span>
                  </li>
                </ul>

                {operatorAvailable ? (
                  <button
                    type="button"
                    onClick={handleAuthorizeTreasury}
                    disabled={isAuthorizingOperator || isAuthorizingToken || operatorReady}
                    className="mb-3 w-full rounded-xl border border-[#00DAF3]/25 bg-[#0F2031] px-4 py-3 text-sm font-bold text-[#9CF0FF] transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {operatorReady
                      ? "Treasury Operator Ready"
                      : isAuthorizingOperator || isAuthorizingToken
                        ? "Authorizing..."
                        : "Authorize Treasury Operator"}
                  </button>
                ) : null}

                {validationErrors.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {validationErrors.map(error => (
                      <div
                        key={error}
                        className="rounded-lg border border-[#8E4A74] bg-[#2A1521] px-3 py-2 text-xs text-[#FFB4AB]"
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                ) : null}

                {submissionStage ? (
                  <div className="mb-4 rounded-lg border border-[#4A587B] bg-[#10192D] px-3 py-2 text-xs text-[#9CF0FF]">
                    {submissionStage}
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    isMining ||
                    validationErrors.length > 0 ||
                    !operatorAvailable ||
                    !operatorReady ||
                    !officialAdminReady
                  }
                  onClick={handleCreatePool}
                  className="w-full rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFE16D] to-[#FFD700] py-4 font-headline font-black text-[#705E00] shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-3">
                    <RocketLaunchIcon className="h-5 w-5" />
                    {isSubmitting || isMining ? "CREATING POOL..." : "CONFIRM CREATION"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
