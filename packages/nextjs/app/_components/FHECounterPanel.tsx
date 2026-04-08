"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { toHex, zeroHash } from "viem";
import { hardhat, sepolia } from "viem/chains";
import { useAccount, useWalletClient } from "wagmi";
import { ArrowDownIcon, ArrowUpIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import {
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type BrowserFhevmInstance = {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string,
  ) => {
    add32: (
      value: number | bigint,
    ) => BrowserFhevmInstance["createEncryptedInput"] extends (...args: any[]) => infer T ? T : never;
    encrypt: () => Promise<{
      handles: Uint8Array[];
      inputProof: Uint8Array;
    }>;
  };
  generateKeypair: () => {
    privateKey: string;
    publicKey: string;
  };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number,
  ) => {
    domain: Record<string, unknown>;
    message: Record<string, unknown>;
    types: {
      UserDecryptRequestVerification: readonly Record<string, unknown>[];
    };
  };
  userDecrypt: (
    handleContractPairs: {
      handle: string;
      contractAddress: string;
    }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number,
  ) => Promise<Record<string, bigint | number | string>>;
};

const LOCALHOST_COMMANDS = [
  "yarn chain",
  "yarn deploy --tags FHECounter --network localhost",
  "yarn workspace @se-2/hardhat hardhat --network localhost task:increment --value 1",
  "yarn workspace @se-2/hardhat hardhat --network localhost task:decrypt-count",
];

export const FHECounterPanel = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { targetNetwork } = useTargetNetwork();
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "FHECounter" });
  const {
    data: encryptedCount,
    refetch: refetchEncryptedCount,
    isFetching: isReadingEncryptedCount,
  } = useScaffoldReadContract({
    contractName: "FHECounter",
    functionName: "getCount",
    watch: true,
    query: {
      enabled: Boolean(deployedContractData),
    },
  });
  const { writeContractAsync, isMining, isPending } = useScaffoldWriteContract({
    contractName: "FHECounter",
  });

  const [fhevmInstance, setFhevmInstance] = useState<BrowserFhevmInstance | null>(null);
  const [sdkState, setSdkState] = useState<"idle" | "loading" | "ready" | "unsupported">("idle");
  const [sdkMessage, setSdkMessage] = useState("");
  const [amount, setAmount] = useState("1");
  const [clearCount, setClearCount] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (targetNetwork.id !== sepolia.id) {
        setFhevmInstance(null);
        setSdkState(targetNetwork.id === hardhat.id ? "unsupported" : "idle");
        setSdkMessage(
          targetNetwork.id === hardhat.id
            ? "Hardhat local mock mode does not expose a browser relayer URL, so browser-side FHE encryption/decryption is unavailable."
            : "Switch to Sepolia to use browser-side FHE encryption and user decryption.",
        );
        return;
      }

      if (typeof window === "undefined" || !("ethereum" in window) || !window.ethereum) {
        setFhevmInstance(null);
        setSdkState("unsupported");
        setSdkMessage("An injected wallet provider is required to initialize the Zama relayer SDK in the browser.");
        return;
      }

      try {
        setSdkState("loading");
        setSdkMessage("Loading Zama relayer SDK...");

        const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");

        await initSDK();

        if (cancelled) {
          return;
        }

        const instance = (await createInstance({
          ...SepoliaConfig,
          network: window.ethereum,
        })) as BrowserFhevmInstance;

        if (cancelled) {
          return;
        }

        setFhevmInstance(instance);
        setSdkState("ready");
        setSdkMessage("Relayer SDK ready.");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setFhevmInstance(null);
        setSdkState("unsupported");
        setSdkMessage(getParsedError(error));
      }
    };

    void setup();

    return () => {
      cancelled = true;
    };
  }, [targetNetwork.id]);

  const submitEncryptedChange = async (functionName: "increment" | "decrement") => {
    if (!fhevmInstance || !connectedAddress || !deployedContractData) {
      notification.error("FHEVM SDK or contract deployment is not ready.");
      return;
    }

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      notification.error("Enter a positive integer.");
      return;
    }

    try {
      const encryptedInput = await fhevmInstance
        .createEncryptedInput(deployedContractData.address, connectedAddress)
        .add32(parsedAmount)
        .encrypt();

      await writeContractAsync({
        functionName,
        args: [toHex(encryptedInput.handles[0]), toHex(encryptedInput.inputProof)],
      } as never);

      setClearCount(null);
      await refetchEncryptedCount();
      notification.success(`${functionName}(${parsedAmount}) submitted.`);
    } catch (error) {
      notification.error(getParsedError(error));
    }
  };

  const decryptCount = async () => {
    if (!fhevmInstance || !walletClient || !connectedAddress || !deployedContractData) {
      notification.error("Wallet, SDK, or contract deployment is not ready.");
      return;
    }

    if (!encryptedCount || encryptedCount === zeroHash) {
      setClearCount("0");
      return;
    }

    try {
      setIsDecrypting(true);

      const keypair = fhevmInstance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 10;
      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        [deployedContractData.address],
        startTimestamp,
        durationDays,
      );

      const signature = await walletClient.signTypedData({
        account: connectedAddress,
        domain: eip712.domain as never,
        types: {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification as never,
        },
        primaryType: "UserDecryptRequestVerification",
        message: eip712.message as never,
      });

      const result = await fhevmInstance.userDecrypt(
        [
          {
            handle: encryptedCount,
            contractAddress: deployedContractData.address,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        [deployedContractData.address],
        connectedAddress,
        startTimestamp,
        durationDays,
      );

      setClearCount(String(result[encryptedCount]));
      notification.success("Count decrypted.");
    } catch (error) {
      notification.error(getParsedError(error));
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <section className="w-full max-w-6xl px-5 pb-14">
      <div className="rounded-[2rem] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200 shadow-xl">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="badge badge-secondary badge-outline gap-2 px-3 py-3">
                <LockClosedIcon className="h-4 w-4" />
                FHEVM Counter
              </div>
              <h2 className="text-3xl font-black tracking-tight">
                Encrypted state onchain, readable only with user decryption.
              </h2>
              <p className="max-w-2xl text-base-content/70">
                This panel uses the deployed <span className="font-semibold">FHECounter</span> contract. On Sepolia it
                can encrypt inputs in the browser and decrypt the stored result for the connected wallet. On local
                Hardhat it shows the supported workflow for mock mode.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-base-200 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">Target Network</p>
                <p className="mt-2 text-2xl font-bold">{targetNetwork.name}</p>
              </div>
              <div className="rounded-3xl bg-base-200 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">SDK Status</p>
                <p className="mt-2 text-sm font-medium">{sdkMessage || "Waiting..."}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">Connected Wallet</p>
              <div className="mt-3">
                {isConnected && connectedAddress ? (
                  <Address address={connectedAddress} chain={targetNetwork} />
                ) : (
                  <p className="text-base-content/60">Connect a wallet to interact with encrypted values.</p>
                )}
              </div>
            </div>

            {deployedContractData ? (
              <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">Contract Address</p>
                <div className="mt-3">
                  <Address address={deployedContractData.address} chain={targetNetwork} />
                </div>
              </div>
            ) : (
              <div className="alert alert-warning">
                <span>
                  No FHECounter deployment was found for {targetNetwork.name}. Deploy before using this panel.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {targetNetwork.id === hardhat.id ? (
              <div className="rounded-3xl border border-warning/30 bg-warning/10 p-6">
                <h3 className="text-xl font-bold">Local Hardhat workflow</h3>
                <p className="mt-3 text-sm text-base-content/70">
                  Zama&apos;s browser relayer flow targets networks with a relayer endpoint. Hardhat mock mode is still
                  useful, but you should drive it with the Hardhat plugin tasks below.
                </p>
                <div className="mt-5 space-y-2">
                  {LOCALHOST_COMMANDS.map(command => (
                    <pre key={command} className="overflow-x-auto rounded-2xl bg-base-300 px-4 py-3 text-xs">
                      <code>{command}</code>
                    </pre>
                  ))}
                </div>
              </div>
            ) : targetNetwork.id !== sepolia.id ? (
              <div className="alert alert-info">
                <span>Switch to Sepolia to use browser-side encrypted input generation and user decryption.</span>
              </div>
            ) : !deployedContractData ? (
              <div className="rounded-3xl border border-base-300 bg-base-100 p-6">
                <h3 className="text-xl font-bold">Sepolia deployment required</h3>
                <p className="mt-3 text-sm text-base-content/70">
                  Deploy <code>FHECounter</code> to Sepolia, then refresh this page. The browser SDK is already wired
                  for that network.
                </p>
              </div>
            ) : (
              <div className="space-y-4 rounded-3xl border border-base-300 bg-base-100 p-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">Encrypted Handle</p>
                  <p className="mt-2 break-all rounded-2xl bg-base-200 px-4 py-3 font-mono text-xs">
                    {isReadingEncryptedCount ? "Refreshing..." : encryptedCount || zeroHash}
                  </p>
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-base-content/50">Decrypted Value</p>
                  <p className="mt-2 rounded-2xl bg-base-200 px-4 py-3 text-3xl font-black">
                    {clearCount ?? "Not decrypted yet"}
                  </p>
                </div>

                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Amount</span>
                  <input
                    className="input input-bordered w-full"
                    inputMode="numeric"
                    min={1}
                    pattern="[0-9]*"
                    value={amount}
                    onChange={event => setAmount(event.target.value)}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="btn btn-secondary"
                    disabled={sdkState !== "ready" || isPending || isMining}
                    onClick={() => void submitEncryptedChange("increment")}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                    Encrypt + Increment
                  </button>
                  <button
                    className="btn btn-outline"
                    disabled={sdkState !== "ready" || isPending || isMining}
                    onClick={() => void submitEncryptedChange("decrement")}
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                    Encrypt + Decrement
                  </button>
                </div>

                <button
                  className="btn btn-primary w-full"
                  disabled={sdkState !== "ready" || isDecrypting}
                  onClick={() => void decryptCount()}
                >
                  {isDecrypting ? "Decrypting..." : "User Decrypt Count"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
