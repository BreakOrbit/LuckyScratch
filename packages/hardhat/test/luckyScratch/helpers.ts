import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { BigNumberish } from "ethers";
import { ethers, fhevm } from "hardhat";
import {
  LuckyScratchCore,
  LuckyScratchCore__factory,
  LuckyScratchTicket,
  LuckyScratchTicket__factory,
  LuckyScratchTreasury,
  LuckyScratchTreasury__factory,
  LuckyScratchVRFAdapter,
  LuckyScratchVRFAdapter__factory,
  TestConfidentialUSDC,
  TestConfidentialUSDC__factory,
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

export type Signers = {
  admin: HardhatEthersSigner;
  creator: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

export type DeployedLuckyScratch = Signers & {
  token: TestConfidentialUSDC;
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
  if (budget <= 200n * UNIT) {
    return budget + (budget * 2n) / 10n;
  }
  if (budget <= 500n * UNIT) {
    return budget + (budget * 15n) / 100n;
  }
  return budget + budget / 10n;
}

export async function authorizeTreasuryOperator(deployed: DeployedLuckyScratch, holder: HardhatEthersSigner) {
  await deployed.token.connect(holder).setOperator(await deployed.treasury.getAddress(), 281_474_976_710_655n);
}

export async function decryptConfidentialBalance(deployed: DeployedLuckyScratch, account: string) {
  const handle = await deployed.token.confidentialBalanceOf(account);
  const result = await fhevm.publicDecrypt([handle]);
  const clearBalance = result.clearValues[handle as `0x${string}`];
  if (typeof clearBalance !== "bigint") {
    throw new Error(`Unexpected confidential balance value type for handle ${handle}`);
  }
  return clearBalance;
}

export async function getCurrentRoundState(deployed: DeployedLuckyScratch, poolId = POOL_ID) {
  const state = await deployed.core.poolStates(poolId);
  const round = await deployed.core.roundStates(poolId, state.currentRound);
  return { state, round };
}

export async function deployLuckyScratchFixture(): Promise<DeployedLuckyScratch> {
  const [admin, creator, alice, bob] = await ethers.getSigners();

  const tokenFactory = (await ethers.getContractFactory("TestConfidentialUSDC")) as TestConfidentialUSDC__factory;
  const ticketFactory = (await ethers.getContractFactory("LuckyScratchTicket")) as LuckyScratchTicket__factory;
  const treasuryFactory = (await ethers.getContractFactory("LuckyScratchTreasury")) as LuckyScratchTreasury__factory;
  const vrfFactory = (await ethers.getContractFactory("LuckyScratchVRFAdapter")) as LuckyScratchVRFAdapter__factory;
  const coreFactory = (await ethers.getContractFactory("LuckyScratchCore")) as LuckyScratchCore__factory;

  const token = await tokenFactory.deploy(admin.address);
  const ticket = await ticketFactory.deploy(admin.address);
  const treasury = await treasuryFactory.deploy(admin.address, await token.getAddress());
  const vrfAdapter = await vrfFactory.deploy(admin.address, ethers.ZeroAddress, 0n, ethers.ZeroHash, 0, 0, false);
  const core = await coreFactory.deploy(admin.address);

  await ticket.connect(admin).setCore(await core.getAddress());
  await treasury.connect(admin).setCore(await core.getAddress());
  await vrfAdapter.connect(admin).setCore(await core.getAddress());

  await core.connect(admin).setTicket(await ticket.getAddress());
  await core.connect(admin).setTreasury(await treasury.getAddress());
  await core.connect(admin).setVrfAdapter(await vrfAdapter.getAddress());

  const largeMint = 1_000_000n * UNIT;
  await token.connect(admin).mint(creator.address, largeMint);
  await token.connect(admin).mint(alice.address, largeMint);
  await token.connect(admin).mint(bob.address, largeMint);

  return { admin, creator, alice, bob, token, ticket, treasury, vrfAdapter, core };
}

export async function createPool(deployed: DeployedLuckyScratch, overrides: Partial<PoolConfigInput> = {}) {
  const config = buildPoolConfig({ ...overrides, creator: deployed.creator.address });
  const tiers = buildPrizeTiers();

  await authorizeTreasuryOperator(deployed, deployed.creator);
  await deployed.core.connect(deployed.creator).createPool(config, tiers);

  return { config, tiers };
}

export async function fulfillRound(deployed: DeployedLuckyScratch, roundId = ROUND_ID, randomWord = 777n) {
  const round = await deployed.core.roundStates(POOL_ID, roundId);
  await deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(round.vrfRequestRef, randomWord);
}

export async function encryptRound(deployed: DeployedLuckyScratch, roundId = ROUND_ID) {
  const round = await deployed.core.roundStates(POOL_ID, roundId);
  await deployed.core.connect(deployed.admin).encryptPrizes(POOL_ID, roundId, 0, round.totalTickets);
}

export async function fulfillAndEncryptRound(deployed: DeployedLuckyScratch, roundId = ROUND_ID, randomWord = 777n) {
  await fulfillRound(deployed, roundId, randomWord);
  await encryptRound(deployed, roundId);
}

export async function approveAndPurchase(
  deployed: DeployedLuckyScratch,
  buyer: HardhatEthersSigner,
  quantity: number | bigint,
) {
  await authorizeTreasuryOperator(deployed, buyer);
  const tx = await deployed.core.connect(buyer).purchaseTickets(POOL_ID, quantity);
  const receipt = await tx.wait();

  return extractTicketIds(deployed.core, receipt!.logs);
}

export async function approveAndPurchaseSelection(
  deployed: DeployedLuckyScratch,
  buyer: HardhatEthersSigner,
  indexes: number[],
) {
  await authorizeTreasuryOperator(deployed, buyer);
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
  const result = await fhevm.publicDecrypt([handle]);
  const clearReward = result.clearValues[handle as `0x${string}`];
  if (typeof clearReward !== "bigint") {
    throw new Error(`Unexpected public decrypt value type for handle ${handle}`);
  }

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
