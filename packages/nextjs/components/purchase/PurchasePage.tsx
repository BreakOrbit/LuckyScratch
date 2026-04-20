"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BatchPickGallery } from "./BatchPickGallery";
import { CheckoutPanel } from "./CheckoutPanel";
import { ManualPickGallery } from "./ManualPickGallery";
import { ModeToggle } from "./ModeToggle";
import { PoolInfoPanel } from "./PoolInfoPanel";
import { PurchaseSuccessModal } from "./PurchaseSuccessModal";

/* ─── Demo Pool Data (to be replaced by contract reads) ─── */
const DEMO_POOL = {
  name: "Lucky Fortune",
  emoji: "🏮",
  themeColor: "#C62828",
  ticketPrice: 2,
  maxPrize: 20,
  winRate: 66.1,
  poolTotal: 100,
  poolType: "High Win Rate",
  issuer: "Official",
  description: "Classic Chinese Red themed lottery with frequent small wins and exciting jackpots.",
  totalTickets: 56,
  prizes: [
    { amount: 20, count: 1, icon: "🥇" },
    { amount: 10, count: 2, icon: "🥈" },
    { amount: 5, count: 4, icon: "🏅" },
    { amount: 2, count: 10, icon: "💰" },
    { amount: 1, count: 20, icon: "🎫" },
  ],
};

type GamePhase = "selecting" | "confirming" | "minting" | "purchased";

/** Generate an array of available ticket IDs */
function generateTicketIds(total: number): string[] {
  return Array.from({ length: total }, (_, i) => String(i + 1).padStart(4, "0"));
}

type PurchasePageProps = {
  poolId: string;
};

/**
 * Main purchase page orchestrator.
 * Manages the state machine: selecting → confirming → minting → purchased.
 * Coordinates all child components and the purchase success modal.
 */
export const PurchasePage: React.FC<PurchasePageProps> = ({ poolId }) => {
  const router = useRouter();
  const pool = DEMO_POOL; // TODO: Load from contract using poolId

  /* ── State ── */
  const [mode, setMode] = useState<"manual" | "quick">("manual");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickQuantity, setQuickQuantity] = useState(3);
  const [isBatchReady, setIsBatchReady] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("selecting");

  /* Available ticket IDs */
  const allIds = useMemo(() => generateTicketIds(pool.totalTickets), [pool.totalTickets]);

  /* Quick-pick assigned IDs */
  const quickPickIds = useMemo(() => {
    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10); // pre-generate 10 for the vortex
  }, [allIds]);

  /* Active selection based on mode */
  const activeSelection = mode === "manual" ? selectedIds : quickPickIds.slice(0, quickQuantity);

  const activeCount = mode === "manual" ? selectedIds.length : quickQuantity;

  /* ── Handlers ── */
  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.length >= 10) return prev; // max 10
      return [...prev, id];
    });
  }, []);

  const handleDeselect = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }, []);

  const handlePurchase = useCallback(() => {
    if (activeCount === 0) return;
    setPhase("confirming");

    // Simulate wallet confirmation delay
    setTimeout(() => {
      setPhase("minting");

      // Simulate minting delay → show success modal
      setTimeout(() => {
        setPhase("purchased");
      }, 1500);
    }, 1000);
  }, [activeCount]);

  const handleScratchNow = useCallback(() => {
    const ticketParam = activeSelection.join(",");
    router.push(`/scratch/${poolId}?tickets=${ticketParam}`);
  }, [router, poolId, activeSelection]);

  const handleBuyMore = useCallback(() => {
    setPhase("selecting");
    setSelectedIds([]);
    setQuickQuantity(3);
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="relative min-h-screen bg-ns-background text-ns-on-surface font-body">
      {/* Cosmic Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Deep space gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(198,40,40,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(125,95,255,0.04) 0%, transparent 50%)",
          }}
        />

        {/* Floating orbs */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-[80px] opacity-15"
            style={{
              width: `${100 + i * 40}px`,
              height: `${100 + i * 40}px`,
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 30}%`,
              background: i % 3 === 0 ? "#FFD700" : i % 3 === 1 ? "#C62828" : "#7D5FFF",
              animation: `ticket-float ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}

        {/* Scan line texture */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            background: "linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.03) 50%)",
            backgroundSize: "100% 4px",
          }}
        />
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pb-32 pt-6">
        {/* Pool Info */}
        <PoolInfoPanel
          poolName={pool.name}
          poolEmoji={pool.emoji}
          poolId={poolId}
          ticketPrice={pool.ticketPrice}
          maxPrize={pool.maxPrize}
          winRate={pool.winRate}
          poolTotal={pool.poolTotal}
          poolType={pool.poolType}
          issuer={pool.issuer}
          description={pool.description}
          totalTickets={pool.totalTickets}
          prizes={pool.prizes}
          onGoBack={handleGoBack}
        />

        {/* Mode Toggle */}
        <ModeToggle mode={mode} onChange={setMode} />

        {/* Selection Gallery */}
        <div
          className={phase !== "selecting" ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}
        >
          {mode === "manual" ? (
            <ManualPickGallery
              availableIds={allIds}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onDeselect={handleDeselect}
              themeColor={pool.themeColor}
            />
          ) : (
            <BatchPickGallery
              quantity={quickQuantity}
              availableIds={allIds}
              assignedIds={quickPickIds}
              onChangeQuantity={setQuickQuantity}
              onReadyStateChange={setIsBatchReady}
              themeColor={pool.themeColor}
            />
          )}
        </div>

        {/* Checkout */}
        {phase === "selecting" && (mode === "manual" ? activeCount > 0 : isBatchReady) && (
          <div style={{ animation: "fade-in 0.5s ease-out forwards" }}>
            <CheckoutPanel
              selectedCount={activeCount}
              selectedIds={activeSelection}
              ticketPrice={pool.ticketPrice}
              walletBalance={120} // Demo value
              isConnected={true} // Demo: always connected
              isProcessing={false}
              onPurchase={handlePurchase}
            />
          </div>
        )}

        {/* Confirming / Minting overlay */}
        {(phase === "confirming" || phase === "minting") && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <div className="font-headline font-bold text-2xl text-white mb-2">
                {phase === "confirming" ? "Waiting for Wallet..." : "Minting NFT Tickets..."}
              </div>
              <div className="text-white/40 text-sm">
                {phase === "confirming"
                  ? "Please confirm the transaction in your wallet"
                  : `Minting ${activeCount} ticket${activeCount !== 1 ? "s" : ""} on-chain`}
              </div>
              {phase === "minting" && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {activeSelection.map((id, i) => (
                    <div
                      key={id}
                      className="w-2 h-2 rounded-full bg-[#FFD700]"
                      style={{
                        animation: "vortex-pulse 1s ease-in-out infinite",
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Purchase Success Modal */}
        {phase === "purchased" && (
          <PurchaseSuccessModal
            ticketIds={activeSelection}
            poolName={pool.name}
            poolEmoji={pool.emoji}
            onScratchNow={handleScratchNow}
            onBuyMore={handleBuyMore}
          />
        )}
      </div>
    </div>
  );
};
