"use client";

import React from "react";

type ModeToggleProps = {
  mode: "manual" | "quick";
  onChange: (mode: "manual" | "quick") => void;
};

/**
 * Elegant sliding tab switch between Manual Pick and Quick Pick modes.
 * Features a neon-glow sliding indicator on the active tab.
 */
export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div className="flex justify-center mb-8">
      <div className="relative cyber-glass rounded-2xl p-1.5 flex gap-1 min-w-[340px]">
        {/* Sliding indicator */}
        <div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-4px)] rounded-xl transition-all duration-500 ease-out"
          style={{
            left: mode === "quick" ? "6px" : "calc(50% + 2px)",
            background: "linear-gradient(135deg, rgba(198, 40, 40, 0.25), rgba(255, 215, 0, 0.15))",
            border: "1px solid rgba(255, 215, 0, 0.2)",
            boxShadow: "0 0 15px rgba(255, 215, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
        />

        <button
          onClick={() => onChange("quick")}
          className={`
            relative z-10 flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
            font-headline font-bold text-sm tracking-wide uppercase transition-all duration-300
            ${mode === "quick" ? "text-[#FFD700]" : "text-white/40 hover:text-white/70"}
          `}
        >
          <span className="text-lg">🎲</span>
          Batch Auto
        </button>

        <button
          onClick={() => onChange("manual")}
          className={`
            relative z-10 flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
            font-headline font-bold text-sm tracking-wide uppercase transition-all duration-300
            ${mode === "manual" ? "text-[#FFD700]" : "text-white/40 hover:text-white/70"}
          `}
        >
          <span className="text-lg">✋</span>
          Manual Pick
        </button>
      </div>
    </div>
  );
};
