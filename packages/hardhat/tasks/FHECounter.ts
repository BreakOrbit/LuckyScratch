import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:fhe-address", "Prints the FHECounter address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const fheCounter = await hre.deployments.get("FHECounter");
  console.log(`FHECounter address: ${fheCounter.address}`);
});

task("task:decrypt-count", "Decrypts the current encrypted count")
  .addOptionalParam("address", "Optionally specify the FHECounter contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHECounter");
    const [signer] = await ethers.getSigners();
    const fheCounterContract = await ethers.getContractAt("FHECounter", deployment.address);

    const encryptedCount = await fheCounterContract.getCount();
    if (encryptedCount === ethers.ZeroHash) {
      console.log("Clear count: 0");
      return;
    }

    const clearCount = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedCount, deployment.address, signer);

    console.log(`Encrypted count: ${encryptedCount}`);
    console.log(`Clear count: ${clearCount}`);
  });

task("task:increment", "Increments the encrypted count")
  .addOptionalParam("address", "Optionally specify the FHECounter contract address")
  .addParam("value", "The increment value")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const value = Number.parseInt(taskArguments.value, 10);
    if (!Number.isInteger(value)) {
      throw new Error("Argument --value must be an integer");
    }

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHECounter");
    const [signer] = await ethers.getSigners();
    const fheCounterContract = await ethers.getContractAt("FHECounter", deployment.address);

    const encryptedValue = await fhevm.createEncryptedInput(deployment.address, signer.address).add32(value).encrypt();
    const tx = await fheCounterContract.connect(signer).increment(encryptedValue.handles[0], encryptedValue.inputProof);

    await tx.wait();
    console.log(`Incremented by ${value} in tx ${tx.hash}`);
  });

task("task:decrement", "Decrements the encrypted count")
  .addOptionalParam("address", "Optionally specify the FHECounter contract address")
  .addParam("value", "The decrement value")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const value = Number.parseInt(taskArguments.value, 10);
    if (!Number.isInteger(value)) {
      throw new Error("Argument --value must be an integer");
    }

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHECounter");
    const [signer] = await ethers.getSigners();
    const fheCounterContract = await ethers.getContractAt("FHECounter", deployment.address);

    const encryptedValue = await fhevm.createEncryptedInput(deployment.address, signer.address).add32(value).encrypt();
    const tx = await fheCounterContract.connect(signer).decrement(encryptedValue.handles[0], encryptedValue.inputProof);

    await tx.wait();
    console.log(`Decremented by ${value} in tx ${tx.hash}`);
  });
