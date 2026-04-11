package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	App         AppConfig
	API         APIConfig
	Database    DatabaseConfig
	Chain       ChainConfig
	Deployments DeploymentsConfig
	Relayer     RelayerConfig
	Risk        RiskConfig
	Reveal      RevealConfig
	Zama        ZamaConfig
	Jobs        JobsConfig
	Admin       AdminConfig
}

type AppConfig struct {
	Env         string
	LogLevel    string
	ProjectRoot string
	BackendRoot string
}

type APIConfig struct {
	Host              string
	Port              int
	PublicBaseURL     string
	ReadHeaderTimeout time.Duration
	ShutdownTimeout   time.Duration
}

type DatabaseConfig struct {
	URL         string
	AutoMigrate bool
	MinConns    int32
	MaxConns    int32
	Migrations  string
}

type ChainConfig struct {
	ID                int64
	Name              string
	RPCURL            string
	Confirmations     uint64
	FinalizationDepth uint64
	ReorgLookback     uint64
	PollInterval      time.Duration
}

type DeploymentsConfig struct {
	Dir        string
	AutoImport bool
	Version    string
}

type RelayerConfig struct {
	PrivateKey           string
	MaxBatchTickets      int
	MaxGasCostWei        int64
	HealthMinBalanceWei  int64
	ReceiptSyncBatchSize int
	RetryBackoff         time.Duration
}

type RiskConfig struct {
	GlobalSponsorBudgetWei      int64
	DefaultPoolSponsorBudgetWei int64
	UserWindow                  time.Duration
	UserWindowMaxRequests       int
	RevealUnitCostWei           int64
}

type RevealConfig struct {
	AuthTTL       time.Duration
	SubmitTimeout time.Duration
}

type ZamaConfig struct {
	Mode                                      string
	RelayerURL                                string
	APIKey                                    string
	HTTPTimeout                               time.Duration
	GatewayChainID                            int64
	FhevmExecutorContractAddress              string
	AclContractAddress                        string
	HCUContractAddress                        string
	KMSVerifierContractAddress                string
	InputVerifierContractAddress              string
	VerifyingContractAddressDecryption        string
	VerifyingContractAddressInputVerification string
	UserDecryptDurationDays                   int
	MaxUserDecryptBits                        int
}

type JobsConfig struct {
	WorkerID              string
	ClaimBatchSize        int
	LockTimeout           time.Duration
	IndexerInterval       time.Duration
	ReceiptSyncInterval   time.Duration
	RetryFailedTxInterval time.Duration
	VRFCheckInterval      time.Duration
	ReconcileInterval     time.Duration
}

type AdminConfig struct {
	Token string
}

func Load() Config {
	backendRoot, projectRoot := detectRoots()
	zamaDefaults := defaultZamaConfig(getEnvInt64("CHAIN_ID", 11155111))

	return Config{
		App: AppConfig{
			Env:         getEnv("APP_ENV", "development"),
			LogLevel:    getEnv("LOG_LEVEL", "info"),
			ProjectRoot: projectRoot,
			BackendRoot: backendRoot,
		},
		API: APIConfig{
			Host:              getEnv("API_HOST", "0.0.0.0"),
			Port:              getEnvInt("API_PORT", 8080),
			PublicBaseURL:     strings.TrimRight(getEnv("API_PUBLIC_BASE_URL", ""), "/"),
			ReadHeaderTimeout: getEnvDuration("API_READ_HEADER_TIMEOUT", 5*time.Second),
			ShutdownTimeout:   getEnvDuration("API_SHUTDOWN_TIMEOUT", 10*time.Second),
		},
		Database: DatabaseConfig{
			URL:         getEnv("DATABASE_URL", ""),
			AutoMigrate: getEnvBool("AUTO_MIGRATE", true),
			MinConns:    int32(getEnvInt("DATABASE_MIN_CONNS", 1)),
			MaxConns:    int32(getEnvInt("DATABASE_MAX_CONNS", 8)),
			Migrations:  getEnv("MIGRATIONS_DIR", filepath.Join(backendRoot, "migrations")),
		},
		Chain: ChainConfig{
			ID:                getEnvInt64("CHAIN_ID", 11155111),
			Name:              getEnv("CHAIN_NAME", "sepolia"),
			RPCURL:            getEnv("RPC_URL", ""),
			Confirmations:     uint64(getEnvInt("CHAIN_CONFIRMATIONS", 3)),
			FinalizationDepth: uint64(getEnvInt("CHAIN_FINALIZATION_DEPTH", 12)),
			ReorgLookback:     uint64(getEnvInt("CHAIN_REORG_LOOKBACK", 25)),
			PollInterval:      getEnvDuration("CHAIN_POLL_INTERVAL", 15*time.Second),
		},
		Deployments: DeploymentsConfig{
			Dir:        getEnv("DEPLOYMENTS_DIR", filepath.Join(projectRoot, "packages", "hardhat", "deployments")),
			AutoImport: getEnvBool("AUTO_IMPORT_DEPLOYMENTS", true),
			Version:    getEnv("DEPLOYMENT_VERSION", "v1"),
		},
		Relayer: RelayerConfig{
			PrivateKey:           strings.TrimPrefix(getEnv("RELAYER_PRIVATE_KEY", ""), "0x"),
			MaxBatchTickets:      getEnvInt("RELAYER_MAX_BATCH_TICKETS", 20),
			MaxGasCostWei:        getEnvInt64("RELAYER_MAX_GAS_COST_WEI", 30_000_000_000_000_000),
			HealthMinBalanceWei:  getEnvInt64("RELAYER_MIN_BALANCE_WEI", 20_000_000_000_000_000),
			ReceiptSyncBatchSize: getEnvInt("RELAYER_RECEIPT_SYNC_BATCH_SIZE", 50),
			RetryBackoff:         getEnvDuration("RELAYER_RETRY_BACKOFF", 30*time.Second),
		},
		Risk: RiskConfig{
			GlobalSponsorBudgetWei:      getEnvInt64("RISK_GLOBAL_SPONSOR_BUDGET_WEI", 500_000_000_000_000_000),
			DefaultPoolSponsorBudgetWei: getEnvInt64("RISK_DEFAULT_POOL_SPONSOR_BUDGET_WEI", 100_000_000_000_000_000),
			UserWindow:                  getEnvDuration("RISK_USER_WINDOW", 10*time.Minute),
			UserWindowMaxRequests:       getEnvInt("RISK_USER_WINDOW_MAX_REQUESTS", 20),
			RevealUnitCostWei:           getEnvInt64("RISK_REVEAL_UNIT_COST_WEI", 0),
		},
		Reveal: RevealConfig{
			AuthTTL:       getEnvDuration("REVEAL_AUTH_TTL", 10*time.Minute),
			SubmitTimeout: getEnvDuration("REVEAL_SUBMIT_TIMEOUT", 2*time.Minute),
		},
		Zama: ZamaConfig{
			Mode:                               getEnv("ZAMA_MODE", zamaDefaults.Mode),
			RelayerURL:                         getEnv("ZAMA_RELAYER_URL", zamaDefaults.RelayerURL),
			APIKey:                             getEnv("ZAMA_API_KEY", ""),
			HTTPTimeout:                        getEnvDuration("ZAMA_HTTP_TIMEOUT", 30*time.Second),
			GatewayChainID:                     getEnvInt64("ZAMA_GATEWAY_CHAIN_ID", zamaDefaults.GatewayChainID),
			FhevmExecutorContractAddress:       getEnv("ZAMA_FHEVM_EXECUTOR_CONTRACT_ADDRESS", zamaDefaults.FhevmExecutorContractAddress),
			AclContractAddress:                 getEnv("ZAMA_ACL_CONTRACT_ADDRESS", zamaDefaults.AclContractAddress),
			HCUContractAddress:                 getEnv("ZAMA_HCU_CONTRACT_ADDRESS", zamaDefaults.HCUContractAddress),
			KMSVerifierContractAddress:         getEnv("ZAMA_KMS_VERIFIER_CONTRACT_ADDRESS", zamaDefaults.KMSVerifierContractAddress),
			InputVerifierContractAddress:       getEnv("ZAMA_INPUT_VERIFIER_CONTRACT_ADDRESS", zamaDefaults.InputVerifierContractAddress),
			VerifyingContractAddressDecryption: getEnv("ZAMA_DECRYPTION_ADDRESS", zamaDefaults.VerifyingContractAddressDecryption),
			VerifyingContractAddressInputVerification: getEnv("ZAMA_INPUT_VERIFICATION_ADDRESS", zamaDefaults.VerifyingContractAddressInputVerification),
			UserDecryptDurationDays:                   getEnvInt("ZAMA_USER_DECRYPT_DURATION_DAYS", zamaDefaults.UserDecryptDurationDays),
			MaxUserDecryptBits:                        getEnvInt("ZAMA_MAX_USER_DECRYPT_BITS", zamaDefaults.MaxUserDecryptBits),
		},
		Jobs: JobsConfig{
			WorkerID:              getEnv("WORKER_ID", hostnameOr("worker-1")),
			ClaimBatchSize:        getEnvInt("JOB_CLAIM_BATCH_SIZE", 8),
			LockTimeout:           getEnvDuration("JOB_LOCK_TIMEOUT", 10*time.Minute),
			IndexerInterval:       getEnvDuration("JOB_INDEXER_INTERVAL", 15*time.Second),
			ReceiptSyncInterval:   getEnvDuration("JOB_RECEIPT_SYNC_INTERVAL", 15*time.Second),
			RetryFailedTxInterval: getEnvDuration("JOB_RETRY_FAILED_TX_INTERVAL", 45*time.Second),
			VRFCheckInterval:      getEnvDuration("JOB_VRF_CHECK_INTERVAL", 2*time.Minute),
			ReconcileInterval:     getEnvDuration("JOB_RECONCILE_INTERVAL", 2*time.Minute),
		},
		Admin: AdminConfig{
			Token: getEnv("ADMIN_TOKEN", ""),
		},
	}
}

func (c Config) APIAddr() string {
	return c.API.Host + ":" + strconv.Itoa(c.API.Port)
}

func detectRoots() (string, string) {
	cwd, err := os.Getwd()
	if err != nil {
		return ".", "."
	}

	current := cwd
	for {
		if fileExists(filepath.Join(current, "packages", "backend", "go.mod")) {
			return filepath.Join(current, "packages", "backend"), current
		}
		if fileExists(filepath.Join(current, "backend", "go.mod")) {
			return filepath.Join(current, "backend"), current
		}
		if fileExists(filepath.Join(current, "go.mod")) && filepath.Base(current) == "backend" {
			parent := filepath.Dir(current)
			if filepath.Base(parent) == "packages" {
				return current, filepath.Dir(parent)
			}
			return current, parent
		}

		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}

	if filepath.Base(cwd) == "backend" {
		parent := filepath.Dir(cwd)
		if filepath.Base(parent) == "packages" {
			return cwd, filepath.Dir(parent)
		}
		return cwd, parent
	}
	return cwd, cwd
}

func hostnameOr(fallback string) string {
	name, err := os.Hostname()
	if err != nil || strings.TrimSpace(name) == "" {
		return fallback
	}
	return name
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func getEnv(key string, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func getEnvInt(key string, fallback int) int {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvInt64(key string, fallback int64) int64 {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return parsed
}

func (c ZamaConfig) Enabled() bool {
	return strings.EqualFold(strings.TrimSpace(c.Mode), "zama-relayer-sdk")
}

func defaultZamaConfig(chainID int64) ZamaConfig {
	// Official Sepolia protocol contracts and services from docs.zama.org.
	if chainID == 11155111 {
		return ZamaConfig{
			Mode:                                      "zama-relayer-sdk",
			RelayerURL:                                "https://relayer.testnet.zama.org",
			GatewayChainID:                            10901,
			FhevmExecutorContractAddress:              "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
			AclContractAddress:                        "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
			HCUContractAddress:                        "0xa10998783c8CF88D886Bc30307e631D6686F0A22",
			KMSVerifierContractAddress:                "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
			InputVerifierContractAddress:              "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
			VerifyingContractAddressDecryption:        "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478",
			VerifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955",
			UserDecryptDurationDays:                   1,
			MaxUserDecryptBits:                        2048,
		}
	}

	return ZamaConfig{
		Mode:                    "frontend-local-proof",
		UserDecryptDurationDays: 1,
		MaxUserDecryptBits:      2048,
	}
}
