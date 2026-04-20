"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TicketCard3D } from "./TicketCard3D";
import gsap from "gsap";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

type ManualPickGalleryProps = {
  availableIds: string[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
  themeColor?: string;
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
  themeColor = "#C62828",
}) => {
  const [offset, setOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

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
      <div
        ref={containerRef}
        className="ticket-3d-scene flex items-center justify-center gap-2 md:gap-4 py-10 px-4 min-h-[360px] flex-wrap"
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
            <TicketCard3D
              ticketId={id}
              ticketIndex={offset + i}
              state={selectedIds.includes(id) ? "selected" : "available"}
              themeColor={themeColor}
              onClick={() => handleCardClick(id)}
            />
          </div>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center mt-4">
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
          Shuffle New Batch
        </button>
      </div>
    </div>
  );
};
