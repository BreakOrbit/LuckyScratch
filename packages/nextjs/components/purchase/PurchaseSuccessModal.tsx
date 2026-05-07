"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";

type PurchaseSuccessModalProps = {
  ticketIds: string[];
  poolName: string;
  poolEmoji: string;
  ticketArtUrl?: string;
  onScratchNow: () => void;
  onBuyMore: () => void;
};

/**
 * Purchase success modal showing minted ticket cards.
 * Three actions: Scratch Now, Save to My Tickets, Continue Buying.
 * Features staggered entrance animation for ticket cards.
 */
export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  ticketIds,
  poolName,
  poolEmoji,
  ticketArtUrl,
  onScratchNow,
  onBuyMore,
}) => {
  const [visible, setVisible] = useState(false);
  const [cardsReady, setCardsReady] = useState(false);

  useEffect(() => {
    // Staggered entrance: backdrop → text → cards
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => setCardsReady(true), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-lg transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Confetti / celebratory particles */}
      {visible && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${3 + Math.random() * 5}px`,
                height: `${3 + Math.random() * 5}px`,
                left: `${10 + Math.random() * 80}%`,
                top: `-5%`,
                background: ["#FFD700", "#C62828", "#00DAF3", "#FF6B6B", "#FFE066"][i % 5],
                opacity: 0.7,
                animation: `confetti-fall ${3 + Math.random() * 4}s linear ${Math.random() * 2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal Content */}
      <div
        className={`relative cyber-glass rounded-3xl p-8 md:p-10 max-w-md w-full max-h-[90vh] overflow-y-auto border border-[#FFD700]/20 transition-all duration-500 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
        style={{
          boxShadow: "0 0 60px rgba(255,215,0,0.08), 0 0 120px rgba(198,40,40,0.06)",
        }}
      >
        {/* ── Header ── */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(0,218,0,0.15) 0%, rgba(0,218,0,0.05) 100%)",
              border: "1px solid rgba(0,218,0,0.2)",
            }}
          >
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="font-headline font-black text-2xl text-white tracking-tight mb-2">Purchase Successful!</h2>
          <p className="text-white/50 text-sm">
            🎫 You got <span className="text-[#FFD700] font-bold">{ticketIds.length}</span> 「{poolName}」ticket
            {ticketIds.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Ticket Cards Grid ── */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 max-h-[40vh] overflow-y-auto pr-1">
          {ticketIds.map((id, i) => (
            <div
              key={id}
              className={`
                relative w-[90px] rounded-xl overflow-hidden border border-white/10
                transition-all duration-500
                ${cardsReady ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-90"}
              `}
              style={{
                transitionDelay: `${i * 120}ms`,
                boxShadow: cardsReady ? "0 0 20px rgba(198,40,40,0.15), 0 4px 20px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {/* Card top: themed cover */}
              <div
                className={`${TICKET_ART_FRAME_CLASS} flex items-center justify-center`}
                style={{
                  background: "linear-gradient(135deg, #C62828 0%, #8B1A1A 50%, #5D0F0F 100%)",
                }}
              >
                <img
                  alt={`${poolName} ticket art`}
                  className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} opacity-70`}
                  src={ticketArtUrl || TICKET_ART_FALLBACK_URL}
                />
                {/* Decorative radial */}
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage: "radial-gradient(circle at 50% 30%, rgba(255,215,0,0.5) 0%, transparent 60%)",
                  }}
                />
                {/* Emoji */}
                <span className="text-3xl relative z-10 drop-shadow-lg">{poolEmoji}</span>
                {/* Shimmer */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
                    animationName: cardsReady ? "scratch-shimmer" : "none",
                    animationDuration: "4s",
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationDelay: `${i * 0.5}s`,
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>

              {/* Card bottom: ID + status */}
              <div
                className="px-2 py-2.5 text-center"
                style={{
                  background: "rgba(15,22,38,0.95)",
                }}
              >
                <div className="font-headline font-black text-xs text-[#FFD700] mb-1 tracking-wider">#{id}</div>
                <div className="text-[9px] text-white/35 font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border border-white/10 inline-block">
                  Unrevealed
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex flex-col gap-2.5">
          {/* Primary: Scratch Now */}
          <button
            onClick={onScratchNow}
            className="w-full py-3.5 rounded-xl font-headline font-bold text-center text-sm uppercase tracking-[0.12em]
              bg-gradient-to-r from-[#C62828] via-[#D4421A] to-[#FFD700] text-white
              hover:brightness-110 active:scale-[0.98] transition-all
              shadow-[0_0_25px_rgba(198,40,40,0.3)]"
            style={{
              animation: "breathe-glow 3s ease-in-out infinite",
            }}
          >
            🎲 Scratch Now
          </button>

          {/* Secondary: Save to My Tickets */}
          <Link
            href="/my-tickets"
            className="w-full py-3.5 rounded-xl font-headline font-bold text-center text-sm uppercase tracking-[0.12em]
              cyber-glass border border-[#FFD700]/20 text-[#FFD700]/80
              hover:text-[#FFD700] hover:border-[#FFD700]/40 active:scale-[0.98] transition-all"
          >
            📦 Save to My Tickets
          </Link>

          {/* Tertiary: Continue Buying */}
          <button
            onClick={onBuyMore}
            className="w-full py-3.5 rounded-xl font-headline font-bold text-center text-sm uppercase tracking-[0.12em]
              cyber-glass border border-white/10 text-white/50
              hover:text-white/75 hover:border-white/20 active:scale-[0.98] transition-all"
          >
            🛒 Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};
