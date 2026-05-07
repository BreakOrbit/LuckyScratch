"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BatchPickGallery } from "./BatchPickGallery";
import { CheckoutPanel } from "./CheckoutPanel";
import { ManualPickGallery } from "./ManualPickGallery";
import { ModeToggle } from "./ModeToggle";
import { PoolInfoPanel } from "./PoolInfoPanel";
import { PurchaseSuccessModal } from "./PurchaseSuccessModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { useLuckyScratchPurchaseContext } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { luckyScratchAPI } from "~~/services/luckyScratch/api";
import { formatPercentFromBps, fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import type { LuckyScratchPurchaseContext, PrizeTierPreview } from "~~/services/luckyScratch/types";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type GamePhase = "selecting" | "authorizing" | "purchasing" | "purchased";

type PurchasePageProps = {
  poolId: string;
};

const formatTicketDisplayId = (index: number) => String(index + 1).padStart(4, "0");

const modeLabelFromPool = (hitRateBps: number) => {
  if (hitRateBps >= 5_500) {
    return "High Win Rate";
  }
  if (hitRateBps >= 3_500) {
    return "Balanced";
  }
  return "High Multiplier";
};

const poolThemeColor = (poolId: string) => {
  const palette = ["#C62828", "#1565C0", "#6A1B9A", "#00897B", "#EF6C00"];
  return palette[Number(poolId) % palette.length] || "#C62828";
};

const poolEmojiFromMetadata = (name?: string) => {
  const normalized = name?.toLowerCase() || "";
  if (normalized.includes("diamond")) return "💎";
  if (normalized.includes("star")) return "⭐";
  if (normalized.includes("cosmic") || normalized.includes("nebula")) return "🌌";
  if (normalized.includes("fortune") || normalized.includes("lucky")) return "🏮";
  return "🎟️";
};

const prizeTierIcons = ["🥇", "🥈", "🏅", "💰", "🎫"];

const formatPrizeAmountLabel = (prizeAmount: number) =>
  `${fromMicroUsdc(prizeAmount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}U`;

const buildPrizeStructure = (tiers?: PrizeTierPreview[]) =>
  [...(tiers || [])]
    .filter(tier => tier.prizeAmount > 0 && tier.count > 0)
    .sort((left, right) => right.prizeAmount - left.prizeAmount || right.count - left.count)
    .map((tier, index) => ({
      amountLabel: formatPrizeAmountLabel(tier.prizeAmount),
      count: tier.count,
      icon: prizeTierIcons[index] || "🎟️",
    }));

const CUSDC_OPERATOR_VALIDITY_SECONDS = 60 * 60 * 24 * 365;
const ZERO_CIPHERTEXT_HANDLE = `0x${"0".repeat(64)}`;

const getOperatorExpiry = () => Math.floor(Date.now() / 1000) + CUSDC_OPERATOR_VALIDITY_SECONDS;

export const PurchasePage: React.FC<PurchasePageProps> = ({ poolId }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const purchaseContextQuery = useLuckyScratchPurchaseContext(poolId);
  const { data: coreContract } = useDeployedContractInfo({ contractName: "LuckyScratchCore" });
  const { data: treasuryContract } = useDeployedContractInfo({ contractName: "LuckyScratchTreasury" });
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "LuckyScratchCore" });
  const { writeContractAsync: setOperatorAsync, isMining: isAuthorizingToken } = useScaffoldWriteContract({
    contractName: "CUSDCToken",
  });

  const [mode, setMode] = useState<"manual" | "quick">("manual");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickQuantity, setQuickQuantity] = useState(3);
  const [isGalleryReady, setIsGalleryReady] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("selecting");
  const [mintedTicketIds, setMintedTicketIds] = useState<string[]>([]);

  const purchaseContext = purchaseContextQuery.data;
  const pool = purchaseContext?.pool;
  const currentRound = purchaseContext?.currentRound || pool?.currentRoundState;
  const metadataGatewayUrl = pool?.metadata?.metadataGatewayUrl;
  const inlinePrizeTiers = pool?.metadata?.prizeTiers;
  const metadataDocumentQuery = useQuery({
    queryKey: ["lucky-scratch", "pools", poolId, "metadata-document", metadataGatewayUrl],
    queryFn: () => luckyScratchAPI.getPoolMetadataDocument(metadataGatewayUrl!),
    enabled: Boolean(metadataGatewayUrl && !inlinePrizeTiers?.length),
    retry: 1,
    staleTime: 60_000,
  });
  const prizeStructure = useMemo(
    () => buildPrizeStructure(inlinePrizeTiers?.length ? inlinePrizeTiers : metadataDocumentQuery.data?.prizeTiers),
    [inlinePrizeTiers, metadataDocumentQuery.data?.prizeTiers],
  );
  const roundReady = Boolean(pool?.status === "Active" && pool?.initialized && currentRound?.status === "Ready");
  const totalAvailableTickets = purchaseContext?.availableTicketIndexes.length || 0;
  const availableIds = useMemo(
    () => (purchaseContext?.availableTicketIndexes || []).map(index => formatTicketDisplayId(index)),
    [purchaseContext?.availableTicketIndexes],
  );
  const displayIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const index of purchaseContext?.availableTicketIndexes || []) {
      map.set(formatTicketDisplayId(index), index);
    }
    return map;
  }, [purchaseContext?.availableTicketIndexes]);

  const quickPickIds = useMemo(() => {
    return [...availableIds].sort(() => Math.random() - 0.5).slice(0, 10);
  }, [availableIds]);

  const activeSelection = mode === "manual" ? selectedIds : quickPickIds.slice(0, quickQuantity);
  const activeCount = mode === "manual" ? selectedIds.length : quickQuantity;
  const activeTicketIndexes = useMemo(
    () =>
      activeSelection.map(id => displayIdToIndex.get(id)).filter((value): value is number => typeof value === "number"),
    [activeSelection, displayIdToIndex],
  );

  const operatorCheckAvailable = Boolean(address && treasuryContract?.address && paymentTokenContract?.address);
  const { data: treasuryIsOperator } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "isOperator",
    args: [address, treasuryContract?.address],
    query: {
      enabled: operatorCheckAvailable,
    },
  });
  const {
    data: confidentialBalanceHandle,
    isError: isConfidentialBalanceReadError,
    isLoading: isConfidentialBalanceLoading,
  } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "confidentialBalanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && paymentTokenContract?.address),
      retry: false,
    },
  });

  useEffect(() => {
    if (pool && !pool.selectable && mode === "manual") {
      setMode("quick");
      setSelectedIds([]);
    }
  }, [mode, pool, pool?.selectable]);

  useEffect(() => {
    if (quickQuantity > totalAvailableTickets && totalAvailableTickets > 0) {
      setQuickQuantity(totalAvailableTickets);
    }
  }, [quickQuantity, totalAvailableTickets]);

  const totalCostMicro = (pool?.ticketPrice || 0) * activeCount;
  const totalCostUsdc = fromMicroUsdc(totalCostMicro);
  const totalCostLabel = totalCostUsdc.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const operatorReady = treasuryIsOperator === true;
  const hasCusdcBalanceHandle =
    typeof confidentialBalanceHandle === "string" && confidentialBalanceHandle !== ZERO_CIPHERTEXT_HANDLE;
  const canSubmitPurchase =
    Boolean(address) &&
    Boolean(coreContract) &&
    roundReady &&
    activeCount > 0 &&
    isGalleryReady &&
    operatorCheckAvailable &&
    hasCusdcBalanceHandle &&
    (pool?.selectable ? activeTicketIndexes.length === activeCount : true);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.length >= 10 || prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const handleDeselect = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!pool || !coreContract) {
      notification.error("Purchase context is not ready.");
      return;
    }
    if (!address) {
      notification.error("Connect your wallet before purchasing tickets.");
      return;
    }
    if (!operatorCheckAvailable) {
      notification.error("cUSDC contract or treasury metadata is unavailable on the current network.");
      return;
    }
    if (!hasCusdcBalanceHandle) {
      notification.error("Mint and wrap Sepolia cUSDC from the faucet before purchasing tickets.");
      return;
    }
    if (!roundReady) {
      notification.error(
        currentRound?.status === "PendingEncryption"
          ? "Prizes are being encrypted. Please wait."
          : "This pool is waiting for VRF initialization before tickets can be purchased.",
      );
      return;
    }
    if (!canSubmitPurchase) {
      notification.error("Current ticket selection is not ready for purchase.");
      return;
    }

    try {
      if (!operatorReady) {
        setPhase("authorizing");
        await setOperatorAsync({
          functionName: "setOperator",
          args: [treasuryContract!.address, getOperatorExpiry()],
        });
        await queryClient.invalidateQueries({ queryKey: ["readContract"] });
      }

      setPhase("purchasing");

      // Refresh purchase context to avoid buying already-sold indexes
      await queryClient.refetchQueries({
        queryKey: ["lucky-scratch", "pools", poolId, "purchase-context"],
      });

      let purchasedTicketIds: string[] = [];
      const txHash = await writeContractAsync(
        pool.selectable
          ? {
              functionName: "purchaseTicketsWithSelection",
              args: [BigInt(poolId), activeTicketIndexes],
            }
          : {
              functionName: "purchaseTickets",
              args: [BigInt(poolId), activeCount],
            },
        {
          onBlockConfirmation: receipt => {
            const events = parseEventLogs({
              abi: coreContract.abi,
              logs: receipt.logs,
              eventName: "TicketPurchased",
            });
            purchasedTicketIds = events
              .filter(event => event.args.poolId?.toString() === poolId)
              .map(event => event.args.ticketId?.toString())
              .filter((value): value is string => Boolean(value));

            // Optimistic update: immediately mark purchased tickets as sold in cache
            queryClient.setQueryData<LuckyScratchPurchaseContext>(
              ["lucky-scratch", "pools", poolId, "purchase-context"],
              old => {
                if (!old) return old;
                return {
                  ...old,
                  soldTicketIndexes: [...old.soldTicketIndexes, ...activeTicketIndexes],
                  availableTicketIndexes: old.availableTicketIndexes.filter(idx => !activeTicketIndexes.includes(idx)),
                };
              },
            );
          },
        },
      );

      if (!txHash) {
        throw new Error("Purchase transaction hash was not returned.");
      }
      if (purchasedTicketIds.length === 0) {
        throw new Error("Purchase receipt did not include TicketPurchased events.");
      }

      setMintedTicketIds(purchasedTicketIds);
      setPhase("purchased");
      // Sync this tx to backend before invalidating so the refetch gets authoritative data
      try {
        await luckyScratchAPI.syncTransaction(txHash);
      } catch {
        console.warn("Backend tx sync failed; cache will update on next poll");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", poolId, "purchase-context"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
      ]);
    } catch (error) {
      const message = getParsedError(error) || "Ticket purchase failed.";
      if (message.includes("TicketIndexAlreadySold")) {
        notification.warning("Some tickets were just sold by another player. Refreshing available tickets...");
        await queryClient.refetchQueries({
          queryKey: ["lucky-scratch", "pools", poolId, "purchase-context"],
        });
      } else {
        notification.error(message);
      }
      setPhase("selecting");
    }
  }, [
    activeCount,
    activeTicketIndexes,
    address,
    canSubmitPurchase,
    coreContract,
    hasCusdcBalanceHandle,
    operatorCheckAvailable,
    operatorReady,
    pool,
    poolId,
    queryClient,
    roundReady,
    setOperatorAsync,
    treasuryContract,
    writeContractAsync,
  ]);

  const handleScratchNow = useCallback(() => {
    router.push(`/scratch/${poolId}?tickets=${mintedTicketIds.join(",")}`);
  }, [mintedTicketIds, poolId, router]);

  const handleBuyMore = useCallback(() => {
    setPhase("selecting");
    setSelectedIds([]);
    setMintedTicketIds([]);
    setQuickQuantity(Math.min(3, Math.max(1, totalAvailableTickets || 1)));
  }, [totalAvailableTickets]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  if (purchaseContextQuery.isLoading) {
    return <div className="min-h-screen bg-ns-background" />;
  }

  if (purchaseContextQuery.isError || !pool) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-24 md:px-8">
        <div className="rounded-3xl border border-[#8E4A74] bg-[#2A1521] p-8 text-[#FFB4AB]">
          {purchaseContextQuery.error instanceof Error
            ? purchaseContextQuery.error.message
            : "Failed to load purchase context."}
        </div>
      </div>
    );
  }

  const issuer = pool.protocolOwned ? "Official" : "Community";
  const statusHint = !address
    ? "Connect your wallet to authorize confidential cUSDC payments."
    : !roundReady
      ? currentRound?.status === "PendingEncryption"
        ? "Prizes are being encrypted. Ticket purchases will open shortly."
        : "This round is waiting for VRF initialization before ticket purchases can open."
      : !operatorCheckAvailable
        ? "The current network does not expose cUSDC / treasury metadata to the frontend, so purchase is disabled."
        : isConfidentialBalanceLoading
          ? "Checking your confidential cUSDC balance handle before purchase."
          : isConfidentialBalanceReadError || !hasCusdcBalanceHandle
            ? "Mint and wrap Sepolia cUSDC from the faucet before purchasing tickets."
            : !operatorReady
              ? "This action will authorize LuckyScratchTreasury as your cUSDC operator before purchasing."
              : pool.selectable
                ? "Manual and quick pick both submit the exact ticket indexes selected below. Payment uses confidential cUSDC."
                : "This pool is not selectable, so the final on-chain ticket indexes are assigned automatically.";

  return (
    <div className="relative min-h-screen bg-ns-background text-ns-on-surface font-body">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, ${poolThemeColor(poolId)}12 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(125,95,255,0.04) 0%, transparent 50%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            background: "linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.03) 50%)",
            backgroundSize: "100% 4px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-32 pt-6 md:px-8">
        <PoolInfoPanel
          poolName={pool.metadata?.name || `Pool #${pool.poolId}`}
          poolEmoji={poolEmojiFromMetadata(pool.metadata?.name)}
          poolId={poolId}
          ticketPrice={fromMicroUsdc(pool.ticketPrice)}
          maxPrize={fromMicroUsdc(pool.maxPrize)}
          winRate={Number(formatPercentFromBps(pool.hitRateBps))}
          poolTotal={fromMicroUsdc(pool.totalPrizeBudget)}
          poolType={modeLabelFromPool(pool.hitRateBps)}
          poolMode={pool.mode || "OneTime"}
          issuer={issuer}
          description={
            pool.metadata?.description ||
            "Pool detail is now sourced from backend read-model data and on-chain configuration."
          }
          totalTickets={currentRound?.totalTickets || pool.totalTicketsPerRound}
          soldTickets={currentRound?.soldCount || 0}
          prizes={prizeStructure}
          isPrizeStructureLoading={metadataDocumentQuery.isLoading}
          coverImage={pool.metadata?.coverImageUrl}
          onGoBack={handleGoBack}
        />

        {pool.selectable ? (
          <ModeToggle mode={mode} onChange={setMode} />
        ) : (
          <div className="mb-8 flex justify-center">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-white/60">
              This pool does not support manual ticket selection. Quick-pick purchase is used instead.
            </div>
          </div>
        )}

        {totalAvailableTickets === 0 ? (
          <div className="rounded-3xl border border-[#8D6C1D] bg-[#493916]/30 p-8 text-center text-[#FFD66D]">
            <div className="text-xl font-headline font-bold mb-2">Sold Out</div>
            <div className="text-sm text-[#FFD66D]/70">
              {pool.mode === "Loop"
                ? "All tickets for the current round have been sold. The next round will start automatically — check back soon or choose another pool."
                : "All tickets for this pool have been sold. This is a one-time pool with no upcoming rounds."}
            </div>
            <button
              onClick={() => router.push("/store")}
              className="mt-4 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 px-6 py-2 text-sm font-headline font-bold text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors"
            >
              Browse Other Pools
            </button>
          </div>
        ) : !roundReady ? (
          <div className="rounded-3xl border border-[#8D6C1D] bg-[#493916]/30 p-8 text-center text-[#FFD66D]">
            {currentRound?.status === "PendingEncryption"
              ? "Prizes are being encrypted. Ticket purchases will open shortly."
              : "The current round is waiting for VRF initialization. Ticket purchases will open after randomness is fulfilled."}
          </div>
        ) : (
          <div
            className={
              phase !== "selecting" ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"
            }
          >
            {mode === "manual" && pool.selectable ? (
              <ManualPickGallery
                availableIds={availableIds}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDeselect={handleDeselect}
                onReadyStateChange={setIsGalleryReady}
                themeColor={poolThemeColor(poolId)}
                ticketArtUrl={pool.metadata?.ticketArtUrl}
              />
            ) : (
              <BatchPickGallery
                quantity={quickQuantity}
                maxQuantity={Math.min(10, totalAvailableTickets)}
                availableIds={availableIds}
                assignedIds={quickPickIds}
                onChangeQuantity={setQuickQuantity}
                onReadyStateChange={setIsGalleryReady}
                themeColor={poolThemeColor(poolId)}
                ticketArtUrl={pool.metadata?.ticketArtUrl}
              />
            )}
          </div>
        )}

        {phase === "selecting" && roundReady && isGalleryReady && activeCount > 0 && (
          <CheckoutPanel
            selectedCount={activeCount}
            selectedIds={activeSelection}
            ticketPrice={fromMicroUsdc(pool.ticketPrice)}
            walletBalance={null}
            isConnected={Boolean(address)}
            isProcessing={false}
            canPurchase={canSubmitPurchase}
            actionLabel={operatorReady ? undefined : `Authorize & Purchase — ${totalCostLabel} USDC`}
            statusHint={statusHint}
            onPurchase={handlePurchase}
          />
        )}

        {(phase === "authorizing" || phase === "purchasing" || isMining || isAuthorizingToken) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="text-center">
              <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-[#FFD700] border-t-transparent" />
              <div className="mb-2 font-headline text-2xl font-bold text-white">
                {phase === "authorizing" || isAuthorizingToken
                  ? "Authorizing cUSDC Operator..."
                  : "Submitting Purchase..."}
              </div>
              <div className="text-sm text-white/40">
                {phase === "authorizing" || isAuthorizingToken
                  ? "Confirm the cUSDC operator transaction in your wallet."
                  : `Buying ${activeCount} ticket${activeCount !== 1 ? "s" : ""} on-chain`}
              </div>
            </div>
          </div>
        )}

        {phase === "purchased" && mintedTicketIds.length > 0 && (
          <PurchaseSuccessModal
            ticketIds={mintedTicketIds}
            poolName={pool.metadata?.name || `Pool #${pool.poolId}`}
            poolEmoji={poolEmojiFromMetadata(pool.metadata?.name)}
            ticketArtUrl={pool.metadata?.ticketArtUrl}
            onScratchNow={handleScratchNow}
            onBuyMore={handleBuyMore}
          />
        )}
      </div>
    </div>
  );
};
