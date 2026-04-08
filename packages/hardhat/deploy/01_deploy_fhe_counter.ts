import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFHECounter: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("FHECounter", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployFHECounter;

deployFHECounter.tags = ["FHECounter"];
