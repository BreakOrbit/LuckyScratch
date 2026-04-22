"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArchiveBoxIcon, BuildingLibraryIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

const bottomNavItems = [
  { icon: HomeIcon, label: "Home", href: "/" },
  { icon: BuildingLibraryIcon, label: "Official", href: "/store" },
  { icon: UserGroupIcon, label: "Community", href: "/store?tab=community" },
  { icon: ArchiveBoxIcon, label: "Vault", href: "/my-tickets" },
];

export const StoreBottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 h-16 lg:hidden bg-ns-surface-dim/90 backdrop-blur-2xl border-t border-ns-outline-variant/20 shadow-[0_-10px_40px_rgba(255,215,0,0.08)]">
      {bottomNavItems.map(({ icon, label, href }) => {
        const isActive = pathname === href || (href === "/store" && pathname === "/store");
        const Icon = icon;
        return (
          <Link
            key={label}
            href={href}
            className={`flex flex-col items-center justify-center transition-transform duration-300 ${
              isActive ? "text-[#00BCD4] bg-[#00BCD4]/10 rounded-xl px-4 py-1 scale-110" : "text-ns-on-surface-variant"
            }`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span className="text-[10px] uppercase tracking-[0.05em] font-body">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
