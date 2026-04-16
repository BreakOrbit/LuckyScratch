"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, CheckBadgeIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useLuckyScratchClaimPrecheck, useLuckyScratchTicket } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useTicketRevealFlow } from "~~/hooks/luckyScratch/useTicketRevealFlow";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const formatDateTime = (value?: string) => {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
};

export const TicketRevealWorkspace = ({ ticketId }: { ticketId: string }) => {
  const { address, chainId } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const ticketQuery = useLuckyScratchTicket(ticketId);
  const claimPrecheckQuery = useLuckyScratchClaimPrecheck(ticketId);
  const {
    runtimeStatus,
    runtimeError,
    revealAuth,
    revealAuthMutation,
    decryptMutation,
    claimMutation,
    decryptProgress,
    decryptionResult,
    isClaimPending,
    claimDisabledReason,
  } = useTicketRevealFlow(ticketId);

  const ticket = ticketQuery.data;
  const claimPrecheck = claimPrecheckQuery.data;
  const isOwner = Boolean(address && ticket?.owner && address.toLowerCase() === ticket.owner.toLowerCase());
  const expectedChainId = revealAuth?.authPayload.chainId || chainId;

  return (
    <div className="flex grow flex-col bg-[radial-gradient(circle_at_top_left,_hsla(var(--s)/0.14),transparent_24%),radial-gradient(circle_at_bottom_right,_hsla(var(--a)/0.16),transparent_28%),linear-gradient(180deg,hsla(var(--b1)/0.98),hsla(var(--b2)/0.98))]">
      <div className="mx-auto flex w-full max-w-6xl grow flex-col gap-8 px-4 py-10 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/tickets"
              className="inline-flex items-center gap-2 text-sm text-base-content/60 hover:text-base-content"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to ticket inventory
            </Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-secondary">LuckyScratch Ticket</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Reveal and Claim Workspace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70 md:text-base">
              This page binds the indexed backend ticket record, `reveal-auth`, ticket-scoped Zama relayer proxy, and
              the final wallet-side claim submission path.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-base-300 bg-base-100/80 px-5 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Connected Wallet</p>
            <div className="mt-2">
              {address ? (
                <Address address={address} chain={targetNetwork} />
              ) : (
                <span className="text-sm text-base-content/60">Connect a wallet to use reveal-auth.</span>
              )}
            </div>
          </div>
        </div>

        {ticketQuery.isLoading && (
          <div className="flex items-center justify-center rounded-[2rem] border border-base-300 bg-base-100/80 p-12 shadow-xl">
            <span className="loading loading-spinner loading-lg text-secondary" />
          </div>
        )}

        {ticketQuery.isError && (
          <div className="rounded-[2rem] border border-error/30 bg-error/10 p-6 text-error">
            {ticketQuery.error instanceof Error ? ticketQuery.error.message : "Failed to load ticket details."}
          </div>
        )}

        {ticket ? (
          <>
            <section className="grid gap-6 rounded-[2rem] border border-base-300/70 bg-base-100/80 p-6 shadow-xl backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2 text-sm text-secondary">
                  <CheckBadgeIcon className="h-4 w-4" />
                  Ticket #{ticket.ticketId}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-base-200/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Status</p>
                    <p className="mt-2 text-2xl font-black capitalize">{ticket.status}</p>
                  </div>
                  <div className="rounded-[1.25rem] bg-base-200/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Reveal Authorized</p>
                    <p className="mt-2 text-2xl font-black">{ticket.revealAuthorized ? "Yes" : "No"}</p>
                  </div>
                  <div className="rounded-[1.25rem] bg-base-200/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Pool / Round</p>
                    <p className="mt-2 text-xl font-bold">
                      {ticket.poolId} / {ticket.roundId}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-base-200/80 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-base-content/50">Claimed Reward</p>
                    <p className="mt-2 text-xl font-bold">{ticket.claimClearRewardAmount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-base-300 bg-base-200/60 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">Owner Snapshot</p>
                <div className="mt-3">
                  <Address address={ticket.owner as `0x${string}`} chain={targetNetwork} />
                </div>
                <div className="mt-5 space-y-3 text-sm text-base-content/70">
                  <p>Current wallet owns this ticket: {isOwner ? "yes" : "no"}</p>
                  <p>Runtime chain id: {expectedChainId}</p>
                  <p>Backend record updated: {formatDateTime(ticket.updatedAt)}</p>
                  <p>Reveal runtime: {runtimeStatus}</p>
                  {runtimeError && <p className="text-error">{runtimeError}</p>}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <article className="rounded-[1.75rem] border border-base-300 bg-base-100/85 p-6 shadow-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">Step 1</p>
                <h2 className="mt-2 text-2xl font-black">Reveal Authorization</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/70">
                  The backend validates `ownerOf` and `getTicketRevealState`, then emits a ticket-scoped Zama proxy URL
                  plus the user-decrypt template.
                </p>

                {claimPrecheckQuery.isLoading && (
                  <span className="loading loading-spinner loading-md mt-4 text-secondary" />
                )}

                {claimPrecheck && (
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Claim Status</dt>
                      <dd className="mt-1 font-semibold capitalize">{claimPrecheck.status}</dd>
                    </div>
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Reveal Authorized</dt>
                      <dd className="mt-1 font-semibold">{claimPrecheck.revealAuthorized ? "Yes" : "No"}</dd>
                    </div>
                    <div className="rounded-xl bg-base-200/80 p-3">
                      <dt className="text-base-content/50">Source of Truth</dt>
                      <dd className="mt-1 text-xs leading-6 text-base-content/70">{claimPrecheck.sourceOfTruthHint}</dd>
                    </div>
                  </dl>
                )}

                <button
                  className="btn btn-primary mt-5 w-full"
                  disabled={!isOwner || revealAuthMutation.isPending}
                  onClick={() => revealAuthMutation.mutate()}
                >
                  {revealAuthMutation.isPending ? "Authorizing..." : "Request Reveal Auth"}
                </button>
                {!isOwner && (
                  <p className="mt-3 text-xs leading-6 text-warning">
                    Only the current ticket owner can request reveal authorization.
                  </p>
                )}
                {revealAuth && (
                  <div className="mt-4 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
                    Reveal auth issued. Expires at {formatDateTime(revealAuth.expiresAt)}.
                  </div>
                )}
              </article>

              <article className="rounded-[1.75rem] border border-base-300 bg-base-100/85 p-6 shadow-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-secondary">Step 2</p>
                <h2 className="mt-2 text-2xl font-black">User Decrypt</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/70">
                  The browser signs the EIP-712 decrypt request, then uses the ticket-scoped backend proxy as the
                  relayer URL.
                </p>

                <button
                  className="btn btn-secondary mt-5 w-full"
                  disabled={!revealAuth || !isOwner || decryptMutation.isPending}
                  onClick={() => decryptMutation.mutate()}
                >
                  {decryptMutation.isPending ? "Decrypting..." : "Decrypt Reward"}
                </button>

                {decryptProgress && (
                  <div className="mt-4 rounded-xl border border-base-300 bg-base-200/80 p-4 text-sm text-base-content/70">
                    {decryptProgress}
                  </div>
                )}

                {revealAuth?.authPayload.zama && (
                  <div className="mt-4 rounded-xl border border-base-300 bg-base-200/80 p-4 text-sm text-base-content/70">
                    <p className="font-semibold text-base-content">Relayer URL</p>
                    <p className="mt-2 break-all text-xs">{revealAuth.authPayload.zama.sdkConfig.relayerUrl}</p>
                  </div>
                )}

                {decryptionResult && (
                  <div className="mt-4 rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-success">Decrypted Reward</p>
                    <p className="mt-2 text-3xl font-black text-success">
                      {decryptionResult.clearRewardAmount.toString()}
                    </p>
                    <p className="mt-2 break-all text-xs text-success/80">{decryptionResult.rewardHandle}</p>
                  </div>
                )}
              </article>

              <article className="rounded-[1.75rem] border border-base-300 bg-base-100/85 p-6 shadow-xl">
                <div className="flex items-center gap-2 text-secondary">
                  <ShieldCheckIcon className="h-5 w-5" />
                  <p className="text-xs uppercase tracking-[0.3em]">Step 3</p>
                </div>
                <h2 className="mt-2 text-2xl font-black">Claim Transaction</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/70">
                  Claim stays wallet-driven and still targets `LuckyScratchCore.claimReward(ticketId, clearRewardAmount,
                  decryptionProof)`.
                </p>

                <button
                  className="btn btn-accent mt-5 w-full"
                  disabled={Boolean(claimDisabledReason) || claimMutation.isPending || isClaimPending}
                  onClick={() => claimMutation.mutate()}
                >
                  {claimMutation.isPending || isClaimPending ? "Submitting..." : "Submit Claim"}
                </button>

                {claimDisabledReason && (
                  <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                    {claimDisabledReason}
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-base-300 bg-base-200/80 p-4 text-sm text-base-content/70">
                  <p className="font-semibold text-base-content">Current Boundary</p>
                  <p className="mt-2 leading-7">
                    The frontend can now request reveal auth and decrypt the reward through the backend proxy. Claim
                    proof assembly still needs a dedicated proof path on top of the current `user-decrypt` flow.
                  </p>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};
