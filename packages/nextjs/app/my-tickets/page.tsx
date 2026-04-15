"use client";

import React, { useState } from "react";
import type { NextPage } from "next";
import { TicketCard } from "~~/components/my-tickets/TicketCard";
import type { TicketCardData } from "~~/components/my-tickets/TicketCard";
import { TicketFilterBar } from "~~/components/my-tickets/TicketFilterBar";
import { VaultStatsBar } from "~~/components/my-tickets/VaultStatsBar";
import { MyTicketsIcon } from "~~/components/my-tickets/icons";

/* ─── Demo Ticket Data ─── */
const DEMO_TICKETS_RAW: TicketCardData[] = [
  {
    id: "ticket-1",
    ticketId: "047",
    poolName: "Lucky Fortune (鸿运当头)",
    poolIcon: "diamond",
    cost: "5 USDC",
    status: "unrevealed",
  },
  {
    id: "ticket-2",
    ticketId: "048",
    poolName: "Lucky Fortune (鸿运当头)",
    poolIcon: "diamond",
    cost: "5 USDC",
    status: "winning",
    prizeAmount: "50 USDC",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuClSAICOGQoiwzeM4jinZ-puNhpcGiBRUxo3bYvnEFpq-whvUnTezR1RtFhf6MzSqlSh0Ntrkm1huQo1IK93qtZcjvMGak8QSPPur2vqOVgf9u-Q9V5wfxdAu8GsBBtYZNKDgkNMR8kb9rpsYl2DWh3nF2MLLhy7ReEUaXMgiLUv7gEmzDHb9n218JWOAyjZzgpqVcYctyk2agJYySTKzYb98oMKFZIhRUKaU3d58JQnzVMVHkMybvA1Q2zeV3wM_ie1Zju4UFnG9_b",
  },
  {
    id: "ticket-3",
    ticketId: "039",
    poolName: "Diamond Hunter (钻石猎人)",
    poolIcon: "stars",
    cost: "2 USDC",
    status: "no-win",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBpYoEQsB_aff42hEtI1ZAOPF5cSCxZ8CJXsq8_jxqedNYR_uBSN6qksdbXE6F4frhGjMV_NCDulQBYoS_W8X-Bq2RYOvuWIxyycyPaeoqJ5cIfE6aAjn0m8T_5AMA6G0swaT6pnagDQRQr2FpF7XotE3FcTDrXvNiFXLBka-5XnqgNIMhqfvhu688xV3vM52PY8J2_UTqE11yGtmGerKzqR8CEYL1Al0tjxf0zB7AIZSiF0r7qQWUR45OwGYo7wSrmBPx-AFW_D-6Z",
  },
  {
    id: "ticket-4",
    ticketId: "105",
    poolName: "Diamond Hunter (钻石猎人)",
    poolIcon: "stars",
    cost: "2 USDC",
    status: "winning",
    prizeAmount: "15 USDC",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDE_fTHo2X77wP_retDf4et_-3O1AcjnsbjL05VW5UXtx8DdnmH4y_0v6YtQrl-VPacB2GbvuuY9-aIjMxsoHYrJhxTIiCuH4ojTJ1VALGhSkN8EhMouIGMhblAdduNiRHwNX4AZWiilS3VBSDcQygzmAyMkc8DGddJ2FEGOf60Zhw1mWIJUETmwFWQxAS-721F0gd-RvPnH_VlMrEyVz9KAcWDYs5WDBGWZFXJ6tJtS2QH-_HrCVMUIewkPxezf_L_SA_2FQZsKKo3",
  },
  {
    id: "ticket-5",
    ticketId: "112",
    poolName: "Lucky Fortune (鸿运当头)",
    poolIcon: "diamond",
    cost: "5 USDC",
    status: "unrevealed",
  },
  {
    id: "ticket-6",
    ticketId: "078",
    poolName: "Cosmic Nebula (星云探秘)",
    poolIcon: "auto_awesome",
    cost: "2 USDC",
    status: "no-win",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCUC7drvZI5-QEJzMgM_pFf_uBTrwaeqxH4mkzJ4ZykOmYUncJdMx5RAWG9twwwvWuH6hsKptVhCXwL5S3nHJm9iljxftx7NBHJ6Gxi9M0y5FgKRxGsZ_YNV-R86a5cSH19iYBz6fS7eUzoEz-iLY3pQ7AjMG1UHQpDWNMNafsSrx0DilcQihxdw9lfy7I7G2e1j3CfM5jermN85mG05HckYH4wYQXpz3JRdiH9qK7kl1T0TCzp1ErgBDaeqeg6ZdgDKE_9x8z54QQ",
  },
  {
    id: "ticket-7",
    ticketId: "091",
    poolName: "Spirit Guide (仙灵指引)",
    poolIcon: "light",
    cost: "2 USDC",
    status: "winning",
    prizeAmount: "8 USDC",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCjkjtSLpwvGAdIJQh4wfnjWErkLMphDU07A0S2hV6v0ndy4c1HpAJzgm6pG5Vc-XNCXKp_pvGeoRUMMKoTfKYiX9vnTQLLoZlG1ODWhHlk7ExpHYWd1KqqPYQQC_cv8OK5O_5QUrJKNkanzaq_KL8DCDYO9Xrufm3hrn9NgiGXYAicc83MclfAotxu3i2pBx7WsxdwzJ4XXj4ZaZt8YityOiBGvaCJ7KkRckp9RPTQm7nnRjdczQ_nF0lvqfyVKP9sbS9VZzYxziI",
  },
  {
    id: "ticket-8",
    ticketId: "156",
    poolName: "Starlight Path (星光之路)",
    poolIcon: "star",
    cost: "5 USDC",
    status: "unrevealed",
  },
];

// Duplicate tickets to demonstrate pagination
const DEMO_TICKETS = [
  ...DEMO_TICKETS_RAW,
  ...DEMO_TICKETS_RAW.map(t => ({ ...t, id: `${t.id}-copy1`, ticketId: `${t.ticketId}A` })),
  ...DEMO_TICKETS_RAW.map(t => ({ ...t, id: `${t.id}-copy2`, ticketId: `${t.ticketId}B` })),
];

const ITEMS_PER_PAGE = 8;

const MyTicketsPage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<"all" | "unrevealed" | "revealed" | "winning" | "to-claim">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Filter logic ── */
  const filteredTickets = DEMO_TICKETS.filter(ticket => {
    // Tab filter
    if (activeTab === "unrevealed" && ticket.status !== "unrevealed") return false;
    if (activeTab === "revealed" && ticket.status === "unrevealed") return false;
    if (activeTab === "winning" && ticket.status !== "winning") return false;
    if (activeTab === "to-claim" && ticket.status !== "winning") return false;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ticket.ticketId.toLowerCase().includes(q) || ticket.poolName.toLowerCase().includes(q);
    }
    return true;
  });

  const claimableCount = DEMO_TICKETS.filter(t => t.status === "winning").length;

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Handle Tab Change
  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to first page
  };

  // Helper to generate page numbers
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            currentPage === i
              ? "bg-[#ffd700] text-[#705e00] font-bold shadow-[0_0_10px_rgba(255,215,0,0.3)]"
              : "bg-[#181f30] border border-[#4d4732]/30 text-[#dce2f9] hover:bg-[#32394a]"
          }`}
        >
          {i}
        </button>,
      );
    }

    return (
      <div className="flex justify-center items-center mt-12 mb-4 gap-2">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="w-10 h-10 rounded-lg bg-[#181f30] border border-[#4d4732]/30 flex items-center justify-center text-[#dce2f9] hover:bg-[#32394a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MyTicketsIcon name="chevron_left" className="h-4 w-4" />
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="w-10 h-10 rounded-lg bg-[#181f30] border border-[#4d4732]/30 flex items-center justify-center text-[#dce2f9] hover:bg-[#32394a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MyTicketsIcon name="chevron_right" className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative bg-[#0c1323] text-[#dce2f9] font-body selection:bg-ns-primary selection:text-ns-primary-container min-h-[80vh]">
      {/* Vault Background Radial */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle at 50% 50%, #181f30 0%, #0c1323 100%)",
        }}
      />

      {/* Ambient Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
        <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-[#e9c400] rounded-full" />
        <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-[#00daf3] rounded-full" />
        <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-[#cabeff] rounded-full" />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 relative z-10">
        <VaultStatsBar />

        <TicketFilterBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectAll={selectAll}
          onSelectAllChange={setSelectAll}
          claimCount={claimableCount}
        />

        {/* Ticket Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {paginatedTickets.map(ticket => (
            <TicketCard key={ticket.id} {...ticket} />
          ))}
        </div>

        {/* Empty State */}
        {filteredTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MyTicketsIcon name="confirmation_number" className="mb-4 h-16 w-16 text-[#d0c6ab]/30" />
            <p className="text-[#d0c6ab]/60 text-lg font-headline">No tickets found</p>
            <p className="text-[#d0c6ab]/40 text-sm mt-1">Try adjusting your filters or search query</p>
          </div>
        )}

        {/* Pagination component */}
        {renderPagination()}

        {/* Reflective Floor */}
        <div
          className="mt-12 h-20 blur-xl"
          style={{
            background: "linear-gradient(to bottom, transparent 0%, rgba(255, 215, 0, 0.05) 100%)",
          }}
        />
      </div>
    </div>
  );
};

export default MyTicketsPage;
