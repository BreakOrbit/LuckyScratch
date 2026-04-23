import React from "react";
import Link from "next/link";

/**
 * LuckyScratch branded footer with Celestial Vault design
 */
export const Footer = () => {
  return (
    <footer className="w-full border-t border-ns-outline-variant bg-ns-surface-container-lowest">
      <div className="flex flex-col md:flex-row justify-between items-center py-12 px-12 gap-8 max-w-[1920px] mx-auto">
        <div>
          <div className="text-[#FFD700] font-bold text-xl font-headline mb-4">LUCKY SCRATCH</div>
          <p className="font-body text-sm uppercase tracking-widest text-ns-tertiary opacity-80 max-w-md">
            © 2024 LUCKY SCRATCH. THE CELESTIAL VAULT SECURED.
          </p>
        </div>
        <div className="flex flex-wrap justify-center md:justify-end gap-x-12 gap-y-4 font-body text-sm uppercase tracking-widest text-ns-on-surface-variant/60">
          <Link href="#" className="hover:text-[#FFD700] transition-colors duration-300">
            Whitepaper
          </Link>
          <Link href="#" className="hover:text-[#FFD700] transition-colors duration-300">
            Audit Report
          </Link>
          <Link href="#" className="hover:text-[#FFD700] transition-colors duration-300">
            Terminals
          </Link>
          <Link href="#" className="hover:text-[#FFD700] transition-colors duration-300">
            Support
          </Link>
          <Link href="#" className="hover:text-[#FFD700] transition-colors duration-300">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
};
