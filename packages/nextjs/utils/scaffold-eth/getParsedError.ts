import { BaseError as BaseViemError, ContractFunctionRevertedError } from "viem";

const KNOWN_EXTERNAL_ERROR_MESSAGES: Record<string, string> = {
  "0x5ff91cdc":
    "cUSDC rejected the transfer with ERC7984ZeroBalance(address). Mint and wrap Sepolia cUSDC from the faucet, then authorize LuckyScratchTreasury before purchasing tickets.",
  "0x79bfd401":
    "Chainlink VRF rejected the request with InvalidConsumer(uint256,address). Add the deployed LuckyScratchVRFAdapter address as a consumer on the configured VRF subscription, make sure the subscription is funded, then retry creating the pool.",
};

export const getKnownExternalErrorMessage = (message?: string): string | undefined => {
  const selector = message?.match(/0x[a-fA-F0-9]{8}/)?.[0]?.toLowerCase();
  return selector ? KNOWN_EXTERNAL_ERROR_MESSAGES[selector] : undefined;
};

/**
 * Parses an viem/wagmi error to get a displayable string
 * @param e - error object
 * @returns parsed error string
 */
export const getParsedError = (error: any): string => {
  const parsedError = error?.walk ? error.walk() : error;

  if (parsedError instanceof BaseViemError) {
    if (parsedError.details) {
      const knownExternalError = getKnownExternalErrorMessage(parsedError.details);
      if (knownExternalError) {
        return knownExternalError;
      }

      return parsedError.details;
    }

    if (parsedError.shortMessage) {
      const knownExternalError = getKnownExternalErrorMessage(parsedError.shortMessage);
      if (knownExternalError) {
        return knownExternalError;
      }

      if (
        parsedError instanceof ContractFunctionRevertedError &&
        parsedError.data &&
        parsedError.data.errorName !== "Error"
      ) {
        const customErrorArgs = parsedError.data.args?.toString() ?? "";
        return `${parsedError.shortMessage.replace(/reverted\.$/, "reverted with the following reason:")}\n${
          parsedError.data.errorName
        }(${customErrorArgs})`;
      }

      return parsedError.shortMessage;
    }

    return parsedError.message ?? parsedError.name ?? "An unknown error occurred";
  }

  const fallbackMessage = parsedError?.message ?? "An unknown error occurred";
  return getKnownExternalErrorMessage(fallbackMessage) ?? fallbackMessage;
};
