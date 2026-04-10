import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const CUSDC_BY_NETWORK: Record<string, string> = {
  mainnet: "0xe978F22157048E5DB8E5d07971376e86671672B2",
  sepolia: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
};

type VrfNetworkConfig = {
  coordinator: string;
  keyHash: string;
  callbackGasLimit: number;
  requestConfirmations: number;
  nativePayment: boolean;
};

const VRF_BY_NETWORK: Record<string, VrfNetworkConfig> = {
  mainnet: {
    coordinator: "0xD7f86b4b8Cae7D942340FF628F82735b7a20893a",
    keyHash: "0x8077df514608a09f83e4e8d300645594e5d7234665448ba83f51a50f842bd3d9",
    callbackGasLimit: 1_500_000,
    requestConfirmations: 3,
    nativePayment: true,
  },
  sepolia: {
    coordinator: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
    keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
    callbackGasLimit: 1_500_000,
    requestConfirmations: 3,
    nativePayment: true,
  },
};

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error(`Invalid boolean env value: ${value}`);
}

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer env value: ${value}`);
  }
  return parsed;
}

function getSubscriptionId(networkName: string): bigint {
  const scopedKey = `CHAINLINK_VRF_SUBSCRIPTION_ID_${networkName.toUpperCase()}`;
  const rawValue = process.env[scopedKey] ?? process.env.CHAINLINK_VRF_SUBSCRIPTION_ID;
  if (!rawValue) {
    throw new Error(
      `Missing Chainlink VRF subscription id. Set ${scopedKey} or CHAINLINK_VRF_SUBSCRIPTION_ID before deploying to ${networkName}.`,
    );
  }
  return BigInt(rawValue);
}

const deployLuckyScratch: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, getOrNull, log } = hre.deployments;
  const networkName = hre.network.name;
  const paymentTokenAddress = CUSDC_BY_NETWORK[networkName];
  const vrfConfig = VRF_BY_NETWORK[networkName];

  if (!paymentTokenAddress) {
    throw new Error(
      `LuckyScratch deployment is only configured for networks with a real cUSDC address. Supported networks: ${Object.keys(CUSDC_BY_NETWORK).join(", ")}.`,
    );
  }
  if (!vrfConfig) {
    throw new Error(
      `LuckyScratch deployment is only configured for networks with a Chainlink VRF coordinator. Supported networks: ${Object.keys(VRF_BY_NETWORK).join(", ")}.`,
    );
  }

  const subscriptionId = getSubscriptionId(networkName);
  const callbackGasLimit = parseIntegerEnv(process.env.CHAINLINK_VRF_CALLBACK_GAS_LIMIT, vrfConfig.callbackGasLimit);
  const requestConfirmations = parseIntegerEnv(
    process.env.CHAINLINK_VRF_REQUEST_CONFIRMATIONS,
    vrfConfig.requestConfirmations,
  );
  const nativePayment = parseBooleanEnv(process.env.CHAINLINK_VRF_NATIVE_PAYMENT, vrfConfig.nativePayment);
  const keyHash = process.env.CHAINLINK_VRF_KEY_HASH ?? vrfConfig.keyHash;
  const coordinator = process.env.CHAINLINK_VRF_COORDINATOR ?? vrfConfig.coordinator;

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
        args: [deployer, coordinator, subscriptionId, keyHash, callbackGasLimit, requestConfirmations, nativePayment],
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
  log(`LuckyScratch VRF coordinator: ${coordinator}`);
  log(`LuckyScratch VRF subscription id: ${subscriptionId.toString()}`);
  log(`LuckyScratch VRF native payment: ${nativePayment}`);
};

export default deployLuckyScratch;

deployLuckyScratch.tags = ["LuckyScratch"];
