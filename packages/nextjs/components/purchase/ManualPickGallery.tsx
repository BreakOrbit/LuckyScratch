"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TicketCard3D } from "./TicketCard3D";
import gsap from "gsap";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  TICKET_ART_FALLBACK_URL,
  TICKET_ART_FRAME_CLASS,
  TICKET_ART_IMAGE_CLASS,
} from "~~/components/ticket-art/constants";

type ManualPickGalleryProps = {
  availableIds: string[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
  onReadyStateChange: (isReady: boolean) => void;
  themeColor?: string;
  ticketArtUrl?: string;
};

const DISPLAY_COUNT = 8;

/**
 * 3D arc-arranged ticket gallery for manual selection.
 * Cards fan out with CSS perspective, hover to pop forward,
 * click to select, and "Refresh" swaps in a new batch with GSAP scatter animation.
 */
export const ManualPickGallery: React.FC<ManualPickGalleryProps> = ({
  availableIds,
  selectedIds,
  onSelect,
  onDeselect,
  onReadyStateChange,
  themeColor = "#C62828",
  ticketArtUrl,
}) => {
  const [offset, setOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "shuffling" | "selected">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  /* Notify parent of checkout readiness */
  useEffect(() => {
    onReadyStateChange(phase === "selected");
  }, [phase, onReadyStateChange]);

  /* Current batch */
  const currentBatch = availableIds.slice(offset, offset + DISPLAY_COUNT);

  /* Arc layout calculations */
  const getArcTransform = useCallback((index: number, total: number) => {
    const center = (total - 1) / 2;
    const offsetFromCenter = index - center;
    const rotateY = offsetFromCenter * 6; // degrees per card
    const translateZ = -Math.abs(offsetFromCenter) * 15; // depth
    const translateX = offsetFromCenter * 10; // slight horizontal spread
    const translateY = Math.abs(offsetFromCenter) * 4; // slight V-shape
    return {
      transform: `rotateY(${rotateY}deg) translateZ(${translateZ}px) translateX(${translateX}px) translateY(${translateY}px)`,
    };
  }, []);

  /* Refresh batch with scatter animation */
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    const cards = cardsRef.current.filter(Boolean);

    // Scatter out
    const tl = gsap.timeline({
      onComplete: () => {
        const nextOffset = offset + DISPLAY_COUNT;
        setOffset(nextOffset >= availableIds.length ? 0 : nextOffset);

        // Animate new cards in (next tick)
        requestAnimationFrame(() => {
          const newCards = cardsRef.current.filter(Boolean);
          gsap.fromTo(
            newCards,
            {
              opacity: 0,
              scale: 0.3,
              rotateY: 180,
              y: 100,
            },
            {
              opacity: 1,
              scale: 1,
              rotateY: 0,
              y: 0,
              duration: 0.6,
              stagger: 0.05,
              ease: "back.out(1.4)",
              onComplete: () => setIsRefreshing(false),
            },
          );
        });
      },
    });

    tl.to(cards, {
      opacity: 0,
      scale: 0.5,
      y: -80,
      rotateY: (i: number) => (i % 2 === 0 ? 90 : -90),
      rotateX: (i: number) => (i % 2 === 0 ? 30 : -30),
      stagger: 0.03,
      duration: 0.4,
      ease: "power2.in",
    });
  }, [isRefreshing, offset, availableIds.length]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) return;
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
  }, [selectedIds.length]);

  /* Initial entrance animation */
  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean);
    gsap.fromTo(
      cards,
      { opacity: 0, scale: 0.5, y: 60, rotateY: -30 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        rotateY: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: "back.out(1.7)",
        delay: 0.3,
      },
    );
  }, []);

  const handleCardClick = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onDeselect(id);
      } else {
        onSelect(id);
      }
    },
    [selectedIds, onSelect, onDeselect],
  );

  return (
    <div className="relative">
      {/* Deep space background */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, rgba(198,40,40,0.06) 0%, transparent 60%)",
          }}
        />
        {/* Floating light orbs */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-3xl opacity-20"
            style={{
              width: `${60 + i * 20}px`,
              height: `${60 + i * 20}px`,
              left: `${15 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
              background: i % 2 === 0 ? "#FFD700" : "#C62828",
              animation: `ticket-float ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>

      {/* Arc Gallery Container */}
      {phase !== "selected" && (
        <div className="relative z-10 w-full flex items-center justify-center min-h-[360px] mb-8">
          <div
            ref={containerRef}
            className="flex items-center justify-center gap-2 md:gap-4 py-10 px-4 w-full flex-wrap"
            style={{ perspective: "1200px" }}
          >
            {currentBatch.map((id, i) => (
              <div
                key={`${offset}-${id}`}
                ref={el => {
                  cardsRef.current[i] = el;
                }}
                style={getArcTransform(i, currentBatch.length)}
                className="transition-transform duration-500"
              >
                <div
                  className="transition-transform duration-300 hover:scale-[1.15] cursor-pointer"
                  onClick={() => handleCardClick(id)}
                >
                  <TicketCard3D
                    ticketId={id}
                    ticketIndex={offset + i}
                    state={selectedIds.includes(id) ? "selected" : "available"}
                    themeColor={themeColor}
                  />
                </div>
              </div>
            ))}
          </div>
          {phase === "shuffling" && (
            <div className="absolute inset-0 flex items-center justify-center z-50 mix-blend-screen pointer-events-none">
              <div className="w-[300px] h-[300px] rounded-full bg-gradient-to-r from-[#FFD700]/30 to-[#C62828]/30 blur-[80px] animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Selected Miniature Cards */}
      {phase === "selected" && (
        <div className="w-full max-w-5xl px-4 flex flex-wrap gap-4 items-center justify-center mb-8 perspective-[1000px] mx-auto min-h-[300px]">
          {selectedIds.map((id, i) => (
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

      {/* Action Buttons */}
      {phase === "idle" && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`
            flex items-center gap-3 px-8 py-3.5 rounded-2xl font-headline font-bold text-sm uppercase tracking-[0.15em]
            cyber-glass border border-[#FFD700]/20 text-[#FFD700]/80
             hover:text-[#FFD700] hover:border-[#FFD700]/40 hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]
            active:scale-95 transition-all duration-300
            ${isRefreshing ? "opacity-50 pointer-events-none" : ""}
          `}
          >
            <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            换一批
          </button>

          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className={`
            flex items-center gap-3 px-8 py-3.5 rounded-2xl font-headline font-bold text-sm uppercase tracking-[0.15em]
            ${
              selectedIds.length > 0
                ? "bg-gradient-to-r from-[#FFD700] to-[#FFE16D] text-[#3a3000] hover:shadow-[0_0_30px_rgba(255,215,0,0.4)]"
                : "bg-white/5 text-white/30 border border-white/10"
            }
            active:scale-95 transition-all duration-300
          `}
          >
            确定 ({selectedIds.length}张)
          </button>
        </div>
      )}

      {/* Selected Action Reshuffle */}
      {phase === "selected" && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => {
              setPhase("idle");
              const cards = cardsRef.current.filter(Boolean);
              gsap.fromTo(
                cards,
                { opacity: 0, scale: 0.5, y: 60, rotateY: -30 },
                {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  rotateY: 0,
                  duration: 0.7,
                  stagger: 0.06,
                  ease: "back.out(1.7)",
                },
              );
            }}
            className="px-6 py-2 glass-panel rounded-full text-xs font-bold tracking-widest text-white/50 hover:text-white transition-colors"
          >
            继续选择
          </button>
        </div>
      )}
    </div>
  );
};
