"use client";

import Link from "next/link";

export const CTAPanels = () => {
  return (
    <section id="cta-panels" className="max-w-7xl mx-auto px-8 pb-32">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Official Store CTA */}
        <div className="relative overflow-hidden group h-80 angled-clip gilded-glow border border-ns-primary/20">
          <img
            alt="high-tech secure server room"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-40 grayscale group-hover:grayscale-0"
            src="/images/cta-store-bg.png"
          />
          <div className="absolute inset-0 bg-ns-surface-container-lowest/80 group-hover:bg-ns-surface-container-lowest/60 transition-colors" />
          <div className="relative z-10 p-12 h-full flex flex-col justify-center">
            <h3 className="font-headline font-black text-4xl uppercase text-ns-on-surface mb-4">Official Store</h3>
            <p className="text-ns-on-surface-variant mb-8 max-w-sm">
              Browse exclusive merch, hardware wallets, and VIP scratch passes.
            </p>
            <Link
              href="/store"
              className="text-ns-primary font-headline font-bold uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all w-fit"
            >
              Enter Store <span className="material-symbols-outlined">shopping_bag</span>
            </Link>
          </div>
        </div>

        {/* Creator Dashboard CTA */}
        <div className="relative overflow-hidden group h-80 angled-clip purple-glow border border-ns-secondary/20">
          <img
            alt="futuristic laptop keyboard"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-40 grayscale group-hover:grayscale-0"
            src="/images/cta-creator-bg.png"
          />
          <div className="absolute inset-0 bg-ns-surface-container-lowest/80 group-hover:bg-ns-surface-container-lowest/60 transition-colors" />
          <div className="relative z-10 p-12 h-full flex flex-col justify-center">
            <h3 className="font-headline font-black text-4xl uppercase text-ns-on-surface mb-4">Creator Dashboard</h3>
            <p className="text-ns-on-surface-variant mb-8 max-w-sm">
              Launch your own pool, customize ticket rarity, and earn platform fees.
            </p>
            <Link
              href="/create-pool"
              className="text-ns-secondary font-headline font-bold uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all w-fit"
            >
              Start Building <span className="material-symbols-outlined">add_box</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
