# LuckyScratch 后端代码生成计划

> 版本：v1.1
> 更新日期：2026-04-22
> 依据文档：[backend-design.md](./backend-design.md)

## 1. 目标

本计划描述 LuckyScratch 当前后端的代码生成与迭代顺序，约束范围如下：

- 后端保持独立 Go 服务
- 用户写交易全部由前端钱包直连合约发送
- 后端只负责读模型、reveal 编排、Zama 代理、jobs 和 admin
- 部署元数据真相源独立建模，不直接依赖 Hardhat deployment JSON 作为线上唯一来源
- claim 交易继续保持客户端驱动，后端只提供 precheck 与 reveal 上下文

## 2. 当前实现状态

截至 2026-04-22，`packages/backend/` 已落地到可运行的一版：

- 已完成运行时装配：配置、迁移、`sqlc` 仓储、API / worker 启动入口
- 已完成部署元数据导入与 `deployment_registry` 维护
- 已完成链访问层：LuckyScratch Core / Ticket 所需只读调用与事件解码
- 已完成读模型 API：`pools` / `rounds` / `tickets` / `users`
- 已完成 reveal / claim-precheck：`ownerOf` + `getTicketRevealState` 实时校验，以及 ticket 级 Zama 代理
- 已完成 recurring jobs：indexer catch-up、pending VRF checker、state reconciliation、reveal proxy sync
- 已完成 admin API：jobs、job retry、pool costs

## 3. 生成顺序

### 阶段 0：工程骨架

输出目录：

- `packages/backend/app`
- `packages/backend/api`
- `packages/backend/admin`
- `packages/backend/chain`
- `packages/backend/contracts`
- `packages/backend/indexer`
- `packages/backend/jobs`
- `packages/backend/models`
- `packages/backend/readmodel`
- `packages/backend/reveal`
- `packages/backend/sql`
- `packages/backend/store`

完成标准：

- `go run .`, `go run . api`, `go run . worker` 三种模式可启动
- 配置结构稳定
- `sqlc`、迁移和 OpenAPI 入口齐备

### 阶段 1：数据库与 `sqlc`

目标表：

- `deployment_registry`
- `indexer_cursors`
- `indexed_logs`
- `pools`
- `rounds`
- `tickets`
- `users`
- `reveal_requests`
- `jobs`
- `pool_cost_ledgers`
- `audit_logs`

完成标准：

- migration 可重复执行
- `sqlc generate` 可产出仓储层
- 字段足够支撑最小 reorg 回滚、reveal 对账和成本查询

### 阶段 2：合约绑定与链访问层

输入来源：

- `packages/hardhat/contracts/luckyScratch/*`
- 当前网络的部署元数据导入结果

需要覆盖的最小只读接口：

- `poolConfigs`
- `poolStates`
- `poolAccounting`
- `roundStates`
- `tickets`
- `claimableCreatorProfit`
- `getTicketRevealState`
- `ownerOf`

需要覆盖的最小事件：

- `PoolCreated`
- `PoolRoundRequested`
- `PoolRoundInitialized`
- `TicketPurchased`
- `TicketScratched`
- `RewardClaimed`
- `RoundSettled`
- `PoolRolledToNextRound`
- `PoolClosed`
- `CreatorProfitWithdrawn`
- `BondRefunded`
- `Transfer`

### 阶段 3：Indexer 与读模型

目标：

- 从 deployment block 开始同步事件
- 维护 `pools` / `rounds` / `tickets` / `users`
- 支持 cursor 持久化
- 支持最小 reorg rewind / replay
- 为前端和 admin 提供稳定分页查询

### 阶段 4：查询 API

首批接口：

- `GET /api/v1/pools`
- `GET /api/v1/pools/{poolId}`
- `GET /api/v1/pools/{poolId}/rounds/{roundId}`
- `GET /api/v1/tickets/{ticketId}`
- `GET /api/v1/users/{address}/tickets`
- `GET /api/v1/users/{address}/wins`
- `GET /api/v1/tickets/{ticketId}/claim-precheck`

要求：

- 列表查询优先走本地读模型
- 非事件真值字段允许在 service 层补链上校准
- 返回结构与 OpenAPI 对齐

### 阶段 5：Reveal Auth 与 Zama 代理

目标：

- `POST /api/v1/tickets/{ticketId}/reveal-auth`
- `GET /api/v1/tickets/{ticketId}/zama/relayer/v2/keyurl`
- `POST /api/v1/tickets/{ticketId}/zama/relayer/v2/user-decrypt`
- `GET /api/v1/tickets/{ticketId}/zama/relayer/v2/user-decrypt/{jobId}`

要求：

- reveal-auth 必须实时校验 `ownerOf` 与 `getTicketRevealState`
- 代理 URL 必须稳定且可公开访问
- 本地 reveal job 状态需支持 reconcile

### 阶段 6：Jobs 与 Admin

目标任务：

- `indexer.catch_up`
- `indexer.pending_vrf_checker`
- `indexer.state_reconciliation`
- `reveal.proxy_sync`

首批 admin 接口：

- `GET /api/v1/admin/jobs`
- `POST /api/v1/admin/jobs/{jobId}/retry`
- `GET /api/v1/admin/pools/{poolId}/costs`

### 阶段 7：验证与回归

默认验证命令：

```bash
cd packages/backend
go test ./...
```

回归重点：

1. migration + `sqlc` 代码同步
2. deployment metadata 导入后可正常启动 indexer
3. reveal-auth / claim-precheck 的链上校验逻辑稳定
4. worker 能回收 stale locks 并继续推进 recurring jobs
5. OpenAPI 与实际路由不漂移

## 4. 变更约束

- 不再新增签名代发交易相关模块、表、接口或 worker
- deployment 真相源必须保持独立建模
- 任何影响 API、schema、job 类型或事件消费方式的变更都要同步更新本文档与 `AGENTS.md`
