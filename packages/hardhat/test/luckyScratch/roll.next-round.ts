import { expect } from "chai";
import { fhevm } from "hardhat";
import {
  approveAndPurchase,
  buildPoolConfig,
  buildWinningClaims,
  computeBondRequirement,
  createPool,
  deployLuckyScratchFixture,
  fulfillRound,
  UNIT,
} from "./helpers";

describe("LuckyScratchRollNextRound", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("rejects rolling before settlement and rolls successfully after the round settles", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed, { mode: 1 });
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 10);
    await deployed.core.connect(deployed.alice).scratchTicket(ticketIds[0]);

    await expect(deployed.core.connect(deployed.creator).rollToNextRound(1n)).to.be.revertedWithCustomError(
      deployed.core,
      "PoolNotSettled",
    );

    await deployed.core.connect(deployed.alice).batchScratch(ticketIds.slice(1));
    await expect(deployed.core.connect(deployed.creator).rollToNextRound(1n)).to.be.revertedWithCustomError(
      deployed.core,
      "PoolNotSettled",
    );

    const positiveClaims = await buildWinningClaims(deployed, ticketIds);
    await deployed.core.connect(deployed.alice).batchClaimRewards(
      positiveClaims.map(item => item.ticketId),
      positiveClaims.map(item => item.amount),
      positiveClaims.map(item => item.proof),
    );
    await deployed.core.connect(deployed.creator).rollToNextRound(1n);

    const state = await deployed.core.poolStates(1n);
    expect(state.currentRound).to.equal(2);
    expect(state.status).to.equal(0);

    await fulfillRound(deployed, 2n, 999n);
    const nextRound = await deployed.core.roundStates(1n, 2n);
    expect(nextRound.status).to.equal(1);
  });

  it("moves loop pools into Closing when next-round funds are insufficient", async function () {
    const deployed = await deployLuckyScratchFixture();
    const config = buildPoolConfig({
      creator: deployed.creator.address,
      mode: 1,
      ticketPrice: 5n * UNIT,
      totalPrizeBudget: 100n * UNIT,
      targetRtpBps: 5000,
      hitRateBps: 4000,
      maxPrize: 30n * UNIT,
    });
    const tiers = [
      { prizeAmount: 30n * UNIT, count: 2 },
      { prizeAmount: 20n * UNIT, count: 2 },
      { prizeAmount: 0n, count: 6 },
    ];

    await deployed.token
      .connect(deployed.creator)
      .approve(await deployed.treasury.getAddress(), computeBondRequirement(config.totalPrizeBudget));
    await deployed.core.connect(deployed.creator).createPool(config, tiers);
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 10);
    await deployed.core.connect(deployed.alice).batchScratch(ticketIds);
    const positiveClaims = await buildWinningClaims(deployed, ticketIds);
    await deployed.core.connect(deployed.alice).batchClaimRewards(
      positiveClaims.map(item => item.ticketId),
      positiveClaims.map(item => item.amount),
      positiveClaims.map(item => item.proof),
    );
    await deployed.core.connect(deployed.creator).rollToNextRound(1n);

    const state = await deployed.core.poolStates(1n);
    expect(state.status).to.equal(3);
  });
});
