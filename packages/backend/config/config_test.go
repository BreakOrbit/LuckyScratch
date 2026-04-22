package config

import "testing"

func TestDefaultZamaConfigForSepolia(t *testing.T) {
	t.Parallel()

	cfg := defaultZamaConfig(11155111)
	if !cfg.Enabled() {
		t.Fatal("expected sepolia Zama config to be enabled")
	}
	if cfg.RelayerURL == "" {
		t.Fatal("expected sepolia relayer url default")
	}
	if cfg.GatewayChainID != 10901 {
		t.Fatalf("expected gateway chain id 10901, got %d", cfg.GatewayChainID)
	}
	if cfg.VerifyingContractAddressDecryption == "" {
		t.Fatal("expected decryption verifying contract default")
	}
}
