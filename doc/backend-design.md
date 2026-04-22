# LuckyScratch 后端详细设计（Go）

> 版本：v1.1
> 更新日期：2026-04-22
> 适用范围：独立 Go 后端 + `packages/nextjs` 前端
> 关联文档：[design.md](./design.md) / [detailed-design.md](./detailed-design.md) / [smart-contract-design.md](./smart-contract-design.md)

---

# 1. 目标

本文件描述 LuckyScratch 当前后端的职责边界与实现结构。当前仓库中的 Go 后端负责：

- 维护链上事件驱动的本地读模型
- 为前端提供 pool / round / ticket / user 查询接口
- 编排 ticket reveal 授权与 claim precheck
- 提供 ticket 级别的 Zama relayer `keyurl` / `user-decrypt` 代理
- 运行定时 worker，做索引、状态校准与 reveal 代理任务对账
- 暴露最小 admin API，用于 jobs 与 pool costs 管理

后端不再承担任何用户写交易代发职责。购票、刮奖、领奖和创建者资金操作均由用户钱包直接发送链上交易。

---

# 2. 总体架构

```text
packages/nextjs
  -> 查询 Go Backend API
  -> 钱包直连 LuckyScratch 合约发送写交易

Go Backend
  -> API
  -> Read Model / Indexer
  -> Reveal Service
  -> Job Worker
  -> Admin Service

PostgreSQL
RPC Provider
LuckyScratch Contracts
Zama Relayer APIs
```

## 2.1 Next.js 负责

- 页面渲染与交互
- 钱包连接
- 购票 / 刮奖 / 领奖的链上交易提交
- reveal 结果展示
- 调用后端查询与 reveal 授权接口

## 2.2 Go Backend 负责

- 事件索引与读模型维护
- reveal-auth / claim-precheck 编排
- ticket 级 Zama 代理
- recurring jobs
- 成本统计与最小管理能力

---

# 3. 模块划分

## 3.1 `api`

对外 HTTP 接口，当前路由包括：

- `GET /healthz`
- `GET /api/v1/pools`
- `GET /api/v1/pools/{poolId}`
- `GET /api/v1/pools/{poolId}/rounds/{roundId}`
- `GET /api/v1/tickets/{ticketId}`
- `GET /api/v1/users/{address}/tickets`
- `GET /api/v1/users/{address}/wins`
- `POST /api/v1/tickets/{ticketId}/reveal-auth`
- `GET /api/v1/tickets/{ticketId}/claim-precheck`
- `GET /api/v1/tickets/{ticketId}/zama/relayer/v2/keyurl`
- `POST /api/v1/tickets/{ticketId}/zama/relayer/v2/user-decrypt`
- `GET /api/v1/tickets/{ticketId}/zama/relayer/v2/user-decrypt/{jobId}`
- `GET /api/v1/admin/jobs`
- `POST /api/v1/admin/jobs/{jobId}/retry`
- `GET /api/v1/admin/pools/{poolId}/costs`

## 3.2 `indexer`

负责同步 LuckyScratch 事件并维护本地查询表。当前重点监听：

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
- ERC-721 `Transfer`

索引器不依赖额外的合约列表 view。分页和聚合查询统一落到本地读模型。

## 3.3 `reveal`

负责 reveal 与 claim 前置编排：

- 用 `ownerOf(ticketId)` 校验当前 NFT 持有人
- 用 `getTicketRevealState(ticketId)` 校验刮奖状态与 reveal 权限
- 构造前端需要的 reveal 授权材料
- 代理 Zama `keyurl` / `user-decrypt`
- 维护本地 reveal job 状态，并做 reconcile

claim 交易本身仍由前端钱包发送，后端只提供 precheck 与 reveal 上下文。

## 3.4 `jobs`

当前 worker 维护四类 recurring jobs：

- `indexer.catch_up`
- `indexer.pending_vrf_checker`
- `indexer.state_reconciliation`
- `reveal.proxy_sync`

worker 使用 PostgreSQL `jobs` 表持久化调度状态，并在 `JOB_LOCK_TIMEOUT` 超时后回收崩溃 worker 遗留的 `running` 锁。

## 3.5 `admin`

保留最小运营能力：

- 查看 recurring jobs
- 触发 job retry
- 查看 pool 维度成本汇总与近期流水

---

# 4. 数据模型

数据库以 `packages/backend/sql/migrations/` 和 `packages/backend/sql/queries/` 为真相源，由 `sqlc` 生成仓储代码。

## 4.1 关键表

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

## 4.2 部署元数据边界

后端运行时必须以 `deployment_registry` 为部署真相源。Hardhat deployment JSON 只用于导入，不能作为线上唯一数据源。

## 4.3 成本归集

`pool_cost_ledgers` 当前只记录仍然存在的基础设施成本：

- `VRF_INFRA`
- `ZAMA_INFRA`

旧的交易代发成本与请求表已从代码和 schema 中移除。

---

# 5. 链上读取边界

## 5.1 优先走后端读模型的场景

- pool 列表
- round 列表 / 明细
- user ticket 列表
- user win 列表
- 后台成本汇总
- 任意分页、聚合、筛选视图

## 5.2 需要链上权威校验的场景

- `poolConfigs`
- `poolStates`
- `poolAccounting`
- `roundStates`
- `tickets`
- `claimableCreatorProfit`
- `getTicketRevealState`
- ERC-721 `ownerOf`

Reveal 与 claim-precheck 必须把链上状态作为最终判断依据，不能完全信任本地索引。

---

# 6. 运行模式

后端单入口为 `packages/backend/main.go`，支持三种模式：

- `go run .`
- `go run . api`
- `go run . worker`

常用运行时配置：

- `DATABASE_URL`
- `RPC_URL`
- `ADMIN_TOKEN`
- `API_PUBLIC_BASE_URL`
- `REVEAL_SUBMIT_TIMEOUT`
- `JOB_LOCK_TIMEOUT`

当前实现不依赖 Redis，任务调度与锁回收全部基于 PostgreSQL。

---

# 7. 当前实现约束

- 后端不代用户发送购票、刮奖、领奖交易
- 后端不维护交易代发 nonce、签名包或请求终态
- 列表查询依赖 indexer，本地读模型必须保持幂等与可回放
- reveal 代理 URL 必须是稳定的公开地址；在反向代理场景下应配置 `API_PUBLIC_BASE_URL`
- 浏览器侧 Zama SDK 初始化依赖前端静态 wasm 资产与 backend-issued ticket-scoped relayer URL

---

# 8. 验证建议

默认验证命令：

```bash
cd packages/backend
go test ./...
go run . api
go run . worker
```

联调时至少确认：

1. indexer 能从部署块高开始同步并写入 `pools` / `rounds` / `tickets`
2. `GET /users/{address}/tickets` 与 `GET /tickets/{ticketId}` 能返回稳定读模型数据
3. `POST /tickets/{ticketId}/reveal-auth` 能生成 ticket-scoped reveal 上下文
4. `GET /tickets/{ticketId}/claim-precheck` 能正确识别可领奖条件
5. `reveal.proxy_sync` 能推进本地 decryption job 状态
