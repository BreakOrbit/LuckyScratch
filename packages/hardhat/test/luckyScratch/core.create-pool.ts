import { expect } from "chai";
import { fhevm } from "hardhat";
import {
  buildPoolConfig,
  buildPrizeTiers,
  computeBondRequirement,
  createPool,
  deployLuckyScratchFixture,
  fulfillRound,
  POOL_ID,
  UNIT,
} from "./helpers";

function buildSingleTicketPrizeTiers(values: bigint[]) {
  return values.map(prizeAmount => ({ prizeAmount, count: 1 }));
}

describe("LuckyScratchCreatePool", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("enforces documented pool parameter constraints", async function () {
    const deployed = await deployLuckyScratchFixture();
    await deployed.token
      .connect(deployed.creator)
      .approve(await deployed.treasury.getAddress(), computeBondRequirement(50n * 1_000_000n));

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
        maxPrize: 30n * UNIT,
        hitRateBps: 6000,
        prizes: [30n, 20n, 20n, 10n, 10n, 10n, 0n, 0n, 0n, 0n].map(value => value * UNIT),
      },
      {
        budget: 300n * UNIT,
        expectedBond: 345n * UNIT,
        maxPrize: 90n * UNIT,
        hitRateBps: 6000,
        prizes: [90n, 60n, 60n, 30n, 30n, 30n, 0n, 0n, 0n, 0n].map(value => value * UNIT),
      },
      {
        budget: 1000n * UNIT,
        expectedBond: 1100n * UNIT,
        maxPrize: 300n * UNIT,
        hitRateBps: 7000,
        prizes: [300n, 200n, 150n, 150n, 100n, 50n, 50n, 0n, 0n, 0n].map(value => value * UNIT),
      },
    ] as const;

    let expectedTreasuryBalance = 0n;

    for (const [index, poolCase] of poolCases.entries()) {
      const poolId = BigInt(index + 1);
      const config = buildPoolConfig({
        creator: deployed.creator.address,
        ticketPrice: 10n * UNIT,
        totalPrizeBudget: poolCase.budget,
        totalTicketsPerRound: poolCase.prizes.length,
        maxPrize: poolCase.maxPrize,
        hitRateBps: poolCase.hitRateBps,
      });

      await deployed.token
        .connect(deployed.creator)
        .approve(await deployed.treasury.getAddress(), poolCase.expectedBond);
      await deployed.core
        .connect(deployed.creator)
        .createPool(config, buildSingleTicketPrizeTiers([...poolCase.prizes]));

      const accounting = await deployed.core.poolAccounting(poolId);
      expectedTreasuryBalance += poolCase.expectedBond;

      expect(accounting.lockedBond).to.equal(poolCase.expectedBond);
      expect(await deployed.treasury.currentBalance()).to.equal(expectedTreasuryBalance);
    }
  });
});
