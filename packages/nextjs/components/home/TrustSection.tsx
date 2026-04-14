"use client";

type TrustPillar = {
  icon: string;
  title: string;
  description: string;
  accentColor: "primary" | "secondary";
};

const pillars: TrustPillar[] = [
  {
    icon: "lock",
    title: "FHE Encryption",
    description:
      "Fully Homomorphic Encryption ensures your moves are private until the moment of reveal. Verifiably dark.",
    accentColor: "primary",
  },
  {
    icon: "casino",
    title: "Non-Gameable",
    description:
      "On-chain entropy combined with cryptographic proofs makes every scratch result tamper-proof and mathematically fair.",
    accentColor: "secondary",
  },
  {
    icon: "terminal",
    title: "On-Chain Verified",
    description:
      "Every contract, Every pool, Every payout is logged eternally on the ledger for total transparency.",
    accentColor: "primary",
  },
];

const accentStyles: Record<TrustPillar["accentColor"], { bg: string; border: string; text: string; hoverBg: string }> = {
  primary: {
    bg: "bg-ns-primary/5",
    border: "border-ns-primary/20",
    text: "text-ns-primary",
    hoverBg: "group-hover:bg-ns-primary/10",
  },
  secondary: {
    bg: "bg-ns-secondary/5",
    border: "border-ns-secondary/20",
    text: "text-ns-secondary",
    hoverBg: "group-hover:bg-ns-secondary/10",
  },
};

export const TrustSection = () => {
  return (
    <section
      id="trust-section"
      className="max-w-7xl mx-auto px-12 py-24 border-y border-ns-outline-variant/10 mb-32 bg-ns-surface-container-lowest/30"
    >
      <div className="text-center mb-16">
        <h2 className="text-4xl font-headline font-black text-ns-on-surface uppercase tracking-[0.2em]">
          The Technology of Trust
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
        {pillars.map((pillar) => {
          const style = accentStyles[pillar.accentColor];
          return (
            <div key={pillar.title} className="flex flex-col items-center text-center group">
              <div
                className={`w-16 h-16 ${style.bg} flex items-center justify-center rounded-full mb-6 border ${style.border} ${style.hoverBg} transition-all`}
              >
                <span className={`material-symbols-outlined ${style.text} text-3xl`}>
                  {pillar.icon}
                </span>
              </div>
              <h4 className="text-xl font-headline font-bold text-ns-on-surface mb-3 uppercase tracking-wider">
                {pillar.title}
              </h4>
              <p className="text-sm text-ns-on-surface-variant leading-relaxed">
                {pillar.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
