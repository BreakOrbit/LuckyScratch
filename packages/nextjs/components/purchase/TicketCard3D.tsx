"use client";

import React, { useRef } from "react";

export type TicketCardState = "available" | "selected" | "sold" | "scratching" | "revealed";

type TicketCard3DProps = {
  ticketId: string;
  ticketIndex: number;
  state: TicketCardState;
  themeColor?: string;
  onClick?: () => void;
  /** Override style for GSAP animation targets */
  style?: React.CSSProperties;
  /** Ref forwarding for GSAP */
  innerRef?: React.Ref<HTMLDivElement>;
};

/**
 * Individual 3D ticket card with CSS perspective transforms, neon ID glow,
 * and theme-based artwork. Supports hover pop-out and selection ring.
 */
export const TicketCard3D: React.FC<TicketCard3DProps> = ({
  ticketId,
  ticketIndex,
  state,
  themeColor = "#C62828",
  onClick,
  style,
  innerRef,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const isSold = state === "sold";
  const isSelected = state === "selected";
  const isAvailable = state === "available";

  /* Per-card floating delay for organic feel */
  const floatDelay = (ticketIndex % 5) * 0.4;
  const floatAnim = ticketIndex % 2 === 0 ? "ticket-float" : "ticket-float-alt";

  /* Subtle per-card hue shift for uniqueness */
  const hueShift = ((ticketIndex * 7) % 20) - 10; // -10 to +10 degrees

  return (
    <div
      ref={innerRef || cardRef}
      className={`
        relative flex-shrink-0 w-[180px] h-[260px] rounded-2xl cursor-pointer
        transition-all duration-500 ease-out
        ${isSold ? "opacity-30 pointer-events-none grayscale" : ""}
        ${isSelected ? "z-20" : "z-10"}
      `}
      style={{
        animation: isAvailable || isSelected ? `${floatAnim} ${3 + floatDelay}s ease-in-out infinite` : undefined,
        animationDelay: `${floatDelay}s`,
        transformStyle: "preserve-3d",
        ...style,
      }}
      onClick={!isSold ? onClick : undefined}
    >
      {/* Selection Energy Ring */}
      {isSelected && (
        <div
          className="absolute -inset-2 rounded-3xl border-2 border-[#FFD700] pointer-events-none"
          style={{ animation: "energy-ring 1.5s ease-out forwards" }}
        />
      )}

      {/* Card Body */}
      <div
        className={`
          relative w-full h-full rounded-2xl overflow-hidden
          border transition-all duration-300
          ${
            isSelected
              ? "border-[#FFD700]/60 shadow-[0_0_30px_rgba(255,215,0,0.3)]"
              : "border-white/10 hover:border-white/25 hover:shadow-[0_0_25px_rgba(255,215,0,0.15)]"
          }
          group
        `}
        style={{
          transform: isSelected ? "scale(1.08) translateZ(20px)" : undefined,
          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease",
        }}
      >
        {/* Theme Background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                135deg,
                ${themeColor}22 0%,
                ${themeColor}44 30%,
                ${themeColor}33 60%,
                #0F162688 100%
              )
            `,
            filter: `hue-rotate(${hueShift}deg)`,
          }}
        />

        {/* Ornamental Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, ${themeColor} 1px, transparent 1px),
              radial-gradient(circle at 80% 70%, ${themeColor} 1px, transparent 1px),
              radial-gradient(circle at 50% 50%, ${themeColor} 0.5px, transparent 0.5px)
            `,
            backgroundSize: "30px 30px, 25px 25px, 15px 15px",
          }}
        />

        {/* Light Streak — unique per card */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(
              ${120 + ticketIndex * 37}deg,
              transparent 30%,
              rgba(255, 215, 0, 0.15) 50%,
              transparent 70%
            )`,
            animation: `scratch-shimmer ${6 + ticketIndex * 0.5}s linear infinite`,
            backgroundSize: "200% 100%",
          }}
        />

        {/* Top Badge Area */}
        <div className="relative z-10 p-3 flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 font-headline">
            NFT Ticket
          </span>
          {isSelected && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded-full border border-[#FFD700]/30">
              ✓ Selected
            </span>
          )}
        </div>

        {/* Center Visual — Pool Theme Icon */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Main lantern emoji or theme icon */}
            <span
              className="text-6xl filter drop-shadow-lg select-none"
              style={{
                filter: `hue-rotate(${hueShift}deg) drop-shadow(0 0 20px ${themeColor}66)`,
              }}
            >
              🏮
            </span>
            {/* Ambient glow */}
            <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: themeColor }} />
          </div>
        </div>

        {/* Bottom — Unique Neon ID */}
        <div className="relative z-10 p-4 pt-0">
          <div className="text-center">
            <div
              className="font-headline font-black text-2xl tracking-tighter"
              style={{
                color: "#FFD700",
                animation: "neon-pulse 3s ease-in-out infinite",
                animationDelay: `${floatDelay * 0.5}s`,
              }}
            >
              #{ticketId}
            </div>
            <div className="text-[9px] text-white/30 uppercase tracking-[0.3em] mt-1 font-label">Lucky Fortune</div>
          </div>
        </div>

        {/* Hover Glow Intensify */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${themeColor}15 0%, transparent 70%)`,
          }}
        />

        {/* Scanline texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.04) 50%)",
            backgroundSize: "100% 4px",
          }}
        />
      </div>

      {/* Hover Transform: push forward */}
      <style jsx>{`
        div:hover > div.group {
          transform: scale(1.06) translateZ(15px);
        }
      `}</style>
    </div>
  );
};
