"use client";

import React from "react";

type CheckoutPanelProps = {
  selectedCount: number;
  selectedIds: string[];
  ticketPrice: number;
  walletBalance?: number;
  isConnected: boolean;
  isProcessing: boolean;
  onPurchase: () => void;
  onConnect?: () => void;
};

/**
 * Bottom checkout panel with cart summary, wallet check, and the main CTA button.
 * Features breathing neon effects and orbiting particles on the purchase button.
 */
export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({
  selectedCount,
  selectedIds,
  ticketPrice,
  walletBalance = 0,
  isConnected,
  isProcessing,
  onPurchase,
  onConnect,
}) => {
  const totalPrice = selectedCount * ticketPrice;
  const hasEnoughBalance = walletBalance >= totalPrice;
  const canPurchase = isConnected && selectedCount > 0 && hasEnoughBalance && !isProcessing;

  const displayIds = selectedIds.slice(0, 5);
  const moreCount = selectedIds.length - 5;

  return (
    <div className="relative mt-8">
      <div className="cyber-glass rounded-3xl p-6 md:p-8">
        {/* Cart Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-[0.2em] font-bold mb-1">Cart Summary</div>
            <div className="font-headline font-bold text-lg text-white">
              Selected:{" "}
              <span className="text-[#FFD700]">
                {selectedCount} ticket{selectedCount !== 1 ? "s" : ""}
              </span>
              {selectedCount > 0 && (
                <span className="text-white/30 text-sm ml-2">
                  (ID: {displayIds.map(id => `#${id}`).join(", ")}
                  {moreCount > 0 ? ` +${moreCount} more` : ""})
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-white/40 uppercase tracking-[0.2em] font-bold mb-1">Total</div>
            <div
              className="font-headline font-black text-3xl text-[#FFD700] neon-text-gold"
              style={{ animation: selectedCount > 0 ? "neon-pulse 3s ease-in-out infinite" : undefined }}
            >
              {totalPrice} USDC
            </div>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="flex flex-wrap items-center gap-4 mb-6 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5">
          {isConnected ? (
            <>
              <span className="text-xs text-white/50">
                Balance: <span className="text-white/80 font-bold">{walletBalance} USDC</span>
              </span>
              <span className="w-px h-4 bg-white/10" />
              <span className="text-xs text-white/50">
                Required: <span className="text-white/80 font-bold">{totalPrice} USDC</span>
              </span>
              {hasEnoughBalance ? (
                <span className="text-xs text-green-400 font-bold">✅ Sufficient</span>
              ) : (
                <span className="text-xs text-red-400 font-bold">❌ Insufficient</span>
              )}
            </>
          ) : (
            <span className="text-xs text-white/50">🦊 Connect your wallet to purchase tickets</span>
          )}
        </div>

        {/* CTA Button */}
        <div className="relative flex justify-center">
          {isConnected ? (
            <button
              onClick={onPurchase}
              disabled={!canPurchase}
              className={`
                relative overflow-hidden px-12 py-5 rounded-2xl font-headline font-black text-lg uppercase tracking-[0.15em]
                transition-all duration-300 active:scale-95
                ${
                  canPurchase
                    ? "bg-gradient-to-r from-[#C62828] via-[#D4421A] to-[#FFD700] text-white shadow-[0_0_30px_rgba(198,40,40,0.4)] hover:shadow-[0_0_50px_rgba(198,40,40,0.6)]"
                    : "bg-white/5 text-white/20 border border-white/10 cursor-not-allowed"
                }
              `}
              style={{
                animation: canPurchase ? "breathe-glow 3s ease-in-out infinite" : undefined,
              }}
            >
              {/* Orbiting particles */}
              {canPurchase && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-[#FFD700]"
                      style={{
                        top: "50%",
                        left: "50%",
                        animation: `cta-particle-orbit ${4 + i}s linear infinite`,
                        animationDelay: `${i * 1.3}s`,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Shimmer sweep */}
              {canPurchase && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)",
                    animation: "scratch-shimmer 3s linear infinite",
                    backgroundSize: "200% 100%",
                  }}
                />
              )}

              <span className="relative z-10">
                {isProcessing ? "⏳ Processing..." : <>💥 Mint & Purchase — {totalPrice} USDC</>}
              </span>
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="px-12 py-5 rounded-2xl font-headline font-black text-lg uppercase tracking-[0.15em]
                bg-[#7D5FFF] text-white hover:bg-[#6A4FE6] active:scale-95 transition-all
                shadow-[0_0_30px_rgba(125,95,255,0.3)]"
            >
              🦊 Connect Wallet to Purchase
            </button>
          )}
        </div>

        {/* Purchase Notice */}
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-2.5 text-center">
            Purchase Notice
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-w-lg mx-auto">
            <div className="flex items-start gap-2 text-[11px] text-white/30 leading-relaxed">
              <span className="text-[#FFD700]/40 mt-0.5 flex-shrink-0">·</span>
              <span>Each purchase mints an NFT ticket</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-white/30 leading-relaxed">
              <span className="text-[#FFD700]/40 mt-0.5 flex-shrink-0">·</span>
              <span>Unscratched tickets are non-transferable</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-white/30 leading-relaxed">
              <span className="text-[#FFD700]/40 mt-0.5 flex-shrink-0">·</span>
              <span>Pool state is encrypted for fairness</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-white/30 leading-relaxed">
              <span className="text-[#FFD700]/40 mt-0.5 flex-shrink-0">·</span>
              <span>Every ticket has equal odds of winning</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
