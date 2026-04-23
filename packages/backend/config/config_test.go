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

func TestDefaultCORSAllowedOriginsForDevelopment(t *testing.T) {
	t.Parallel()

	origins := defaultCORSAllowedOrigins("development")
	if len(origins) != 2 {
		t.Fatalf("expected 2 default dev origins, got %d", len(origins))
	}
	if origins[0] != "http://localhost:3000" {
		t.Fatalf("unexpected first default dev origin: %q", origins[0])
	}
}

func TestDefaultCORSAllowedOriginsForProduction(t *testing.T) {
	t.Parallel()

	origins := defaultCORSAllowedOrigins("production")
	if len(origins) != 0 {
		t.Fatalf("expected no default prod origins, got %#v", origins)
	}
}
