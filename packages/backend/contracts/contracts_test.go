package contracts

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"lucky-scratch/config"
	"lucky-scratch/store/db"
)

func TestBuildRegistryFromRowsPrefersLatestDeploymentPerContract(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	chainName := "sepolia"
	chainDir := filepath.Join(tempDir, chainName)
	if err := os.MkdirAll(chainDir, 0o755); err != nil {
		t.Fatalf("mkdir chain dir: %v", err)
	}

	writeArtifact := func(name string, address string, block uint64) string {
		t.Helper()

		path := filepath.Join(chainDir, name+"-"+address+".json")
		payload := map[string]any{
			"address":         address,
			"abi":             []any{},
			"transactionHash": "0x01",
			"receipt": map[string]any{
				"blockNumber":     block,
				"transactionHash": "0x01",
			},
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal artifact: %v", err)
		}
		if err := os.WriteFile(path, raw, 0o644); err != nil {
			t.Fatalf("write artifact: %v", err)
		}
		return path
	}

	coreNew := writeArtifact(CoreContractName, "0x0000000000000000000000000000000000000004", 40)
	coreOld := writeArtifact(CoreContractName, "0x0000000000000000000000000000000000000001", 10)
	ticketPath := writeArtifact(TicketContractName, "0x0000000000000000000000000000000000000002", 20)
	treasuryPath := writeArtifact(TreasuryContractName, "0x0000000000000000000000000000000000000003", 30)
	vrfPath := writeArtifact(VRFContractName, "0x0000000000000000000000000000000000000005", 50)

	cfg := config.Config{}
	cfg.Chain.ID = 11155111
	cfg.Chain.Name = chainName
	cfg.Deployments.Dir = tempDir

	rows := []db.DeploymentRegistry{
		{ChainID: cfg.Chain.ID, ChainName: chainName, ContractName: CoreContractName, ContractAddress: "0x0000000000000000000000000000000000000004", DeploymentBlock: 40, AbiSourcePath: coreNew, IsActive: true},
		{ChainID: cfg.Chain.ID, ChainName: chainName, ContractName: CoreContractName, ContractAddress: "0x0000000000000000000000000000000000000001", DeploymentBlock: 10, AbiSourcePath: coreOld, IsActive: true},
		{ChainID: cfg.Chain.ID, ChainName: chainName, ContractName: TicketContractName, ContractAddress: "0x0000000000000000000000000000000000000002", DeploymentBlock: 20, AbiSourcePath: ticketPath, IsActive: true},
		{ChainID: cfg.Chain.ID, ChainName: chainName, ContractName: TreasuryContractName, ContractAddress: "0x0000000000000000000000000000000000000003", DeploymentBlock: 30, AbiSourcePath: treasuryPath, IsActive: true},
		{ChainID: cfg.Chain.ID, ChainName: chainName, ContractName: VRFContractName, ContractAddress: "0x0000000000000000000000000000000000000005", DeploymentBlock: 50, AbiSourcePath: vrfPath, IsActive: true},
	}

	registry, err := buildRegistryFromRows(rows, cfg)
	if err != nil {
		t.Fatalf("build registry: %v", err)
	}

	if got := registry.Deployments[CoreContractName].Address.Hex(); got != "0x0000000000000000000000000000000000000004" {
		t.Fatalf("expected latest core deployment, got %s", got)
	}
}
