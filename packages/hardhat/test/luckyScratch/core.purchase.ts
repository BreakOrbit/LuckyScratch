import { expect } from "chai";
import { fhevm } from "hardhat";
import {
  approveAndPurchase,
  approveAndPurchaseSelection,
  createPool,
  deployLuckyScratchFixture,
  fulfillRound,
  POOL_ID,
  ROUND_ID,
} from "./helpers";

describe("LuckyScratchPurchase", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("mints tickets, records revenue and marks rounds sold out", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const firstBatch = await approveAndPurchase(deployed, deployed.alice, 5);
    expect(firstBatch).to.have.length(5);

    const secondBatch = await approveAndPurchase(deployed, deployed.bob, 5);
    expect(secondBatch).to.have.length(5);

    const round = await deployed.core.roundStates(POOL_ID, ROUND_ID);
    const accounting = await deployed.core.poolAccounting(POOL_ID);

    expect(round.soldCount).to.equal(10);
    expect(round.status).to.equal(2);
    expect(accounting.realizedRevenue).to.equal(100_000_000n);
    expect(accounting.accruedPlatformFee).to.equal(8_000_000n);
  });

  it("supports selection purchase and rejects duplicates, sold slots and out-of-bounds indexes", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const selected = await approveAndPurchaseSelection(deployed, deployed.alice, [1, 3]);
    expect(selected).to.have.length(2);

    await deployed.token.connect(deployed.bob).approve(await deployed.treasury.getAddress(), 2_000_000n);

    await expect(
      deployed.core.connect(deployed.bob).purchaseTicketsWithSelection(POOL_ID, [1]),
    ).to.be.revertedWithCustomError(deployed.core, "TicketIndexAlreadySold");

    await expect(
      deployed.core.connect(deployed.bob).purchaseTicketsWithSelection(POOL_ID, [0, 0]),
    ).to.be.revertedWithCustomError(deployed.core, "DuplicateTicketIndex");

    await expect(
      deployed.core.connect(deployed.bob).purchaseTicketsWithSelection(POOL_ID, [10]),
    ).to.be.revertedWithCustomError(deployed.core, "TicketIndexOutOfBounds");
  });
});
