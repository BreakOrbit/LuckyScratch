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
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpXb_Z_1NG7tO-Bvs6CmLf2xwO1LKI_EejRTXLAuph1djW7O3K5lUpL1nYSoy4dGMljduWRaMfk5f-TgHQyeIs75I2nb4Xglcn1yMgvYiluAhI_1crsyqZ7bHejojOO64O6CfK0LBhq-9pWd0tvnW5lKcYNCFDVeXhkPztWeq_nTTnshlOIBUG1T3Ytov7VMTw7-BPcaPQjgObUB68Nt6Ys2cebKrrKlg10MLMxf6Mn4GwFofmmZ97Px66_5nc6OrR47OMIZCN6n2R"
          />
          <div className="absolute inset-0 bg-ns-surface-container-lowest/80 group-hover:bg-ns-surface-container-lowest/60 transition-colors" />
          <div className="relative z-10 p-12 h-full flex flex-col justify-center">
            <h3 className="font-headline font-black text-4xl uppercase text-ns-on-surface mb-4">
              Official Store
            </h3>
            <p className="text-ns-on-surface-variant mb-8 max-w-sm">
              Browse exclusive merch, hardware wallets, and VIP scratch passes.
            </p>
            <Link
              href="/store"
              className="text-ns-primary font-headline font-bold uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all w-fit"
            >
              Enter Store{" "}
              <span className="material-symbols-outlined">shopping_bag</span>
            </Link>
          </div>
        </div>

        {/* Creator Dashboard CTA */}
        <div className="relative overflow-hidden group h-80 angled-clip purple-glow border border-ns-secondary/20">
          <img
            alt="futuristic laptop keyboard"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-40 grayscale group-hover:grayscale-0"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkJ7ndaXq3CK1L9VrOanmj1ZmxtVnfQITUS6FtV0Z2weBbGngxUozk03r3B55MGQwBae94knNcY0y2FDfa9N0sGjM0N624Sx4Pim1VJMFP43YGh9Yo_uDGRN6ULHcunpz7MEYj5fR56005srhgMs7Zm9HqLJ64UpWD6KYfiENc7Pka2AQ_u2T_PZxFhCtjMrGbIumhB3LAHZk1Pqr-9TwS-WJRJaVGRpo04ACyt9xu7W40o89Z0E3L0YXq9krmEgFr29wdiUS64c59"
          />
          <div className="absolute inset-0 bg-ns-surface-container-lowest/80 group-hover:bg-ns-surface-container-lowest/60 transition-colors" />
          <div className="relative z-10 p-12 h-full flex flex-col justify-center">
            <h3 className="font-headline font-black text-4xl uppercase text-ns-on-surface mb-4">
              Creator Dashboard
            </h3>
            <p className="text-ns-on-surface-variant mb-8 max-w-sm">
              Launch your own pool, customize ticket rarity, and earn platform fees.
            </p>
            <Link
              href="/create-pool"
              className="text-ns-secondary font-headline font-bold uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all w-fit"
            >
              Start Building{" "}
              <span className="material-symbols-outlined">add_box</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
