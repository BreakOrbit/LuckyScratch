"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type ScratchCanvasProps = {
  width: number;
  height: number;
  coatingColor?: string;
  onThresholdReached: () => void;
  threshold?: number;
  disabled?: boolean;
};

/**
 * Canvas-based scratch card mechanic.
 * Uses globalCompositeOperation: 'destination-out' to erase a themed coating.
 * Tracks scratch progress and fires callback at threshold (default 70%).
 */
export const ScratchCanvas: React.FC<ScratchCanvasProps> = ({
  width,
  height,
  coatingColor = "#B8860B",
  onThresholdReached,
  threshold = 0.7,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasTriggered = useRef(false);
  const [progress, setProgress] = useState(0);

  /* Initialize canvas with themed coating */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Draw the coating
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, coatingColor);
    gradient.addColorStop(0.5, adjustColor(coatingColor, 20));
    gradient.addColorStop(1, coatingColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add shimmer texture
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add text hint
    ctx.font = "bold 14px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCRATCH HERE ✨", width / 2, height / 2);

    hasTriggered.current = false;
    setProgress(0);
  }, [width, height, coatingColor]);

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

  /* Scratch drawing logic */
  const scratch = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas || disabled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (x - rect.left) * scaleX;
      const canvasY = (y - rect.top) * scaleY;

      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 22, 0, Math.PI * 2);
      ctx.fill();

      // Also draw a softer outer ring for smoother edges
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 30, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(canvasX, canvasY, 22, canvasX, canvasY, 30);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
    },
    [disabled],
  );

  /* Check progress periodically during scratching */
  const checkProgress = useCallback(() => {
    if (hasTriggered.current) return;
    const p = calculateProgress();
    setProgress(p);
    if (p >= threshold) {
      hasTriggered.current = true;
      onThresholdReached();
    }
  }, [calculateProgress, threshold, onThresholdReached]);

  /* Mouse events */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      isDrawing.current = true;
      scratch(e.clientX, e.clientY);
    },
    [scratch, disabled],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing.current || disabled) return;
      scratch(e.clientX, e.clientY);
      checkProgress();
    },
    [scratch, checkProgress, disabled],
  );

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false;
    checkProgress();
  }, [checkProgress]);

  /* Touch events */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDrawing.current = true;
      const touch = e.touches[0];
      scratch(touch.clientX, touch.clientY);
    },
    [scratch, disabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDrawing.current || disabled) return;
      e.preventDefault();
      const touch = e.touches[0];
      scratch(touch.clientX, touch.clientY);
      checkProgress();
    },
    [scratch, checkProgress, disabled],
  );

  const handleTouchEnd = useCallback(() => {
    isDrawing.current = false;
    checkProgress();
  }, [checkProgress]);

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 rounded-xl cursor-crosshair touch-none"
        style={{ width: "100%", height: "100%" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Progress indicator */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="h-1 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              background:
                progress >= threshold
                  ? "linear-gradient(90deg, #FFD700, #00DAF3)"
                  : "linear-gradient(90deg, #FFD700, #C62828)",
            }}
          />
        </div>
        {progress > 0.3 && progress < threshold && (
          <div className="text-[8px] text-white/40 text-center mt-0.5 font-mono uppercase">
            {Math.round(progress * 100)}% — Keep scratching...
          </div>
        )}
      </div>
    </div>
  );
};

/** Helper: lighten/darken a hex color */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
