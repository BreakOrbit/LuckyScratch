import {
  WalletIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  CommandLineIcon,
  CpuChipIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export function OverviewPanel() {
  return (
    <>
      {/* Section 1: Wallet Overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-8 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high border-t-2 border-ns-primary-container/20">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase font-bold tracking-widest text-ns-on-surface-variant">
              Available Credits
            </span>
            <WalletIcon className="w-6 h-6 text-ns-primary" />
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-4xl font-headline font-black text-ns-on-surface tracking-tighter">
              12,450.00
            </h3>
            <span className="text-ns-primary-container font-bold text-sm">USDC</span>
          </div>
          <p className="text-xs text-ns-on-surface-variant mb-6 flex items-center gap-1">
            <ArrowTrendingUpIcon className="w-4 h-4 text-ns-tertiary" />
            +12% from last week
          </p>
          <button className="w-full bg-ns-primary-container text-ns-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all active:scale-95 shadow-[0_4px_15px_rgba(255,215,0,0.15)]">
            DEPOSIT CREDITS
          </button>
        </div>

        <div className="glass-panel rounded-xl p-8 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase font-bold tracking-widest text-ns-on-surface-variant">
              Total Winnings
            </span>
            <TrophyIcon className="w-6 h-6 text-ns-secondary" />
          </div>
          <div className="flex items-baseline gap-3 mb-6">
            <h3 className="text-4xl font-headline font-black text-ns-on-surface tracking-tighter">
              45,892.40
            </h3>
            <span className="text-ns-secondary font-bold text-sm">USDC</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-2 bg-ns-surface-container-lowest rounded-full overflow-hidden">
              <div className="w-[75%] h-full bg-ns-secondary rounded-full"></div>
            </div>
            <span className="text-[10px] font-bold text-ns-secondary">ROI 245%</span>
          </div>
        </div>
      </section>

      {/* Section 2: Gaming Performance */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-ns-outline-variant/30"></div>
          <h4 className="font-headline font-bold text-xs uppercase tracking-widest text-ns-on-surface-variant">
            Performance Matrix
          </h4>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-ns-outline-variant/30"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-ns-surface-container-high border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2">
              Purchased
            </div>
            <div className="text-2xl font-headline font-bold">
              1,240 <span className="text-xs text-ns-on-surface-variant">TIX</span>
            </div>
          </div>
          <div className="bg-ns-surface-container-high border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2 text-ns-primary">
              Won
            </div>
            <div className="text-2xl font-headline font-bold text-ns-primary">
              142 <span className="text-xs text-ns-on-surface-variant">PRIZES</span>
            </div>
          </div>
          <div className="bg-ns-surface-container-high border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2 text-ns-tertiary">
              Yield
            </div>
            <div className="text-2xl font-headline font-bold text-ns-tertiary">
              1.2 <span className="text-xs text-ns-on-surface-variant">ETH</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Creator Terminal */}
      <section className="relative">
        <div className="glass-panel rounded-xl p-8 border border-ns-tertiary/20 overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <CommandLineIcon className="w-24 h-24 text-ns-tertiary opacity-10" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <CpuChipIcon className="w-6 h-6 text-ns-tertiary" />
              <h4 className="font-headline text-lg font-bold">CREATOR_TERMINAL_V1.2</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Active Pools</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">3</div>
                <div className="text-[10px] text-ns-tertiary font-mono">STATUS: ONLINE</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Total Revenue</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">1,500 <span className="text-sm">USDC</span></div>
                <div className="text-[10px] text-ns-tertiary font-mono">REVENUE_SHARE: 5%</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Tickets Sold</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">420/600</div>
                <div className="w-full bg-ns-surface-container-lowest h-1.5 rounded-full mt-2">
                  <div className="bg-ns-tertiary h-full rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-ns-outline-variant/10 flex justify-end">
              <button className="text-xs font-bold text-ns-tertiary flex items-center gap-2 hover:underline">
                LAUNCH POOL CREATOR
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Activity Logs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ns-primary-container animate-pulse"></span>
            Live Activity Logs
          </h4>
          <span className="text-[10px] font-mono text-ns-on-surface-variant">FILTER: ALL_TRANS</span>
        </div>
        <div className="bg-ns-surface-container-lowest rounded-xl border border-ns-outline-variant/10 h-64 overflow-y-auto scroll-smooth font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-ns-surface-container-lowest border-b border-ns-outline-variant/20">
              <tr>
                <th className="p-3 text-ns-on-surface-variant font-medium">TIMESTAMP</th>
                <th className="p-3 text-ns-on-surface-variant font-medium">OPERATION</th>
                <th className="p-3 text-ns-on-surface-variant font-medium">AMOUNT</th>
                <th className="p-3 text-ns-on-surface-variant font-medium text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ns-outline-variant/5">
              <tr className="hover:bg-ns-surface-container/50 transition-colors">
                <td className="p-3 text-ns-on-surface-variant">2023-10-24 14:22:01</td>
                <td className="p-3 font-semibold text-ns-primary">POOL_WIN_CREDIT</td>
                <td className="p-3">+250.00 USDC</td>
                <td className="p-3 text-right text-ns-tertiary">COMPLETED</td>
              </tr>
              <tr className="hover:bg-ns-surface-container/50 transition-colors">
                <td className="p-3 text-ns-on-surface-variant">2023-10-24 12:05:45</td>
                <td className="p-3 font-semibold text-ns-secondary">TICKET_PURCHASE</td>
                <td className="p-3">-15.00 USDC</td>
                <td className="p-3 text-right text-ns-tertiary">COMPLETED</td>
              </tr>
              <tr className="hover:bg-ns-surface-container/50 transition-colors">
                <td className="p-3 text-ns-on-surface-variant">2023-10-23 09:15:22</td>
                <td className="p-3 font-semibold text-ns-tertiary">CREATOR_ROYALTY</td>
                <td className="p-3">+42.10 USDC</td>
                <td className="p-3 text-right text-ns-tertiary">COMPLETED</td>
              </tr>
              <tr className="hover:bg-ns-surface-container/50 transition-colors">
                <td className="p-3 text-ns-on-surface-variant">2023-10-22 18:44:10</td>
                <td className="p-3 font-semibold text-ns-secondary">TICKET_PURCHASE</td>
                <td className="p-3">-50.00 USDC</td>
                <td className="p-3 text-right text-ns-tertiary">COMPLETED</td>
              </tr>
              <tr className="hover:bg-ns-surface-container/50 transition-colors">
                <td className="p-3 text-ns-on-surface-variant">2023-10-22 10:30:00</td>
                <td className="p-3 font-semibold text-ns-on-surface">WALLET_DEPOSIT</td>
                <td className="p-3">+1,000.00 USDC</td>
                <td className="p-3 text-right text-ns-tertiary">COMPLETED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
