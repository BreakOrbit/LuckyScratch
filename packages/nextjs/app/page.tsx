"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <>
      <div className="flex grow flex-col items-center bg-[radial-gradient(circle_at_top,_hsl(var(--s))_0%,transparent_28%),linear-gradient(180deg,transparent,hsla(var(--b3)/0.65))] pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.45em] text-secondary">
              Zama x Scaffold-ETH 2
            </span>
            <span className="block text-4xl font-black md:text-6xl">LuckyScratch Contract Workspace</span>
          </h1>
          <div className="mt-6 flex flex-col items-center justify-center space-x-2">
            <p className="my-2 font-medium">Connected Address</p>
            <Address
              address={connectedAddress}
              chain={targetNetwork}
              blockExplorerAddressLink={
                targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
              }
            />
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-lg text-base-content/70">
            This workspace now focuses on the LuckyScratch fhEVM contract suite. Scaffold template demo contracts and
            panels have been removed so the repo only tracks the lottery pool, ticket NFT, treasury, VRF adapter, and
            their test and deployment flows.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-secondary">Contracts</p>
              <p className="mt-3 text-lg font-semibold">LuckyScratchCore / Ticket / Treasury / VRFAdapter</p>
              <p className="mt-2 text-sm text-base-content/70">
                The active onchain surface is under <code>packages/hardhat/contracts/luckyScratch</code>.
              </p>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-secondary">Validation</p>
              <p className="mt-3 text-lg font-semibold">Compile, typecheck, test</p>
              <p className="mt-2 text-sm text-base-content/70">
                Use <code>yarn compile</code>, <code>yarn hardhat:check-types</code>, and <code>yarn test</code>.
              </p>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.3em] text-secondary">Design Source</p>
              <p className="mt-3 text-lg font-semibold">Contract behavior follows the docs in `doc/`</p>
              <p className="mt-2 text-sm text-base-content/70">
                Start from the smart contract design and implementation plan documents when extending this repo.
              </p>
            </div>
          </div>
        </div>

        <div className="grow bg-base-300/80 w-full px-8 py-12 backdrop-blur">
          <div className="flex flex-col items-center justify-center gap-12 md:flex-row">
            <div className="flex max-w-xs flex-col items-center rounded-3xl bg-base-100 px-10 py-10 text-center shadow-lg">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex max-w-xs flex-col items-center rounded-3xl bg-base-100 px-10 py-10 text-center shadow-lg">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
