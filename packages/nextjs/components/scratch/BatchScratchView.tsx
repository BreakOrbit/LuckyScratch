"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, StarIcon, WalletIcon } from "@heroicons/react/24/solid";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";

type TicketResult = {
  ticketId: string;
  isWin: boolean;
  prize: number;
  isKnown?: boolean;
};

type BatchScratchViewProps = {
  poolName: string;
  ticketPrice: number;
  ticketIds: string[];
  ticketArtUrl?: string;
  results: TicketResult[];
  isReadyToScratch?: boolean;
  preparationStage?: string;
  preparationError?: string | null;
  onRetryPrepare?: () => void;
  onScratchAll?: () => Promise<void>;
};

type BatchPhase = "ready" | "submitting" | "animating" | "revealed";

const ScratchPrizeContent = ({ res }: { res: TicketResult }) => (
  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
    {res.isKnown === false ? (
      <>
        <div className="relative">
          <div className="absolute inset-0 bg-[#00DAF3] blur-xl opacity-20" />
          <StarIcon className="w-16 h-16 text-[#00DAF3] relative" />
        </div>
        <div className="text-center">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[#D0C6AB] font-bold">SCRATCHED</span>
          <span className="block px-5 font-headline text-lg font-black text-[#FFE16D]">
            Retry decrypt in My Tickets
          </span>
        </div>
      </>
    ) : res.isWin ? (
      <>
        <div className="relative">
          <div className="absolute inset-0 bg-[#FFD700] blur-xl opacity-30" />
          <StarIcon className="w-16 h-16 text-[#FFD700] relative" />
        </div>
        <div className="text-center">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[#D0C6AB] font-bold">ESTIMATED VALUE</span>
          <span className="block font-headline font-black text-5xl text-[#FFE16D] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
            {res.prize}.00<span className="text-xl ml-1">U</span>
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
);

/**
 * Individual Batch Scratch Card
 */
const BatchScratchCard = ({
  id,
  index,
  res,
  isRevealed,
  globalPhase,
  poolName,
  ticketPrice,
  maxPrizeValue,
  ticketArtUrl,
  canScratch,
  preparationStage,
  preparationError,
  onRetryPrepare,
  onManualReveal,
}: {
  id: string;
  index: number;
  res: TicketResult;
  isRevealed: boolean;
  globalPhase: BatchPhase;
  poolName: string;
  ticketPrice: number;
  maxPrizeValue: number;
  ticketArtUrl?: string;
  canScratch: boolean;
  preparationStage: string;
  preparationError?: string | null;
  onRetryPrepare?: () => void;
  onManualReveal: (index: number) => void | Promise<void>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasTriggered = useRef(false);

  const CANVAS_W = 180;
  const CANVAS_H = 320;
  const THRESHOLD = 0.55;

  useEffect(() => {
    if (isRevealed || globalPhase === "animating" || globalPhase === "submitting") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    gradient.addColorStop(0, "#1F2937"); // Dark gray
    gradient.addColorStop(0.5, "#4B5563"); // Slate gray
    gradient.addColorStop(1, "#111827"); // Deeper
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (let i = 0; i < 300; i++) {
      const x = Math.random() * CANVAS_W;
      const y = Math.random() * CANVAS_H;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

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
  }, [isRevealed, globalPhase]);

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
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 28, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(canvasX, canvasY, 20, canvasX, canvasY, 28);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, []);

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

  const checkProgress = useCallback(() => {
    if (hasTriggered.current) return;
    const p = calculateProgress();
    if (p >= THRESHOLD) {
      hasTriggered.current = true;
      void onManualReveal(index);
    }
  }, [calculateProgress, index, onManualReveal]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canScratch) return;
      e.preventDefault();
      isDrawing.current = true;
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

  return (
    <div
      className="relative floating-card"
      style={{
        animation: globalPhase === "ready" ? `batch-card-entrance 0.5s ease-out ${index * 0.08}s forwards` : undefined,
        opacity: globalPhase === "ready" ? 0 : 1,
      }}
    >
      <div className="absolute -inset-10 bg-[#FFD700]/20 blur-[60px] rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-700" />
      <div className="absolute -inset-px border border-[#FFD700]/10 rounded-[2.2rem] pointer-events-none" />

      <div
        className={`relative w-[340px] max-w-full bg-[#232a3b]/90 backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border transition-all duration-700 flex flex-col gap-3 overflow-hidden ${
          isRevealed
            ? res.isWin
              ? "border-[#FFD700]/50 card-reveal-glow"
              : "border-white/10"
            : "border-white/10 hover:border-white/20 card-reveal-glow"
        }`}
        style={{
          transformStyle: "preserve-3d",
          animation: isRevealed ? "card-flip-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : undefined,
        }}
      >
        <div className="absolute top-0 right-0 p-2 opacity-30">
          <svg className="text-[#FFD700]" fill="none" height="40" viewBox="0 0 40 40" width="40">
            <path d="M40 0L40 10M40 0L30 0" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex justify-between items-start px-2 z-10">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-[#D0C6AB]/80">
              AUTHENTICATED • SERIES 1
            </span>
            <h2 className="font-headline font-black text-2xl text-[#FFE16D] italic tracking-tight uppercase truncate max-w-[180px]">
              {poolName}
            </h2>
          </div>
          <div className="bg-[#FFD700]/10 px-2 py-1 rounded border border-[#FFD700]/30 shrink-0">
            <span className="text-[10px] font-black text-[#FFD700]">ID: #{id}</span>
          </div>
        </div>

        <div className={`${TICKET_ART_FRAME_CLASS} rounded-xl bg-black border border-white/10 shadow-inner`}>
          <img
            alt="Ticket Background"
            className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} opacity-60`}
            src={ticketArtUrl || TICKET_ART_FALLBACK_URL}
          />

          <div className="absolute inset-4 rounded-xl border border-[#FFD700]/20 bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="relative w-full h-full p-4 overflow-hidden rounded-lg">
              <ScratchPrizeContent res={res} />

              {!isRevealed && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  {globalPhase === "animating" ? (
                    <div
                      className="absolute inset-0 metallic-shimmer opacity-90 mix-blend-screen"
                      style={{
                        animation: `magic-shimmer 1.5s ease-in-out ${index * 0.35}s`,
                        backgroundSize: "200% 100%",
                      }}
                    />
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className={`absolute inset-0 rounded-lg touch-none z-10 ${
                        canScratch ? "cursor-crosshair" : "pointer-events-none cursor-not-allowed"
                      }`}
                      style={{ width: "100%", height: "100%" }}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    />
                  )}
                  {!canScratch && globalPhase !== "animating" && (
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
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto z-10">
          <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5">
            <span className="block text-[8px] uppercase tracking-widest text-[#D0C6AB]/80">ENTRY COST</span>
            <span className="font-headline font-bold text-[#DCE2F9]">{ticketPrice}.00 U</span>
          </div>
          <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5">
            <span className="block text-[8px] uppercase tracking-widest text-[#D0C6AB]/80">MAX POTENTIAL</span>
            <span className="font-headline font-bold text-[#FFD700]">{maxPrizeValue}.00 U</span>
          </div>
        </div>
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent mt-1 opacity-50" />
      </div>
    </div>
  );
};

/**
 * Batch scratch view for multiple tickets.
 * Shows card grid → one-click magic reveal animation OR manual scratch → results summary.
 */
export const BatchScratchView: React.FC<BatchScratchViewProps> = ({
  poolName,
  ticketPrice,
  ticketIds,
  ticketArtUrl,
  results,
  isReadyToScratch = true,
  preparationStage = "Preparing result",
  preparationError,
  onRetryPrepare,
  onScratchAll,
}) => {
  const router = useRouter();
  const [phase, setPhase] = useState<BatchPhase>("ready");
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [allRevealed, setAllRevealed] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const scratchPromiseRef = useRef<Promise<boolean> | null>(null);
  const canScratch = isReadyToScratch && !preparationError;

  const totalTickets = ticketIds.length;
  const hasKnownResults = results.some(r => r.isKnown !== false);
  const winCount = hasKnownResults ? results.filter(r => r.isWin).length : 0;
  const totalPrize = hasKnownResults ? results.reduce((sum, r) => sum + r.prize, 0) : 0;

  const submitScratchAllOnce = useCallback(async () => {
    if (!onScratchAll) {
      return true;
    }
    if (!scratchPromiseRef.current) {
      scratchPromiseRef.current = (async () => {
        setPhase("submitting");
        try {
          await onScratchAll();
          return true;
        } catch {
          setPhase("ready");
          scratchPromiseRef.current = null;
          return false;
        }
      })();
    }
    return scratchPromiseRef.current;
  }, [onScratchAll]);

  const handleManualReveal = useCallback(
    async (index: number) => {
      if (!canScratch) {
        return;
      }
      const didScratch = await submitScratchAllOnce();
      if (!didScratch) {
        return;
      }
      setPhase(current => (current === "submitting" ? "ready" : current));
      setRevealedIndices(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    },
    [canScratch, submitScratchAllOnce],
  );

  useEffect(() => {
    if (ticketIds.length > 0 && revealedIndices.size === ticketIds.length && !allRevealed) {
      setAllRevealed(true);
      setTimeout(() => setShowSummary(true), 800);
    }
  }, [revealedIndices.size, ticketIds.length, allRevealed]);

  /* Handle the "Scratch All" button click */
  const handleScratchAll = useCallback(async () => {
    if (!canScratch) {
      return;
    }
    const didScratch = await submitScratchAllOnce();
    if (!didScratch) {
      return;
    }
    setPhase("animating");

    ticketIds.forEach((_, index) => {
      if (revealedIndices.has(index)) return; // Skip already revealed

      setTimeout(
        () => {
          setRevealedIndices(prev => {
            const next = new Set(prev);
            next.add(index);
            return next;
          });
        },
        400 + index * 350,
      );
    });
  }, [canScratch, ticketIds, revealedIndices, submitScratchAllOnce]);

  /* Win celebration particles */
  useEffect(() => {
    if (!allRevealed || winCount === 0) return;
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type CelebParticle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      gravity: number;
      rotation: number;
      rotationSpeed: number;
    };

    const particles: CelebParticle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        life: 1,
        maxLife: 3 + Math.random() * 2,
        size: 3 + Math.random() * 4,
        color: ["#FFD700", "#FF6347", "#00DAF3", "#7D5FFF", "#FFE16D", "#FF4444"][Math.floor(Math.random() * 6)],
        gravity: 0.015,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.life -= 1 / 60 / p.maxLife;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        alive = true;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (alive) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [allRevealed, winCount]);

  const handleGoBack = useCallback(() => router.back(), [router]);
  const handleBackToTickets = useCallback(() => router.push("/my-tickets"), [router]);
  const handleClaimAll = useCallback(() => router.push("/my-tickets"), [router]);

  const maxPrizeValue = results.reduce((max, r) => (r.prize > max ? r.prize : max), 0) || 50;

  return (
    <div className="bg-[#0C1323] font-body text-[#DCE2F9] min-h-screen cinematic-bg">
      {/* Immersive Overlay */}
      <div className="fixed inset-0 bg-black/40 pointer-events-none z-0" />

      {/* Header */}
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
              Batch Scratch
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

      {/* Confetti canvas */}
      {allRevealed && winCount > 0 && (
        <canvas ref={particleCanvasRef} className="fixed inset-0 pointer-events-none z-40" />
      )}

      <main className="relative z-10 w-full min-h-[calc(100vh-64px)] flex flex-col pt-8 pb-24 md:pb-32 overflow-hidden">
        {/* Refined Lighting / Floor Blend */}
        <div className="absolute bottom-0 w-full h-[60%] floor-reflection z-0 pointer-events-none" />

        {/* Top Info & Actions */}
        <div className="px-8 max-w-[1400px] mx-auto w-full mb-8 z-20 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3">
              <span className="text-[#D0C6AB]/60 text-sm font-bold uppercase tracking-widest">Total</span>
              <span className="font-headline font-black text-2xl text-[#FFE16D]">{totalTickets}</span>
            </div>

            {showSummary && (
              <>
                <div
                  className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3"
                  style={{ animation: "result-fade-in 0.5s ease-out forwards" }}
                >
                  <span className="text-[#D0C6AB]/60 text-sm font-bold uppercase tracking-widest">
                    {hasKnownResults ? "Won" : "Scratched"}
                  </span>
                  <span className="font-headline font-black text-2xl text-[#00DAF3]">
                    {hasKnownResults ? winCount : totalTickets}
                  </span>
                </div>
                {hasKnownResults ? (
                  <div
                    className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3"
                    style={{ animation: "result-fade-in 0.5s ease-out 0.2s forwards", opacity: 0 }}
                  >
                    <span className="text-[#D0C6AB]/60 text-sm font-bold uppercase tracking-widest">Total Prize</span>
                    <span className="font-headline font-black text-2xl text-[#FFD700]">{totalPrize}</span>
                    <span className="text-[#D0C6AB]/60 text-sm font-bold">U</span>
                  </div>
                ) : (
                  <div
                    className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3"
                    style={{ animation: "result-fade-in 0.5s ease-out 0.2s forwards", opacity: 0 }}
                  >
                    <span className="text-[#D0C6AB]/60 text-sm font-bold uppercase tracking-widest">Next</span>
                    <span className="font-headline font-black text-sm text-[#FFD700]">Retry decrypt in My Tickets</span>
                  </div>
                )}
              </>
            )}
          </div>

          {(phase === "ready" || phase === "submitting") && !allRevealed && (
            <div className="relative group">
              <div className="absolute -inset-1 bg-[#FFD700]/30 blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <button
                onClick={handleScratchAll}
                disabled={phase === "submitting" || !canScratch}
                className="relative px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFE16D] text-[#3a3000] rounded-2xl font-headline font-black text-lg tracking-[0.15em] uppercase transition-all active:scale-95 border-b-4 border-[#3a3000]/30"
                style={{ animation: "breathe-glow 3s ease-in-out infinite" }}
              >
                <div className="flex items-center gap-3">
                  <StarIcon className="w-5 h-5" />
                  <span>
                    {phase === "submitting"
                      ? "Revealing..."
                      : canScratch
                        ? "Reveal All"
                        : preparationError
                          ? "Preparation Failed"
                          : preparationStage}
                  </span>
                  <StarIcon className="w-5 h-5" />
                </div>
              </button>
            </div>
          )}

          {phase === "animating" && !allRevealed && (
            <div className="inline-flex items-center gap-3 glass-panel px-6 py-3 rounded-full">
              <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-ping" />
              <span className="text-[#FFD700] font-headline font-bold text-sm tracking-wider uppercase">
                Revealing Sequence...
              </span>
            </div>
          )}
        </div>

        {/* Horizontal Ticket Gallery */}
        <div className="flex-grow w-full overflow-y-auto z-10 mt-12 md:mt-24 px-4">
          <div className="flex flex-wrap items-start justify-center gap-6 pb-10 pt-10 max-w-[1600px] mx-auto">
            {ticketIds.map((id, index) => {
              const isRevealed = revealedIndices.has(index);
              const res = results[index];

              return (
                <BatchScratchCard
                  key={id}
                  id={id}
                  index={index}
                  res={res}
                  isRevealed={isRevealed}
                  globalPhase={phase}
                  poolName={poolName}
                  ticketPrice={ticketPrice}
                  maxPrizeValue={maxPrizeValue}
                  ticketArtUrl={ticketArtUrl}
                  canScratch={canScratch}
                  preparationStage={preparationStage}
                  preparationError={preparationError}
                  onRetryPrepare={onRetryPrepare}
                  onManualReveal={handleManualReveal}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Post-Scratch Actions */}
        {showSummary && (
          <div
            className="w-full max-w-sm mx-auto px-8 z-20"
            style={{ animation: "result-fade-in 0.5s ease-out 0.4s forwards", opacity: 0 }}
          >
            {hasKnownResults && totalPrize > 0 && (
              <div className="relative group mb-4">
                <div className="absolute -inset-1 bg-[#FFD700]/20 blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <button
                  onClick={handleClaimAll}
                  className="w-full relative py-5 bg-[#FFD700] text-[#3a3000] rounded-2xl font-headline font-black text-xl tracking-[0.2em] uppercase transition-all active:scale-95 border-b-4 border-[#3a3000]/30 shadow-2xl"
                >
                  🎁 Claim All
                </button>
              </div>
            )}
            <button
              onClick={handleBackToTickets}
              className="w-full py-5 bg-transparent border border-white/10 text-white/50 rounded-2xl font-headline font-black tracking-[0.2em] uppercase hover:text-white/80 transition-colors"
            >
              Back to Tickets
            </button>
          </div>
        )}
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `,
        }}
      />
    </div>
  );
};
