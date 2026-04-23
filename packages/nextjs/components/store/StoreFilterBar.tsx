"use client";

import React from "react";

export type StoreSortOption = "latest" | "popular" | "winrate" | "price";

type StoreFilterBarProps = {
  activeSort: StoreSortOption;
  minPrice: string;
  maxPrice: string;
  onSortChange: (sort: StoreSortOption) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
};

const sortOptions: { key: StoreSortOption; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "popular", label: "Popular" },
  { key: "winrate", label: "Win Rate" },
  { key: "price", label: "Price" },
];

export const StoreFilterBar = ({
  activeSort,
  minPrice,
  maxPrice,
  onSortChange,
  onMinPriceChange,
  onMaxPriceChange,
}: StoreFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4 mb-8 border-y border-ns-outline-variant/10">
      {/* Sort By */}
      <div className="flex items-center gap-4">
        <span className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant font-bold">Sort By</span>
        <div className="flex gap-2">
          {sortOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSortChange(key)}
              className={`px-4 py-1.5 rounded-full text-xs transition-colors ${
                activeSort === key
                  ? "border border-ns-primary/20 bg-ns-primary/5 text-ns-primary"
                  : "border border-ns-outline-variant/30 text-ns-on-surface-variant hover:border-ns-outline"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="flex items-center gap-4">
        <span className="text-[10px] uppercase tracking-widest text-ns-on-surface-variant font-bold">Price Range</span>
        <div className="flex items-center gap-2">
          <input
            className="w-16 bg-ns-surface-container-low border border-ns-outline-variant/20 rounded-lg text-xs py-1.5 px-3 focus:border-ns-primary/50 focus:ring-0 focus:outline-none text-ns-on-surface placeholder:text-ns-on-surface-variant/50"
            inputMode="decimal"
            min="0"
            placeholder="Min"
            step="0.01"
            type="number"
            value={minPrice}
            onChange={event => onMinPriceChange(event.target.value)}
          />
          <span className="text-ns-outline text-sm">—</span>
          <input
            className="w-16 bg-ns-surface-container-low border border-ns-outline-variant/20 rounded-lg text-xs py-1.5 px-3 focus:border-ns-primary/50 focus:ring-0 focus:outline-none text-ns-on-surface placeholder:text-ns-on-surface-variant/50"
            inputMode="decimal"
            min="0"
            placeholder="Max"
            step="0.01"
            type="number"
            value={maxPrice}
            onChange={event => onMaxPriceChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
