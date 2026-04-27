import { createTicketRelayerInstance } from "~~/services/fhevm/sdk";
import type { PublicDecryptResults } from "~~/services/fhevm/types";
import type { RevealAuthResponse } from "~~/services/luckyScratch/types";

export type TicketClaimProof = {
  clearRewardAmount: bigint;
  decryptionProof: `0x${string}`;
  handle: string;
};

const MAX_UINT64 = (1n << 64n) - 1n;

const normalizeHex = (value: string) => value.trim().toLowerCase();

const clearValueToBigInt = (value: bigint | number | boolean | string) => {
  if (typeof value === "boolean") {
    throw new Error("Relayer returned a boolean clear value for the reward amount.");
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error("Relayer returned an invalid numeric reward amount.");
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Relayer returned an empty reward amount.");
  }
  return BigInt(trimmed);
};

const getClearRewardAmount = (result: PublicDecryptResults, handle: string) => {
  const directValue = result.clearValues[handle] ?? result.clearValues[normalizeHex(handle)];
  if (directValue != null) {
    return clearValueToBigInt(directValue);
  }

  const normalizedHandle = normalizeHex(handle);
  for (const [key, value] of Object.entries(result.clearValues)) {
    if (normalizeHex(key) === normalizedHandle) {
      return clearValueToBigInt(value);
    }
  }

  const fallbackValue = Object.values(result.clearValues)[0];
  if (fallbackValue == null) {
    throw new Error("Relayer did not return a decrypted reward amount.");
  }
  return clearValueToBigInt(fallbackValue);
};

export const buildTicketClaimProof = async ({
  chainId,
  revealAuth,
}: {
  chainId: number;
  revealAuth: RevealAuthResponse;
}): Promise<TicketClaimProof> => {
  const zama = revealAuth.authPayload.zama;
  if (!zama) {
    throw new Error("Reveal authorization does not include a Zama relayer context.");
  }

  const handle = zama.claimProof.handles[0] || revealAuth.authPayload.encryptedPrizeHandle;
  if (!handle) {
    throw new Error("Reveal authorization does not include an encrypted reward handle.");
  }

  const instance = await createTicketRelayerInstance({
    chainId,
    sdkConfig: zama.sdkConfig,
  });
  const result = await instance.publicDecrypt([handle]);
  const clearRewardAmount = getClearRewardAmount(result, handle);

  if (clearRewardAmount < 0n || clearRewardAmount > MAX_UINT64) {
    throw new Error("Decrypted reward amount is outside the uint64 claim range.");
  }
  if (!result.decryptionProof) {
    throw new Error("Relayer did not return a reward decryption proof.");
  }

  return {
    clearRewardAmount,
    decryptionProof: result.decryptionProof,
    handle,
  };
};
