"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/solid";

type ScratchResultOverlayProps = {
  isWin: boolean;
  prize: number;
  onClaimReward?: () => void;
  onScratchNext?: () => void;
  onBuyMore?: () => void;
  onBackToTickets: () => void;
  hasNextTicket?: boolean;
};

type Particle = {
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

/**
 * Full-screen result overlay for single scratch mode.
 * Win: fireworks + golden prize display + celebration
 * Loss: gentle encouragement + subtle particles
 */
export const ScratchResultOverlay: React.FC<ScratchResultOverlayProps> = ({
  isWin,
  prize,
  onClaimReward,
  onScratchNext,
  onBuyMore,
  onBackToTickets,
  hasNextTicket = false,
}) => {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  /* Staggered entrance */
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    return () => {
      clearTimeout(t1);
    };
  }, []);

  /* Firework particle system */
  const createFireworks = useCallback(() => {
    const particles: Particle[] = [];
    const canvas = canvasRef.current;
    if (!canvas) return particles;
    const w = canvas.width;
    const h = canvas.height;

    if (isWin) {
      const burstPoints = [
        { x: w * 0.3, y: h * 0.3 },
        { x: w * 0.7, y: h * 0.25 },
        { x: w * 0.5, y: h * 0.4 },
        { x: w * 0.2, y: h * 0.5 },
        { x: w * 0.8, y: h * 0.45 },
      ];

      burstPoints.forEach(bp => {
        const count = 25 + Math.floor(Math.random() * 15);
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
          const speed = 2 + Math.random() * 5;
          const colors = ["#FFD700", "#FFA500", "#FF6347", "#FFE16D", "#00DAF3", "#FF4444", "#7D5FFF"];
          particles.push({
            x: bp.x,
            y: bp.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 1,
            maxLife: 1.2 + Math.random() * 0.8,
            size: 2 + Math.random() * 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 0.04 + Math.random() * 0.03,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
          });
        }
      });

      // Confetti rain
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * w,
          y: -20 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 2,
          vy: 1.5 + Math.random() * 3,
          life: 1,
          maxLife: 3 + Math.random() * 2,
          size: 3 + Math.random() * 4,
          color: ["#FFD700", "#FF6347", "#00DAF3", "#7D5FFF", "#FFE16D", "#FF4444"][Math.floor(Math.random() * 6)],
          gravity: 0.01,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
        });
      }
    } else {
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: w * 0.5 + (Math.random() - 0.5) * w * 0.6,
          y: h * 0.5 + (Math.random() - 0.5) * h * 0.4,
          vx: (Math.random() - 0.5) * 1,
          vy: -0.5 - Math.random() * 1,
          life: 1,
          maxLife: 2 + Math.random(),
          size: 1 + Math.random() * 2,
          color: ["#555", "#666", "#777", "#888"][Math.floor(Math.random() * 4)],
          gravity: -0.01,
          rotation: 0,
          rotationSpeed: 0,
        });
      }
    }

    return particles;
  }, [isWin]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
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
      const alpha = Math.max(0, p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (isWin) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
      }

      if (p.size > 3) {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive) {
      animFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isWin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = createFireworks();
    animate();

    if (isWin) {
      const intervals = [800, 1600, 2400].map(delay =>
        setTimeout(() => {
          particlesRef.current.push(...createFireworks());
          if (!animFrameRef.current) animate();
        }, delay),
      );
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        intervals.forEach(clearTimeout);
      };
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [createFireworks, animate, isWin]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/90 transition-all duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ backdropFilter: "blur(16px)" }}
      />

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Content */}
      <div
        className={`relative z-20 w-full max-w-sm transition-all duration-700 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"
        }`}
      >
        {isWin ? (
          /* ═══ WIN RESULT ═══ */
          <div className="relative bg-[#232a3b] w-full rounded-[3rem] p-10 border border-[#FFD700]/40 shadow-[0_0_100px_rgba(255,215,0,0.15)] text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#FFD700]/30 blur-2xl rounded-full" />
              <div className="w-28 h-28 bg-black/40 rounded-full flex items-center justify-center mx-auto border-2 border-[#FFD700] shadow-2xl relative">
                <SparklesIcon className="w-16 h-16 text-[#FFD700]" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-black text-4xl text-[#FFE16D] uppercase italic tracking-tighter">
                Jackpot!
              </h3>
              <p className="text-[#D0C6AB] font-bold tracking-wide">LEGENDARY SYMBOL MATCHED</p>
            </div>
            <div className="bg-black/60 py-6 rounded-[2rem] border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FFD700]/50 to-transparent" />
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[#FFD700]/60 mb-2 font-black">
                Transferring Assets
              </span>
              <span className="font-headline font-black text-5xl text-white">
                +{prize}.00<span className="text-2xl ml-1">U</span>
              </span>
            </div>
            <div className="space-y-3">
              <button
                onClick={onClaimReward}
                className="w-full py-5 bg-white/5 text-[#FFE16D] rounded-2xl font-headline font-black tracking-[0.2em] uppercase border border-[#FFD700]/30 hover:bg-[#FFD700]/10 transition-colors"
              >
                Initialize Claim
              </button>
              {hasNextTicket && onScratchNext && (
                <button
                  onClick={onScratchNext}
                  className="w-full py-3 bg-transparent text-[#00DAF3] rounded-xl font-headline font-bold text-sm tracking-[0.1em] uppercase border border-[#00DAF3]/30 hover:bg-[#00DAF3]/10 transition-colors"
                >
                  Scratch Next
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ═══ LOSS RESULT ═══ */
          <div className="relative bg-[#232a3b] w-full rounded-[3rem] p-10 border border-white/5 shadow-2xl text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full" />
              <div className="w-28 h-28 bg-black/40 rounded-full flex items-center justify-center mx-auto border-2 border-white/10 shadow-2xl relative">
                <span className="text-4xl opacity-50">😔</span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-black text-2xl text-white/70 uppercase tracking-tighter">No Prize</h3>
              <p className="text-white/40 text-sm font-bold tracking-wide">
                &quot;Fortune favors the persistent...&quot;
              </p>
            </div>
            <div className="space-y-3">
              {hasNextTicket && onScratchNext ? (
                <button
                  onClick={onScratchNext}
                  className="w-full py-5 bg-white/5 text-white/90 rounded-2xl font-headline font-black tracking-[0.2em] uppercase border border-white/20 hover:bg-white/10 transition-colors"
                >
                  Scratch Next
                </button>
              ) : onBuyMore ? (
                <button
                  onClick={onBuyMore}
                  className="w-full py-5 bg-white/5 text-[#FFE16D] rounded-2xl font-headline font-black tracking-[0.2em] uppercase border border-[#FFD700]/30 hover:bg-[#FFD700]/10 transition-colors"
                >
                  Buy More Tickets
                </button>
              ) : null}
              <button
                onClick={onBackToTickets}
                className="w-full py-3 bg-transparent text-white/50 rounded-xl font-headline font-bold text-sm tracking-[0.1em] uppercase hover:text-white/80 transition-colors"
              >
                Back to Tickets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
