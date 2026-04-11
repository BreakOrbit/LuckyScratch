package chain

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/yangyang/lucky-scratch/packages/backend/internal/config"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/contracts"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/contracts/bindings"
	"github.com/yangyang/lucky-scratch/packages/backend/internal/store/db"
)

var erc20ABI = mustABI(`[{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]`)

type Client struct {
	cfg          config.Config
	rpc          *ethclient.Client
	registry     contracts.Registry
	core         *bindings.Core
	ticket       *bindings.Ticket
	treasuryABI  gethabi.ABI
	treasuryAddr common.Address
}

func NewClient(ctx context.Context, cfg config.Config, queries *db.Queries) (*Client, error) {
	if strings.TrimSpace(cfg.Chain.RPCURL) == "" {
		return nil, errors.New("RPC_URL is required")
	}

	if cfg.Deployments.AutoImport {
		if err := contracts.ImportArtifacts(ctx, queries, cfg); err != nil {
			return nil, err
		}
	}

	registry, err := contracts.LoadRegistry(ctx, queries, cfg)
	if err != nil {
		return nil, err
	}

	rpc, err := ethclient.DialContext(ctx, cfg.Chain.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("dial RPC: %w", err)
	}

	coreDeployment, _ := registry.Get(contracts.CoreContractName)
	ticketDeployment, _ := registry.Get(contracts.TicketContractName)
	treasuryDeployment, _ := registry.Get(contracts.TreasuryContractName)

	return &Client{
		cfg:          cfg,
		rpc:          rpc,
		registry:     registry,
		core:         bindings.NewCore(coreDeployment.Address, coreDeployment.ABI, rpc),
		ticket:       bindings.NewTicket(ticketDeployment.Address, ticketDeployment.ABI, rpc),
		treasuryABI:  treasuryDeployment.ABI,
		treasuryAddr: treasuryDeployment.Address,
	}, nil
}

func (c *Client) Close() {
	if c.rpc != nil {
		c.rpc.Close()
	}
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.rpc.BlockNumber(ctx)
	return err
}

func (c *Client) Registry() contracts.Registry {
	return c.registry
}

func (c *Client) StartBlock() uint64 {
	return c.registry.StartBlock()
}

func (c *Client) BlockNumber(ctx context.Context) (uint64, error) {
	return c.rpc.BlockNumber(ctx)
}

func (c *Client) HeaderByNumber(ctx context.Context, number *big.Int) (*types.Header, error) {
	return c.rpc.HeaderByNumber(ctx, number)
}

func (c *Client) TransactionReceipt(ctx context.Context, hash common.Hash) (*types.Receipt, error) {
	return c.rpc.TransactionReceipt(ctx, hash)
}

func (c *Client) TransactionByHash(ctx context.Context, hash common.Hash) (*types.Transaction, bool, error) {
	return c.rpc.TransactionByHash(ctx, hash)
}

func (c *Client) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	return c.rpc.SendTransaction(ctx, tx)
}

func (c *Client) FilterLogs(ctx context.Context, query ethereum.FilterQuery) ([]types.Log, error) {
	return c.rpc.FilterLogs(ctx, query)
}

func (c *Client) EstimateGas(ctx context.Context, msg ethereum.CallMsg) (uint64, error) {
	return c.rpc.EstimateGas(ctx, msg)
}

func (c *Client) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	return c.rpc.SuggestGasPrice(ctx)
}

func (c *Client) BalanceAt(ctx context.Context, account common.Address) (*big.Int, error) {
	return c.rpc.BalanceAt(ctx, account, nil)
}

func (c *Client) CoreAddress() common.Address {
	return c.core.Address()
}

func (c *Client) TicketAddress() common.Address {
	return c.ticket.Address()
}

func (c *Client) TreasuryAddress() common.Address {
	return c.treasuryAddr
}

func (c *Client) CoreABI() bindings.Core {
	return *c.core
}

func (c *Client) EstimateGaslessPurchase(ctx context.Context, relayer common.Address, req bindings.GaslessRequest, signature []byte, poolID uint64, quantity uint32) (uint64, *big.Int, error) {
	data, err := c.core.PackExecuteGaslessPurchase(req, signature, poolID, quantity)
	if err != nil {
		return 0, nil, err
	}
	return c.estimateGas(ctx, relayer, data)
}

func (c *Client) EstimateGaslessPurchaseSelection(ctx context.Context, relayer common.Address, req bindings.GaslessRequest, signature []byte, poolID uint64, indexes []uint32) (uint64, *big.Int, error) {
	data, err := c.core.PackExecuteGaslessPurchaseSelection(req, signature, poolID, indexes)
	if err != nil {
		return 0, nil, err
	}
	return c.estimateGas(ctx, relayer, data)
}

func (c *Client) EstimateGaslessScratch(ctx context.Context, relayer common.Address, req bindings.GaslessRequest, signature []byte, ticketID uint64) (uint64, *big.Int, error) {
	data, err := c.core.PackExecuteGaslessScratch(req, signature, ticketID)
	if err != nil {
		return 0, nil, err
	}
	return c.estimateGas(ctx, relayer, data)
}

func (c *Client) EstimateGaslessBatchScratch(ctx context.Context, relayer common.Address, req bindings.GaslessRequest, signature []byte, ticketIDs []uint64) (uint64, *big.Int, error) {
	ids := make([]*big.Int, 0, len(ticketIDs))
	for _, ticketID := range ticketIDs {
		ids = append(ids, new(big.Int).SetUint64(ticketID))
	}

	data, err := c.core.PackExecuteGaslessBatchScratch(req, signature, ids)
	if err != nil {
		return 0, nil, err
	}
	return c.estimateGas(ctx, relayer, data)
}

func (c *Client) PoolConfig(ctx context.Context, poolID uint64) (bindings.PoolConfig, error) {
	return c.core.PoolConfig(ctx, poolID)
}

func (c *Client) PoolState(ctx context.Context, poolID uint64) (bindings.PoolState, error) {
	return c.core.PoolState(ctx, poolID)
}

func (c *Client) PoolAccounting(ctx context.Context, poolID uint64) (bindings.PoolAccounting, error) {
	return c.core.PoolAccounting(ctx, poolID)
}

func (c *Client) RoundState(ctx context.Context, poolID uint64, roundID uint64) (bindings.RoundState, error) {
	return c.core.RoundState(ctx, poolID, roundID)
}

func (c *Client) TicketData(ctx context.Context, ticketID uint64) (bindings.TicketData, error) {
	return c.core.Ticket(ctx, ticketID)
}

func (c *Client) TicketRevealState(ctx context.Context, ticketID uint64) (uint8, bool, error) {
	return c.core.TicketRevealState(ctx, ticketID)
}

func (c *Client) TicketPrizeHandle(ctx context.Context, ticketID uint64) ([32]byte, error) {
	return c.core.TicketPrizeHandle(ctx, ticketID)
}

func (c *Client) OwnerOf(ctx context.Context, ticketID uint64) (common.Address, error) {
	return c.ticket.OwnerOf(ctx, ticketID)
}

func (c *Client) Nonce(ctx context.Context, user common.Address) (*big.Int, error) {
	return c.core.Nonce(ctx, user)
}

func (c *Client) ClaimableCreatorProfit(ctx context.Context, poolID uint64) (*big.Int, error) {
	return c.core.ClaimableCreatorProfit(ctx, poolID)
}

func (c *Client) TreasuryToken(ctx context.Context) (common.Address, error) {
	values, err := c.callView(ctx, c.treasuryAddr, c.treasuryABI, "token")
	if err != nil {
		return common.Address{}, err
	}
	if len(values) != 1 {
		return common.Address{}, fmt.Errorf("unexpected token() result length %d", len(values))
	}

	token, ok := values[0].(common.Address)
	if !ok {
		return common.Address{}, fmt.Errorf("unexpected token() return type %T", values[0])
	}
	return token, nil
}

func (c *Client) ERC20Allowance(ctx context.Context, token common.Address, owner common.Address, spender common.Address) (*big.Int, error) {
	values, err := c.callView(ctx, token, erc20ABI, "allowance", owner, spender)
	if err != nil {
		return nil, err
	}
	if len(values) != 1 {
		return nil, fmt.Errorf("unexpected allowance() result length %d", len(values))
	}

	allowance, ok := values[0].(*big.Int)
	if !ok {
		return nil, fmt.Errorf("unexpected allowance() return type %T", values[0])
	}
	return allowance, nil
}

func (c *Client) NewRelayerTransactor(ctx context.Context) (*bind.TransactOpts, common.Address, error) {
	if strings.TrimSpace(c.cfg.Relayer.PrivateKey) == "" {
		return nil, common.Address{}, errors.New("RELAYER_PRIVATE_KEY is required")
	}

	privateKey, err := crypto.HexToECDSA(c.cfg.Relayer.PrivateKey)
	if err != nil {
		return nil, common.Address{}, fmt.Errorf("decode relayer private key: %w", err)
	}

	chainID := big.NewInt(c.cfg.Chain.ID)
	opts, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return nil, common.Address{}, fmt.Errorf("create relayer transactor: %w", err)
	}

	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	opts.Context = ctx
	return opts, from, nil
}

func (c *Client) RelayerAddress() (common.Address, error) {
	if strings.TrimSpace(c.cfg.Relayer.PrivateKey) == "" {
		return common.Address{}, errors.New("RELAYER_PRIVATE_KEY is required")
	}

	privateKey, err := crypto.HexToECDSA(c.cfg.Relayer.PrivateKey)
	if err != nil {
		return common.Address{}, err
	}
	return publicAddress(privateKey), nil
}

func (c *Client) ExecuteGaslessPurchase(ctx context.Context, req bindings.GaslessRequest, signature []byte, poolID uint64, quantity uint32) (*types.Transaction, common.Address, error) {
	tx, from, err := c.BuildGaslessPurchaseTx(ctx, req, signature, poolID, quantity)
	if err != nil {
		return nil, common.Address{}, err
	}
	return tx, from, c.SendTransaction(ctx, tx)
}

func (c *Client) BuildGaslessPurchaseTx(ctx context.Context, req bindings.GaslessRequest, signature []byte, poolID uint64, quantity uint32) (*types.Transaction, common.Address, error) {
	opts, from, err := c.NewRelayerTransactor(ctx)
	if err != nil {
		return nil, common.Address{}, err
	}
	opts.NoSend = true
	tx, err := c.core.ExecuteGaslessPurchase(opts, req, signature, poolID, quantity)
	return tx, from, err
}

func (c *Client) ExecuteGaslessPurchaseSelection(ctx context.Context, req bindings.GaslessRequest, signature []byte, poolID uint64, indexes []uint32) (*types.Transaction, common.Address, error) {
	tx, from, err := c.BuildGaslessPurchaseSelectionTx(ctx, req, signature, poolID, indexes)
	if err != nil {
		return nil, common.Address{}, err
	}
	return tx, from, c.SendTransaction(ctx, tx)
}

func (c *Client) BuildGaslessPurchaseSelectionTx(ctx context.Context, req bindings.GaslessRequest, signature []byte, poolID uint64, indexes []uint32) (*types.Transaction, common.Address, error) {
	opts, from, err := c.NewRelayerTransactor(ctx)
	if err != nil {
		return nil, common.Address{}, err
	}
	opts.NoSend = true
	tx, err := c.core.ExecuteGaslessPurchaseSelection(opts, req, signature, poolID, indexes)
	return tx, from, err
}

func (c *Client) ExecuteGaslessScratch(ctx context.Context, req bindings.GaslessRequest, signature []byte, ticketID uint64) (*types.Transaction, common.Address, error) {
	tx, from, err := c.BuildGaslessScratchTx(ctx, req, signature, ticketID)
	if err != nil {
		return nil, common.Address{}, err
	}
	return tx, from, c.SendTransaction(ctx, tx)
}

func (c *Client) BuildGaslessScratchTx(ctx context.Context, req bindings.GaslessRequest, signature []byte, ticketID uint64) (*types.Transaction, common.Address, error) {
	opts, from, err := c.NewRelayerTransactor(ctx)
	if err != nil {
		return nil, common.Address{}, err
	}
	opts.NoSend = true
	tx, err := c.core.ExecuteGaslessScratch(opts, req, signature, ticketID)
	return tx, from, err
}

func (c *Client) ExecuteGaslessBatchScratch(ctx context.Context, req bindings.GaslessRequest, signature []byte, ticketIDs []uint64) (*types.Transaction, common.Address, error) {
	tx, from, err := c.BuildGaslessBatchScratchTx(ctx, req, signature, ticketIDs)
	if err != nil {
		return nil, common.Address{}, err
	}
	return tx, from, c.SendTransaction(ctx, tx)
}

func (c *Client) BuildGaslessBatchScratchTx(ctx context.Context, req bindings.GaslessRequest, signature []byte, ticketIDs []uint64) (*types.Transaction, common.Address, error) {
	opts, from, err := c.NewRelayerTransactor(ctx)
	if err != nil {
		return nil, common.Address{}, err
	}
	opts.NoSend = true

	ids := make([]*big.Int, 0, len(ticketIDs))
	for _, ticketID := range ticketIDs {
		ids = append(ids, new(big.Int).SetUint64(ticketID))
	}

	tx, err := c.core.ExecuteGaslessBatchScratch(opts, req, signature, ids)
	return tx, from, err
}

func publicAddress(privateKey *ecdsa.PrivateKey) common.Address {
	return crypto.PubkeyToAddress(privateKey.PublicKey)
}

func (c *Client) callView(ctx context.Context, contract common.Address, parsedABI gethabi.ABI, method string, args ...interface{}) ([]interface{}, error) {
	data, err := parsedABI.Pack(method, args...)
	if err != nil {
		return nil, err
	}

	raw, err := c.rpc.CallContract(ctx, ethereum.CallMsg{
		To:   ptr(contract),
		Data: data,
	}, nil)
	if err != nil {
		return nil, err
	}
	return parsedABI.Unpack(method, raw)
}

func (c *Client) estimateGas(ctx context.Context, relayer common.Address, data []byte) (uint64, *big.Int, error) {
	gasLimit, err := c.rpc.EstimateGas(ctx, ethereum.CallMsg{
		From: relayer,
		To:   ptr(c.core.Address()),
		Data: data,
	})
	if err != nil {
		return 0, nil, err
	}

	gasPrice, err := c.rpc.SuggestGasPrice(ctx)
	if err != nil {
		return 0, nil, err
	}

	totalCost := new(big.Int).Mul(new(big.Int).SetUint64(gasLimit), gasPrice)
	return gasLimit, totalCost, nil
}

func ptr[T any](value T) *T {
	return &value
}

func mustABI(raw string) gethabi.ABI {
	parsed, err := gethabi.JSON(strings.NewReader(raw))
	if err != nil {
		panic(err)
	}
	return parsed
}
