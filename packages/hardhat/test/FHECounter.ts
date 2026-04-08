import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FHECounter, FHECounter__factory } from "../typechain-types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHECounter")) as FHECounter__factory;
  const contract = (await factory.deploy()) as FHECounter;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("FHECounter", function () {
  let signers: Signers;
  let contract: FHECounter;
  let contractAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("starts from zero", async function () {
    expect(await contract.getCount()).to.equal(ethers.ZeroHash);
  });

  it("increments encrypted count", async function () {
    const encryptedOne = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(1).encrypt();

    const tx = await contract.connect(signers.alice).increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    const encryptedCount = await contract.getCount();
    const clearCount = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedCount, contractAddress, signers.alice);

    expect(clearCount).to.equal(1);
  });

  it("decrements encrypted count", async function () {
    const encryptedOne = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(1).encrypt();

    let tx = await contract.connect(signers.alice).increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    tx = await contract.connect(signers.alice).decrement(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    const encryptedCount = await contract.getCount();
    const clearCount = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedCount, contractAddress, signers.alice);

    expect(clearCount).to.equal(0);
  });
});
