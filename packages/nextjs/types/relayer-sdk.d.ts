declare global {
  interface Window {
    relayerSDK?: import("~~/services/fhevm/types").RelayerSDKModule;
  }
}

export {};
