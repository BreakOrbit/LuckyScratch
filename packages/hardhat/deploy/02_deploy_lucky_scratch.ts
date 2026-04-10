import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const CUSDC_BY_NETWORK: Record<string, string> = {
  mainnet: "0xe978F22157048E5DB8E5d07971376e86671672B2",
  sepolia: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
};

const deployLuckyScratch: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, getOrNull, log } = hre.deployments;
  const networkName = hre.network.name;
  const paymentTokenAddress = CUSDC_BY_NETWORK[networkName];

  if (!paymentTokenAddress) {
    throw new Error(
      `LuckyScratch deployment is only configured for networks with a real cUSDC address. Supported networks: ${Object.keys(CUSDC_BY_NETWORK).join(", ")}.`,
    );
  }

  const existingTicket = await getOrNull("LuckyScratchTicket");
  const existingTreasury = await getOrNull("LuckyScratchTreasury");
  const existingVrfAdapter = await getOrNull("LuckyScratchVRFAdapter");
  const existingCore = await getOrNull("LuckyScratchCore");

  const ticketDeployment = existingTicket
    ? existingTicket
    : await deploy("LuckyScratchTicket", {
        from: deployer,
        args: [deployer],
        log: true,
        autoMine: true,
      });

  const treasuryDeployment = existingTreasury
    ? existingTreasury
    : await deploy("LuckyScratchTreasury", {
        from: deployer,
        args: [deployer, paymentTokenAddress],
        log: true,
        autoMine: true,
      });

  const vrfDeployment = existingVrfAdapter
    ? existingVrfAdapter
    : await deploy("LuckyScratchVRFAdapter", {
        from: deployer,
        args: [deployer],
        log: true,
        autoMine: true,
      });

  const coreDeployment = existingCore
    ? existingCore
    : await deploy("LuckyScratchCore", {
        from: deployer,
        args: [deployer],
        log: true,
        autoMine: true,
      });

  await execute("LuckyScratchTicket", { from: deployer, log: true, autoMine: true }, "setCore", coreDeployment.address);
  await execute(
    "LuckyScratchTreasury",
    { from: deployer, log: true, autoMine: true },
    "setCore",
    coreDeployment.address,
  );
  await execute(
    "LuckyScratchVRFAdapter",
    { from: deployer, log: true, autoMine: true },
    "setCore",
    coreDeployment.address,
  );

  await execute(
    "LuckyScratchCore",
    { from: deployer, log: true, autoMine: true },
    "setTicket",
    ticketDeployment.address,
  );
  await execute(
    "LuckyScratchCore",
    { from: deployer, log: true, autoMine: true },
    "setTreasury",
    treasuryDeployment.address,
  );
  await execute(
    "LuckyScratchCore",
    { from: deployer, log: true, autoMine: true },
    "setVrfAdapter",
    vrfDeployment.address,
  );
  await execute("LuckyScratchCore", { from: deployer, log: true, autoMine: true }, "setRelayer", deployer, true);

  log(`LuckyScratch payment token: ${paymentTokenAddress}`);
};

export default deployLuckyScratch;

deployLuckyScratch.tags = ["LuckyScratch"];
