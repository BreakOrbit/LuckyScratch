"use client";

import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type StorePaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export const StorePagination = ({ currentPage, totalPages, onPageChange }: StorePaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center mt-10 mb-6 gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="w-10 h-10 rounded-xl bg-ns-surface-container-low border border-ns-outline-variant/30 flex items-center justify-center text-ns-on-surface hover:bg-ns-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-colors ${
            currentPage === page
              ? "bg-ns-primary text-ns-on-primary font-bold shadow-[0_0_15px_rgba(255,215,0,0.25)]"
              : "bg-ns-surface-container-low border border-ns-outline-variant/30 text-ns-on-surface hover:bg-ns-surface-container-high"
          }`}
          aria-label={`Go to page ${page}`}
          aria-current={currentPage === page ? "page" : undefined}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="w-10 h-10 rounded-xl bg-ns-surface-container-low border border-ns-outline-variant/30 flex items-center justify-center text-ns-on-surface hover:bg-ns-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
