"use client";

import React from "react";
import Link from "next/link";

type TicketResult = {
  id: string;
  isWin: boolean;
  prize: number;
};

type ResultSummaryProps = {
  results: TicketResult[];
  poolName: string;
  poolEmoji: string;
  onBuyMore: () => void;
  onScratchAgain?: () => void;
};

/**
 * Final settlement overlay showing purchase results.
 * Displays individual ticket outcomes and totals.
 */
export const ResultSummary: React.FC<ResultSummaryProps> = ({
  results,
  poolName,
  poolEmoji,
  onBuyMore,
  onScratchAgain,
}) => {
  const totalWon = results.reduce((sum, r) => sum + r.prize, 0);
  const winCount = results.filter(r => r.isWin).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Content */}
      <div className="relative cyber-glass rounded-3xl p-8 md:p-10 max-w-lg w-full border border-[#FFD700]/20">
        {/* Header */}
        <div className="text-center mb-8">
          {totalWon > 0 ? (
            <>
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="font-headline font-black text-3xl text-white tracking-tight mb-2">Congratulations!</h2>
              <p className="text-white/60 text-sm">
                You purchased {results.length} {poolEmoji} {poolName} NFT tickets
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">💪</div>
              <h2 className="font-headline font-black text-3xl text-white tracking-tight mb-2">
                Better Luck Next Time
              </h2>
              <p className="text-white/60 text-sm">No wins this round — fortune favors the persistent!</p>
            </>
          )}
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-center gap-6 mb-6 py-4 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="text-center">
            <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-bold">Total</div>
            <div className="font-headline font-bold text-lg text-white">{results.length}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-bold">Wins</div>
            <div className="font-headline font-bold text-lg text-[#FFD700]">{winCount}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-bold">Won</div>
            <div className="font-headline font-black text-2xl text-[#FFD700] neon-text-gold">{totalWon} USDC</div>
          </div>
        </div>

        {/* Per-ticket results grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-8">
          {results.map(r => (
            <div
              key={r.id}
              className={`
                p-3 rounded-xl text-center border transition-all
                ${r.isWin ? "border-[#FFD700]/30 bg-[#FFD700]/5" : "border-white/5 bg-white/[0.02] opacity-50"}
              `}
            >
              <div className={`font-headline font-bold text-xs ${r.isWin ? "text-[#FFD700]" : "text-white/30"}`}>
                #{r.id}
              </div>
              <div className={`text-xs mt-1 ${r.isWin ? "text-[#FFD700]" : "text-white/20"}`}>
                {r.isWin ? `+${r.prize}U 🎉` : "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {totalWon > 0 && (
            <Link
              href="/my-tickets"
              className="w-full py-4 rounded-xl font-headline font-bold text-center uppercase tracking-[0.15em] text-sm
                bg-gradient-to-r from-[#FFD700] to-[#B8860B] text-[#0F1626] hover:brightness-110
                active:scale-95 transition-all"
            >
              🎁 View My Tickets & Claim
            </Link>
          )}

          {onScratchAgain && (
            <button
              onClick={onScratchAgain}
              className="w-full py-4 rounded-xl font-headline font-bold uppercase tracking-[0.15em] text-sm
                cyber-glass border border-[#FFD700]/20 text-[#FFD700]/80 hover:text-[#FFD700]
                hover:border-[#FFD700]/40 active:scale-95 transition-all"
            >
              🎲 Scratch More Tickets
            </button>
          )}

          <button
            onClick={onBuyMore}
            className="w-full py-4 rounded-xl font-headline font-bold uppercase tracking-[0.15em] text-sm
              cyber-glass border border-white/10 text-white/60 hover:text-white/80
              hover:border-white/20 active:scale-95 transition-all"
          >
            🛒 Buy More Tickets
          </button>
        </div>
      </div>
    </div>
  );
};
