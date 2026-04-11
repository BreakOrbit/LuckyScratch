package contracts

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	contractabi "github.com/yangyang/lucky-scratch/packages/backend/internal/contracts/abi"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

const (
	CoreContractName     = "LuckyScratchCore"
	TicketContractName   = "LuckyScratchTicket"
	TreasuryContractName = "LuckyScratchTreasury"
	VRFContractName      = "LuckyScratchVRFAdapter"
)

var RequiredContractNames = []string{
	CoreContractName,
	TicketContractName,
	TreasuryContractName,
	VRFContractName,
}

type Deployment struct {
	Name             string
	Address          common.Address
	ABI              abi.ABI
	DeploymentBlock  uint64
	DeploymentTxHash common.Hash
	ArtifactPath     string
}

type Registry struct {
	ChainID     int64
	ChainName   string
	Deployments map[string]Deployment
}

func (r Registry) Get(name string) (Deployment, bool) {
	deployment, ok := r.Deployments[name]
	return deployment, ok
}

func (r Registry) Must(name string) (Deployment, error) {
	deployment, ok := r.Get(name)
	if !ok {
		return Deployment{}, fmt.Errorf("missing deployment for %s", name)
	}
	return deployment, nil
}

func (r Registry) StartBlock() uint64 {
	if len(r.Deployments) == 0 {
		return 0
	}

	values := make([]Deployment, 0, len(r.Deployments))
	for _, deployment := range r.Deployments {
		values = append(values, deployment)
	}
	sort.Slice(values, func(i, j int) bool {
		return values[i].DeploymentBlock < values[j].DeploymentBlock
	})
	return values[0].DeploymentBlock
}

func ImportArtifacts(ctx context.Context, queries *db.Queries, cfg config.Config) error {
	for _, name := range RequiredContractNames {
		path := filepath.Join(cfg.Deployments.Dir, cfg.Chain.Name, name+".json")
		artifact, _, err := contractabi.LoadArtifact(path)
		if err != nil {
			return fmt.Errorf("load deployment artifact %s: %w", name, err)
		}

		txHash := artifact.TransactionHash
		if txHash == "" {
			txHash = artifact.Receipt.TransactionHash
		}

		_, err = queries.UpsertDeployment(ctx, db.UpsertDeploymentParams{
			ChainID:           cfg.Chain.ID,
			ChainName:         cfg.Chain.Name,
			ContractName:      name,
			ContractAddress:   artifact.Address,
			DeploymentBlock:   int64(artifact.Receipt.BlockNumber),
			DeploymentTxHash:  txHash,
			DeploymentVersion: cfg.Deployments.Version,
			AbiSourcePath:     path,
			IsActive:          true,
		})
		if err != nil {
			return fmt.Errorf("upsert deployment %s: %w", name, err)
		}
	}

	return nil
}

func LoadRegistry(ctx context.Context, queries *db.Queries, cfg config.Config) (Registry, error) {
	rows, err := queries.ListActiveDeployments(ctx, cfg.Chain.ID)
	if err != nil {
		return Registry{}, fmt.Errorf("list active deployments: %w", err)
	}

	registry := Registry{
		ChainID:     cfg.Chain.ID,
		ChainName:   cfg.Chain.Name,
		Deployments: make(map[string]Deployment, len(rows)),
	}

	for _, row := range rows {
		artifactPath := row.AbiSourcePath
		if artifactPath == "" {
			artifactPath = filepath.Join(cfg.Deployments.Dir, cfg.Chain.Name, row.ContractName+".json")
		}

		artifact, parsedABI, err := contractabi.LoadArtifact(artifactPath)
		if err != nil {
			return Registry{}, fmt.Errorf("load ABI for %s: %w", row.ContractName, err)
		}

		txHash := row.DeploymentTxHash
		if txHash == "" {
			txHash = artifact.TransactionHash
		}

		registry.Deployments[row.ContractName] = Deployment{
			Name:             row.ContractName,
			Address:          common.HexToAddress(row.ContractAddress),
			ABI:              parsedABI,
			DeploymentBlock:  uint64(row.DeploymentBlock),
			DeploymentTxHash: common.HexToHash(txHash),
			ArtifactPath:     artifactPath,
		}
	}

	for _, name := range RequiredContractNames {
		if _, ok := registry.Deployments[name]; !ok {
			return Registry{}, fmt.Errorf("active deployment for %s not found", name)
		}
	}

	return registry, nil
}
