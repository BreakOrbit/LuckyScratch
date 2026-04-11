package abi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
)

type Artifact struct {
	Address         string          `json:"address"`
	ABI             json.RawMessage `json:"abi"`
	TransactionHash string          `json:"transactionHash"`
	Receipt         ArtifactReceipt `json:"receipt"`
}

type ArtifactReceipt struct {
	BlockNumber     uint64 `json:"blockNumber"`
	TransactionHash string `json:"transactionHash"`
}

func LoadArtifact(path string) (Artifact, gethabi.ABI, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Artifact{}, gethabi.ABI{}, fmt.Errorf("read artifact: %w", err)
	}

	var artifact Artifact
	if err := json.Unmarshal(raw, &artifact); err != nil {
		return Artifact{}, gethabi.ABI{}, fmt.Errorf("decode artifact: %w", err)
	}

	parsed, err := gethabi.JSON(bytes.NewReader(artifact.ABI))
	if err != nil {
		return Artifact{}, gethabi.ABI{}, fmt.Errorf("parse ABI: %w", err)
	}

	return artifact, parsed, nil
}
