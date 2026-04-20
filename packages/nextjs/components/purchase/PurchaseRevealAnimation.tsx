"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScratchCanvas } from "./ScratchCanvas";
import { WinExplosion } from "./WinExplosion";
import gsap from "gsap";

type TicketRevealData = {
  id: string;
  isWin: boolean;
  prize: number;
};

type PurchaseRevealAnimationProps = {
  tickets: TicketRevealData[];
  themeColor?: string;
  onComplete: (results: TicketRevealData[]) => void;
};

type RevealPhase = "gather" | "shuffle" | "spread" | "scratch" | "done";

/**
 * Post-purchase grand reveal animation sequence.
 * 1. Gather: tickets fly to center and stack
 * 2. Shuffle: stack spins into glowing orb
 * 3. Spread: orb explodes, tickets fly back in slow-mo
 * 4. Scratch: each ticket gets a canvas scratch overlay
 * 5. Done: trigger result summary
 */
export const PurchaseRevealAnimation: React.FC<PurchaseRevealAnimationProps> = ({
  tickets,
  themeColor = "#C62828",
  onComplete,
}) => {
  const [phase, setPhase] = useState<RevealPhase>("gather");
  const [scratchedTickets, setScratchedTickets] = useState<Set<string>>(new Set());
  const [revealedTickets, setRevealedTickets] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const orbRef = useRef<HTMLDivElement>(null);
  const spreadCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  /* Phase 1 → 2: Gather → Shuffle */
  useEffect(() => {
    if (phase !== "gather") return;

    const tl = gsap.timeline({
      onComplete: () => setPhase("shuffle"),
    });

    // Cards fly to center
    tl.to(cardRefs.current.filter(Boolean), {
      x: 0,
      y: 0,
      scale: 0.6,
      rotation: (i: number) => i * 15,
      opacity: 1,
      stagger: 0.08,
      duration: 0.8,
      ease: "power3.inOut",
    });

    // Stack them
    tl.to(cardRefs.current.filter(Boolean), {
      scale: 0.4,
      rotation: 0,
      x: 0,
      y: 0,
      stagger: 0.03,
      duration: 0.4,
      ease: "power2.in",
    });

    return () => {
      tl.kill();
    };
  }, [phase]);

  /* Phase 2 → 3: Shuffle → Spread */
  useEffect(() => {
    if (phase !== "shuffle") return;

    const tl = gsap.timeline({
      onComplete: () => setPhase("spread"),
    });

    // Hide card elements
    tl.set(cardRefs.current.filter(Boolean), { opacity: 0 });

    // Show and animate orb
    if (orbRef.current) {
      tl.fromTo(
        orbRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" },
      );

      // Spin the orb
      tl.to(orbRef.current, {
        rotation: 720,
        scale: 1.3,
        duration: 1.5,
        ease: "power2.inOut",
      });

      // Orb explodes
      tl.to(orbRef.current, {
        scale: 3,
        opacity: 0,
        duration: 0.3,
        ease: "power4.in",
      });
    }

    return () => {
      tl.kill();
    };
  }, [phase]);

  /* Phase 3 → 4: Spread → Scratch */
  useEffect(() => {
    if (phase !== "spread") return;

    const cards = spreadCardsRef.current.filter(Boolean);
    const tl = gsap.timeline({
      onComplete: () => setPhase("scratch"),
      delay: 0.2,
    });

    // Cards fly back from center
    tl.fromTo(
      cards,
      {
        scale: 0,
        opacity: 0,
        y: 0,
        rotation: (i: number) => 180 + i * 30,
      },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        rotation: 0,
        stagger: 0.12,
        duration: 0.7,
        ease: "back.out(1.5)",
      },
    );

    return () => {
      tl.kill();
    };
  }, [phase]);

  /* Handle scratch threshold for individual tickets */
  const handleScratchThreshold = useCallback((ticketId: string) => {
    setScratchedTickets(prev => {
      const next = new Set(prev);
      next.add(ticketId);
      return next;
    });

    // Reveal after brief delay (simulating decrypt)
    setTimeout(() => {
      setRevealedTickets(prev => {
        const next = new Set(prev);
        next.add(ticketId);
        return next;
      });
    }, 800);
  }, []);

  /* Check if all tickets are revealed */
  useEffect(() => {
    if (phase === "scratch" && revealedTickets.size === tickets.length) {
      setTimeout(() => {
        setPhase("done");
        onComplete(tickets);
      }, 2000);
    }
  }, [phase, revealedTickets.size, tickets, onComplete]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Darkened backdrop with tunnel effect */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background:
            phase === "shuffle"
              ? "radial-gradient(ellipse at center, rgba(198,40,40,0.15) 0%, rgba(0,0,0,0.95) 60%)"
              : "rgba(0, 0, 0, 0.85)",
        }}
      />

      {/* Tunnel rings during shuffle */}
      {phase === "shuffle" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFD700]/10"
              style={{
                width: `${200 + i * 120}px`,
                height: `${200 + i * 120}px`,
                animation: `vortex-pulse ${2 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative z-10 w-full max-w-4xl px-4">
        {/* Phase 1 & 2: Flying cards / orb */}
        {(phase === "gather" || phase === "shuffle") && (
          <div className="flex items-center justify-center min-h-[300px] relative">
            {/* Card elements */}
            {tickets.map((ticket, i) => (
              <div
                key={ticket.id}
                ref={el => {
                  cardRefs.current[i] = el;
                }}
                className="absolute w-[120px] h-[170px] rounded-xl border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}44, #0F162688)`,
                  left: `${30 + i * 15}%`,
                  top: "20%",
                }}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-3xl">🏮</span>
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-headline font-bold text-[#FFD700]">
                  #{ticket.id}
                </div>
              </div>
            ))}

            {/* Energy Orb */}
            <div
              ref={orbRef}
              className="absolute w-[120px] h-[120px] rounded-full opacity-0"
              style={{
                background: `radial-gradient(circle, #FFD700 0%, ${themeColor} 40%, transparent 70%)`,
                boxShadow: `0 0 60px #FFD700, 0 0 120px ${themeColor}`,
              }}
            />
          </div>
        )}

        {/* Phase 3 & 4: Spread cards with scratch overlays */}
        {(phase === "spread" || phase === "scratch") && (
          <div className="flex flex-wrap items-center justify-center gap-4 min-h-[350px]">
            {tickets.map((ticket, i) => (
              <div
                key={ticket.id}
                ref={el => {
                  spreadCardsRef.current[i] = el;
                }}
                className="relative w-[180px] h-[260px] rounded-2xl overflow-hidden border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}33, #0F162688)`,
                }}
              >
                {/* Ticket face */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-5xl">🏮</span>
                  <div className="font-headline font-bold text-sm text-[#FFD700]">#{ticket.id}</div>
                  <div className="text-[9px] text-white/30 uppercase tracking-widest">Lucky Fortune</div>
                </div>

                {/* Result layer (visible after scratch) */}
                {revealedTickets.has(ticket.id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <WinExplosion
                      active={true}
                      isWin={ticket.isWin}
                      prizeAmount={ticket.prize}
                      width={180}
                      height={260}
                    />
                  </div>
                )}

                {/* Decrypting overlay */}
                {scratchedTickets.has(ticket.id) && !revealedTickets.has(ticket.id) && (
                  <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-6 h-6 border-2 border-[#00DAF3] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div className="text-[10px] text-[#00DAF3] font-mono uppercase tracking-widest">
                        Decrypting...
                      </div>
                    </div>
                  </div>
                )}

                {/* Scratch canvas overlay */}
                {phase === "scratch" && !scratchedTickets.has(ticket.id) && (
                  <div className="absolute inset-0 z-30">
                    <ScratchCanvas
                      width={180}
                      height={260}
                      coatingColor={themeColor === "#C62828" ? "#B8860B" : themeColor}
                      onThresholdReached={() => handleScratchThreshold(ticket.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Phase hint text */}
        <div className="text-center mt-8">
          {phase === "gather" && (
            <div className="text-white/40 text-sm font-headline uppercase tracking-widest animate-pulse">
              Gathering your tickets...
            </div>
          )}
          {phase === "shuffle" && (
            <div className="text-[#FFD700]/60 text-sm font-headline uppercase tracking-widest animate-pulse">
              ✨ Infusing with cosmic energy... ✨
            </div>
          )}
          {phase === "spread" && (
            <div className="text-white/40 text-sm font-headline uppercase tracking-widest">Your tickets are ready!</div>
          )}
          {phase === "scratch" && (
            <div className="text-[#FFD700]/80 text-sm font-headline uppercase tracking-widest">
              🎨 Scratch each ticket to reveal your fortune!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
