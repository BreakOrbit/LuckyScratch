"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { BanknotesIcon, LockClosedIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdcFromMicro, toMicroUsdc } from "~~/services/luckyScratch/poolMath";
import { notification } from "~~/utils/scaffold-eth";

const MAX_MINT_USDC = 1_000_000;
const DEFAULT_MINT_USDC = 1_000;
const OPERATOR_VALIDITY_SECONDS = 60 * 60 * 24 * 365;

const getOperatorExpiry = () => Math.floor(Date.now() / 1000) + OPERATOR_VALIDITY_SECONDS;

const clampMintAmount = (value: number) => Math.min(MAX_MINT_USDC, Math.max(1, Math.floor(value || 1)));

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Transaction failed.";
};

export function CusdcFaucetPage() {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { data: cusdcContract } = useDeployedContractInfo({ contractName: "CUSDCToken" });
  const { data: underlyingContract } = useDeployedContractInfo({ contractName: "CUSDCUnderlyingToken" });
  const { data: treasuryContract } = useDeployedContractInfo({ contractName: "LuckyScratchTreasury" });
  const { writeContractAsync: writeUnderlyingAsync, isMining: isUnderlyingMining } = useScaffoldWriteContract({
    contractName: "CUSDCUnderlyingToken",
  });
  const { writeContractAsync: writeCusdcAsync, isMining: isCusdcMining } = useScaffoldWriteContract({
    contractName: "CUSDCToken",
  });

  const [amountUsdc, setAmountUsdc] = useState(DEFAULT_MINT_USDC);
  const [stage, setStage] = useState<string>("");

  const amountMicro = useMemo(() => BigInt(toMicroUsdc(clampMintAmount(amountUsdc))), [amountUsdc]);
  const isSepolia = chainId === 11155111;
  const contractsReady = Boolean(address && cusdcContract?.address && underlyingContract?.address);
  const canUseFaucet = contractsReady && isSepolia;

  const { data: underlyingBalance } = useScaffoldReadContract({
    contractName: "CUSDCUnderlyingToken",
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && underlyingContract?.address),
    },
  });
  const { data: wrapAllowance } = useScaffoldReadContract({
    contractName: "CUSDCUnderlyingToken",
    functionName: "allowance",
    args: [address, cusdcContract?.address],
    query: {
      enabled: Boolean(address && underlyingContract?.address && cusdcContract?.address),
    },
  });
  const { data: confidentialBalanceHandle } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "confidentialBalanceOf",
    args: [address],
    query: {
      enabled: Boolean(address && cusdcContract?.address),
    },
  });
  const { data: treasuryIsOperator } = useScaffoldReadContract({
    contractName: "CUSDCToken",
    functionName: "isOperator",
    args: [address, treasuryContract?.address],
    query: {
      enabled: Boolean(address && cusdcContract?.address && treasuryContract?.address),
    },
  });

  const allowanceReady = typeof wrapAllowance === "bigint" && wrapAllowance >= amountMicro;
  const isBusy = isUnderlyingMining || isCusdcMining || Boolean(stage);

  const invalidateReads = async () => {
    await queryClient.invalidateQueries({ queryKey: ["readContract"] });
  };

  const handleMintUnderlying = async () => {
    if (!address || !canUseFaucet) {
      notification.error("Connect a Sepolia wallet before minting.");
      return;
    }

    try {
      setStage("Minting testnet USDC...");
      await writeUnderlyingAsync({
        functionName: "mint",
        args: [address, amountMicro],
      });
      await invalidateReads();
      notification.success("Underlying mock USDC minted.");
    } catch (error) {
      notification.error(toErrorMessage(error));
    } finally {
      setStage("");
    }
  };

  const handleApproveWrapper = async () => {
    if (!cusdcContract?.address || !canUseFaucet) {
      notification.error("cUSDC wrapper metadata is unavailable.");
      return;
    }

    try {
      setStage("Approving wrapper...");
      await writeUnderlyingAsync({
        functionName: "approve",
        args: [cusdcContract.address, amountMicro],
      });
      await invalidateReads();
      notification.success("Wrapper approval completed.");
    } catch (error) {
      notification.error(toErrorMessage(error));
    } finally {
      setStage("");
    }
  };

  const handleWrap = async () => {
    if (!address || !canUseFaucet) {
      notification.error("Connect a Sepolia wallet before wrapping.");
      return;
    }
    if (!allowanceReady) {
      notification.error("Approve the wrapper before wrapping.");
      return;
    }

    try {
      setStage("Wrapping into confidential cUSDC...");
      await writeCusdcAsync({
        functionName: "wrap",
        args: [address, amountMicro],
      });
      await invalidateReads();
      notification.success("Confidential cUSDC minted.");
    } catch (error) {
      notification.error(toErrorMessage(error));
    } finally {
      setStage("");
    }
  };

  const handleMintApproveWrap = async () => {
    if (!address || !canUseFaucet) {
      notification.error("Connect a Sepolia wallet before using the faucet.");
      return;
    }
    if (!cusdcContract?.address) {
      notification.error("cUSDC wrapper metadata is unavailable.");
      return;
    }

    try {
      setStage("Minting testnet USDC...");
      await writeUnderlyingAsync({
        functionName: "mint",
        args: [address, amountMicro],
      });

      if (!allowanceReady) {
        setStage("Approving wrapper...");
        await writeUnderlyingAsync({
          functionName: "approve",
          args: [cusdcContract.address, amountMicro],
        });
      }

      setStage("Wrapping into confidential cUSDC...");
      await writeCusdcAsync({
        functionName: "wrap",
        args: [address, amountMicro],
      });
      await invalidateReads();
      notification.success("cUSDC faucet flow completed.");
    } catch (error) {
      notification.error(toErrorMessage(error));
    } finally {
      setStage("");
    }
  };

  const handleAuthorizeTreasury = async () => {
    if (!treasuryContract?.address || !address) {
      notification.error("LuckyScratchTreasury metadata is unavailable.");
      return;
    }

    try {
      setStage("Authorizing Treasury operator...");
      await writeCusdcAsync({
        functionName: "setOperator",
        args: [treasuryContract.address, getOperatorExpiry()],
      });
      await invalidateReads();
      notification.success("Treasury operator authorization completed.");
    } catch (error) {
      notification.error(toErrorMessage(error));
    } finally {
      setStage("");
    }
  };

  return (
    <main className="min-h-screen bg-[#0C1323] text-[#DCE2F9]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 md:px-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9CF0FF]">Sepolia cUSDC Faucet</p>
            <h1 className="mt-3 font-headline text-4xl font-black tracking-tight text-white md:text-5xl">
              Mint confidential cUSDC
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9FB0D0]">
              Mint the public mock USDC, wrap it into Zama confidential cUSDC, then authorize LuckyScratchTreasury for
              purchases and creator bonds.
            </p>
          </div>
          <Link
            href="/store"
            className="inline-flex items-center justify-center rounded-2xl border border-[#FFD700]/25 bg-[#141B2E] px-5 py-3 text-sm font-bold text-[#FFD700] transition hover:bg-[#1B243A]"
          >
            Go to Store
          </Link>
        </header>

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          {[
            {
              label: "Network",
              value: isSepolia ? "Sepolia" : "Switch to Sepolia",
              icon: ShieldCheckIcon,
            },
            {
              label: "Underlying USDC",
              value: underlyingBalance == null ? "--" : `${formatUsdcFromMicro(underlyingBalance)} USDC`,
              icon: BanknotesIcon,
            },
            {
              label: "cUSDC Balance",
              value: confidentialBalanceHandle ? "Encrypted" : "--",
              icon: LockClosedIcon,
            },
            {
              label: "Treasury Operator",
              value: treasuryIsOperator ? "Authorized" : "Not authorized",
              icon: SparklesIcon,
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#11192B] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#8290AE]">{item.label}</span>
                  <Icon className="h-5 w-5 text-[#FFD700]" />
                </div>
                <div className="font-headline text-2xl font-bold text-white">{item.value}</div>
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-[#11192B] p-6">
            <h2 className="font-headline text-2xl font-bold text-white">Amount</h2>
            <div className="mt-5 flex flex-col gap-4 md:flex-row">
              <label className="flex-1">
                <span className="mb-2 block text-sm font-medium text-[#D0C6AB]">USDC to wrap</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_MINT_USDC}
                  step={1}
                  value={amountUsdc}
                  onChange={event => setAmountUsdc(clampMintAmount(Number(event.target.value)))}
                  className="w-full rounded-2xl border border-white/10 bg-[#0B1120] px-4 py-3 text-sm text-[#DCE2F9] outline-none transition focus:border-[#FFD700]/35"
                />
              </label>
              <div className="rounded-2xl bg-[#0B1120] px-5 py-4 md:w-56">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8290AE]">Mint Limit</div>
                <div className="mt-2 font-headline text-xl font-bold text-[#FFD700]">
                  {MAX_MINT_USDC.toLocaleString()} / call
                </div>
              </div>
            </div>

            {stage ? (
              <div className="mt-5 rounded-2xl border border-[#4A587B] bg-[#10192D] px-4 py-3 text-sm text-[#9CF0FF]">
                {stage}
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <button
                type="button"
                disabled={!canUseFaucet || isBusy}
                onClick={handleMintUnderlying}
                className="rounded-2xl bg-[#25314E] px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:bg-[#2D3A5B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mint USDC
              </button>
              <button
                type="button"
                disabled={!canUseFaucet || isBusy || allowanceReady}
                onClick={handleApproveWrapper}
                className="rounded-2xl bg-[#25314E] px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:bg-[#2D3A5B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allowanceReady ? "Wrapper Approved" : "Approve Wrapper"}
              </button>
              <button
                type="button"
                disabled={!canUseFaucet || isBusy || !allowanceReady}
                onClick={handleWrap}
                className="rounded-2xl bg-[#25314E] px-4 py-3 text-sm font-bold text-[#DCE2F9] transition hover:bg-[#2D3A5B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Wrap cUSDC
              </button>
            </div>

            <button
              type="button"
              disabled={!canUseFaucet || isBusy}
              onClick={handleMintApproveWrap}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ffd700_0%,#e9c400_60%,#ffe16d_100%)] px-5 py-4 font-headline text-lg font-bold text-[#705E00] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mint and Wrap
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11192B] p-6">
            <h2 className="font-headline text-2xl font-bold text-white">LuckyScratch Authorization</h2>
            <p className="mt-3 text-sm leading-7 text-[#9FB0D0]">
              Purchases and creator bonds use `confidentialTransferFrom`, so Treasury needs operator permission on your
              cUSDC balance.
            </p>
            <div className="mt-5 rounded-2xl bg-[#0B1120] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8290AE]">Treasury</div>
              <div className="mt-2 break-all font-mono text-sm text-[#DCE2F9]">
                {treasuryContract?.address ?? "Unavailable"}
              </div>
            </div>
            <button
              type="button"
              disabled={!address || !treasuryContract?.address || isBusy || treasuryIsOperator === true}
              onClick={handleAuthorizeTreasury}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[#00DAF3]/25 bg-[#0F2031] px-5 py-4 text-sm font-bold text-[#9CF0FF] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {treasuryIsOperator ? "Treasury Authorized" : "Authorize Treasury"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
