import * as dotenv from "dotenv";
dotenv.config();
import { Wallet } from "ethers";
import password from "@inquirer/password";
import { spawn } from "child_process";
import { config } from "hardhat";

function runHardhatCommand(args: string[], env = process.env): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("hardhat", args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", code => resolve(code ?? 0));
  });
}

/**
 * Unencrypts the private key and runs the hardhat deploy command
 */
async function main() {
  const networkIndex = process.argv.indexOf("--network");
  const networkName = networkIndex !== -1 ? process.argv[networkIndex + 1] : config.defaultNetwork;

  if (networkName === "localhost" || networkName === "hardhat") {
    // Deploy command on the localhost network
    const exitCode = await runHardhatCommand(["deploy", ...process.argv.slice(2)]);
    process.exit(exitCode);
    return;
  }

  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;

  if (!encryptedKey) {
    console.log("🚫️ You don't have a deployer account. Run `yarn generate` or `yarn account:import` first");
    return;
  }

  const pass = await password({ message: "Enter password to decrypt private key:" });

  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedKey, pass);
    const deployEnv = {
      ...process.env,
      __RUNTIME_DEPLOYER_PRIVATE_KEY: wallet.privateKey,
    };
    const deployArgs = process.argv.slice(2);

    if (!deployArgs.includes("--no-compile")) {
      const compileExitCode = await runHardhatCommand(["compile", "--network", "hardhat"], deployEnv);
      if (compileExitCode !== 0) {
        process.exit(compileExitCode);
      }
      deployArgs.push("--no-compile");
    }

    const deployExitCode = await runHardhatCommand(["deploy", ...deployArgs], deployEnv);
    process.exit(deployExitCode);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.error("Failed to decrypt private key. Wrong password?");
    process.exit(1);
  }
}

main().catch(console.error);
