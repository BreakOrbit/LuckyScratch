"use client";

import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  ChartBarIcon,
  CircleStackIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { POOL_COVER_FRAME_CLASS, POOL_COVER_IMAGE_CLASS } from "~~/components/pool-cover/constants";
import { useLuckyScratchPool } from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { formatPercentFromBps, formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";

const statCardClassName = "rounded-3xl border border-white/10 bg-[#121B2D] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]";

const statusClassName = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-[#0A3322] text-[#8AF4C5] border border-[#0F5B3A]";
    case "Initializing":
      return "bg-[#2D2546] text-[#CABEFF] border border-[#5E4E92]";
    case "SoldOut":
      return "bg-[#493916] text-[#FFD66D] border border-[#8D6C1D]";
    case "Closing":
      return "bg-[#3A2234] text-[#FFB4AB] border border-[#8E4A74]";
    case "Closed":
      return "bg-[#232A3B] text-[#D0C6AB] border border-[#3B455B]";
    default:
      return "bg-[#232A3B] text-[#DCE2F9] border border-[#3B455B]";
  }
};

type DetailStatProps = {
  label: string;
  value: string;
  caption?: string;
};

const DetailStat = ({ label, value, caption }: DetailStatProps) => (
  <div className={statCardClassName}>
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8290AE]">{label}</p>
    <p className="mt-3 font-headline text-3xl font-bold text-[#DCE2F9]">{value}</p>
    {caption ? <p className="mt-2 text-sm text-[#9FB0D0]">{caption}</p> : null}
  </div>
);

export function PoolDetailPage({ poolId }: { poolId: string }) {
  const { data: pool, isLoading, isError, error } = useLuckyScratchPool(poolId);

  if (isLoading) {
    return <div className="mx-auto min-h-screen max-w-7xl animate-pulse px-4 pb-16 pt-24 md:px-8" />;
  }

  if (isError || !pool) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-24 md:px-8">
        <div className="rounded-3xl border border-[#8E4A74] bg-[#2A1521] p-8 text-[#FFB4AB]">
          {error?.message || "Pool not found"}
        </div>
      </div>
    );
  }

  const round = pool.currentRoundState;
  const soldCount = round?.soldCount ?? 0;
  const totalTickets = round?.totalTickets ?? pool.totalTicketsPerRound;
  const roundProgress = totalTickets > 0 ? Math.min(100, (soldCount / totalTickets) * 100) : 0;
  const title = pool.metadata?.name || `Pool #${pool.poolId}`;
  const description =
    pool.metadata?.description ||
    "This page only shows indexed round progress and creator accounting. It no longer estimates unavailable winner totals.";

  return (
    <div className="relative min-h-screen bg-[#0C1323] text-[#DCE2F9]">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-20">
        <div className="absolute left-[12%] top-[12%] h-[460px] w-[460px] rounded-full bg-[#4719C9] blur-[120px]" />
        <div className="absolute bottom-[12%] right-[10%] h-[520px] w-[520px] rounded-full bg-[#173454] blur-[120px]" />
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#11192B] shadow-[0_36px_90px_rgba(0,0,0,0.3)]">
          <div className={POOL_COVER_FRAME_CLASS}>
            {pool.metadata?.coverImageUrl ? (
              <img
                src={pool.metadata.coverImageUrl}
                alt={title}
                className={`absolute inset-0 ${POOL_COVER_IMAGE_CLASS}`}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#ffd700_0%,#20304b_45%,#0c1323_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C1323] via-[#0C1323]/45 to-transparent" />
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.22em] ${statusClassName(pool.status)}`}
              >
                {pool.status.toUpperCase()}
              </span>
              <span className="rounded-full border border-[#4A587B] bg-[#10192D]/80 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-[#9FB0D0]">
                ROUND {pool.currentRound}
              </span>
            </div>
          </div>
          <div className="p-8 md:p-10">
            <h1 className="max-w-4xl font-headline text-4xl font-bold tracking-tight text-white md:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#D0C6AB]">{description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/purchase/${pool.poolId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_65%,#ffe16d_100%)] px-5 py-3 font-headline font-bold text-[#705E00]"
              >
                <TicketIcon className="h-5 w-5" />
                Buy Tickets
              </Link>
              {pool.metadata?.metadataGatewayUrl ? (
                <a
                  href={pool.metadata.metadataGatewayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-[#10192D]/85 px-5 py-3 font-bold text-[#DCE2F9]"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  Metadata
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DetailStat
            label="Sold / Total"
            value={`${soldCount} / ${totalTickets}`}
            caption={`Round fill ${roundProgress.toFixed(1)}%`}
          />
          <DetailStat
            label="Ticket Price"
            value={`${formatUsdcFromMicro(pool.ticketPrice)} USDC`}
            caption="Current on-chain ticket price"
          />
          <DetailStat
            label="Target RTP / Hit Rate"
            value={`${formatPercentFromBps(pool.targetRtpBps)}% / ${formatPercentFromBps(pool.hitRateBps)}%`}
            caption="Configured at pool creation"
          />
          <DetailStat
            label="Prize Budget / Max Prize"
            value={`${formatUsdcFromMicro(pool.totalPrizeBudget)} / ${formatUsdcFromMicro(pool.maxPrize)} USDC`}
            caption="Budget per round and largest tier"
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-[#11192B] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-6 w-6 text-[#9CF0FF]" />
              <div>
                <h2 className="font-headline text-2xl font-bold text-white">Current Round Telemetry</h2>
                <p className="text-sm text-[#9FB0D0]">
                  Replaces unavailable sold-ticket winner totals with indexed round progress and claim status.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#8290AE]">
                <span>Round Progress</span>
                <span>{roundProgress.toFixed(1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#1B2741]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#00daf3_0%,#72ebff_100%)]"
                  style={{ width: `${roundProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#0B1120] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Round Status</p>
                <p className="mt-3 font-headline text-3xl font-bold text-[#DCE2F9]">{round?.status || "Unavailable"}</p>
                <p className="mt-2 text-sm text-[#9FB0D0]">VRF and reveal progress from the read model.</p>
              </div>
              <div className="rounded-2xl bg-[#0B1120] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Round Prize Budget</p>
                <p className="mt-3 font-headline text-3xl font-bold text-[#FFD66D]">
                  {formatUsdcFromMicro(round?.roundPrizeBudget ?? pool.totalPrizeBudget)} USDC
                </p>
                <p className="mt-2 text-sm text-[#9FB0D0]">Budget reserved for the current round.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Scratched Count</p>
                <p className="mt-3 font-headline text-2xl font-bold text-[#DCE2F9]">{round?.scratchedCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Claimed Count</p>
                <p className="mt-3 font-headline text-2xl font-bold text-[#DCE2F9]">{round?.claimedCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Claimable Winning Tickets</p>
                <p className="mt-3 font-headline text-2xl font-bold text-[#9CF0FF]">{round?.winClaimableCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#121B2D] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8290AE]">Round Ticket Capacity</p>
                <p className="mt-3 font-headline text-2xl font-bold text-[#DCE2F9]">
                  {round?.totalTickets ?? pool.totalTicketsPerRound}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#11192B] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-3">
                <BanknotesIcon className="h-6 w-6 text-[#FFD66D]" />
                <div>
                  <h2 className="font-headline text-2xl font-bold text-white">Creator Accounting</h2>
                  <p className="text-sm text-[#9FB0D0]">
                    All values come from pool accounting and current round state.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["Realized revenue", pool.realizedRevenue],
                  ["Settled prize cost", pool.settledPrizeCost],
                  ["Settled protocol cost", pool.settledProtocolCost],
                  ["Accrued platform fee", pool.accruedPlatformFee],
                  ["Claimable creator profit", pool.claimableCreatorProfit],
                  ["Creator profit claimed", pool.creatorProfitClaimed],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-[#0B1120] px-4 py-3">
                    <span className="text-sm text-[#9FB0D0]">{label}</span>
                    <span className="font-headline text-lg font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(value as number)} USDC
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#11192B] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-3">
                <CircleStackIcon className="h-6 w-6 text-[#CABEFF]" />
                <div>
                  <h2 className="font-headline text-2xl font-bold text-white">Liability Snapshot</h2>
                  <p className="text-sm text-[#9FB0D0]">
                    Useful for creators tracking rollover readiness and reserved funds.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["Locked bond", pool.lockedBond],
                  ["Reserved prize budget", pool.reservedPrizeBudget],
                  ["Locked next round budget", pool.lockedNextRoundBudget],
                  ["Round ticket price", round?.ticketPrice ?? pool.ticketPrice],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#121B2D] px-4 py-3"
                  >
                    <span className="text-sm text-[#9FB0D0]">{label}</span>
                    <span className="font-headline text-lg font-bold text-[#DCE2F9]">
                      {formatUsdcFromMicro(value as number)} USDC
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
