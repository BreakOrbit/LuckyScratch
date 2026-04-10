import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import {
  approveAndPurchase,
  createPool,
  deployLuckyScratchFixture,
  fulfillRound,
  GaslessAction,
  hashBatchScratchParams,
  hashScratchParams,
  signGaslessRequest,
} from "./helpers";

describe("LuckyScratchGaslessScratch", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("executes gasless scratch and batch gasless scratch", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    const ticketIds = await approveAndPurchase(deployed, deployed.alice, 2);

    const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
    const deadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);

    const singleRequest = {
      user: deployed.alice.address,
      action: GaslessAction.Scratch,
      targetContract: await deployed.core.getAddress(),
      paramsHash: hashScratchParams(ticketIds[0]),
      nonce: 0n,
      deadline,
      chainId,
    };
    const singleSignature = await signGaslessRequest(deployed.alice, deployed.core, singleRequest);

    await deployed.core.connect(deployed.relayer).executeGaslessScratch(singleRequest, singleSignature, ticketIds[0]);

    const batchRequest = {
      user: deployed.alice.address,
      action: GaslessAction.BatchScratch,
      targetContract: await deployed.core.getAddress(),
      paramsHash: hashBatchScratchParams([ticketIds[1]]),
      nonce: 1n,
      deadline,
      chainId,
    };
    const batchSignature = await signGaslessRequest(deployed.alice, deployed.core, batchRequest);

    await deployed.core
      .connect(deployed.relayer)
      .executeGaslessBatchScratch(batchRequest, batchSignature, [ticketIds[1]]);

    const state0 = await deployed.core.getTicketRevealState(ticketIds[0]);
    const state1 = await deployed.core.getTicketRevealState(ticketIds[1]);
    expect(state0.revealAuthorized).to.equal(true);
    expect(state1.revealAuthorized).to.equal(true);
  });
});
