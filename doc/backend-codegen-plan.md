# LuckyScratch 后端代码生成计划

> 版本：v1.0
> 更新日期：2026-04-10
> 依据文档：[backend-design.md](./backend-design.md)

## 1. 目标

本计划把 LuckyScratch 后端设计拆成可以直接生成代码的阶段性任务，约束范围如下：

- 当前链上目标是 Sepolia
- 当前合约基于 `LuckyScratchCore`、`LuckyScratchTicket`、`LuckyScratchTreasury`、`LuckyScratchVRFAdapter`
- 当前随机源是 Chainlink VRF v2.5
- 当前领奖模型必须走 `claimReward(ticketId, clearRewardAmount, decryptionProof)`
- 当前 gasless 失败终态不依赖链上 `GaslessRejected`

本计划额外固定两条实现边界，避免后续返工：

- 部署元数据真相源必须独立建模，不能只临时读取 Hardhat deployment JSON
- 当前 reveal / claim 边界固定为：后端做权限校验与短时授权编排，前端负责生成或提交最终 `clearRewardAmount + decryptionProof`，后端不代发 claim

## 1.1 当前实现状态

截至 2026-04-10，本计划对应的代码已在 `packages/backend/` 落地到可运行的一版：

- 已完成工程化运行时：配置、迁移、`sqlc` 仓储、API/worker 进程装配
- 已完成部署元数据导入：从 `packages/hardhat/deployments/<network>` 导入 `deployment_registry`
- 已完成链访问层：LuckyScratch Core/Ticket 所需只读调用与 gasless 写调用封装
- 已完成查询 API：`pools` / `rounds` / `tickets` / `users` / `gasless nonce` / `claim-precheck`
- 已完成 gasless relayer：EIP-712 校验、链上 nonce 校验、deadline/paramsHash 校验、风控、广播、回执同步
- 已完成 reveal / claim-precheck：`ownerOf` + `getTicketRevealState` 实时校验、短时授权记录，以及 ticket 级 Zama relayer `keyurl` / `user-decrypt` 代理
- 已完成 worker jobs：indexer catch-up、gasless receipt sync、dropped retry、pending VRF checker、state reconciliation
- 已完成 admin API：jobs、relayer health、pool costs、pool pause、user block、job retry

当前仍保留的边界：

- claim 交易仍由前端钱包自己发送
- Redis 尚未接入，当前 recurring jobs 仅依赖 PostgreSQL `jobs` 表

## 2. 生成顺序

### 阶段 0：工程骨架

输出目录：

- `packages/backend/cmd/api`
- `packages/backend/cmd/worker`
- `packages/backend/internal/app`
- `packages/backend/internal/config`
- `packages/backend/internal/api`
- `packages/backend/internal/contracts`
- `packages/backend/internal/chain`
- `packages/backend/internal/indexer`
- `packages/backend/internal/gasless`
- `packages/backend/internal/reveal`
- `packages/backend/internal/jobs`
- `packages/backend/internal/risk`
- `packages/backend/internal/store`
- `packages/backend/internal/models`
- `packages/backend/internal/admin`
- `packages/backend/migrations`
- `packages/backend/openapi`

输出文件：

- `packages/backend/go.mod`
- `packages/backend/README.md`
- `packages/backend/sqlc.yaml`
- `packages/backend/openapi/openapi.yaml`

完成标准：

- `go test ./...` 可通过
- `cmd/api` 和 `cmd/worker` 可启动
- 配置结构已固定，后续代码按统一配置扩展

### 阶段 1：数据库与 SQL 代码生成

输出文件：

- `packages/backend/migrations/000001_init_core_tables.sql`
- `packages/backend/sqlc.yaml`
- `packages/backend/internal/store/queries/*.sql`

首批表：

- `users`
- `pools`
- `rounds`
- `tickets`
- `gasless_requests`
- `reveal_requests`
- `pool_cost_ledgers`
- `indexer_cursors`
- `deployment_registry`
- `indexed_logs`

补充字段要求：

- `gasless_requests.round_id`
- `gasless_requests.request_payload`
- `gasless_requests.signature`
- `reveal_requests.claim_clear_reward_amount`
- `reveal_requests.claim_proof_ref`
- `rounds.last_vrf_requested_at`
- `rounds.last_vrf_initialized_at`
- `tickets.last_event_tx_hash`
- `tickets.last_event_log_index`
- `tickets.last_event_block_hash`
- `rounds.last_event_tx_hash`
- `rounds.last_event_log_index`
- `rounds.last_event_block_hash`

完成标准：

- migration 可执行
- `sqlc generate` 可以产出 repository 层代码
- 读模型字段能覆盖当前合约事件与查询需求
- 审计字段足够支持最小 reorg 回滚

### 阶段 2：合约绑定与链访问层

输入来源：

- `packages/hardhat/deployments/sepolia/LuckyScratchCore.json`
- `packages/hardhat/deployments/sepolia/LuckyScratchTicket.json`
- `packages/hardhat/deployments/sepolia/LuckyScratchTreasury.json`
- `packages/hardhat/deployments/sepolia/LuckyScratchVRFAdapter.json`

部署元数据真相源：

- 以 `deployment_registry` 表或等价静态配置文件作为后端运行时真相源
- 启动时可以从 Hardhat deployment JSON 导入
- 运行时不能假设部署目录永远是最新地址或唯一版本

输出目录：

- `packages/backend/internal/contracts/abi`
- `packages/backend/internal/contracts/bindings`
- `packages/backend/internal/chain`

首批链上只读方法：

- `poolConfigs`
- `poolStates`
- `poolAccounting`
- `roundStates`
- `tickets`
- `nonces`
- `claimableCreatorProfit`
- `getTicketRevealState`
- `ownerOf`

首批事件：

- `PoolCreated`
- `PoolRoundRequested`
- `PoolRoundInitialized`
- `TicketPurchased`
- `TicketScratched`
- `RewardClaimed`
- `GaslessExecuted`
- `RoundSettled`
- `PoolRolledToNextRound`
- `PoolClosed`
- `CreatorProfitWithdrawn`
- `BondRefunded`
- `Transfer`

完成标准：

- 有统一的链客户端初始化入口
- 有合约地址配置
- 有 deployment block / deployment tx hash / 生效版本配置
- 有事件解码器和只读调用封装

### 阶段 3：Indexer

输出目录：

- `packages/backend/internal/indexer`
- `packages/backend/internal/jobs`

生成顺序：

1. `PoolCreated` / `PoolRoundRequested`
2. `PoolRoundInitialized`
3. `TicketPurchased`
4. `TicketScratched`
5. `RewardClaimed`
6. `Transfer`
7. `RoundSettled` / `PoolRolledToNextRound` / `PoolClosed`
8. `CreatorProfitWithdrawn` / `BondRefunded`
9. `GaslessExecuted`
10. 状态校准任务回填 `poolStates` / `roundStates` / `claimableCreatorProfit`

完成标准：

- 从部署块高同步事件
- cursor 可持久化
- 事件处理幂等
- 能处理最小 reorg 回滚
- 有事件审计表或同等级别的日志落库能力

### 阶段 4：查询 API

输出目录：

- `packages/backend/internal/api`

首批接口：

- `GET /api/v1/pools`
- `GET /api/v1/pools/{poolId}`
- `GET /api/v1/pools/{poolId}/rounds/{roundId}`
- `GET /api/v1/tickets/{ticketId}`
- `GET /api/v1/users/{address}/tickets`
- `GET /api/v1/users/{address}/wins`
- `GET /api/v1/gasless/nonce/{address}`
- `GET /api/v1/tickets/{ticketId}/claim-precheck`

完成标准：

- 列表查询全部基于本地读模型
- `claim-precheck` 允许走链上实时读取
- 返回结构与 OpenAPI 对齐
- 对 `paused`、`claimableCreatorProfit` 等非纯事件可还原字段，允许走定期链上校准

### 阶段 5：Gasless Relayer

输出目录：

- `packages/backend/internal/gasless`
- `packages/backend/internal/risk`
- `packages/backend/internal/jobs`

首批接口：

- `POST /api/v1/gasless/purchase`
- `POST /api/v1/gasless/purchase-selection`
- `POST /api/v1/gasless/scratch`
- `POST /api/v1/gasless/batch-scratch`
- `GET /api/v1/gasless/requests/{digest}`

必须实现：

- EIP-712 签名校验
- 链上 `nonces(address)` 预校验
- `deadline` 校验
- `paramsHash` 校验
- relayer 广播
- 请求落库
- 回执确认
- 错误分类与失败终态维护

状态机：

- `created`
- `validated`
- `submitted`
- `confirmed`
- `failed`
- `dropped`

### 阶段 6：Reveal / Claim

输出目录：

- `packages/backend/internal/reveal`
- `packages/backend/internal/api`

接口：

- `POST /api/v1/tickets/{ticketId}/reveal-auth`
- `GET /api/v1/tickets/{ticketId}/claim-precheck`

必须实现：

- `ownerOf(ticketId)` 实时校验
- `getTicketRevealState(ticketId)` 实时校验
- 短时授权记录
- 领奖参数说明

当前固定边界：

- reveal-auth 不负责替用户决定中奖结果
- reveal-auth 不负责代用户提交领奖交易
- 后端只暴露权限校验、上下文组织、claim precheck 和短时授权记录

说明：

- 当前阶段不代用户发送 `claimReward`
- 当前阶段不把领奖交易托管到后端

### 阶段 7：Jobs / 运维

任务：

- gasless receipt sync
- failed tx retry
- pending VRF round checker
- indexer catch-up
- cost ledger aggregation
- state reconciliation for `poolStates` / `roundStates` / `claimableCreatorProfit`

说明：

- `rollToNextRound(poolId)` 只能由 `pool creator` 或 `ADMIN_ROLE` 调用
- 后端不能默认替所有池自动滚轮
- “VRF consumer 是否已加入 subscription” 当前先定义为运维检查项，不强行做成自动代码路径；后续若接入稳定数据源，再升级成自动监控
- 对 `protocol-owned` 池可以由 admin signer 自动触发

### 阶段 8：Admin API

接口：

- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/relayer/health`
- `GET /api/v1/admin/pools/{poolId}/costs`

## 3. 当前建议的实际落地顺序

1. 生成后端骨架与配置
2. 生成 migration 与 `sqlc` 配置
3. 生成合约 ABI 输入与链访问层骨架
4. 生成 indexer 基础框架
5. 生成查询 API 基础框架
6. 生成 gasless 模块骨架
7. 生成 reveal / claim-precheck 模块骨架
8. 生成 jobs 与 admin 占位实现

## 4. 当前代码生成范围

本轮代码生成只覆盖：

- 后端工程骨架
- 配置结构
- 路由与模块边界
- migration 初稿
- OpenAPI 初稿
- 阶段计划文档
- deployment metadata 与 event journal 的表结构草案

历史说明：

- 上面这组“代码生成范围”是最初骨架阶段的约束，不再代表当前仓库状态
- 当前仓库已补齐真实链上事件同步、真实数据库连接与 `sqlc` 产物、真实 relayer 广播，以及 ticket 级 Zama `keyurl` / `user-decrypt` 后端代理
