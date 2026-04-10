import { expect } from "chai";
import { fhevm } from "hardhat";
import {
  approveAndPurchase,
  buildClaimProof,
  buildWinningClaims,
  createPool,
  deployLuckyScratchFixture,
  fulfillRound,
  scratchAndDecrypt,
} from "./helpers";

describe("LuckyScratchClaim", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("pays winning tickets, rejects zero-reward claims and prevents duplicate claims", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 10);

    let winningTicketId = 0n;
    let zeroTicketId = 0n;
    for (const ticketId of ticketIds) {
      const { clearReward } = await scratchAndDecrypt(deployed, deployed.alice, ticketId);
      if (clearReward > 0n && winningTicketId === 0n) winningTicketId = ticketId;
      if (clearReward === 0n && zeroTicketId === 0n) zeroTicketId = ticketId;
    }

    const winnerBalanceBefore = await deployed.token.balanceOf(deployed.alice.address);
    const winningClaim = await buildClaimProof(deployed, winningTicketId);
    await deployed.core
      .connect(deployed.alice)
      .claimReward(winningTicketId, winningClaim.clearReward, winningClaim.decryptionProof);

    const winnerBalanceAfter = await deployed.token.balanceOf(deployed.alice.address);
    expect(winnerBalanceAfter - winnerBalanceBefore).to.equal(winningClaim.clearReward);

    await expect(
      deployed.core
        .connect(deployed.alice)
        .claimReward(winningTicketId, winningClaim.clearReward, winningClaim.decryptionProof),
    ).to.be.revertedWithCustomError(deployed.core, "TicketNotClaimable");

    const zeroClaim = await buildClaimProof(deployed, zeroTicketId);
    await expect(
      deployed.core.connect(deployed.alice).claimReward(zeroTicketId, zeroClaim.clearReward, zeroClaim.decryptionProof),
    ).to.be.revertedWithCustomError(deployed.core, "NoReward");
  });

  it("supports batch claims and creator profit / bond operations", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 10);
    for (const ticketId of ticketIds) {
      await scratchAndDecrypt(deployed, deployed.alice, ticketId);
    }
    const positiveClaims = await buildWinningClaims(deployed, ticketIds);

    expect(positiveClaims.length).to.be.greaterThan(1);

    await deployed.core.connect(deployed.alice).batchClaimRewards(
      positiveClaims.slice(0, 2).map(item => item.ticketId),
      positiveClaims.slice(0, 2).map(item => item.amount),
      positiveClaims.slice(0, 2).map(item => item.proof),
    );

    await expect(
      deployed.core
        .connect(deployed.alice)
        .batchClaimRewards(
          [positiveClaims[0].ticketId, positiveClaims[2].ticketId],
          [positiveClaims[0].amount, positiveClaims[2].amount],
          [positiveClaims[0].proof, positiveClaims[2].proof],
        ),
    ).to.be.revertedWithCustomError(deployed.core, "TicketNotClaimable");

    let state = await deployed.core.poolStates(1n);
    expect(state.status).to.equal(2);

    await expect(deployed.core.connect(deployed.creator).refundBond(1n)).to.be.revertedWithCustomError(
      deployed.core,
      "PoolClosedForRolling",
    );

    await deployed.core.connect(deployed.alice).batchClaimRewards(
      positiveClaims.slice(2).map(item => item.ticketId),
      positiveClaims.slice(2).map(item => item.amount),
      positiveClaims.slice(2).map(item => item.proof),
    );

    state = await deployed.core.poolStates(1n);
    expect(state.status).to.equal(4);

    const claimableProfit = await deployed.core.claimableCreatorProfit(1n);
    expect(claimableProfit).to.equal(42_000_000n);

    const creatorBalanceBefore = await deployed.token.balanceOf(deployed.creator.address);
    await deployed.core.connect(deployed.creator).withdrawCreatorProfit(1n, claimableProfit);
    const creatorBalanceAfter = await deployed.token.balanceOf(deployed.creator.address);
    expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(42_000_000n);

    await expect(deployed.core.connect(deployed.creator).refundBond(1n)).to.not.be.reverted;
    const accounting = await deployed.core.poolAccounting(1n);
    expect(accounting.lockedBond).to.equal(0);
  });
});
