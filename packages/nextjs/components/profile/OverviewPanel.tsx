"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import {
  ArrowRightIcon,
  CommandLineIcon,
  CpuChipIcon,
  LockClosedIcon,
  TicketIcon,
  TrophyIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import {
  useLuckyScratchCreatorSummary,
  useLuckyScratchUserTickets,
  useLuckyScratchUserWins,
} from "~~/hooks/luckyScratch/useLuckyScratchQueries";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useFhevmRuntime } from "~~/services/fhevm/FhevmRuntimeProvider";
import { createSepoliaRelayerInstance, generateTicketKeypair } from "~~/services/fhevm/sdk";
import { formatUsdcFromMicro } from "~~/services/luckyScratch/poolMath";
import { notification } from "~~/utils/scaffold-eth";

type ActivityItem = {
  timestamp: string;
  operation: string;
  details: string;
  status: string;
};

const formatTimestamp = (value?: string) => {
  if (!value) {
    return "n/a";
  }
  return new Date(value).toLocaleString();
};

const formatClaimRate = (claimedWins: number, totalTickets: number) => {
  if (totalTickets <= 0) {
    return "0.0";
  }
  return ((claimedWins / totalTickets) * 100).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

export function OverviewPanel() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { ensureReady } = useFhevmRuntime();
  const ticketsQuery = useLuckyScratchUserTickets(address);
  const winsQuery = useLuckyScratchUserWins(address);
  const creatorSummaryQuery = useLuckyScratchCreatorSummary(address);
  const { data: paymentTokenContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const paymentBalanceQuery = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "confidentialBalanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && paymentTokenContract?.address),
    },
  });

  const [balanceStage, setBalanceStage] = useState<string>("");
  const [decryptedCusdcBalance, setDecryptedCusdcBalance] = useState<bigint | null>(null);

  const tickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data?.items]);
  const claimedWins = useMemo(() => winsQuery.data?.items ?? [], [winsQuery.data?.items]);
  const creatorSummary = creatorSummaryQuery.data;
  const confidentialBalanceHandle = paymentBalanceQuery.data;

  const canDecryptBalance = Boolean(
    address && walletClient && chainId === 11155111 && paymentTokenContract?.address && confidentialBalanceHandle,
  );

  const handleDecryptBalance = async () => {
    if (
      !address ||
      !walletClient ||
      chainId !== 11155111 ||
      !paymentTokenContract?.address ||
      !confidentialBalanceHandle
    ) {
      notification.error("Connect a Sepolia wallet with a cUSDC balance before decrypting.");
      return;
    }

    try {
      setBalanceStage("Preparing");
      await ensureReady();

      const userAddress = getAddress(address);
      const tokenAddress = getAddress(paymentTokenContract.address);
      const balanceHandle = String(confidentialBalanceHandle);
      const instance = await createSepoliaRelayerInstance({ chainId });
      const keypair = await generateTicketKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;
      const contractAddresses = [tokenAddress];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);

      setBalanceStage("Sign request");
      const signature = await walletClient.signTypedData({
        account: userAddress,
        domain: eip712.domain as any,
        types: {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        } as any,
        primaryType: "UserDecryptRequestVerification",
        message: eip712.message as any,
      });

      setBalanceStage("Decrypting");
      const result = await instance.userDecrypt(
        [{ handle: balanceHandle, contractAddress: tokenAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays,
        {
          onProgress: progress => {
            if (progress.type === "queued") {
              setBalanceStage("Queued");
            }
            if (progress.type === "throttled") {
              setBalanceStage("Retrying");
            }
          },
        },
      );
      const decryptedValue = result[balanceHandle] ?? Object.values(result)[0];
      if (decryptedValue == null) {
        throw new Error("Relayer did not return a decrypted cUSDC balance.");
      }

      setDecryptedCusdcBalance(typeof decryptedValue === "bigint" ? decryptedValue : BigInt(String(decryptedValue)));
      notification.success("cUSDC balance decrypted.");
    } catch (error) {
      notification.error(error instanceof Error && error.message ? error.message : "Balance decryption failed.");
    } finally {
      setBalanceStage("");
    }
  };

  const ticketCount = tickets.length;
  const revealedCount = tickets.filter(ticket => ticket.status !== "Unscratched").length;
  const claimedWinCount = claimedWins.length;
  const totalWinningsMicro = claimedWins.reduce((sum, ticket) => sum + ticket.claimClearRewardAmount, 0);
  const bestClaimedRewardMicro = claimedWins.reduce(
    (maxReward, ticket) => Math.max(maxReward, ticket.claimClearRewardAmount),
    0,
  );
  const claimRate = formatClaimRate(claimedWinCount, ticketCount);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const ticketEvents = tickets.map(ticket => ({
      timestamp: ticket.createdAt,
      operation: "TICKET_PURCHASED",
      details: `Ticket #${ticket.ticketId} • Pool #${ticket.poolId} • Round ${ticket.roundId}`,
      status: ticket.status.toUpperCase(),
    }));
    const claimEvents = claimedWins.map(ticket => ({
      timestamp: ticket.updatedAt,
      operation: "REWARD_CLAIMED",
      details: `+${formatUsdcFromMicro(ticket.claimClearRewardAmount)} USDC • Ticket #${ticket.ticketId}`,
      status: "CLAIMED",
    }));

    return [...claimEvents, ...ticketEvents]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 10);
  }, [claimedWins, tickets]);

  if (!address) {
    return (
      <div className="rounded-2xl border border-dashed border-ns-outline-variant/20 bg-ns-surface-container-lowest p-10 text-center">
        <p className="font-headline text-2xl font-bold text-ns-on-surface">Connect your wallet</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-ns-on-surface-variant">
          Connect your wallet to view your cUSDC balance, ticket history, wins, and creator metrics.
        </p>
        <Link
          href="/store"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ns-primary-container px-5 py-3 font-bold text-ns-on-primary"
        >
          Browse Pools
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Wallet Overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-8 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high border-t-2 border-ns-primary-container/20">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase font-bold tracking-widest text-ns-on-surface-variant">
              Available Credits
            </span>
            <WalletIcon className="w-6 h-6 text-ns-primary" />
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-4xl font-headline font-black text-ns-on-surface tracking-tighter">
              {paymentBalanceQuery.isLoading
                ? "--"
                : decryptedCusdcBalance != null
                  ? formatUsdcFromMicro(decryptedCusdcBalance, 6)
                  : confidentialBalanceHandle
                    ? "Encrypted"
                    : "--"}
            </h3>
            <span className="text-ns-primary-container font-bold text-sm">cUSDC</span>
          </div>
          <p className="text-xs text-ns-on-surface-variant mb-4">
            {paymentTokenContract?.address
              ? "Confidential balance on the current network."
              : "cUSDC metadata is not available on the current network."}
          </p>
          {confidentialBalanceHandle ? (
            <button
              type="button"
              disabled={!canDecryptBalance || Boolean(balanceStage)}
              onClick={handleDecryptBalance}
              className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ns-primary-container/30 bg-ns-surface-container-lowest py-2.5 text-xs font-bold text-ns-primary-container transition-all hover:bg-ns-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockClosedIcon className="h-4 w-4" />
              {balanceStage || (decryptedCusdcBalance == null ? "Decrypt Balance" : "Refresh Balance")}
            </button>
          ) : null}
          <Link
            href="/faucet"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ns-primary-container py-3 text-sm font-bold text-ns-on-primary transition-all hover:brightness-110 active:scale-95 shadow-[0_4px_15px_rgba(255,215,0,0.15)]"
          >
            GET cUSDC
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-xl p-8 bg-gradient-to-br from-ns-surface-container to-ns-surface-container-high">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase font-bold tracking-widest text-ns-on-surface-variant">
              Total Winnings
            </span>
            <TrophyIcon className="w-6 h-6 text-ns-secondary" />
          </div>
          <div className="flex items-baseline gap-3 mb-6">
            <h3 className="text-4xl font-headline font-black text-ns-on-surface tracking-tighter">
              {winsQuery.isLoading ? "--" : formatUsdcFromMicro(totalWinningsMicro)}
            </h3>
            <span className="text-ns-secondary font-bold text-sm">USDC</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-ns-surface-container-lowest rounded-full overflow-hidden">
              <div
                className="h-full bg-ns-secondary rounded-full"
                style={{ width: `${Math.min(100, Number(claimRate))}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-ns-secondary">{claimRate}% claimed</span>
          </div>
          <p className="mt-3 text-xs text-ns-on-surface-variant">
            Based on indexed claimed wins only. Unclaimed scratched winners are not included.
          </p>
        </div>
      </section>

      {/* Section 2: Gaming Performance */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-ns-outline-variant/30"></div>
          <h4 className="font-headline font-bold text-xs uppercase tracking-widest text-ns-on-surface-variant">
            Performance Matrix
          </h4>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-ns-outline-variant/30"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2">Purchased</div>
            <div className="text-2xl font-headline font-bold">
              {ticketsQuery.isLoading ? "--" : ticketCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">TIX</span>
            </div>
          </div>
          <div className="border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2 text-ns-primary">
              Revealed
            </div>
            <div className="text-2xl font-headline font-bold text-ns-primary">
              {ticketsQuery.isLoading ? "--" : revealedCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">TIX</span>
            </div>
          </div>
          <div className="border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2 text-ns-tertiary">
              Claimed Wins
            </div>
            <div className="text-2xl font-headline font-bold text-ns-tertiary">
              {winsQuery.isLoading ? "--" : claimedWinCount}{" "}
              <span className="text-xs text-ns-on-surface-variant">CLAIMS</span>
            </div>
          </div>
          <div className="border border-ns-outline-variant/10 rounded-xl p-5 hover:bg-ns-surface-container-highest transition-colors">
            <div className="text-[10px] text-ns-on-surface-variant uppercase font-semibold mb-2 text-ns-primary-container">
              Best Claimed
            </div>
            <div className="text-2xl font-headline font-bold text-ns-primary-container">
              {winsQuery.isLoading ? "--" : formatUsdcFromMicro(bestClaimedRewardMicro)}{" "}
              <span className="text-xs text-ns-on-surface-variant">USDC</span>
            </div>
            <div className="text-[10px] text-ns-primary-container/80 mt-1 font-semibold">Highest settled reward</div>
          </div>
        </div>
      </section>

      {/* Section 3: Creator Terminal */}
      <section className="relative">
        <div className="glass-panel rounded-xl p-8 border border-ns-tertiary/20 overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <CommandLineIcon className="w-24 h-24 text-ns-tertiary opacity-10" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <CpuChipIcon className="w-6 h-6 text-ns-tertiary" />
              <h4 className="font-headline text-lg font-bold">CREATOR_TERMINAL_V1.2</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Active Pools</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.activePools ?? 0)}
                </div>
                <div className="text-[10px] text-ns-tertiary font-mono">
                  STATUS: {(creatorSummary?.activePools ?? 0) > 0 ? "ONLINE" : "IDLE"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Sales Amount</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalRealizedRevenue)}{" "}
                  <span className="text-sm">USDC</span>
                </div>
                <div className="text-[10px] text-ns-tertiary font-mono">INDEXED_REVENUE: LIVE</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Tickets Sold</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.currentRoundSoldCount ?? 0)}/
                  {creatorSummaryQuery.isLoading ? "--" : (creatorSummary?.currentRoundTotalTickets ?? 0)}
                </div>
                <div className="w-full bg-ns-surface-container-lowest h-1.5 rounded-full mt-2">
                  <div
                    className="bg-ns-tertiary h-full rounded-full"
                    style={{
                      width: `${
                        creatorSummary && creatorSummary.currentRoundTotalTickets > 0
                          ? (creatorSummary.currentRoundSoldCount / creatorSummary.currentRoundTotalTickets) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-ns-on-surface-variant uppercase tracking-widest">Claimable Profit</div>
                <div className="text-3xl font-headline font-bold text-ns-on-surface">
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalClaimableProfit)}{" "}
                  <span className="text-sm">USDC</span>
                </div>
                <div className="text-[10px] text-ns-tertiary font-mono">
                  LOCKED_BOND:{" "}
                  {creatorSummaryQuery.isLoading ? "--" : formatUsdcFromMicro(creatorSummary?.totalLockedBond)}U
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-ns-outline-variant/10 flex justify-end">
              <Link
                href="/create-pool"
                className="text-xs font-bold text-ns-tertiary flex items-center gap-2 hover:underline"
              >
                LAUNCH POOL CREATOR
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Activity Logs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ns-primary-container animate-pulse"></span>
            Live Activity Logs
          </h4>
          <span className="text-[10px] font-mono text-ns-on-surface-variant">SOURCE: TICKETS + WINS</span>
        </div>
        <div className="bg-ns-surface-container-lowest rounded-xl border border-ns-outline-variant/10 h-64 overflow-y-auto scroll-smooth font-mono text-xs">
          {ticketsQuery.isLoading || winsQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-ns-on-surface-variant">
              Loading activity...
            </div>
          ) : activityItems.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-ns-surface-container-lowest border-b border-ns-outline-variant/20">
                <tr>
                  <th className="p-3 text-ns-on-surface-variant font-medium">TIMESTAMP</th>
                  <th className="p-3 text-ns-on-surface-variant font-medium">OPERATION</th>
                  <th className="p-3 text-ns-on-surface-variant font-medium">DETAILS</th>
                  <th className="p-3 text-ns-on-surface-variant font-medium text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ns-outline-variant/5">
                {activityItems.map(item => (
                  <tr
                    key={`${item.operation}-${item.timestamp}-${item.details}`}
                    className="hover:bg-ns-surface-container/50 transition-colors"
                  >
                    <td className="p-3 text-ns-on-surface-variant">{formatTimestamp(item.timestamp)}</td>
                    <td className="p-3 font-semibold text-ns-primary">{item.operation}</td>
                    <td className="p-3">{item.details}</td>
                    <td className="p-3 text-right text-ns-tertiary">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <TicketIcon className="mb-4 h-12 w-12 text-ns-on-surface-variant/30" />
              <p className="font-headline text-lg font-bold text-ns-on-surface">No indexed activity yet</p>
              <p className="mt-2 max-w-lg text-sm text-ns-on-surface-variant">
                Purchase or claim a ticket first. Once the backend indexes those events, this table will fill with live
                activity.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
