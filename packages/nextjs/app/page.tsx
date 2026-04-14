"use client";

import type { NextPage } from "next";
import { LiveWinnersTicker } from "~~/components/home/LiveWinnersTicker";
import { HeroSection } from "~~/components/home/HeroSection";
import { StatsSection } from "~~/components/home/StatsSection";
import { ThemePoolsSection } from "~~/components/home/ThemePoolsSection";
import { CommunityPoolsSection } from "~~/components/home/CommunityPoolsSection";
import { CTAPanels } from "~~/components/home/CTAPanels";
import { TrustSection } from "~~/components/home/TrustSection";

const Home: NextPage = () => {
  return (
    <div className="bg-ns-background text-ns-on-surface font-body selection:bg-ns-primary selection:text-ns-primary-container">
      <LiveWinnersTicker />
      <HeroSection />
      <StatsSection />
      <ThemePoolsSection />
      <CommunityPoolsSection />
      <CTAPanels />
      <TrustSection />
    </div>
  );
};

export default Home;
