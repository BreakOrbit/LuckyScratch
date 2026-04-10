import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { BigNumberish } from "ethers";
import { ethers, fhevm } from "hardhat";
import { KMSVerifier } from "../../node_modules/@fhevm/mock-utils/_cjs/fhevm/contracts/KMSVerifier.js";
import {
  LuckyScratchCore,
  LuckyScratchCore__factory,
  LuckyScratchTicket,
  LuckyScratchTicket__factory,
  LuckyScratchTreasury,
  LuckyScratchTreasury__factory,
  LuckyScratchVRFAdapter,
  LuckyScratchVRFAdapter__factory,
  TestUSDC,
  TestUSDC__factory,
} from "../../typechain-types";

export const UNIT = 1_000_000n;
export const POOL_ID = 1n;
export const ROUND_ID = 1n;
export const DEFAULT_TICKET_PRICE = 10n * UNIT;
export const DEFAULT_TOTAL_TICKETS = 10;
export const DEFAULT_TOTAL_PRIZE_BUDGET = 50n * UNIT;
export const DEFAULT_PLATFORM_FEE_BPS = 800;
export const DEFAULT_TARGET_RTP_BPS = 5000;
export const DEFAULT_HIT_RATE_BPS = 4000;
export const DEFAULT_MAX_PRIZE = 15n * UNIT;
const MOCK_KMS_PRIVATE_KEY = "388b7680e4e1afa06efbfd45cdd1fe39f3c6af381df6555a19661f283b97de91";
export const GASLESS_TYPES: Record<string, { name: string; type: string }[]> = {
  GaslessRequest: [
    { name: "user", type: "address" },
    { name: "action", type: "uint8" },
    { name: "targetContract", type: "address" },
    { name: "paramsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "chainId", type: "uint256" },
  ],
};

export const GaslessAction = {
  Purchase: 0,
  PurchaseSelection: 1,
  Scratch: 2,
  BatchScratch: 3,
} as const;

export type Signers = {
  admin: HardhatEthersSigner;
  creator: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  relayer: HardhatEthersSigner;
};

export type DeployedLuckyScratch = Signers & {
  token: TestUSDC;
  ticket: LuckyScratchTicket;
  treasury: LuckyScratchTreasury;
  vrfAdapter: LuckyScratchVRFAdapter;
  core: LuckyScratchCore;
};

export type PoolConfigInput = {
  mode: BigNumberish;
  creator: string;
  protocolOwned: boolean;
  poolInstanceGroupSize: BigNumberish;
  ticketPrice: BigNumberish;
  totalTicketsPerRound: BigNumberish;
  totalPrizeBudget: BigNumberish;
  feeBps: BigNumberish;
  targetRtpBps: BigNumberish;
  hitRateBps: BigNumberish;
  maxPrize: BigNumberish;
  themeId: string;
  selectable: boolean;
};

export type PrizeTierInput = {
  prizeAmount: BigNumberish;
  count: BigNumberish;
};

export function buildPoolConfig(overrides: Partial<PoolConfigInput> = {}): PoolConfigInput {
  return {
    mode: overrides.mode ?? 0,
    creator: overrides.creator ?? ethers.ZeroAddress,
    protocolOwned: overrides.protocolOwned ?? false,
    poolInstanceGroupSize: overrides.poolInstanceGroupSize ?? 1,
    ticketPrice: overrides.ticketPrice ?? DEFAULT_TICKET_PRICE,
    totalTicketsPerRound: overrides.totalTicketsPerRound ?? DEFAULT_TOTAL_TICKETS,
    totalPrizeBudget: overrides.totalPrizeBudget ?? DEFAULT_TOTAL_PRIZE_BUDGET,
    feeBps: overrides.feeBps ?? DEFAULT_PLATFORM_FEE_BPS,
    targetRtpBps: overrides.targetRtpBps ?? DEFAULT_TARGET_RTP_BPS,
    hitRateBps: overrides.hitRateBps ?? DEFAULT_HIT_RATE_BPS,
    maxPrize: overrides.maxPrize ?? DEFAULT_MAX_PRIZE,
    themeId: overrides.themeId ?? ethers.id("lucky-scratch-test"),
    selectable: overrides.selectable ?? true,
  };
}

export function buildPrizeTiers(): PrizeTierInput[] {
  return [
    { prizeAmount: 15n * UNIT, count: 2 },
    { prizeAmount: 10n * UNIT, count: 2 },
    { prizeAmount: 0n, count: 6 },
  ];
}

function toBigInt(value: BigNumberish): bigint {
  return typeof value === "bigint" ? value : BigInt(value.toString());
}

export function computeBondRequirement(totalPrizeBudget: BigNumberish): bigint {
  const budget = toBigInt(totalPrizeBudget);
  if (budget <= 200n) {
    return budget + (budget * 2n) / 10n;
  }
  if (budget <= 500n) {
    return budget + (budget * 15n) / 100n;
  }
  return budget + budget / 10n;
}

export async function getCurrentRoundState(deployed: DeployedLuckyScratch, poolId = POOL_ID) {
  const state = await deployed.core.poolStates(poolId);
  const round = await deployed.core.roundStates(poolId, state.currentRound);
  return { state, round };
}

export async function deployLuckyScratchFixture(): Promise<DeployedLuckyScratch> {
  const [admin, creator, alice, bob, relayer] = await ethers.getSigners();

  const tokenFactory = (await ethers.getContractFactory("TestUSDC")) as TestUSDC__factory;
  const ticketFactory = (await ethers.getContractFactory("LuckyScratchTicket")) as LuckyScratchTicket__factory;
  const treasuryFactory = (await ethers.getContractFactory("LuckyScratchTreasury")) as LuckyScratchTreasury__factory;
  const vrfFactory = (await ethers.getContractFactory("LuckyScratchVRFAdapter")) as LuckyScratchVRFAdapter__factory;
  const coreFactory = (await ethers.getContractFactory("LuckyScratchCore")) as LuckyScratchCore__factory;

  const token = await tokenFactory.deploy(admin.address);
  const ticket = await ticketFactory.deploy(admin.address);
  const treasury = await treasuryFactory.deploy(admin.address, await token.getAddress());
  const vrfAdapter = await vrfFactory.deploy(admin.address);
  const core = await coreFactory.deploy(admin.address);

  await ticket.connect(admin).setCore(await core.getAddress());
  await treasury.connect(admin).setCore(await core.getAddress());
  await vrfAdapter.connect(admin).setCore(await core.getAddress());

  await core.connect(admin).setTicket(await ticket.getAddress());
  await core.connect(admin).setTreasury(await treasury.getAddress());
  await core.connect(admin).setVrfAdapter(await vrfAdapter.getAddress());
  await core.connect(admin).setRelayer(relayer.address, true);

  const largeMint = 1_000_000n * UNIT;
  await token.connect(admin).mint(creator.address, largeMint);
  await token.connect(admin).mint(alice.address, largeMint);
  await token.connect(admin).mint(bob.address, largeMint);

  return { admin, creator, alice, bob, relayer, token, ticket, treasury, vrfAdapter, core };
}

export async function createPool(deployed: DeployedLuckyScratch, overrides: Partial<PoolConfigInput> = {}) {
  const config = buildPoolConfig({ ...overrides, creator: deployed.creator.address });
  const tiers = buildPrizeTiers();
  const bondRequirement = computeBondRequirement(config.totalPrizeBudget);

  await deployed.token.connect(deployed.creator).approve(await deployed.treasury.getAddress(), bondRequirement);
  await deployed.core.connect(deployed.creator).createPool(config, tiers);

  return { config, tiers };
}

export async function fulfillRound(deployed: DeployedLuckyScratch, roundId = ROUND_ID, randomWord = 777n) {
  const round = await deployed.core.roundStates(POOL_ID, roundId);
  await deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(round.vrfRequestRef, randomWord);
}

export async function approveAndPurchase(
  deployed: DeployedLuckyScratch,
  buyer: HardhatEthersSigner,
  quantity: number | bigint,
) {
  const { round } = await getCurrentRoundState(deployed);
  const ticketPrice = round.ticketPrice;
  await deployed.token.connect(buyer).approve(await deployed.treasury.getAddress(), ticketPrice * BigInt(quantity));
  const tx = await deployed.core.connect(buyer).purchaseTickets(POOL_ID, quantity);
  const receipt = await tx.wait();

  return extractTicketIds(deployed.core, receipt!.logs);
}

export async function approveAndPurchaseSelection(
  deployed: DeployedLuckyScratch,
  buyer: HardhatEthersSigner,
  indexes: number[],
) {
  const { round } = await getCurrentRoundState(deployed);
  const ticketPrice = round.ticketPrice;
  await deployed.token
    .connect(buyer)
    .approve(await deployed.treasury.getAddress(), ticketPrice * BigInt(indexes.length));
  const tx = await deployed.core.connect(buyer).purchaseTicketsWithSelection(POOL_ID, indexes);
  const receipt = await tx.wait();

  return extractTicketIds(deployed.core, receipt!.logs);
}

export async function scratchAndDecrypt(deployed: DeployedLuckyScratch, user: HardhatEthersSigner, ticketId: bigint) {
  await deployed.core.connect(user).scratchTicket(ticketId);
  const handle = await deployed.core.getTicketPrizeHandle(ticketId);
  const clearReward = await fhevm.userDecryptEuint(FhevmType.euint64, handle, await deployed.core.getAddress(), user);

  return { handle, clearReward };
}

export async function buildClaimProof(deployed: DeployedLuckyScratch, ticketId: bigint) {
  const handle = await deployed.core.getTicketPrizeHandle(ticketId);
  const clearReward = await fhevm.debugger.decryptEuint(FhevmType.euint64, handle);
  const coprocessorConfig = await fhevm.getCoprocessorConfig(await deployed.core.getAddress());
  const kmsSigner = new ethers.Wallet(MOCK_KMS_PRIVATE_KEY, ethers.provider);
  const kmsVerifier = await KMSVerifier.create(ethers.provider, coprocessorConfig.KMSVerifierAddress, undefined, {
    signers: [kmsSigner],
  });
  const result = await kmsVerifier.computeDecryptionSignatures([handle], [clearReward], "0x00");

  return { handle, clearReward, decryptionProof: result.decryptionProof };
}

export async function buildWinningClaims(deployed: DeployedLuckyScratch, ticketIds: bigint[]) {
  const claims: { ticketId: bigint; amount: bigint; proof: string }[] = [];

  for (const ticketId of ticketIds) {
    const claim = await buildClaimProof(deployed, ticketId);
    if (claim.clearReward > 0n) {
      claims.push({ ticketId, amount: claim.clearReward, proof: claim.decryptionProof });
    }
  }

  return claims;
}

export async function findTicketByReward(
  deployed: DeployedLuckyScratch,
  user: HardhatEthersSigner,
  ticketIds: bigint[],
  predicate: (reward: bigint) => boolean,
) {
  for (const ticketId of ticketIds) {
    const { clearReward } = await scratchAndDecrypt(deployed, user, ticketId);
    if (predicate(clearReward)) {
      return ticketId;
    }
  }

  throw new Error("No matching ticket found");
}

export async function signGaslessRequest(
  signer: HardhatEthersSigner,
  core: LuckyScratchCore,
  request: {
    user: string;
    action: number;
    targetContract: string;
    paramsHash: string;
    nonce: bigint;
    deadline: bigint;
    chainId: bigint;
  },
) {
  return signer.signTypedData(
    {
      name: "LuckyScratch",
      version: "1",
      chainId: Number(request.chainId),
      verifyingContract: await core.getAddress(),
    },
    GASLESS_TYPES,
    request,
  );
}

export function hashPurchaseParams(poolId: bigint, quantity: number) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint256", "uint32"],
      [GaslessAction.Purchase, poolId, quantity],
    ),
  );
}

export function hashScratchParams(ticketId: bigint) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint256"], [GaslessAction.Scratch, ticketId]),
  );
}

export function hashBatchScratchParams(ticketIds: bigint[]) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "uint256[]"], [GaslessAction.BatchScratch, ticketIds]),
  );
}

export function extractTicketIds(core: LuckyScratchCore, logs: readonly unknown[]) {
  const ticketIds: bigint[] = [];

  for (const log of logs) {
    if (!log || typeof log !== "object" || !("topics" in log)) continue;
    try {
      const parsed = core.interface.parseLog(log as Parameters<typeof core.interface.parseLog>[0]);
      if (parsed?.name === "TicketPurchased") {
        ticketIds.push(parsed.args.ticketId);
      }
    } catch {
      // ignore unrelated logs
    }
  }

  return ticketIds;
}
