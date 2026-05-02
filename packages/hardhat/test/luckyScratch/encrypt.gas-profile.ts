import { expect } from "chai";
import {
  authorizeTreasuryOperator,
  buildPoolConfig,
  computeBondRequirement,
  deployLuckyScratchFixture,
  POOL_ID,
  UNIT,
} from "./helpers";

describe("encryptPrizes gas profiling", () => {
  const ticketCounts = [10, 50, 100, 200];

  for (const totalTickets of ticketCounts) {
    it(`measures encryptPrizes gas for ${totalTickets} tickets (single call)`, async () => {
      const deployed = await deployLuckyScratchFixture();

      const ticketPrice = 5n * UNIT;
      const prizePerTicket = 2n * UNIT;
      const winningCount = Math.floor(totalTickets * 0.3);
      const totalPrizeBudget = prizePerTicket * BigInt(winningCount);

      const config = buildPoolConfig({
        creator: deployed.creator.address,
        ticketPrice,
        totalTicketsPerRound: totalTickets,
        totalPrizeBudget,
        targetRtpBps: Number((totalPrizeBudget * 10000n) / (ticketPrice * BigInt(totalTickets))),
        hitRateBps: Math.round((winningCount * 10000) / totalTickets),
        maxPrize: prizePerTicket,
      });

      const tiers = [
        { prizeAmount: prizePerTicket, count: winningCount },
        { prizeAmount: 0n, count: totalTickets - winningCount },
      ];

      const bond = computeBondRequirement(totalPrizeBudget);
      await deployed.token.connect(deployed.admin).mint(deployed.creator.address, bond);
      await authorizeTreasuryOperator(deployed, deployed.creator);
      await deployed.core.connect(deployed.creator).createPool(config, tiers);

      const state = await deployed.core.poolStates(POOL_ID);
      const round = await deployed.core.roundStates(POOL_ID, state.currentRound);
      await deployed.vrfAdapter.connect(deployed.admin).fulfillRandomness(round.vrfRequestRef, 777n);

      const tx = await deployed.core.connect(deployed.admin).encryptPrizes(POOL_ID, 1n, 0, totalTickets);
      const receipt = await tx.wait();

      console.log(`\n  encryptPrizes tickets=${totalTickets} | Gas used: ${receipt!.gasUsed.toString()}`);

      const stateAfter = await deployed.core.poolStates(POOL_ID);
      expect(stateAfter.status).to.equal(1); // Active
    });
  }
});
