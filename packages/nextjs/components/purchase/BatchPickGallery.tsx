"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TicketCard3D } from "./TicketCard3D";
import gsap from "gsap";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";

type BatchPickGalleryProps = {
  quantity: number;
  maxQuantity?: number;
  availableIds: string[];
  assignedIds: string[];
  onChangeQuantity: (q: number) => void;
  onReadyStateChange: (isReady: boolean) => void;
  themeColor?: string;
  ticketArtUrl?: string;
};

/**
 * Quick Pick redesign: Batch Auto mode.
 * Shows a pool of selectable cards, allowing the user to select quantity.
 * Clicking Auto Pick triggers a shuffle animation, then reveals mini selected tickets.
 */
export const BatchPickGallery: React.FC<BatchPickGalleryProps> = ({
  quantity,
  maxQuantity = 10,
  availableIds,
  assignedIds,
  onChangeQuantity,
  onReadyStateChange,
  themeColor = "#C62828",
  ticketArtUrl,
}) => {
  const [phase, setPhase] = useState<"idle" | "shuffling" | "selected">("idle");
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // 12 pseudo cards for the background grid
  const displayPool = availableIds.slice(0, 12);

  /* Notify parent of checkout readiness */
  useEffect(() => {
    onReadyStateChange(phase === "selected");
  }, [phase, onReadyStateChange]);

  const handleIncrement = useCallback(() => {
    if (quantity < maxQuantity) onChangeQuantity(quantity + 1);
  }, [quantity, maxQuantity, onChangeQuantity]);

  const handleDecrement = useCallback(() => {
    if (quantity > 1) onChangeQuantity(quantity - 1);
  }, [quantity, onChangeQuantity]);

  const handleShuffle = () => {
    setPhase("shuffling");

    const cards = cardsRef.current.filter(Boolean);
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase("selected");
      },
    });

    // 1. Initial pop-out
    tl.to(cards, {
      z: 100,
      scale: 1.1,
      duration: 0.3,
      ease: "power2.out",
    });

    // 2. Crazy chaotic shuffle
    tl.to(cards, {
      x: () => (Math.random() - 0.5) * 500,
      y: () => (Math.random() - 0.5) * 300,
      rotateZ: () => (Math.random() - 0.5) * 720,
      rotateY: () => (Math.random() - 0.5) * 360,
      rotateX: () => (Math.random() - 0.5) * 360,
      duration: 0.6,
      ease: "power2.inOut",
      stagger: 0.02,
    });

    // 3. Suck into vortex center and disappear
    tl.to(
      cards,
      {
        x: 0,
        y: 0,
        z: -500,
        rotateZ: 0,
        rotateY: 0,
        rotateX: 0,
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: "back.in(1.5)",
        stagger: 0.015,
      },
      "+=0.1",
    );
  };

  const getGridTransform = (index: number) => {
    // 2 rows layout: 6 columns
    const row = Math.floor(index / 6);
    const col = index % 6;
    const centerCol = 2.5;
    const offsetFromCenter = col - centerCol;

    const rotateY = offsetFromCenter * 6; // slightly fan out horizontally
    const translateZ = -Math.abs(offsetFromCenter) * 15;

    // Position using flex-like spacing layout mapped to absolute transforms
    const translateX = offsetFromCenter * 140;
    const translateY = (row - 0.5) * 220 + Math.abs(offsetFromCenter) * 8;

    return {
      transform: `translateX(${translateX}px) translateY(${translateY}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
      zIndex: 10 - Math.abs(offsetFromCenter),
    };
  };

  return (
    <div className="relative min-h-[480px] flex flex-col items-center justify-center py-6 perspective-[1200px]">
      {/* Deep space background */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(125,95,255,0.08) 0%, rgba(198,40,40,0.04) 40%, transparent 70%)",
          }}
        />
        {/* Particle dots */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#FFD700]"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `ticket-float ${3 + i * 0.5}s ease-in-out infinite alternate`,
              opacity: Math.random() * 0.4 + 0.1,
            }}
          />
        ))}
      </div>

      {/* Grid of cards */}
      {phase !== "selected" && (
        <div
          className="relative w-full flex items-center justify-center min-h-[320px] mb-8"
          style={{ transformStyle: "preserve-3d" }}
        >
          {displayPool.map((id, i) => (
            <div
              key={id}
              ref={el => {
                cardsRef.current[i] = el;
              }}
              className="absolute top-1/2 left-1/2 -mt-[140px] -ml-[90px]"
              style={{ ...getGridTransform(i), transformStyle: "preserve-3d" }}
            >
              <div className="scale-[0.6] pointer-events-none w-[180px]">
                <TicketCard3D ticketId={id} ticketIndex={i} state="available" themeColor={themeColor} />
              </div>
            </div>
          ))}

          {phase === "shuffling" && (
            <div className="absolute inset-0 flex items-center justify-center z-50 mix-blend-screen pointer-events-none">
              <div className="w-[300px] h-[300px] rounded-full bg-gradient-to-r from-[#FFD700]/30 to-[#C62828]/30 blur-[80px] animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Selected Miniature Cards */}
      {phase === "selected" && (
        <div className="w-full max-w-5xl px-4 flex flex-wrap gap-4 items-center justify-center mb-8 perspective-[1000px]">
          {assignedIds.slice(0, quantity).map((id, i) => (
            <div
              key={id}
              className={`${TICKET_ART_FRAME_CLASS} w-[110px] rounded-2xl border border-[#FFD700]/30 shadow-2xl transition-transform duration-300 hover:scale-105 hover:-translate-y-2`}
              style={{
                animation: `batch-card-entrance 0.5s ease-out ${i * 0.08}s forwards`,
                opacity: 0,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Background Art */}
              <img
                src={ticketArtUrl || TICKET_ART_FALLBACK_URL}
                className={`absolute inset-0 ${TICKET_ART_IMAGE_CLASS} opacity-80`}
                alt="Ticket BG"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90" />

              {/* Border effect */}
              <div className="absolute inset-[2px] rounded-xl border border-white/10" />

              {/* ID Tag */}
              <div className="absolute bottom-3 inset-x-0 mx-auto w-max px-2 py-1 bg-black/60 rounded border border-[#FFD700]/20 backdrop-blur-sm">
                <span className="font-headline font-black text-[11px] text-[#FFD700] tracking-wider">#{id}</span>
              </div>

              {/* Shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 hover:opacity-100 transition duration-500 rounded-2xl mix-blend-overlay" />
            </div>
          ))}
        </div>
      )}

      {/* Control Panel */}
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-6 mt-8 z-10 p-6 rounded-3xl bg-black/30 backdrop-blur-xl border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="text-[#D0C6AB] text-xs font-bold tracking-[0.2em] uppercase">Select Quantity</div>

          <div className="flex items-center gap-8">
            <button
              onClick={handleDecrement}
              disabled={quantity <= 1}
              className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-[#FFD700] hover:bg-[#FFD700]/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <MinusIcon className="h-5 w-5" />
            </button>

            <div className="text-center min-w-[80px]">
              <div className="font-headline font-black text-5xl text-[#FFD700] neon-text-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                {quantity}
              </div>
            </div>

            <button
              onClick={handleIncrement}
              disabled={quantity >= maxQuantity}
              className="w-12 h-12 rounded-full glass-panel flex items-center justify-center text-[#FFD700] hover:bg-[#FFD700]/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={handleShuffle}
            className="relative px-10 py-4 mt-2 bg-gradient-to-r from-[#FFD700] to-[#FFE16D] text-[#3a3000] rounded-2xl font-headline font-black text-sm tracking-[0.15em] uppercase transition-all hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] active:scale-95"
          >
            🎲 Auto Pick
          </button>
        </div>
      )}

      {/* Selected Action Reshuffle */}
      {phase === "selected" && (
        <button
          onClick={() => setPhase("idle")}
          className="px-6 py-2 mt-4 glass-panel rounded-full text-xs font-bold tracking-widest text-white/50 hover:text-white transition-colors"
        >
          Pick Again
        </button>
      )}
    </div>
  );
};
