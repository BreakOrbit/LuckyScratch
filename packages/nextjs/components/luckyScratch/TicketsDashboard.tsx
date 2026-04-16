"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ArrowRightIcon, TicketIcon } from "@heroicons/react/24/outline";
import { useLuckyScratchUserTickets } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const TicketsDashboard = () => {
  const router = useRouter();
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const [manualTicketId, setManualTicketId] = useState("");
  const ticketsQuery = useLuckyScratchUserTickets(address);

  return (
    <div className="flex grow flex-col bg-[radial-gradient(circle_at_top,_hsla(var(--s)/0.18),transparent_30%),linear-gradient(180deg,hsla(var(--b1)/0.96),hsla(var(--b2)/0.98))]">
      <div className="mx-auto flex w-full max-w-6xl grow flex-col gap-8 px-4 py-10 md:px-6">
        <section className="grid gap-6 rounded-[2rem] border border-base-300/70 bg-base-100/80 p-6 shadow-xl backdrop-blur md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-secondary">LuckyScratch Frontend</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Ticket Reveal Workspace</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-base-content/70 md:text-base">
              This page is wired to the Go backend and the browser-side Zama relayer SDK. It lists your indexed tickets
              and links into the ticket-specific reveal and decrypt flow.
            </p>
            <div className="mt-6 rounded-2xl border border-base-300 bg-base-200/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Connected Wallet</p>
              <div className="mt-2">
                {address ? (
                  <Address address={address} chain={targetNetwork} />
                ) : (
                  <span className="text-sm text-base-content/60">Connect a wallet to query your ticket inventory.</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-base-300 bg-base-200/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Open Ticket</p>
            <p className="mt-3 text-sm text-base-content/70">
              If you already know the ticket id, jump straight into the reveal and decrypt page.
            </p>
            <label className="mt-5 flex flex-col gap-2">
              <span className="text-sm font-medium">Ticket ID</span>
              <input
                className="input input-bordered w-full"
                inputMode="numeric"
                placeholder="e.g. 1"
                value={manualTicketId}
                onChange={event => setManualTicketId(event.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
            <button
              className="btn btn-primary mt-4 w-full"
              disabled={!manualTicketId}
              onClick={() => router.push(`/tickets/${manualTicketId}`)}
            >
              Open Ticket
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-base-300/70 bg-base-100/80 p-6 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Indexed Tickets</p>
              <h2 className="mt-2 text-2xl font-bold">Wallet Inventory</h2>
            </div>
            {ticketsQuery.isFetching && <span className="loading loading-spinner loading-md text-secondary" />}
          </div>

          {!address && (
            <div className="mt-6 rounded-2xl border border-dashed border-base-300 bg-base-200/70 p-5 text-sm text-base-content/70">
              Connect a wallet to load `GET /api/v1/users/{"{address}"}/tickets` from the backend read model.
            </div>
          )}

          {address && ticketsQuery.isError && (
            <div className="mt-6 rounded-2xl border border-error/30 bg-error/10 p-5 text-sm text-error">
              {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Failed to load ticket inventory."}
            </div>
          )}

          {address && ticketsQuery.isSuccess && ticketsQuery.data.items.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-base-300 bg-base-200/70 p-5 text-sm text-base-content/70">
              The backend read model does not currently show any tickets for this wallet.
            </div>
          )}

          {address && ticketsQuery.data?.items.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ticketsQuery.data.items.map(ticket => (
                <Link
                  key={ticket.ticketId}
                  href={`/tickets/${ticket.ticketId}`}
                  className="group rounded-[1.5rem] border border-base-300 bg-base-100 p-5 shadow-sm transition hover:-translate-y-1 hover:border-secondary/50 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Ticket</p>
                      <p className="mt-2 text-3xl font-black">#{ticket.ticketId}</p>
                    </div>
                    <div className="rounded-2xl bg-secondary/10 p-3 text-secondary">
                      <TicketIcon className="h-6 w-6" />
                    </div>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Pool</dt>
                      <dd className="mt-1 font-semibold">{ticket.poolId}</dd>
                    </div>
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Round</dt>
                      <dd className="mt-1 font-semibold">{ticket.roundId}</dd>
                    </div>
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Status</dt>
                      <dd className="mt-1 font-semibold capitalize">{ticket.status}</dd>
                    </div>
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Reveal</dt>
                      <dd className="mt-1 font-semibold">{ticket.revealAuthorized ? "authorized" : "locked"}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex items-center justify-between text-sm text-base-content/60">
                    <span>Open reveal flow</span>
                    <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
