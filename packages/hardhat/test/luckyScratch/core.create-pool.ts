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
} from "./helpers";

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
});
