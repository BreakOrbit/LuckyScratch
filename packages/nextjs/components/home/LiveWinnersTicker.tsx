"use client";

const winners = [
  { address: "0x4f...a2", amount: "500 USDT", pool: "CyberPunk Pool", type: "win" as const },
  { address: "0x12...9e", label: "Legendary SR Ticket", pool: "", type: "reveal" as const },
  { address: "0x8b...33", amount: "1,250 USDT", pool: "Neon Dragon Pool", type: "win" as const },
  { address: "0x7c...11", amount: "50 USDT", pool: "Starter Pool", type: "win" as const },
  { address: "0xd3...f7", amount: "200 USDT", pool: "Sakura Pool", type: "win" as const },
  { address: "0xa1...c8", label: "Ultra Rare UR Ticket", pool: "", type: "reveal" as const },
];

const WinnerItem = ({ winner }: { winner: (typeof winners)[number] }) => (
  <div className="flex items-center gap-2">
    <span
      className="material-symbols-outlined text-[14px]"
      style={{ fontVariationSettings: '"FILL" 1' }}
    >
      stars
    </span>
    <span>
      User {winner.address}{" "}
      {winner.type === "win" ? (
        <>
          won <span className="text-ns-primary font-bold">{winner.amount}</span> in {winner.pool}
        </>
      ) : (
        <>
          revealed <span className="text-ns-secondary font-bold">{winner.label}</span>
        </>
      )}
    </span>
  </div>
);

export const LiveWinnersTicker = () => {
  return (
    <div
      id="live-winners-ticker"
      className="w-full bg-ns-surface-container-lowest py-3 border-y border-ns-primary/10 overflow-hidden flex items-center"
    >
      <div className="flex whitespace-nowrap gap-12 text-xs font-label uppercase tracking-widest text-ns-primary px-8 animate-marquee">
        {/* Duplicate content for seamless loop */}
        {winners.map((winner, i) => (
          <WinnerItem key={`a-${i}`} winner={winner} />
        ))}
        {winners.map((winner, i) => (
          <WinnerItem key={`b-${i}`} winner={winner} />
        ))}
      </div>
    </div>
  );
};
