"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BatchPickGallery } from "./BatchPickGallery";
import { CheckoutPanel } from "./CheckoutPanel";
import { ManualPickGallery } from "./ManualPickGallery";
import { ModeToggle } from "./ModeToggle";
import { PoolInfoPanel } from "./PoolInfoPanel";
import { PurchaseSuccessModal } from "./PurchaseSuccessModal";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { useLuckyScratchPurchaseContext } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatPercentFromBps, fromMicroUsdc } from "~~/services/luckyScratch/poolMath";
import { notification } from "~~/utils/scaffold-eth";

type GamePhase = "selecting" | "approving" | "purchasing" | "purchased";

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

export const PurchasePage: React.FC<PurchasePageProps> = ({ poolId }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const purchaseContextQuery = useLuckyScratchPurchaseContext(poolId);
  const { data: coreContract } = useDeployedContractInfo({ contractName: "LuckyScratchCore" });
  const { data: treasuryContract } = useDeployedContractInfo({ contractName: "LuckyScratchTreasury" });
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "LuckyScratchCore" });
  const { writeContractAsync: approveTokenAsync, isMining: isApprovingToken } = useScaffoldWriteContract({
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
  const approvalSatisfied = typeof currentAllowance === "bigint" && currentAllowance >= BigInt(totalCostMicro);
  const balanceSufficient = typeof paymentTokenBalance === "bigint" && paymentTokenBalance >= BigInt(totalCostMicro);
  const canSubmitPurchase =
    Boolean(address) &&
    Boolean(coreContract) &&
    activeCount > 0 &&
    isGalleryReady &&
    balanceSufficient &&
    approvalAvailable &&
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
    if (!approvalAvailable) {
      notification.error("cUSDC contract or treasury metadata is unavailable on the current network.");
      return;
    }
    if (!balanceSufficient) {
      notification.error("Your cUSDC balance is lower than the required purchase amount.");
      return;
    }
    if (!canSubmitPurchase) {
      notification.error("Current ticket selection is not ready for purchase.");
      return;
    }

    try {
      if (!approvalSatisfied) {
        setPhase("approving");
        await approveTokenAsync({
          functionName: "approve",
          args: [treasuryContract!.address, BigInt(totalCostMicro)],
        });
        await queryClient.invalidateQueries({ queryKey: ["readContract"] });
      }

      setPhase("purchasing");
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "pools", poolId, "purchase-context"] }),
        queryClient.invalidateQueries({ queryKey: ["lucky-scratch", "users", address.toLowerCase(), "tickets"] }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ticket purchase failed.";
      notification.error(message);
      setPhase("selecting");
    }
  }, [
    activeCount,
    activeTicketIndexes,
    address,
    approvalAvailable,
    approvalSatisfied,
    approveTokenAsync,
    balanceSufficient,
    canSubmitPurchase,
    coreContract,
    pool,
    poolId,
    queryClient,
    totalCostMicro,
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

  const walletBalanceUsdc = fromMicroUsdc(paymentTokenBalance);
  const issuer = pool.protocolOwned ? "Official" : "Community";
  const statusHint = !address
    ? "Connect your wallet to read cUSDC balance and approve ticket payments."
    : !approvalAvailable
      ? "The current network does not expose cUSDC / treasury metadata to the frontend, so purchase is disabled."
      : !balanceSufficient
        ? "Your cUSDC balance is below the current purchase total."
        : !approvalSatisfied
          ? "This action will request a cUSDC approval before submitting the purchase transaction."
          : pool.selectable
            ? "Manual and quick pick both submit the exact ticket indexes selected below."
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
          issuer={issuer}
          description={
            pool.metadata?.description ||
            "Pool detail is now sourced from backend read-model data and on-chain configuration."
          }
          totalTickets={pool.currentRoundState?.totalTickets || pool.totalTicketsPerRound}
          soldTickets={pool.currentRoundState?.soldCount || 0}
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
            The current round is sold out. Wait for the next loop round or choose another pool.
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
              />
            )}
          </div>
        )}

        {phase === "selecting" && isGalleryReady && activeCount > 0 && (
          <CheckoutPanel
            selectedCount={activeCount}
            selectedIds={activeSelection}
            ticketPrice={fromMicroUsdc(pool.ticketPrice)}
            walletBalance={walletBalanceUsdc}
            isConnected={Boolean(address)}
            isProcessing={false}
            canPurchase={canSubmitPurchase}
            actionLabel={approvalSatisfied ? undefined : `💥 Approve & Purchase — ${totalCostLabel} USDC`}
            statusHint={statusHint}
            onPurchase={handlePurchase}
          />
        )}

        {(phase === "approving" || phase === "purchasing" || isMining || isApprovingToken) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="text-center">
              <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-[#FFD700] border-t-transparent" />
              <div className="mb-2 font-headline text-2xl font-bold text-white">
                {phase === "approving" || isApprovingToken ? "Approving cUSDC..." : "Submitting Purchase..."}
              </div>
              <div className="text-sm text-white/40">
                {phase === "approving" || isApprovingToken
                  ? "Confirm the allowance transaction in your wallet."
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
            onScratchNow={handleScratchNow}
            onBuyMore={handleBuyMore}
          />
        )}
      </div>
    </div>
  );
};
