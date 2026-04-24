import { expect } from "chai";
import { fhevm } from "hardhat";
import {
  buildPoolConfig,
  buildPrizeTiers,
  authorizeTreasuryOperator,
  createPool,
  decryptConfidentialBalance,
  deployLuckyScratchFixture,
  fulfillRound,
  POOL_ID,
  UNIT,
} from "./helpers";

function computeTargetRtpBps(totalPrizeBudget: bigint, ticketPrice: bigint, totalTickets: number) {
  const grossRevenue = ticketPrice * BigInt(totalTickets);
  return Number((totalPrizeBudget * 10_000n + grossRevenue / 2n) / grossRevenue);
}

function computeHitRateBps(winningTicketCount: number, totalTickets: number) {
  return Number((BigInt(winningTicketCount) * 10_000n + BigInt(totalTickets) / 2n) / BigInt(totalTickets));
}

describe("LuckyScratchCreatePool", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("enforces documented pool parameter constraints", async function () {
    const deployed = await deployLuckyScratchFixture();
    await authorizeTreasuryOperator(deployed, deployed.creator);

    const invalidPriceConfig = buildPoolConfig({
      creator: deployed.creator.address,
      ticketPrice: 3n * 1_000_000n,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(invalidPriceConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const invalidHitRateConfig = buildPoolConfig({
      creator: deployed.creator.address,
      hitRateBps: 1000,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(invalidHitRateConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const invalidMaxPrizeConfig = buildPoolConfig({
      creator: deployed.creator.address,
      maxPrize: 16n * 1_000_000n,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(invalidMaxPrizeConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const mismatchedMaxPrizeConfig = buildPoolConfig({
      creator: deployed.creator.address,
      maxPrize: 14n * 1_000_000n,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(mismatchedMaxPrizeConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const mismatchedRtpConfig = buildPoolConfig({
      creator: deployed.creator.address,
      targetRtpBps: 6000,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(mismatchedRtpConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const mismatchedHitRateConfig = buildPoolConfig({
      creator: deployed.creator.address,
      hitRateBps: 5000,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(mismatchedHitRateConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");

    const excessiveTicketCountConfig = buildPoolConfig({
      creator: deployed.creator.address,
      totalTicketsPerRound: 257,
    });
    await expect(
      deployed.core.connect(deployed.creator).createPool(excessiveTicketCountConfig, buildPrizeTiers()),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidPoolConfig");
  });

  it("keeps a closed pending pool closed even if the old VRF request is fulfilled later", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed, { mode: 1 });
    const roundBeforeClose = await deployed.core.roundStates(POOL_ID, 1n);

    await deployed.core.connect(deployed.creator).closePool(POOL_ID);

    let state = await deployed.core.poolStates(POOL_ID);
    expect(state.status).to.equal(4);
    expect(state.closeRequested).to.equal(true);

    await fulfillRound(deployed);

    state = await deployed.core.poolStates(POOL_ID);
    const round = await deployed.core.roundStates(POOL_ID, 1n);

    expect(state.status).to.equal(4);
    expect(state.vrfPending).to.equal(false);
    expect(round.status).to.equal(0);

    await expect(deployed.core.connect(deployed.alice).purchaseTickets(POOL_ID, 1)).to.be.revertedWithCustomError(
      deployed.core,
      "RoundNotReady",
    );

    await expect(
      deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(roundBeforeClose.vrfRequestRef, 888n),
    ).to.be.revertedWithCustomError(deployed.vrfAdapter, "RequestAlreadyFulfilled");
  });

  it("locks creator bond according to the documented prize-budget tiers", async function () {
    const deployed = await deployLuckyScratchFixture();
    const poolCases = [
      {
        budget: 100n * UNIT,
        expectedBond: 120n * UNIT,
        ticketPrice: 20n * UNIT,
        totalTickets: 10,
        maxPrize: 30n * UNIT,
        winningTicketCount: 4,
        tiers: [
          { prizeAmount: 30n * UNIT, count: 2 },
          { prizeAmount: 20n * UNIT, count: 2 },
          { prizeAmount: 0n, count: 6 },
        ],
      },
      {
        budget: 300n * UNIT,
        expectedBond: 345n * UNIT,
        ticketPrice: 20n * UNIT,
        totalTickets: 30,
        maxPrize: 90n * UNIT,
        winningTicketCount: 6,
        tiers: [
          { prizeAmount: 90n * UNIT, count: 1 },
          { prizeAmount: 60n * UNIT, count: 2 },
          { prizeAmount: 30n * UNIT, count: 3 },
          { prizeAmount: 0n, count: 24 },
        ],
      },
      {
        budget: 1000n * UNIT,
        expectedBond: 1100n * UNIT,
        ticketPrice: 20n * UNIT,
        totalTickets: 100,
        maxPrize: 300n * UNIT,
        winningTicketCount: 21,
        tiers: [
          { prizeAmount: 300n * UNIT, count: 1 },
          { prizeAmount: 35n * UNIT, count: 20 },
          { prizeAmount: 0n, count: 79 },
        ],
      },
    ];

    let expectedTreasuryBalance = 0n;

    for (const [index, poolCase] of poolCases.entries()) {
      const poolId = BigInt(index + 1);
      const config = buildPoolConfig({
        creator: deployed.creator.address,
        ticketPrice: poolCase.ticketPrice,
        totalPrizeBudget: poolCase.budget,
        totalTicketsPerRound: poolCase.totalTickets,
        maxPrize: poolCase.maxPrize,
        hitRateBps: computeHitRateBps(poolCase.winningTicketCount, poolCase.totalTickets),
        targetRtpBps: computeTargetRtpBps(poolCase.budget, poolCase.ticketPrice, poolCase.totalTickets),
      });

      await authorizeTreasuryOperator(deployed, deployed.creator);
      await deployed.core.connect(deployed.creator).createPool(config, poolCase.tiers);

      const accounting = await deployed.core.poolAccounting(poolId);
      expectedTreasuryBalance += poolCase.expectedBond;

      expect(accounting.lockedBond).to.equal(poolCase.expectedBond);
      expect(await decryptConfidentialBalance(deployed, await deployed.treasury.getAddress())).to.equal(
        expectedTreasuryBalance,
      );
    }
  });
});
