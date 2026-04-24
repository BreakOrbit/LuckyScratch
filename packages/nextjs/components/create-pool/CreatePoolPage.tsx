"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  PlusIcon,
  RocketLaunchIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
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
import { notification } from "~~/utils/scaffold-eth";

type RewardTierDraft = {
  id: string;
  amountUsdc: number;
  quantity: number;
};

const panelClassName = "rounded-3xl border border-white/10 bg-[#11192B] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]";
const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#0B1120] px-4 py-3 text-sm text-[#DCE2F9] outline-none transition focus:border-[#FFD700]/35";

const createTierId = () => `tier-${Math.random().toString(36).slice(2, 10)}`;

const defaultRewardTiers: RewardTierDraft[] = [
  { id: createTierId(), amountUsdc: 50, quantity: 2 },
  { id: createTierId(), amountUsdc: 20, quantity: 5 },
  { id: createTierId(), amountUsdc: 5, quantity: 20 },
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

export function CreatePoolPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "LuckyScratchCore" });
  const { data: coreContract } = useDeployedContractInfo({ contractName: "LuckyScratchCore" });
  const { data: treasuryContract } = useDeployedContractInfo({ contractName: "LuckyScratchTreasury" });
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const { writeContractAsync: approveTokenAsync, isMining: isApprovingToken } = useScaffoldWriteContract({
    contractName: "CUSDCToken",
  });

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
  const [isApprovingBond, setIsApprovingBond] = useState<boolean>(false);
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
  const estimatedBondMicro = computeBondRequirementMicro(prizePoolMicro);
  const approvalAvailable = Boolean(address && treasuryContract?.address && paymentTokenContract?.address);
  const { data: currentAllowance } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "allowance",
    args: [address, treasuryContract?.address],
    query: {
      enabled: approvalAvailable,
    },
  });
  const { data: paymentTokenBalance } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && paymentTokenContract?.address),
    },
  });
  const approvalSatisfied = typeof currentAllowance === "bigint" && currentAllowance >= BigInt(estimatedBondMicro);
  const balanceSufficient =
    typeof paymentTokenBalance === "bigint" && paymentTokenBalance >= BigInt(estimatedBondMicro);

  const validationErrors = [
    !address ? "Connect the creator wallet before creating a pool." : null,
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
    prizePoolMicro < toMicroUsdc(MIN_TOTAL_PRIZE_BUDGET_USDC) ||
    prizePoolMicro > toMicroUsdc(MAX_TOTAL_PRIZE_BUDGET_USDC)
      ? `Prize budget must stay between ${MIN_TOTAL_PRIZE_BUDGET_USDC} and ${MAX_TOTAL_PRIZE_BUDGET_USDC} USDC.`
      : null,
    hitRateBps < MIN_HIT_RATE_BPS || hitRateBps > MAX_HIT_RATE_BPS
      ? `Winning ticket count must keep hit rate between ${formatPercentFromBps(MIN_HIT_RATE_BPS)}% and ${formatPercentFromBps(MAX_HIT_RATE_BPS)}%.`
      : null,
    targetRtpBps < MIN_RTP_BPS || targetRtpBps > MAX_RTP_BPS
      ? `Prize structure must keep RTP between ${formatPercentFromBps(MIN_RTP_BPS)}% and ${formatPercentFromBps(MAX_RTP_BPS)}%.`
      : null,
    prizePoolMicro > 0 && maxPrizeMicro * 10_000 > prizePoolMicro * MAX_PRIZE_SHARE_BPS
      ? `Max prize cannot exceed ${formatPercentFromBps(MAX_PRIZE_SHARE_BPS)}% of the total prize budget.`
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
    setter(event.target.files?.[0] ?? null);
  };

  const handleApproveBond = async () => {
    if (!treasuryContract?.address) {
      notification.error("LuckyScratchTreasury deployment metadata is unavailable on the current network.");
      return;
    }

    setIsApprovingBond(true);
    setSubmissionStage("Approving cUSDC allowance for LuckyScratchTreasury...");

    try {
      await approveTokenAsync({
        functionName: "approve",
        args: [treasuryContract.address, BigInt(estimatedBondMicro)],
      });
      await queryClient.invalidateQueries({ queryKey: ["readContract"] });
      notification.success("cUSDC approval transaction completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve cUSDC.";
      notification.error(message);
    } finally {
      setIsApprovingBond(false);
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
    if (!approvalAvailable) {
      notification.error("cUSDC contract or treasury metadata is unavailable on the current network.");
      return;
    }
    if (validationErrors.length > 0) {
      notification.error(validationErrors[0]);
      return;
    }
    if (!balanceSufficient) {
      notification.error("Your cUSDC balance is lower than the estimated creator bond.");
      return;
    }
    if (!approvalSatisfied) {
      notification.error("Approve the estimated bond amount in cUSDC before creating the pool.");
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
              protocolOwned: false,
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

      await queryClient.invalidateQueries({ queryKey: ["lucky-scratch"] });
      notification.success("Pool created and metadata finalized.");
      router.push(`/pool-detail/${createdPoolId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create pool.";
      notification.error(message);
    } finally {
      setIsSubmitting(false);
      setSubmissionStage("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0C1323] text-[#DCE2F9]">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-20">
        <div className="absolute left-[14%] top-[10%] h-[460px] w-[460px] rounded-full bg-[#4719C9] blur-[120px]" />
        <div className="absolute bottom-[8%] right-[12%] h-[540px] w-[540px] rounded-full bg-[#173454] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9CF0FF]">Creator Launch Terminal</p>
          <h1 className="mt-3 font-headline text-4xl font-bold tracking-tight md:text-5xl">
            Create a pool with backend-pinned artwork and on-chain metadata binding
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#9FB0D0]">
            The frontend now uploads images to the backend, stores metadata on IPFS, uses the returned `themeId` in
            `createPool`, and finalizes the binding after `PoolCreated`.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="space-y-6">
            <section className={panelClassName}>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-[#D0C6AB]">Pool Name</label>
                  <input
                    className={inputClassName}
                    value={poolName}
                    maxLength={48}
                    onChange={event => setPoolName(event.target.value)}
                    placeholder="Enter a creator-facing pool name"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-[#D0C6AB]">Description</label>
                  <textarea
                    className={`${inputClassName} min-h-28`}
                    value={description}
                    maxLength={280}
                    onChange={event => setDescription(event.target.value)}
                    placeholder="Describe the artwork theme, reward feel, or creator intent."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#D0C6AB]">Ticket Price</label>
                  <select
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
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#D0C6AB]">Total Tickets / Round</label>
                  <input
                    className={inputClassName}
                    type="number"
                    min={1}
                    max={MAX_TICKETS_PER_ROUND}
                    step={1}
                    value={totalTickets}
                    onChange={event => setTotalTickets(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-white">Mode & round rollout</h2>
                  <p className="mt-1 text-sm text-[#9FB0D0]">
                    One-time pools stop after settlement. Loop pools keep preparing the next round when funds allow.
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={loopMode}
                  onClick={() => setLoopMode(current => !current)}
                  className={`relative flex h-10 w-20 items-center rounded-full px-1 transition-colors ${loopMode ? "bg-[#FFD700]" : "bg-[#25314E]"}`}
                >
                  <span
                    className={`h-8 w-8 rounded-full transition-transform ${loopMode ? "translate-x-10 bg-[#705E00]" : "translate-x-0 bg-[#D0C6AB]"}`}
                  />
                  <span
                    className={`absolute text-[10px] font-bold tracking-[0.24em] ${loopMode ? "left-3 text-[#705E00]" : "right-3 text-[#D0C6AB]"}`}
                  >
                    {loopMode ? "ON" : "OFF"}
                  </span>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="rounded-2xl bg-[#0B1120] p-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Mode</p>
                  <p className="mt-3 font-headline text-3xl font-bold text-[#DCE2F9]">
                    {loopMode ? "LOOP" : "ONE-TIME"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#0B1120] p-5">
                  <label className="mb-2 block text-sm font-medium text-[#D0C6AB]">Pool Instance Group Size</label>
                  <input
                    className={inputClassName}
                    type="number"
                    min={1}
                    step={1}
                    value={loopMode ? loopSubpoolCount : 1}
                    disabled={!loopMode}
                    onChange={event => setLoopSubpoolCount(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
              </div>
            </section>

            <section className={panelClassName}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-white">Reward tiers</h2>
                  <p className="mt-1 text-sm text-[#9FB0D0]">
                    Any unallocated ticket count is automatically filled as a zero-prize tier before `createPool`.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTier}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#00DAF3]/20 bg-[#0F2031] px-4 py-2 text-sm font-bold text-[#9CF0FF]"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Tier
                </button>
              </div>

              <div className="space-y-3">
                {rewardTiers.map(tier => (
                  <div key={tier.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded-2xl bg-[#0B1120] p-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#8290AE]">
                        Prize Amount
                      </label>
                      <input
                        className={inputClassName}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tier.amountUsdc}
                        onChange={event => updateTier(tier.id, "amountUsdc", Number(event.target.value))}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#8290AE]">
                        Quantity
                      </label>
                      <input
                        className={inputClassName}
                        type="number"
                        min={1}
                        step={1}
                        value={tier.quantity}
                        onChange={event => updateTier(tier.id, "quantity", Number(event.target.value))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(tier.id)}
                      className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-[#9FB0D0] transition hover:border-[#FFB4AB]/40 hover:text-[#FFB4AB]"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className={panelClassName}>
              <div className="flex items-center gap-3">
                <PhotoIcon className="h-6 w-6 text-[#FFD66D]" />
                <div>
                  <h2 className="font-headline text-2xl font-bold text-white">Artwork uploads</h2>
                  <p className="text-sm text-[#9FB0D0]">These images are uploaded to the backend and pinned to IPFS.</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#D0C6AB]">Pool cover image</span>
                  <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-[#0B1120]">
                    {coverPreviewURL ? (
                      <img src={coverPreviewURL} alt="Cover preview" className="aspect-[16/10] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 text-[#8290AE]">
                        <ArrowUpTrayIcon className="h-8 w-8" />
                        <span className="text-sm font-bold">Upload cover artwork</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={handleFileChange(setCoverFile)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#D0C6AB]">Ticket artwork</span>
                  <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-[#0B1120]">
                    {ticketPreviewURL ? (
                      <img src={ticketPreviewURL} alt="Ticket preview" className="aspect-[4/5] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 text-[#8290AE]">
                        <ArrowUpTrayIcon className="h-8 w-8" />
                        <span className="text-sm font-bold">Upload ticket artwork</span>
                      </div>
                    )}
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
              <h2 className="font-headline text-2xl font-bold text-white">Launch checks</h2>
              <div className="mt-5 grid grid-cols-1 gap-4">
                {[
                  ["Prize budget", `${formatUsdcFromMicro(prizePoolMicro)} USDC`],
                  ["Gross revenue", `${formatUsdcFromMicro(grossRevenueMicro)} USDC`],
                  ["Hit rate", `${formatPercentFromBps(hitRateBps)}%`],
                  ["Target RTP", `${formatPercentFromBps(targetRtpBps)}%`],
                  ["Estimated bond", `${formatUsdcFromMicro(estimatedBondMicro)} USDC`],
                  ["Unallocated tickets", `${Math.max(remainingTicketCount, 0)}`],
                  [
                    "cUSDC allowance",
                    approvalAvailable && typeof currentAllowance === "bigint"
                      ? `${formatUsdcFromMicro(currentAllowance)} USDC`
                      : "unavailable",
                  ],
                  [
                    "cUSDC balance",
                    approvalAvailable && typeof paymentTokenBalance === "bigint"
                      ? `${formatUsdcFromMicro(paymentTokenBalance)} USDC`
                      : "unavailable",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-[#0B1120] px-4 py-3">
                    <span className="text-sm text-[#9FB0D0]">{label}</span>
                    <span className="font-headline text-lg font-bold text-[#DCE2F9]">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#4A587B] bg-[#10192D] p-4 text-sm text-[#9FB0D0]">
                `protocolOwned` is fixed to `false` for this creator flow. On Sepolia/mainnet the page can approve the
                current estimated bond in cUSDC for `LuckyScratchTreasury`; if the allowance or balance is too low,
                `createPool` will revert during bond lock.
              </div>

              {approvalAvailable ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleApproveBond}
                    disabled={isApprovingBond || isApprovingToken || approvalSatisfied}
                    className="inline-flex items-center justify-center rounded-2xl border border-[#00DAF3]/25 bg-[#0F2031] px-4 py-3 text-sm font-bold text-[#9CF0FF] transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approvalSatisfied
                      ? "Bond Approval Ready"
                      : isApprovingBond || isApprovingToken
                        ? "Approving..."
                        : "Approve Estimated Bond"}
                  </button>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      approvalSatisfied && balanceSufficient
                        ? "border border-[#0F5B3A] bg-[#0A3322] text-[#8AF4C5]"
                        : "border border-[#8E4A74] bg-[#2A1521] text-[#FFB4AB]"
                    }`}
                  >
                    {approvalSatisfied && balanceSufficient
                      ? "Allowance and balance cover the current estimated bond."
                      : "Approval or cUSDC balance is below the current estimated bond."}
                  </div>
                </div>
              ) : null}
            </section>

            <section className={panelClassName}>
              <div className="flex items-center gap-2">
                {validationErrors.length === 0 ? (
                  <CheckCircleIcon className="h-5 w-5 text-[#8AF4C5]" />
                ) : (
                  <ExclamationTriangleIcon className="h-5 w-5 text-[#FFB4AB]" />
                )}
                <h2 className="font-headline text-2xl font-bold text-white">Validation</h2>
              </div>

              {validationErrors.length === 0 ? (
                <p className="mt-4 text-sm text-[#8AF4C5]">All contract-side constraints are currently satisfied.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm text-[#FFB4AB]">
                  {validationErrors.map(error => (
                    <li key={error} className="rounded-2xl border border-[#8E4A74] bg-[#2A1521] px-4 py-3">
                      {error}
                    </li>
                  ))}
                </ul>
              )}

              {submissionStage ? (
                <div className="mt-5 rounded-2xl border border-[#4A587B] bg-[#10192D] px-4 py-3 text-sm text-[#9CF0FF]">
                  {submissionStage}
                </div>
              ) : null}

              <button
                type="button"
                disabled={
                  isSubmitting ||
                  isMining ||
                  validationErrors.length > 0 ||
                  !approvalAvailable ||
                  !approvalSatisfied ||
                  !balanceSufficient
                }
                onClick={handleCreatePool}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-5 py-4 font-headline text-lg font-bold text-[#705E00] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RocketLaunchIcon className="h-5 w-5" />
                {isSubmitting || isMining ? "Creating Pool..." : "Upload, Create, and Finalize Pool"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
