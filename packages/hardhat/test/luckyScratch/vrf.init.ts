import { expect } from "chai";
import { fhevm } from "hardhat";
import { createPool, deployLuckyScratchFixture, fulfillRound, POOL_ID, ROUND_ID } from "./helpers";

describe("LuckyScratchVRF", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("keeps a new pool pending until VRF fulfillment", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);

    await expect(deployed.core.connect(deployed.alice).purchaseTickets(POOL_ID, 1)).to.be.revertedWithCustomError(
      deployed.core,
      "RoundNotReady",
    );

    const roundBefore = await deployed.core.roundStates(POOL_ID, ROUND_ID);
    expect(roundBefore.status).to.equal(0);

    await fulfillRound(deployed);

    const roundAfter = await deployed.core.roundStates(POOL_ID, ROUND_ID);
    expect(roundAfter.status).to.equal(1);
    expect(roundAfter.shuffleRoot).to.not.equal("0x" + "0".repeat(64));
  });

  it("rejects duplicate VRF processing for the same request", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    const round = await deployed.core.roundStates(POOL_ID, ROUND_ID);

    await deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(round.vrfRequestRef, 123n);

    await expect(
      deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(round.vrfRequestRef, 456n),
    ).to.be.revertedWithCustomError(deployed.vrfAdapter, "RequestAlreadyFulfilled");
  });
});
