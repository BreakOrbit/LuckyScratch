"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/store" },
  { label: "My Tickets", href: "/my-tickets" },
  { label: "Create Pool", href: "/create-pool" },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`font-headline tracking-tight uppercase text-sm transition-all duration-300 ${
              isActive
                ? "text-[#FFD700] border-b-2 border-[#FFD700] pb-1 shadow-[0_4px_10px_-2px_rgba(255,215,0,0.3)]"
                : "text-[#D0C6AB] hover:text-[#FFE16D]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
};

/**
 * LuckyScratch branded header with Celestial Vault design
 */
export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);

  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0C1323]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(7,14,29,0.5)]">
      <div className="flex justify-between items-center h-20 px-8 max-w-[1920px] mx-auto relative">
        {/* Logo */}
        <Link
          href="/"
          className="text-2xl font-black tracking-tighter text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.4)] font-headline uppercase"
        >
          LUCKY SCRATCH
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 font-headline tracking-tight uppercase text-sm">
          <HeaderMenuLinks />
        </div>

        {/* Mobile Burger */}
        <details className="dropdown dropdown-end md:hidden" ref={burgerMenuRef}>
          <summary className="btn btn-ghost">
            <Bars3Icon className="h-6 w-6 text-ns-on-surface" />
          </summary>
          <ul
            className="menu dropdown-content mt-3 p-4 bg-ns-surface-container shadow-lg rounded-sm w-52 z-50 space-y-3"
            onClick={() => burgerMenuRef?.current?.removeAttribute("open")}
          >
            {menuLinks.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="font-headline tracking-tight uppercase text-sm text-[#D0C6AB] hover:text-[#FFE16D]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </details>

        {/* Wallet Button */}
        <div className="hidden md:block">
          <RainbowKitCustomConnectButton />
        </div>

        {/* Bottom gradient line */}
        <div className="bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent h-[1px] absolute bottom-0 w-full left-0" />
      </div>
    </nav>
  );
};
