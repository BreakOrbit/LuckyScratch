import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import {
  createPool,
  DEFAULT_TICKET_PRICE,
  deployLuckyScratchFixture,
  fulfillRound,
  GaslessAction,
  hashPurchaseParams,
  signGaslessRequest,
} from "./helpers";

describe("LuckyScratchGaslessPurchase", function () {
  beforeEach(function () {
    if (!fhevm.isMock) this.skip();
  });

  it("executes gasless purchase and rejects bad nonce, params, signature, deadline and caller", async function () {
    const deployed = await deployLuckyScratchFixture();
    await createPool(deployed);
    await fulfillRound(deployed);

    await deployed.token.connect(deployed.alice).approve(await deployed.treasury.getAddress(), DEFAULT_TICKET_PRICE);

    const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
    const deadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);

    const request = {
      user: deployed.alice.address,
      action: GaslessAction.Purchase,
      targetContract: await deployed.core.getAddress(),
      paramsHash: hashPurchaseParams(1n, 1),
      nonce: 0n,
      deadline,
      chainId,
    };
    const signature = await signGaslessRequest(deployed.alice, deployed.core, request);

    await expect(deployed.core.connect(deployed.relayer).executeGaslessPurchase(request, signature, 1n, 1)).to.not.be
      .reverted;

    await expect(
      deployed.core.connect(deployed.relayer).executeGaslessPurchase(request, signature, 1n, 1),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidGaslessNonce");

    const badNonceRequest = { ...request, nonce: 1n, paramsHash: ethers.keccak256("0x1234") };
    const badNonceSignature = await signGaslessRequest(deployed.alice, deployed.core, badNonceRequest);
    await expect(
      deployed.core.connect(deployed.relayer).executeGaslessPurchase(badNonceRequest, badNonceSignature, 1n, 1),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidGaslessParamsHash");

    const expiredRequest = { ...request, nonce: 1n, deadline: 1n };
    const expiredSignature = await signGaslessRequest(deployed.alice, deployed.core, expiredRequest);
    await expect(
      deployed.core.connect(deployed.relayer).executeGaslessPurchase(expiredRequest, expiredSignature, 1n, 1),
    ).to.be.revertedWithCustomError(deployed.core, "ExpiredGaslessRequest");

    const otherSignature = await signGaslessRequest(deployed.bob, deployed.core, { ...request, nonce: 1n });
    await expect(
      deployed.core.connect(deployed.relayer).executeGaslessPurchase({ ...request, nonce: 1n }, otherSignature, 1n, 1),
    ).to.be.revertedWithCustomError(deployed.core, "InvalidGaslessSignature");

    const requestByNonRelayer = { ...request, nonce: 1n };
    const signatureByNonRelayer = await signGaslessRequest(deployed.alice, deployed.core, requestByNonRelayer);
    await expect(
      deployed.core.connect(deployed.bob).executeGaslessPurchase(requestByNonRelayer, signatureByNonRelayer, 1n, 1),
    ).to.be.revertedWithCustomError(deployed.core, "AccessControlUnauthorizedAccount");
  });
});
