"use client";

import Link from "next/link";
import { useLuckyScratchHealth } from "~~/hooks/luckyScratch/useLuckyScratchQueries";

export const HeroSection = () => {
  const { data: health } = useLuckyScratchHealth();
  const statusLabel =
    health?.status === "ok" ? `System Status: ${health.chain} online` : "System Status: syncing backend";

  return (
    <section id="hero-section" className="relative min-h-[716px] flex items-center justify-center px-8 py-20">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ns-background z-10" />
        <img
          alt="futuristic digital landscape"
          className="w-full h-full object-cover opacity-30 mix-blend-screen saturate-50 sepia-[0.2] hue-rotate-[200deg]"
          src="/images/hero-bg.png"
        />
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ns-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ns-secondary/10 rounded-full blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-20 max-w-6xl w-full flex flex-col items-center text-center">
        {/* System Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-ns-primary/10 border border-ns-primary/20 text-ns-primary text-[10px] uppercase font-label tracking-[0.2em] mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ns-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ns-primary" />
          </span>
          {statusLabel}
        </div>

        {/* Headline */}
        <h1 className="font-headline font-black text-6xl md:text-8xl text-ns-on-surface leading-[0.9] uppercase tracking-tighter mb-8 max-w-4xl drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          Scratch The
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-ns-primary via-ns-secondary to-ns-primary">
            Digital Void
          </span>
        </h1>

        {/* Sub-copy */}
        <p className="font-body text-lg text-ns-on-surface-variant max-w-2xl mb-12">
          Premium decentralized scratch-off ecosystem. Verifiable randomness meets cinematic gaming experiences
          on-chain. Create pools, scratch tickets, win instant crypto rewards.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-6">
          <Link
            href="/player-rankings"
            className="angled-clip px-12 py-5 bg-gradient-to-br from-ns-primary to-[#B8860B] text-ns-background font-headline font-black uppercase tracking-[0.15em] text-lg hover:scale-105 transition-transform duration-300 gilded-glow"
          >
            Heroes Leaderboard
          </Link>
          <Link
            href="/pool-rankings"
            className="px-12 py-5 border border-ns-primary/30 hover:bg-ns-primary/5 text-ns-primary font-headline font-bold uppercase tracking-[0.15em] text-lg transition-all duration-300 rounded-sm"
          >
            Prize Pool Rankings
          </Link>
        </div>
      </div>
    </section>
  );
};
