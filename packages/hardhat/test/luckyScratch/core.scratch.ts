import { expect } from "chai";
import { fhevm } from "hardhat";
import { approveAndPurchase, createPool, deployLuckyScratchFixture, fulfillRound, scratchAndDecrypt } from "./helpers";

describe("LuckyScratchScratch", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("reveals the encrypted prize to the current owner and supports batch scratch", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 2);
    const firstResult = await scratchAndDecrypt(deployed, deployed.alice, ticketIds[0]);
    expect(firstResult.clearReward >= 0n).to.equal(true);

    await deployed.core.connect(deployed.alice).batchScratch([ticketIds[1]]);
    const secondState = await deployed.core.getTicketRevealState(ticketIds[1]);
    expect(secondState.revealAuthorized).to.equal(true);

    await expect(deployed.core.connect(deployed.alice).batchScratch([ticketIds[1]])).to.be.revertedWithCustomError(
      deployed.core,
      "TicketNotScratchable",
    );
  });
});
