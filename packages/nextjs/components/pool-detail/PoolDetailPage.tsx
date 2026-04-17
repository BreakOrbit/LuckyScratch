"use client";

import {
  ShareIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandLineIcon,
  WalletIcon,
  BanknotesIcon,
  PowerIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const salesData = [30, 45, 40, 60, 55, 75, 85, 70, 40, 35, 65, 90, 80, 95, 60, 50, 70, 85, 75, 90, 100, 85, 70, 60];

const chartOptions = {
  tooltip: {
    trigger: "axis",
    axisPointer: { type: "shadow" },
    backgroundColor: "rgba(20, 27, 44, 0.9)",
    borderColor: "rgba(0, 218, 243, 0.3)",
    textStyle: { color: "#DCE2F9", fontSize: 12 },
    formatter: (params: any) => {
      const val = params[0].value;
      const hour = params[0].dataIndex;
      return `<div style="font-family: monospace;">${String(hour).padStart(2, '0')}:00 - ${String(hour+1).padStart(2, '0')}:00<br/><span style="color:#00DAF3;font-weight:bold;">${val} Sales</span></div>`;
    }
  },
  grid: {
    top: 5,
    bottom: 0,
    left: 0,
    right: 0,
  },
  xAxis: {
    type: "category",
    data: salesData.map((_, i) => i),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
  },
  yAxis: {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
  },
  series: [
    {
      data: salesData,
      type: "bar",
      barWidth: "80%",
      itemStyle: {
        color: (params: any) => {
          const val = params.value;
          const mapOp = val / 100;
          return `rgba(0, 218, 243, ${Math.max(0.2, mapOp)})`;
        },
        borderRadius: [2, 2, 0, 0],
      },
      emphasis: {
        itemStyle: {
          color: "rgba(0, 218, 243, 1)",
          shadowBlur: 10,
          shadowColor: "rgba(0, 218, 243, 0.5)",
        },
      },
    },
  ],
};

export function PoolDetailPage({ poolId }: { poolId: string }) {
  return (
    <div className="relative min-h-screen bg-[#0C1323] text-[#DCE2F9] font-body selection:bg-[#FFE16D] selection:text-[#705E00]">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-20">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[#4719C9] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[600px] w-[600px] rounded-full bg-[#2E3546] blur-[100px]" />
      </div>

      <main className="pt-10 md:pt-12 pb-48 px-4 md:px-8 max-w-[1440px] mx-auto space-y-12">
        {/* Hero Stage */}
        <section className="relative h-[600px] rounded-3xl overflow-hidden border border-[#FFD700]/30 shadow-[0_0_80px_rgba(0,0,0,0.6)] group">
          {/* Immersive 3D Vault Background */}
          <div className="absolute inset-0">
            <img
              alt="Vault Achievement Background"
              className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPoQc0CzqT6UpaKqhUjAqQ2HwCisgwzzEYUq5zlsY46V-29z3KN-eZ99YLLMdwLX0SYQ0mJ7t3IsVeLfytNR3WZ-NV3Y18JmkViCYebpKF_rHmTqJSADnSW3pGeUHOwwYv5mlo_TgFb2luE10XELib0SFAXpBELUuMGNij8C8VZBb_ZhVuRZgo5QLISJFwa4XcnAaJs_DTXLeY4ExyS6SbdZP_Kn31Vp-7z8xBkYqmlcdl3opgl7yb2HJICRCssiI2CAgycfrrzZUz"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C1323] via-[#0C1323]/40 to-transparent"></div>
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.4) 100%)" }}></div>
            {/* Scanline */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.02) 50%)",
                backgroundSize: "100% 4px",
              }}
            ></div>
          </div>

          <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-[#FFD700]/30 bg-[#0C1323]/40 backdrop-blur-[24px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFD700] animate-pulse shadow-[0_0_8px_#ffd700]"></span>
                  <span className="text-xs font-bold font-headline text-[#FFD700] tracking-[0.3em] uppercase">
                    Master Duel Terminal #{poolId || "402"}
                  </span>
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold font-headline text-white tracking-tighter leading-none">
                  Cosmic Odyssey <br />
                  <span className="text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">Legendary Achievement</span>
                </h1>
                <p className="text-[#D0C6AB] text-xl font-light leading-relaxed max-w-lg">
                  Operational excellence reached. Vault overflow detected in sector 402. Deep-space liquidity successfully stabilized.
                </p>
              </div>

              <div className="flex flex-col items-end gap-6">
                <button className="group flex items-center gap-4 px-10 py-5 bg-[#FFD700]/10 backdrop-blur-xl border border-[#FFD700]/40 rounded-2xl hover:bg-[#FFD700] hover:text-[#705E00] transition-all" style={{ animation: "pulse-hologram 3s infinite ease-in-out" }}>
                  <ShareIcon className="h-6 w-6" />
                  <span className="font-bold uppercase tracking-[0.2em] text-sm">Share My Achievement</span>
                </button>
              </div>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8 border-t border-white/10">
              {/* Total Revenue */}
              <div className="p-6 rounded-2xl border-l-4 border-[#FFD700] bg-[#0C1323]/40 backdrop-blur-[24px]">
                <div className="text-[10px] font-bold text-[#D0C6AB] uppercase tracking-[0.3em] mb-2">Total Revenue</div>
                <div className="text-4xl font-headline font-bold text-white drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">12.84 ETH</div>
              </div>

              {/* Net Profit */}
              <div className="p-6 rounded-2xl border-l-4 border-[#00DAF3] bg-[#0C1323]/40 backdrop-blur-[24px]">
                <div className="text-[10px] font-bold text-[#D0C6AB] uppercase tracking-[0.3em] mb-2">Net Profit</div>
                <div className="text-4xl font-headline font-bold text-[#00DAF3] drop-shadow-[0_0_15px_rgba(0,218,243,0.6)]">+4.12 ETH</div>
              </div>

              {/* Bond Status */}
              <div className="p-6 rounded-2xl border-l-4 border-[#CABEFF] bg-[#0C1323]/40 backdrop-blur-[24px]">
                <div className="text-[10px] font-bold text-[#D0C6AB] uppercase tracking-[0.3em] mb-2">Bond Status</div>
                <div className="text-2xl font-headline font-bold text-white uppercase tracking-tight">RECLAIM_READY</div>
                <div className="text-[9px] text-[#00DAF3] uppercase mt-1">Audit complete</div>
              </div>

              {/* Round Progress */}
              <div className="p-6 rounded-2xl border-l-4 border-white/30 bg-[#0C1323]/40 backdrop-blur-[24px]">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-[#D0C6AB] uppercase tracking-[0.3em]">Round Progress</div>
                  <div className="text-[10px] font-bold text-white">84%</div>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 mb-2">
                  <div className="h-full bg-[#FFD700] w-[84%] relative"></div>
                </div>
                <div className="text-[8px] text-[#D0C6AB] font-mono uppercase">T-Minus 04:22:01</div>
              </div>
            </div>
          </div>
        </section>

        {/* Enlarged 24H Sales Trend Row */}
        <section>
          <div className="p-8 rounded-3xl border border-white/10 shadow-lg relative overflow-hidden bg-[#0C1323]/40 backdrop-blur-[24px]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-headline font-bold text-white">24H Sales Analytics</h3>
                <p className="text-[11px] font-bold text-[#D0C6AB] uppercase tracking-widest mt-1">Hourly Performance Distribution</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[#00DAF3] text-lg font-bold">+12.5%</span>
                  <div className="text-[10px] text-[#D0C6AB] uppercase">Vs Yesterday</div>
                </div>
                <ChartBarIcon className="h-5 w-5 text-[#FFE16D]/50" />
              </div>
            </div>

            {/* Hourly Statistics Chart */}
            <div className="h-48 w-full group/chart">
              <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} />
            </div>

            <div className="flex justify-between mt-4 text-[9px] text-[#D0C6AB] font-mono uppercase tracking-widest border-t border-white/5 pt-4">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>

            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.02) 50%)",
                backgroundSize: "100% 4px",
              }}
            ></div>
          </div>
        </section>

        {/* Live Operations Feed */}
        <section className="space-y-6 pb-24 relative">
          <div className="flex justify-between items-end relative z-10">
            <div className="space-y-1">
              <h2 className="text-3xl font-headline font-bold tracking-tight text-white flex items-center gap-3">
                Live Operations Feed
                <span className="inline-block w-2 h-2 rounded-full bg-[#FFD700] animate-pulse shadow-[0_0_8px_#ffd700]"></span>
              </h2>
              <p className="text-[#D0C6AB] text-sm font-label tracking-wide uppercase">Real-time cryptographic audit of pool activity</p>
            </div>
            <div className="flex gap-4">
              <button className="p-3 rounded-xl border border-[#FFD700]/10 bg-[#0C1323]/40 backdrop-blur-[24px] text-[#D0C6AB] hover:text-[#FFE16D] hover:border-[#FFE16D]/30 transition-all">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              <button className="p-3 rounded-xl border border-[#FFD700]/10 bg-[#0C1323]/40 backdrop-blur-[24px] text-[#D0C6AB] hover:text-[#FFE16D] hover:border-[#FFE16D]/30 transition-all">
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative"
            style={{ background: "linear-gradient(145deg, #141b2c 0%, #070e1d 100%)" }}
          >
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.02) 50%)",
                backgroundSize: "100% 4px",
              }}
            ></div>

            <table className="w-full text-left border-collapse relative z-10">
              <thead>
                <tr className="bg-white/5 text-[11px] uppercase tracking-[0.3em] font-bold text-[#D0C6AB] border-b border-white/10">
                  <th className="px-5 md:px-8 py-5">Ticket ID</th>
                  <th className="px-5 md:px-8 py-5">Timestamp</th>
                  <th className="px-5 md:px-8 py-5">Outcome</th>
                  <th className="px-5 md:px-8 py-5 text-right">Prize Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="px-5 md:px-8 py-6 font-headline text-base font-bold text-white group-hover:text-[#FFD700]">#{poolId || "402"}-089</td>
                  <td className="px-5 md:px-8 py-6 text-sm text-[#D0C6AB] font-mono">2024.10.12 | 12:45:01.002</td>
                  <td className="px-5 md:px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] text-[10px] font-black tracking-widest shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                      <StarIcon className="h-3.5 w-3.5" />
                      WINNER
                    </span>
                  </td>
                  <td className="px-5 md:px-8 py-6 text-right font-headline font-bold text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">+5.00 USDC</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="px-5 md:px-8 py-6 font-headline text-base font-bold text-white group-hover:text-[#FFD700]">#{poolId || "402"}-088</td>
                  <td className="px-5 md:px-8 py-6 text-sm text-[#D0C6AB] font-mono">2024.10.12 | 12:44:52.981</td>
                  <td className="px-5 md:px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#D0C6AB]/70 text-[10px] font-black tracking-widest">
                      NO REWARD
                    </span>
                  </td>
                  <td className="px-5 md:px-8 py-6 text-right font-headline font-bold text-[#D0C6AB]/30">---</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="px-5 md:px-8 py-6 font-headline text-base font-bold text-white group-hover:text-[#FFD700]">#{poolId || "402"}-086</td>
                  <td className="px-5 md:px-8 py-6 text-sm text-[#D0C6AB] font-mono">2024.10.12 | 12:40:55.420</td>
                  <td className="px-5 md:px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] text-[10px] font-black tracking-widest">
                      <StarIcon className="h-3.5 w-3.5" />
                      WINNER
                    </span>
                  </td>
                  <td className="px-5 md:px-8 py-6 text-right font-headline font-bold text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">+12.00 USDC</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors group">
                  <td className="px-5 md:px-8 py-6 font-headline text-base font-bold text-white group-hover:text-[#FFD700]">#{poolId || "402"}-085</td>
                  <td className="px-5 md:px-8 py-6 text-sm text-[#D0C6AB] font-mono">2024.10.12 | 12:38:22.115</td>
                  <td className="px-5 md:px-8 py-6">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#D0C6AB]/70 text-[10px] font-black tracking-widest">
                      NO REWARD
                    </span>
                  </td>
                  <td className="px-5 md:px-8 py-6 text-right font-headline font-bold text-[#D0C6AB]/30">---</td>
                </tr>
              </tbody>
            </table>

            <div className="px-5 md:px-8 py-5 bg-black/20 flex flex-col md:flex-row justify-between items-center text-[11px] font-bold text-[#D0C6AB] tracking-[0.2em] uppercase border-t border-white/10 gap-4">
              <span>Ops Logs: 1-4 of 1,204</span>
              <div className="flex gap-6 items-center">
                <button className="opacity-30 flex items-center gap-1">
                  <ChevronLeftIcon className="h-4 w-4" /> Previous
                </button>
                <div className="hidden md:flex gap-4">
                  <span className="text-[#FFE16D] border-b border-[#FFE16D]">01</span>
                  <span className="hover:text-white cursor-pointer transition-colors">02</span>
                  <span className="hover:text-white cursor-pointer transition-colors">03</span>
                  <span>...</span>
                  <span className="hover:text-white cursor-pointer transition-colors">48</span>
                </div>
                <button className="hover:text-[#FFE16D] flex items-center gap-1 transition-colors">
                  Next <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Reflective floor effect for Live Operations */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[150px] pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(12, 19, 35, 0.8), transparent)" }}
          ></div>
        </section>

        {/* Command Console (Bottom Content Section) */}
        <section className="max-w-4xl mx-auto relative z-10 pb-8">
          <div className="p-6 rounded-3xl border border-[#FFD700]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center gap-8 bg-[#0C1323]/40 backdrop-blur-[24px]">
            <div className="flex items-center gap-4 pl-4 md:border-r border-white/10 pr-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#FFD700] border border-[#FFD700]/20 shadow-inner"
                style={{ background: "linear-gradient(145deg, #141b2c 0%, #070e1d 100%)" }}
              >
                <CommandLineIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#FFD700] tracking-[0.3em] uppercase">Status: Nominal</div>
                <div className="text-lg font-headline font-bold text-white tracking-tight">Root_Terminal_v4.2</div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              <button className="flex items-center justify-center gap-2 py-4 bg-[#FFD700] text-[#705E00] rounded-2xl font-headline font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                <WalletIcon className="h-5 w-5" />
                Withdraw Profit
              </button>
              <button className="flex items-center justify-center gap-2 py-4 bg-[#0C1323]/40 backdrop-blur-[24px] text-white border border-white/20 rounded-2xl font-headline font-bold text-sm hover:bg-white/10 active:scale-95 transition-all">
                <BanknotesIcon className="h-5 w-5" />
                Refund Bond
              </button>
              <button className="flex items-center justify-center gap-2 py-4 bg-red-900/20 text-red-400 border border-red-900/40 rounded-2xl font-headline font-bold text-sm hover:bg-red-900/40 hover:text-red-300 active:scale-95 transition-all">
                <PowerIcon className="h-5 w-5" />
                Close Pool
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
