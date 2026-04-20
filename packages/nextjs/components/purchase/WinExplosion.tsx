"use client";

import React, { useCallback, useEffect, useRef } from "react";

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
};

type WinExplosionProps = {
  active: boolean;
  isWin: boolean;
  prizeAmount?: number;
  width?: number;
  height?: number;
};

/**
 * Canvas particle effects for win/loss moments.
 * Win: gold particle burst + confetti rain + golden glow.
 * Loss: subtle grey particles that fade quietly.
 */
export const WinExplosion: React.FC<WinExplosionProps> = ({
  active,
  isWin,
  prizeAmount = 0,
  width = 400,
  height = 300,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const createParticles = useCallback(() => {
    const particles: Particle[] = [];
    const count = isWin ? 60 : 15;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = isWin ? 3 + Math.random() * 6 : 1 + Math.random() * 2;
      const colors = isWin
        ? ["#FFD700", "#FFA500", "#FF6347", "#FFE16D", "#B8860B", "#FF4444"]
        : ["#666", "#888", "#555", "#777"];

      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isWin ? 2 : 0.5),
        life: 1,
        maxLife: isWin ? 1.5 + Math.random() * 1 : 0.8 + Math.random() * 0.5,
        size: isWin ? 2 + Math.random() * 4 : 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: isWin ? 0.08 : 0.05,
      });
    }

    // Add confetti for wins
    if (isWin) {
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * width,
          y: -10 - Math.random() * 50,
          vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 3,
          life: 1,
          maxLife: 2 + Math.random() * 1.5,
          size: 3 + Math.random() * 3,
          color: ["#FFD700", "#FF6347", "#00DAF3", "#7D5FFF", "#FFE16D"][Math.floor(Math.random() * 5)],
          gravity: 0.02,
        });
      }
    }

    return particles;
  }, [isWin, width, height]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const particles = particlesRef.current;
    let alive = false;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= 1 / 60 / p.maxLife;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      alive = true;
      const alpha = Math.max(0, p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      // Draw particle with glow
      if (isWin) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (alive) {
      animFrameRef.current = requestAnimationFrame(animate);
    }
  }, [width, height, isWin]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;

    particlesRef.current = createParticles();
    animate();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [active, createParticles, animate, width, height]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
      <canvas ref={canvasRef} style={{ width, height }} className="absolute" />

      {/* Prize amount overlay */}
      {isWin && prizeAmount > 0 && (
        <div className="relative z-10 text-center animate-bounce">
          <div className="font-headline font-black text-4xl md:text-5xl neon-text-gold" style={{ color: "#FFD700" }}>
            +{prizeAmount} USDC! 🎉
          </div>
        </div>
      )}

      {!isWin && (
        <div className="relative z-10 text-center">
          <div className="font-headline font-bold text-xl text-white/30">Better Luck Next Time 💪</div>
        </div>
      )}
    </div>
  );
};
