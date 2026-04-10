import { expect } from "chai";
import { fhevm } from "hardhat";
import { approveAndPurchase, createPool, deployLuckyScratchFixture, fulfillRound } from "./helpers";

describe("LuckyScratchTicketTransfer", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("allows transfer before scratch and locks transfer after scratch", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const [ticketId] = await approveAndPurchase(deployed, deployed.alice, 1);
    await deployed.ticket.connect(deployed.alice).transferFrom(deployed.alice.address, deployed.bob.address, ticketId);

    const ticketRecord = await deployed.core.tickets(ticketId);
    expect(ticketRecord.transferredBeforeScratch).to.equal(true);
    expect(await deployed.ticket.ownerOf(ticketId)).to.equal(deployed.bob.address);

    await deployed.core.connect(deployed.bob).scratchTicket(ticketId);
    await expect(
      deployed.ticket.connect(deployed.bob).transferFrom(deployed.bob.address, deployed.alice.address, ticketId),
    ).to.be.revertedWithCustomError(deployed.ticket, "TransferLocked");
  });
});
