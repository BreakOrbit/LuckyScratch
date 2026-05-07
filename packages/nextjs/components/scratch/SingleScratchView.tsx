"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScratchResultOverlay } from "./ScratchResultOverlay";
import { ArrowLeftIcon, ChevronRightIcon, QrCodeIcon, StarIcon, WalletIcon } from "@heroicons/react/24/solid";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";

type SingleScratchViewProps = {
  poolId: string;
  poolName: string;
  ticketPrice: number;
  maxPrize: number;
  ticketId: string;
  ticketArtUrl?: string;
  result: { ticketId: string; isWin: boolean; prize: number; isKnown?: boolean };
  isScratchable?: boolean;
  isReadyToScratch?: boolean;
  preparationStage?: string;
  preparationError?: string | null;
  onRetryPrepare?: () => void;
  onScratch?: () => Promise<void>;
};

type ScratchPhase = "ready" | "scratching" | "submitting" | "revealed";

/**
 * Single ticket scratch view with interactive canvas-based scratch mechanic.
 * Design reference: doc/scratch/code.html — Celestial Vault themed card
 * with cinematic background image.
 */
export const SingleScratchView: React.FC<SingleScratchViewProps> = ({
  poolId,
  poolName,
  ticketPrice,
  maxPrize,
  ticketId,
  ticketArtUrl,
  result,
  isScratchable = true,
  isReadyToScratch = true,
  preparationStage = "Preparing result",
  preparationError,
  onRetryPrepare,
  onScratch,
}) => {
  const router = useRouter();
  const [phase, setPhase] = useState<ScratchPhase>(isScratchable ? "ready" : "revealed");
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasTriggered = useRef(false);

  const CANVAS_W = 180;
  const CANVAS_H = 320;
  const THRESHOLD = 0.55;
  const canScratch = isScratchable && isReadyToScratch && !preparationError;

  /* Initialize scratch coating */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isScratchable) {
      setProgress(1);
      setPhase("revealed");
      hasTriggered.current = true;
      return;
    }
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // Metallic gradient coating
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    gradient.addColorStop(0, "#1F2937"); // Dark gray
    gradient.addColorStop(0.5, "#4B5563"); // Slate gray
    gradient.addColorStop(1, "#111827"); // Deeper
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Shimmer texture dots
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * CANVAS_W;
      const y = Math.random() * CANVAS_H;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // VOID stamp text -> 刮开揭晓
    ctx.save();
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.rotate(-0.05);
    ctx.font = "bold 32px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 255, 255, 0.1)";
    ctx.shadowBlur = 2;
    ctx.fillText("刮开揭晓", 0, 0);
    ctx.restore();

    // Hint text
    ctx.font = "12px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "center";
    ctx.fillText("✨ SCRATCH TO REVEAL ✨", CANVAS_W / 2, CANVAS_H - 20);

    hasTriggered.current = false;
    setProgress(0);
    setPhase("ready");
  }, [isScratchable]);

  /* Calculate scratch progress */
  const calculateProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    const total = pixels.length / 4;

    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++;
    }
    return transparent / total;
  }, []);

  /* Scratch drawing */
  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;

    ctx.globalCompositeOperation = "destination-out";

    // Main circle
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 20, 0, Math.PI * 2);
    ctx.fill();

    // Soft edge
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 28, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(canvasX, canvasY, 20, canvasX, canvasY, 28);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
  }, []);

  const completeScratch = useCallback(async () => {
    setPhase("submitting");
    try {
      if (!isScratchable) return;
      await onScratch?.();
      setTimeout(() => setPhase("revealed"), 500);
    } catch {
      hasTriggered.current = false;
      setPhase("ready");
    }
  }, [isScratchable, onScratch]);

  const checkProgress = useCallback(() => {
    if (hasTriggered.current) return;
    const p = calculateProgress();
    setProgress(p);
    if (p >= THRESHOLD) {
      hasTriggered.current = true;
      void completeScratch();
    }
  }, [calculateProgress, completeScratch]);

  /* Pointer events */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canScratch) return;
      e.preventDefault();
      isDrawing.current = true;
      setPhase("scratching");
      scratch(e.clientX, e.clientY);
    },
    [canScratch, scratch],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      scratch(e.clientX, e.clientY);
      checkProgress();
    },
    [scratch, checkProgress],
  );

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
    checkProgress();
  }, [checkProgress]);

  /* Navigation */
  const handleBackToTickets = useCallback(() => router.push("/my-tickets"), [router]);
  const handleBuyMore = useCallback(() => router.push(`/purchase/${poolId}`), [router, poolId]);
  const handleGoBack = useCallback(() => router.back(), [router]);

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="bg-[#0C1323] font-body text-[#DCE2F9] min-h-screen cinematic-bg">
      {/* Immersive Overlay */}
      <div className="fixed inset-0 bg-black/40 pointer-events-none z-0" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#0C1323]/40 backdrop-blur-md flex justify-between items-center w-full px-6 h-16 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-all active:scale-95 text-[#FFE16D]"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold tracking-tight text-xl text-[#FFE16D] uppercase italic">
              Scratch Center
            </h1>
            <div className="h-[1px] w-full bg-gradient-to-r from-[#FFD700]/50 to-transparent" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-panel px-4 py-1.5 rounded-full flex items-center gap-2 neon-glow-primary">
            <WalletIcon className="w-4 h-4 text-[#FFD700]" />
            <span className="font-headline font-black text-sm tracking-tighter text-[#FFF6DF]">1,240.00 U</span>
          </div>
        </div>
      </header>

      <main className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 gap-8 overflow-hidden z-10">
        {/* Refined Lighting / Floor Blend */}
        <div className="absolute bottom-0 w-full h-[60%] floor-reflection z-0" />

        {/* Central Stage */}
        <div className="relative z-10 floating-card">
          {/* Intense Backglow */}
          <div className="absolute -inset-10 bg-[#FFD700]/20 blur-[60px] rounded-full opacity-60" />
          {/* Technical Terminal Framing */}
          <div className="absolute -inset-px border border-[#FFD700]/20 rounded-[2.2rem] pointer-events-none" />

          {/* Card Container */}
          <div className="relative w-[340px] max-w-full bg-[#232a3b]/90 backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border border-white/10 flex flex-col gap-3 overflow-hidden card-reveal-glow">
            {/* Terminal UI Corner Accents */}
            <div className="absolute top-0 right-0 p-2 opacity-30">
              <svg className="text-[#FFD700]" fill="none" height="40" viewBox="0 0 40 40" width="40">
                <path d="M40 0L40 10M40 0L30 0" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>

            {/* Ticket Header */}
            <div className="flex justify-between items-start px-2 z-10">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-[#D0C6AB]/80">
                  AUTHENTICATED • SERIES 1
                </span>
                <h2 className="font-headline font-black text-2xl text-[#FFE16D] italic tracking-tight uppercase">
                  {poolName}
                </h2>
              </div>
              <div className="bg-[#FFD700]/10 px-2 py-1 rounded border border-[#FFD700]/30">
                <span className="text-[10px] font-black text-[#FFD700]">ID: #{ticketId}</span>
              </div>
            </div>

            {/* Ticket Illustration Area */}
            <div className={`${TICKET_ART_FRAME_CLASS} rounded-xl bg-black border border-white/10 shadow-inner`}>
              <img
                alt="Ticket Background"
                className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} opacity-60`}
                src={ticketArtUrl || TICKET_ART_FALLBACK_URL}
              />

              {/* SCRATCH AREA OVERLAY */}
              <div className="absolute inset-4 rounded-xl border border-[#FFD700]/20 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="relative w-full h-full p-4 overflow-hidden rounded-lg">
                  {/* Revealed Content */}
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                    {result.isKnown === false ? (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 bg-[#00DAF3] blur-xl opacity-20" />
                          <StarIcon className="w-16 h-16 text-[#00DAF3] relative" />
                        </div>
                        <div className="text-center">
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-[#D0C6AB] font-bold">
                            SCRATCHED
                          </span>
                          <span className="block px-5 font-headline text-lg font-black text-[#FFE16D]">
                            Open My Tickets to retry decrypt
                          </span>
                        </div>
                      </>
                    ) : result.isWin ? (
                      <>
                        <div className="relative">
                          <div className="absolute inset-0 bg-[#FFD700] blur-xl opacity-30" />
                          <StarIcon className="w-16 h-16 text-[#FFD700] relative" />
                        </div>
                        <div className="text-center">
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-[#D0C6AB] font-bold">
                            ESTIMATED VALUE
                          </span>
                          <span className="block font-headline font-black text-5xl text-[#FFE16D] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                            {result.prize}.00<span className="text-xl ml-1">U</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl opacity-50">😔</span>
                        <div className="text-center">
                          <span className="block text-white/40 text-sm">No Prize</span>
                          <span className="block text-white/20 text-xs mt-1">Better Luck Next Time</span>
                        </div>
                      </>
                    )}
                  </div>

                  {phase !== "revealed" && (
                    <canvas
                      ref={canvasRef}
                      className={`absolute inset-0 rounded-lg touch-none z-10 ${
                        canScratch ? "cursor-crosshair" : "pointer-events-none cursor-not-allowed"
                      } ${phase === "submitting" ? "pointer-events-none opacity-70" : ""}`}
                      style={{ width: "100%", height: "100%" }}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    />
                  )}

                  {!canScratch && phase !== "revealed" && (
                    <div
                      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg border px-5 text-center backdrop-blur-sm ${
                        preparationError ? "border-[#FFB4AB]/30 bg-[#2A1521]/90" : "border-[#FFD700]/20 bg-black/75"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black uppercase tracking-[0.22em] ${
                          preparationError ? "text-[#FFB4AB]" : "text-[#00DAF3]"
                        }`}
                      >
                        {preparationError ? "Preparation Failed" : "Preparing Reveal"}
                      </span>
                      <span className="font-headline text-lg font-black text-[#FFE16D]">{preparationStage}</span>
                      {preparationError ? (
                        <button
                          type="button"
                          onClick={onRetryPrepare}
                          className="rounded-lg bg-[#FFD700] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#3a3000] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!onRetryPrepare}
                        >
                          Retry
                        </button>
                      ) : (
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#00DAF3]" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ticket Footer Info */}
            <div className="grid grid-cols-2 gap-2 mt-auto z-10">
              <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="block text-[8px] uppercase tracking-widest text-[#D0C6AB]/80">ENTRY COST</span>
                <span className="font-headline font-bold text-[#DCE2F9]">{ticketPrice}.00 U</span>
              </div>
              <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="block text-[8px] uppercase tracking-widest text-[#D0C6AB]/80">MAX POTENTIAL</span>
                <span className="font-headline font-bold text-[#FFD700]">{maxPrize}.00 U</span>
              </div>
            </div>

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent mt-1 opacity-50" />
          </div>
        </div>

        {/* Controls Area */}
        <div className="w-full max-w-[340px] space-y-8 z-20">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00DAF3] rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#00DAF3] neon-text-cyan">
                  {phase === "submitting"
                    ? "Scratch & Decrypt: Pending"
                    : !canScratch
                      ? preparationError
                        ? "Reveal Preparation Failed"
                        : preparationStage
                      : `Data Extraction: ${phase === "revealed" ? 100 : progressPercent}%`}
                </span>
              </div>
              <QrCodeIcon className="w-4 h-4 text-[#00DAF3]" />
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full p-[1px] overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-[#00DAF3] to-[#FFD700] rounded-full shadow-[0_0_15px_rgba(0,218,243,0.3)] relative transition-all duration-700"
                style={{ width: `${phase === "revealed" ? 100 : progressPercent}%` }}
              >
                {phase !== "revealed" && (
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer-crystal_2s_infinite]" />
                )}
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-[#FFD700]/20 blur opacity-0 group-hover:opacity-100 transition duration-500" />
            <button
              onClick={handleBackToTickets}
              className="w-full relative py-5 bg-[#FFD700] text-[#3a3000] rounded-2xl font-headline font-black text-xl tracking-[0.2em] uppercase transition-all active:scale-95 border-b-4 border-[#3a3000]/30"
            >
              <div className="relative flex items-center justify-center gap-4">
                Next Terminal
                <ChevronRightIcon className="w-5 h-5 font-black" />
              </div>
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="terminal-line" />
            <p className="text-center text-[9px] text-[#D0C6AB]/70 font-bold tracking-[0.1em] px-4 leading-relaxed">
              {isScratchable
                ? "NEURAL LINK ESTABLISHED. REVEAL ALL FRAGMENTS TO SYNC WINNING SEQUENCE."
                : "THIS TICKET HAS ALREADY BEEN SCRATCHED. ITS RESULT IS LOCKED IN."}
            </p>
            <div className="terminal-line" />
          </div>
        </div>
      </main>

      {/* Result Overlay */}
      {phase === "revealed" && isScratchable && result.isKnown !== false && (
        <ScratchResultOverlay
          isWin={result.isWin}
          prize={result.prize}
          onClaimReward={result.isWin ? () => router.push("/my-tickets") : undefined}
          onBuyMore={handleBuyMore}
          onBackToTickets={handleBackToTickets}
        />
      )}
    </div>
  );
};
