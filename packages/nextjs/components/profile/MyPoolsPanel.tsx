import {
  PlusCircleIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  SignalIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";

export function MyPoolsPanel() {
  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-black text-ns-on-surface italic tracking-tighter uppercase">MY ISSUED POOLS</h1>
        <button className="bg-ns-primary-container text-ns-on-primary px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <PlusCircleIcon className="w-5 h-5" />
          CREATE NEW POOL
        </button>
      </div>

      {/* Section: Global Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-xl p-6 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high border-t-2 border-ns-primary-container/30">
          <div className="text-[10px] uppercase font-bold tracking-widest text-ns-on-surface-variant mb-4">Total Creator Revenue</div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-headline font-black text-ns-on-surface">2,450.00</h3>
            <span className="text-ns-primary-container font-bold text-xs">USDC</span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[10px] text-ns-tertiary">
            <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
            +8.4% this month
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high border-t-2 border-ns-secondary/30">
          <div className="text-[10px] uppercase font-bold tracking-widest text-ns-on-surface-variant mb-4">Total Tickets Sold</div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-headline font-black text-ns-on-surface">1,840</h3>
            <span className="text-ns-secondary font-bold text-xs">TIX</span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[10px] text-ns-secondary">
            <UsersIcon className="w-3.5 h-3.5" />
            Across all pools
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high border-t-2 border-ns-tertiary/30">
          <div className="text-[10px] uppercase font-bold tracking-widest text-ns-on-surface-variant mb-4">Active Issued Pools</div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-headline font-black text-ns-on-surface">4</h3>
            <span className="text-ns-tertiary font-bold text-xs">POOLS</span>
          </div>
          <div className="mt-4 flex items-center gap-1 text-[10px] text-ns-tertiary">
            <SignalIcon className="w-3.5 h-3.5" />
            Live on Marketplace
          </div>
        </div>
      </div>

      {/* Section: Pool List Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-ns-outline-variant/10">
        <div className="p-6 border-b border-ns-outline-variant/10 flex justify-between items-center">
          <h4 className="font-headline font-bold text-sm uppercase tracking-widest text-ns-on-surface">Pool Management</h4>
          <div className="flex gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ns-on-surface-variant" />
              <input 
                className="bg-ns-surface-container-lowest border border-ns-outline-variant/20 rounded-lg pl-9 pr-4 py-1.5 text-xs text-ns-on-surface placeholder:text-ns-on-surface-variant/50 focus:outline-none focus:border-ns-primary-container/50 w-48"
                placeholder="Search pools..."
                type="text"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-ns-surface-container-low/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-ns-on-surface-variant uppercase tracking-wider">Pool Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ns-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ns-on-surface-variant uppercase tracking-wider">Tickets Sold</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ns-on-surface-variant uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-4 text-[10px] font-bold text-ns-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ns-outline-variant/5">
              
              {/* Row 1 */}
              <tr className="hover:bg-ns-surface-container/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-ns-primary-container/10 flex items-center justify-center text-ns-primary-container border border-ns-primary-container/20 font-headline font-bold">A</div>
                    <div>
                      <div className="text-sm font-bold text-ns-on-surface">Lucky Fortune</div>
                      <div className="text-[10px] text-ns-on-surface-variant font-mono">ID: #8821-X</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ns-tertiary/10 text-ns-tertiary border border-ns-tertiary/20 uppercase tracking-tighter">Active</span>
                </td>
                <td className="px-6 py-5">
                  <div className="w-32">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-ns-on-surface font-bold">420/600</span>
                      <span className="text-ns-on-surface-variant">70%</span>
                    </div>
                    <div className="h-1.5 w-full bg-ns-surface-container-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-ns-primary-container" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm font-bold text-ns-on-surface">150.00 <span className="text-[10px] text-ns-primary-container uppercase ml-1">USDC</span></div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-surface-variant border border-ns-outline-variant/30 rounded-lg hover:bg-ns-surface-container transition-colors uppercase">View Details</button>
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-primary bg-ns-primary-container rounded-lg hover:brightness-110 transition-all uppercase">Withdraw Profit</button>
                  </div>
                </td>
              </tr>

              {/* Row 2 */}
              <tr className="hover:bg-ns-surface-container/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-ns-secondary/10 flex items-center justify-center text-ns-secondary border border-ns-secondary/20 font-headline font-bold">G</div>
                    <div>
                      <div className="text-sm font-bold text-ns-on-surface">Gilded Strike</div>
                      <div className="text-[10px] text-ns-on-surface-variant font-mono">ID: #8912-A</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ns-secondary/10 text-ns-secondary border border-ns-secondary/20 uppercase tracking-tighter">Sold Out</span>
                </td>
                <td className="px-6 py-5">
                  <div className="w-32">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-ns-on-surface font-bold">1000/1000</span>
                      <span className="text-ns-on-surface-variant">100%</span>
                    </div>
                    <div className="h-1.5 w-full bg-ns-surface-container-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-ns-secondary" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm font-bold text-ns-on-surface">850.00 <span className="text-[10px] text-ns-primary-container uppercase ml-1">USDC</span></div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-surface-variant border border-ns-outline-variant/30 rounded-lg hover:bg-ns-surface-container transition-colors uppercase">View Details</button>
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-primary bg-ns-primary-container rounded-lg hover:brightness-110 transition-all uppercase">Withdraw Profit</button>
                  </div>
                </td>
              </tr>

              {/* Row 3 */}
              <tr className="hover:bg-ns-surface-container/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-ns-tertiary/10 flex items-center justify-center text-ns-tertiary border border-ns-tertiary/20 font-headline font-bold">N</div>
                    <div>
                      <div className="text-sm font-bold text-ns-on-surface">Neon Jackpot</div>
                      <div className="text-[10px] text-ns-on-surface-variant font-mono">ID: #9004-C</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ns-tertiary/10 text-ns-tertiary border border-ns-tertiary/20 uppercase tracking-tighter">Active</span>
                </td>
                <td className="px-6 py-5">
                  <div className="w-32">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-ns-on-surface font-bold">120/500</span>
                      <span className="text-ns-on-surface-variant">24%</span>
                    </div>
                    <div className="h-1.5 w-full bg-ns-surface-container-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-ns-primary-container" style={{ width: '24%' }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm font-bold text-ns-on-surface">45.00 <span className="text-[10px] text-ns-primary-container uppercase ml-1">USDC</span></div>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-surface-variant border border-ns-outline-variant/30 rounded-lg hover:bg-ns-surface-container transition-colors uppercase">View Details</button>
                    <button className="px-3 py-1.5 text-[10px] font-bold text-ns-on-primary bg-ns-primary-container rounded-lg hover:brightness-110 transition-all uppercase">Withdraw Profit</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-ns-outline-variant/10 flex items-center justify-center gap-2">
          <button className="w-8 h-8 rounded border border-ns-outline-variant/20 flex items-center justify-center text-ns-on-surface-variant hover:text-ns-on-surface transition-colors">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold text-ns-on-surface-variant px-4">PAGE 1 OF 1</span>
          <button className="w-8 h-8 rounded border border-ns-outline-variant/20 flex items-center justify-center text-ns-on-surface-variant hover:text-ns-on-surface transition-colors">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
