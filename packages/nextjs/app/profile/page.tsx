"use client";

import { type ReactNode, useState } from "react";
import {
  Cog8ToothIcon,
  DocumentDuplicateIcon,
  RectangleGroupIcon,
  SparklesIcon,
  StarIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import MyTicketsPage from "~~/app/my-tickets/page";
import { MyPoolsPanel } from "~~/components/profile/MyPoolsPanel";
import { OverviewPanel } from "~~/components/profile/OverviewPanel";
import { SettingsPanel } from "~~/components/profile/SettingsPanel";

export default function ProfilePage() {
  const [activeSection, setActiveSection] = useState("overview");

  const renderSectionShell = (content: ReactNode, options?: { padded?: boolean; framed?: boolean }) => {
    const padded = options?.padded ?? true;
    const framed = options?.framed ?? true;

    if (!framed) {
      return <div className={padded ? "w-full p-6 md:p-8" : "w-full"}>{content}</div>;
    }

    return (
      <div className="relative z-20 w-full overflow-hidden rounded-xl border border-ns-outline-variant/30 bg-[#0c1323] shadow-2xl">
        <div className={padded ? "w-full p-6 md:p-8" : "w-full"}>{content}</div>
      </div>
    );
  };

  return (
    <main className="w-full pt-32 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto relative min-h-screen font-body text-ns-on-surface">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-ns-secondary-container opacity-5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Profile Hub */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="glass-panel rounded-xl p-8 relative overflow-hidden group">
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] !bg-[length:100%_2px,_3px_100%] pointer-events-none"></div>
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(135deg,rgba(255,215,0,0.1)_0%,rgba(255,215,0,0)_50%,rgba(255,215,0,0.1)_100%)]"></div>
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-ns-primary-container via-ns-surface-bright to-ns-primary shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                  <img
                    alt="User Avatar"
                    className="w-full h-full rounded-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBebVBrLuuUEdsfTGfKCFR6spVCUHkgFtjIQXhUJV_N0YGnZrZoBn-UMMsUZ-Vbx9Vc9CP_iImHg7jdbDFWTzv_9q24iJq8t8efgq6ZWNnWIx2PTRfKqVZ6ElZfj7_QJnAnEleSZ0QAhgPvJUAM2eQBsXBT8Etntxc2yGhLYpZ_D0UkzaQ24K_X7Pb7QSE9qg9otD3LtqdNUmrXriMdSwkZViy2oJjZVGgZBXBMr906amO4PoaYxyXyTOB8IH9bfxTWINBXzHNO6X_D"
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-ns-primary-container text-ns-on-primary px-4 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                  LEVEL 84
                </div>
              </div>
              <h2 className="font-headline text-2xl font-bold text-ns-on-surface mb-1">CYBER_DUELIST_01</h2>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs font-mono text-ns-on-surface-variant bg-ns-surface-container-lowest px-2 py-1 rounded">
                  0x71C...4f92
                </span>
                <DocumentDuplicateIcon className="w-4 h-4 text-ns-tertiary cursor-pointer hover:text-white transition-colors" />
              </div>
              <div className="w-full bg-ns-surface-container-low rounded-lg p-4 border-l-4 border-ns-primary-container mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ns-on-surface-variant uppercase tracking-tighter font-semibold">
                    Rank Status
                  </span>
                  <StarIcon className="w-5 h-5 text-ns-primary-container" />
                </div>
                <div className="text-xl font-headline font-bold text-ns-primary italic tracking-tight">
                  LEGENDARY DUELIST
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-ns-surface-container-lowest p-3 rounded-lg border border-ns-outline-variant/10">
                  <div className="text-[10px] text-ns-on-surface-variant uppercase mb-1">Total Tickets</div>
                  <div className="text-xl font-headline font-bold text-ns-on-surface">84</div>
                </div>
                <div className="bg-ns-surface-container-lowest p-3 rounded-lg border border-ns-outline-variant/10">
                  <div className="text-[10px] text-ns-on-surface-variant uppercase mb-1">Win Rate</div>
                  <div className="text-xl font-headline font-bold text-ns-tertiary">68.4%</div>
                </div>
              </div>
            </div>
          </div>
          {/* Secondary Side Nav Links */}
          <div className="glass-panel rounded-xl overflow-hidden py-4">
            <nav className="flex flex-col">
              <button
                onClick={() => setActiveSection("overview")}
                className={`${activeSection === "overview" ? "bg-ns-primary text-[#0C1323] rounded-r-full mr-4 shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant hover:bg-ns-surface-bright hover:translate-x-1 duration-200"} px-6 py-3 flex items-center gap-4 transition-all w-full text-left`}
              >
                <RectangleGroupIcon className="w-5 h-5" />
                <span className="font-body font-medium text-sm">Overview</span>
              </button>
              <button
                onClick={() => setActiveSection("my-tickets")}
                className={`${activeSection === "my-tickets" ? "bg-ns-primary text-[#0C1323] rounded-r-full mr-4 shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant hover:bg-ns-surface-bright hover:translate-x-1 duration-200"} px-6 py-3 flex items-center gap-4 transition-all w-full text-left`}
              >
                <TicketIcon className="w-5 h-5" />
                <span className="font-body font-medium text-sm">My Tickets</span>
              </button>
              <button
                onClick={() => setActiveSection("my-pools")}
                className={`${activeSection === "my-pools" ? "bg-ns-primary text-[#0C1323] rounded-r-full mr-4 shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant hover:bg-ns-surface-bright hover:translate-x-1 duration-200"} px-6 py-3 flex items-center gap-4 transition-all w-full text-left`}
              >
                <SparklesIcon className="w-5 h-5" />
                <span className="font-body font-medium text-sm">My Pools</span>
              </button>
              <button
                onClick={() => setActiveSection("setting")}
                className={`${activeSection === "setting" ? "bg-ns-primary text-[#0C1323] rounded-r-full mr-4 shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-ns-on-surface-variant hover:bg-ns-surface-bright hover:translate-x-1 duration-200"} px-6 py-3 flex items-center gap-4 transition-all w-full text-left`}
              >
                <Cog8ToothIcon className="w-5 h-5" />
                <span className="font-body font-medium text-sm">Setting</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Right Column: Dashboard */}
        <div className="lg:col-span-9 space-y-8">
          {activeSection === "overview" && renderSectionShell(<OverviewPanel />)}

          {activeSection === "my-tickets" && renderSectionShell(<MyTicketsPage />, { padded: false })}

          {activeSection === "my-pools" && renderSectionShell(<MyPoolsPanel />, { framed: false })}

          {activeSection === "setting" && renderSectionShell(<SettingsPanel />)}
        </div>
      </div>

      {/* Decorative Corner Accents */}
      <div className="fixed bottom-0 right-0 p-8 opacity-20 pointer-events-none">
        <div className="w-64 h-64 border-r-2 border-b-2 border-ns-primary-container rounded-br-3xl"></div>
      </div>
      <div className="fixed bottom-0 left-0 p-8 opacity-20 pointer-events-none">
        <div className="w-32 h-32 border-l-2 border-b-2 border-ns-tertiary rounded-bl-3xl"></div>
      </div>
    </main>
  );
}
