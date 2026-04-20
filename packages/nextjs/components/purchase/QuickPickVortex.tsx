"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { TicketCard3D } from "./TicketCard3D";
import gsap from "gsap";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";

type QuickPickVortexProps = {
  quantity: number;
  maxQuantity?: number;
  assignedIds: string[];
  onChangeQuantity: (q: number) => void;
  themeColor?: string;
};

/**
 * Quick Pick mode with a central energy vortex/portal.
 * Incrementing quantity shoots ticket ghosts out from the vortex center;
 * decrementing dissolves them back.
 */
export const QuickPickVortex: React.FC<QuickPickVortexProps> = ({
  quantity,
  maxQuantity = 10,
  assignedIds,
  onChangeQuantity,
  themeColor = "#C62828",
}) => {
  const ticketRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevQuantity = useRef(quantity);

  /* Animate ticket in/out when quantity changes */
  useEffect(() => {
    const diff = quantity - prevQuantity.current;
    if (diff > 0) {
      // Animate the last `diff` tickets in
      for (let i = prevQuantity.current; i < quantity; i++) {
        const el = ticketRefs.current[i];
        if (el) {
          gsap.fromTo(
            el,
            {
              opacity: 0,
              scale: 0,
              x: 0,
              y: 0,
              rotation: 720,
            },
            {
              opacity: 1,
              scale: 1,
              x: 0,
              y: 0,
              rotation: 0,
              duration: 0.6,
              delay: (i - prevQuantity.current) * 0.08,
              ease: "back.out(1.7)",
            },
          );
        }
      }
    } else if (diff < 0) {
      // Animate removed tickets out
      for (let i = quantity; i < prevQuantity.current; i++) {
        const el = ticketRefs.current[i];
        if (el) {
          gsap.to(el, {
            opacity: 0,
            scale: 0,
            rotation: -360,
            duration: 0.4,
            ease: "power2.in",
          });
        }
      }
    }
    prevQuantity.current = quantity;
  }, [quantity]);

  const handleIncrement = useCallback(() => {
    if (quantity < maxQuantity) onChangeQuantity(quantity + 1);
  }, [quantity, maxQuantity, onChangeQuantity]);

  const handleDecrement = useCallback(() => {
    if (quantity > 1) onChangeQuantity(quantity - 1);
  }, [quantity, onChangeQuantity]);

  return (
    <div className="relative min-h-[420px] flex flex-col items-center justify-center">
      {/* Deep space background */}
      <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(125,95,255,0.08) 0%, rgba(198,40,40,0.04) 40%, transparent 70%)",
          }}
        />
      </div>

      {/* Central Vortex */}
      <div className="relative w-[200px] h-[200px] mb-8">
        {/* Outer rotating ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed border-[#FFD700]/20"
          style={{ animation: "vortex-spin 12s linear infinite" }}
        />
        {/* Middle pulsing ring */}
        <div
          className="absolute inset-4 rounded-full border border-[#C62828]/30"
          style={{ animation: "vortex-pulse 3s ease-in-out infinite" }}
        />
        {/* Inner glow ring */}
        <div
          className="absolute inset-8 rounded-full border border-[#FFD700]/20"
          style={{ animation: "vortex-spin 8s linear infinite reverse" }}
        />
        {/* Center energy core */}
        <div
          className="absolute inset-[30%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${themeColor}66 0%, ${themeColor}22 50%, transparent 70%)`,
            animation: "vortex-pulse 2s ease-in-out infinite",
          }}
        />
        {/* Particle dots */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#FFD700]"
            style={{
              top: "50%",
              left: "50%",
              animation: `cta-particle-orbit ${3 + i * 0.5}s linear infinite`,
              animationDelay: `${i * 0.4}s`,
              opacity: 0.4 + (i % 3) * 0.2,
            }}
          />
        ))}
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={handleDecrement}
          disabled={quantity <= 1}
          className="w-12 h-12 rounded-xl cyber-glass flex items-center justify-center
            text-[#FFD700] hover:bg-[#FFD700]/10 active:scale-90 transition-all
            disabled:opacity-30 disabled:pointer-events-none border border-[#FFD700]/20"
        >
          <MinusIcon className="h-5 w-5" />
        </button>

        <div className="text-center min-w-[80px]">
          <div
            className="font-headline font-black text-5xl text-[#FFD700] neon-text-gold"
            style={{ animation: "neon-pulse 3s ease-in-out infinite" }}
          >
            {quantity}
          </div>
          <div className="text-[9px] text-white/40 uppercase tracking-[0.3em] font-bold mt-1">Tickets</div>
        </div>

        <button
          onClick={handleIncrement}
          disabled={quantity >= maxQuantity}
          className="w-12 h-12 rounded-xl cyber-glass flex items-center justify-center
            text-[#FFD700] hover:bg-[#FFD700]/10 active:scale-90 transition-all
            disabled:opacity-30 disabled:pointer-events-none border border-[#FFD700]/20"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Spawned Tickets — arranged around vortex */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 max-w-[800px]">
        {assignedIds.slice(0, quantity).map((id, i) => (
          <div
            key={id}
            ref={el => {
              ticketRefs.current[i] = el;
            }}
            className="transition-all"
          >
            <TicketCard3D ticketId={id} ticketIndex={i} state="selected" themeColor={themeColor} />
          </div>
        ))}
      </div>
    </div>
  );
};
