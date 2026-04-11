# LuckyScratch 后端详细设计（Go）

> 版本：v1.0  
> 更新日期：2026-04-10  
> 适用范围：独立 Go 后端 + `packages/nextjs` 前端  
> 关联文档：[design.md](./design.md) / [detailed-design.md](./detailed-design.md) / [smart-contract-design.md](./smart-contract-design.md)

---

# 1. 目标

本文件用于把 LuckyScratch 的后端架构落到可实现的 Go 服务设计上，重点回答：

- 为什么后端独立于 Next.js
- 后端拆成哪些模块
- 哪些能力必须由后端负责
- 如何接入链上事件、Gasless、Zama 解密授权与风控
- API、数据库、任务系统和部署方式如何设计

本文档默认采用当前仓库已完成的 LuckyScratch 合约实现：

- 前端：`packages/nextjs`
- 后端：独立 Go 服务
- 链上：`LuckyScratchCore` / `LuckyScratchTicket` / `LuckyScratchTreasury` / `LuckyScratchVRFAdapter`
- 支付代币：Zama 官方 `cUSDC`
- 随机源：`LuckyScratchVRFAdapter` 接入 Chainlink VRF v2.5（本地测试保留 mock fulfill）

---

# 2. 架构结论

## 2.1 推荐方案

推荐采用：

- `Next.js` 只负责前端与轻量 BFF
- 核心后端能力独立为 Go 服务

不推荐把以下能力直接塞进 Next.js API Routes / Server Actions：

- 链上事件长轮询与回放
- Gasless Relayer
- fhEVM 解密授权编排
- 异步任务重试
- 风控与预算控制
- 结算/索引/对账任务

## 2.2 原因

LuckyScratch 的后端不是普通 Web API，而是偏“链上中台”：

- 需要常驻运行
- 需要处理异步任务
- 需要做幂等和重试
- 需要稳定管理私钥与签名
- 需要消费链上事件并维护本地索引

这类能力用 Go 独立服务更稳，后续也更容易拆 worker。

---

# 3. 总体架构

```text
packages/nextjs
  -> 调用 Go Backend API
  -> 钱包签名 / 合约直连 / UI 展示

Go Backend
  -> API Gateway
  -> Gasless Relayer
  -> Decryption Auth Service
  -> Chain Indexer
  -> Job Scheduler
  -> Risk & Budget Engine
  -> Admin API

PostgreSQL
Redis
RPC Provider
LuckyScratch Contracts
Zama fhEVM Backend APIs
```

## 3.1 职责边界

### Next.js 负责

- 页面渲染
- 钱包连接
- 用户签名
- 交易状态展示
- 调用后端查询 API

### Go Backend 负责

- 签名包校验
- Gasless 请求接收与广播
- 链上事件索引
- 解密授权接口编排
- 风控、预算、限流
- 运营后台 API
- 任务调度与重试

---

# 4. 服务拆分

建议第一版先单体服务实现，逻辑上按模块拆分；流量起来后再拆为多个进程。

## 4.1 API Gateway

对外统一 HTTP API，负责：

- 用户态查询接口
- Gasless 请求入口
- 刮奖解密授权入口
- 管理后台接口
- SIWE / session 校验

建议：

- 对外暴露 REST JSON
- 内部模块直接调用 service layer
- 后续需要时再拆 gRPC

## 4.2 Chain Indexer

负责同步链上事件并维护本地读模型。

主要监听：

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
- `Transfer`（来自 `LuckyScratchTicket` ERC-721）

主要职责：

- 从部署块高开始同步
- 处理 reorg
- 维护 pool / round / ticket / user 的查询表
- 为前端提供快速查询，而不是每次直接扫链
- 结合 `GaslessExecuted`、交易回执和 relayer 自身落库记录维护 gasless 请求终态
- 维护 NFT 当前 owner 的本地缓存
- 对少量高价值权限判断走链上实时读取，而不是只信本地索引
- 后端运行时必须有独立的 deployment metadata 真相源，至少包含合约地址、deployment block、deployment tx hash 和生效版本

## 4.3 Gasless Relayer

负责处理：

- `executeGaslessPurchase`
- `executeGaslessPurchaseSelection`
- `executeGaslessScratch`
- `executeGaslessBatchScratch`

执行流程：

1. 接收前端上传的签名请求
2. 校验 EIP-712 签名结构
3. 校验 nonce / deadline / paramsHash
4. 校验风控与预算
5. 选择 relayer signer 广播交易
6. 落库请求状态
7. 回写成功/失败结果

注意：

- 当前版 Gasless 只覆盖“已完成 `Treasury approve` 后”的执行交易
- 首次 `approve` 仍由用户自己发链上交易
- 当前合约没有链上 `GaslessRejected` 事件；失败终态必须由 relayer 落库、交易回执和错误分类共同维护
- `nonces(address)` 是链上唯一 nonce 真相；后端缓存只能用于加速，不能替代链上读取

## 4.4 Decryption Auth Service

负责 fhEVM 解密授权和领奖前校验编排。

主要职责：

- 统一以链上 `ownerOf(ticketId)` 校验请求用户是否为当前 NFT 持有人
- 通过合约只读接口 `getTicketRevealState(ticketId)` 校验 ticket 是否已链上 `scratch`
- 通过合约只读接口 `getTicketRevealState(ticketId)` 校验 `revealAuthorized == true`
- 基于当前合约地址与加密 handle 组织前端所需的解密材料
- 为领奖流程返回上下文与参数要求，但不代用户生成或代发最终 claim 交易
- 返回前端可消费的解密参数

关键原则：

- 后端不替用户“决定中奖结果”
- 后端只负责“授权当前持有人查看已存在的加密结果”
- 最终显示结果与领取提交仍由前端钱包完成
- 后端不直接代用户调用 `claimReward(...)`
- 当前版本默认由前端本地完成最终 `clearRewardAmount + decryptionProof` 的生成或组装

## 4.5 Risk & Budget Engine

负责：

- sponsor 预算控制
- 按 pool 统计 Gasless 成本
- 按 pool 统计 VRF 成本
- 按用户限流
- 异常用户熔断

需要控制的维度：

- 全局预算
- pool 预算
- 用户短时频率
- 单笔 ticket 数量
- 单笔 max gas cost

## 4.6 Job Scheduler

负责异步任务：

- 交易回执确认
- 失败请求重试
- 卡住交易替换 gas
- 周期性同步健康检查
- 成本归集
- 轮次结算检查

建议：

- 用 PostgreSQL 持久化任务
- 用 Redis 做轻量锁和短时队列

## 4.7 Admin API

提供给运营后台：

- 查看 pool / round / ticket 统计
- 查看 sponsor 成本与 infra 成本
- 查看 relayer 状态
- 暂停特定用户或 pool 的 Gasless
- 查看失败任务与审计日志

---

# 5. 关键流程

## 5.1 购票流程

```text
Next.js
 -> 用户签名 GaslessRequest
 -> POST /api/v1/gasless/purchase

Go Backend
 -> 读取链上 `nonces(user)` 或使用刚同步的 nonce 缓存进行预校验
 -> 校验签名/nonce/deadline
 -> 校验 pool round = Ready
 -> 校验用户已对 Treasury 完成 approve
 -> 风控与预算校验
 -> 广播 executeGaslessPurchase
 -> 更新 request 状态

Chain Indexer
 -> 收到 TicketPurchased
 -> 更新 ticket / user / round 读模型
```

## 5.2 自选购票流程

比普通购票多一层校验：

- `ticketIndexes` 不重复
- 全部 index 未售
- 数量不超过单笔上限

后端只做预校验，最终以链上校验为准。

## 5.3 刮奖流程

```text
Next.js
 -> 用户完成前端刮开动画阈值
 -> 用户签名 scratch 请求
 -> POST /api/v1/gasless/scratch

Go Backend
 -> 以链上 `ownerOf(ticketId)` 校验 NFT 当前 owner
 -> 校验状态为 Unscratched
 -> 广播 `executeGaslessScratch`

Chain Indexer
 -> 收到 TicketScratched
 -> 更新 ticket 状态

Next.js
 -> POST /api/v1/tickets/{id}/reveal-auth

Go Backend
 -> 调用 `ownerOf(ticketId)`
 -> 调用 `getTicketRevealState(ticketId)`
 -> 校验链上已 scratch
 -> 校验 revealAuthorized = true
 -> 组织解密/领奖所需材料
 -> 返回授权材料与领奖参数说明

Next.js
 -> 本地解密并展示结果
```

## 5.4 领奖流程

领奖不走 Gasless。

流程：

1. 用户前端先通过 reveal 流程拿到或生成 `clearRewardAmount + decryptionProof`
2. 用户前端调用 `claimReward(ticketId, clearRewardAmount, decryptionProof)`
3. 链上 `Treasury` 向 `ownerOf(ticketId)` 转出官方 `cUSDC`
4. Indexer 收到 `RewardClaimed`
5. 本地读模型更新用户累计中奖额、ticket 状态、round claim 计数

说明：

- 当前合约不存在无证明版 `claimReward(ticketId)`
- 后端可提供领奖前校验与材料编排，但最终领取交易由用户钱包自己发送
- 如果前端直接本地生成 `decryptionProof`，后端也至少应保留 claim precheck 能力，避免无效提交

## 5.5 建池与 VRF 初始化流程

```text
createPool
 -> PoolCreated
 -> PoolRoundRequested
 -> Chainlink VRF callback 进入 LuckyScratchVRFAdapter
 -> fulfillPoolRandomness
 -> PoolRoundInitialized
```

后端职责：

- 监听每个 round 的 VRF 初始化状态
- 统计每个 pool / round 的 VRF 请求成本
- 若发现长时间停留在 `PendingVRF`，触发告警
- 监控 `LuckyScratchVRFAdapter` 是否已被加入对应 Chainlink subscription consumer

注意：

- 后端不负责生成随机数
- 随机数只来自 Chainlink VRF
- 生产部署后需要人工或运维流程把 `LuckyScratchVRFAdapter` 地址加入 VRF subscription，否则 round 会一直停在 `PendingVRF`
- “consumer 是否已加入 subscription” 当前优先作为运维 checklist；若未来接入稳定数据源，再升级成自动监控

## 5.6 循环池结算检查

后端定时检查：

- 当前 round 是否已 `SoldOut`
- `scratchedCount == soldCount` 是否已满足
- `winClaimableCount == 0` 是否已满足
- round 是否已进入 `Settled`
- pool 是否需要由授权运营账户触发下一轮

说明：

- 结算状态最终以链上为准
- 当前合约只有 `pool creator` 或 `ADMIN_ROLE` 能调用 `rollToNextRound(poolId)`
- 因此后端不能默认替所有池自动滚下一轮
- 对 `protocol-owned` 池，后端可以用管理员 signer 自动触发
- 对创作者自有池，后端更适合做提醒、告警和后台展示；除非该地址本身就是运营 signer
- 若下一轮资金不足，链上会把 pool 状态切到 `Closing`，后端只需记录与告警

## 5.7 确认深度规则

后端对链上事件采用三态：

- `pending`：交易已广播，尚未进入稳定区块
- `confirmed`：事件已被索引，可用于前端展示
- `finalized`：达到确认深度阈值，可用于财务、成本统计和审计

建议：

- 用户态页面可基于 `confirmed` 展示
- sponsor 成本、infra 成本、运营报表基于 `finalized`
- 若发生 reorg，必须能把 `confirmed` 状态回滚

---

# 6. 数据库设计

建议：

- 主库：PostgreSQL
- 缓存/锁：Redis

## 6.1 主要表

### `users`

```sql
id
wallet_address
created_at
last_seen_at
```

### `pools`

```sql
id
chain_id
pool_id
creator
protocol_owned
mode
status
theme_id
ticket_price
total_tickets_per_round
total_prize_budget
fee_bps
current_round
created_block
created_at
updated_at
```

### `rounds`

```sql
id
chain_id
pool_id
round_id
status
sold_count
scratched_count
claimed_count
win_claimable_count
ticket_price
round_prize_budget
vrf_request_ref
shuffle_root
created_at
updated_at
```

### `tickets`

```sql
id
chain_id
ticket_id
pool_id
round_id
owner
ticket_index
status
transferred_before_scratch
mint_tx_hash
last_event_block
created_at
updated_at
```

### `gasless_requests`

```sql
id
chain_id
digest
user_address
action
target_contract
params_hash
nonce
deadline
status
failure_reason
tx_hash
gas_used
gas_cost_wei
pool_id
ticket_id
created_at
updated_at
```

### `reveal_requests`

```sql
id
chain_id
ticket_id
request_user
owner_snapshot
request_status
zama_request_ref
expires_at
created_at
updated_at
```

### `pool_cost_ledgers`

```sql
id
chain_id
pool_id
cost_type
amount
tx_hash
ref_type
ref_id
created_at
```

其中：

- `cost_type` ∈ `SPONSOR_GAS | ZAMA_INFRA | VRF_INFRA`

### `indexer_cursors`

```sql
chain_id
contract_name
last_processed_block
last_processed_log_index
updated_at
```

## 6.2 设计原则

- 所有写链结果都需要本地落库
- 所有任务都必须可重试
- 所有请求都需要幂等键
- 所有链上状态都以 event replay 可恢复
- owner 缓存仅用于查询加速，权限判断仍以链上实时读取为准
- 当前链上没有聚合查询 view；后端读模型应基于事件索引，并按需调用 `poolConfigs`、`poolStates`、`poolAccounting`、`roundStates`、`tickets`、`nonces`、`claimableCreatorProfit`、`getTicketRevealState` 和 ERC-721 `ownerOf`
- 对 `pausePool` 等无事件状态变更，以及 `claimableCreatorProfit` 这类非纯事件可还原字段，需要额外的链上状态校准任务

---

# 7. API 设计

统一前缀：

`/api/v1`

## 7.1 用户查询接口

```text
GET  /pools
GET  /pools/{poolId}
GET  /pools/{poolId}/rounds/{roundId}
GET  /tickets/{ticketId}
GET  /users/{address}/tickets
GET  /users/{address}/wins
GET  /gasless/nonce/{address}
GET  /tickets/{ticketId}/claim-precheck
```

## 7.2 Gasless 接口

```text
POST /gasless/purchase
POST /gasless/purchase-selection
POST /gasless/scratch
POST /gasless/batch-scratch
GET  /gasless/requests/{digest}
```

### `POST /gasless/purchase`

请求体：

```json
{
  "request": {
    "user": "0x...",
    "action": "Purchase",
    "targetContract": "0x...",
    "paramsHash": "0x...",
    "nonce": "12",
    "deadline": "1710000000",
    "chainId": "11155111"
  },
  "signature": "0x...",
  "poolId": "1",
  "quantity": 3
}
```

返回：

```json
{
  "digest": "0x...",
  "status": "pending",
  "txHash": "0x..."
}
```

## 7.3 解密授权接口

```text
POST /tickets/{ticketId}/reveal-auth
GET  /tickets/{ticketId}/claim-precheck
```

请求体：

```json
{
  "address": "0x..."
}
```

返回：

```json
{
  "ticketId": "123",
  "authPayload": {},
  "claim": {
    "requiresClearRewardAmount": true,
    "requiresDecryptionProof": true
  },
  "expiresAt": "2026-04-10T12:00:00Z"
}
```

校验条件：

- 当前地址是链上 `ownerOf(ticketId)`
- 通过 `getTicketRevealState(ticketId)` 可见 ticket 已 `scratch`
- 通过 `getTicketRevealState(ticketId)` 可见 `revealAuthorized == true`

### `GET /tickets/{ticketId}/claim-precheck`

用途：

- 返回当前 ticket 是否具备链上领奖前置条件
- 给前端提供更明确的错误提示，而不是让用户直接打失败交易

建议返回字段：

```json
{
  "ticketId": "123",
  "owner": "0x...",
  "status": "Scratched",
  "revealAuthorized": true,
  "claimMethod": "claimReward(ticketId, clearRewardAmount, decryptionProof)"
}
```

## 7.4 管理后台接口

```text
GET  /admin/jobs
GET  /admin/relayer/health
GET  /admin/pools/{poolId}/costs
POST /admin/gasless/pools/{poolId}/pause
POST /admin/gasless/users/{address}/block
POST /admin/jobs/{jobId}/retry
```

---

# 8. 安全与风控

## 8.1 身份认证

建议：

- 用户态接口采用 SIWE session 或 JWT
- 管理后台接口采用独立 admin auth
- 内部 job/admin 接口不与公开接口混用

## 8.2 Relayer 安全

- Relayer 私钥单独托管
- 生产环境使用 KMS / HSM
- 不把 relayer signer 私钥放进 Next.js
- 对每类 action 设独立速率限制

## 8.3 解密授权安全

- 后端每次授权前都重新读链或读取最新索引
- 不缓存长期可复用的 reveal token
- 授权材料必须短时过期
- 必须绑定 `ticketId + owner + chainId`

## 8.4 链上数据一致性

- 所有 event handler 幂等
- 支持 block reorg 回滚
- 区分“已广播”“已上链”“已确认”
- 后端状态不替代链上真相

## 8.5 风控策略

- 用户短时频率限制
- pool 维度 sponsor 预算限制
- 全局 sponsor 预算限制
- 单钱包单次可买票数限制
- 异常失败熔断
- 恶意重复请求黑名单

---

# 9. 成本与预算模型

后端需要维护三类成本台账：

- Sponsor Gas 成本
- Zama Infra 成本
- VRF Infra 成本

## 9.1 计提口径

- Sponsor Gas：按具体 Gasless 请求计提
- Zama Infra：按 reveal / FHE 服务调用计提
- VRF Infra：按 pool instance 初始化计提

## 9.2 归集维度

- 按 `chain_id`
- 按 `pool_id`
- 按 `round_id`
- 按 `request_id / tx_hash`

## 9.3 展示口径

后台至少需要展示：

- 单 pool 总 sponsor 成本
- 单 pool 总 infra 成本
- 单轮 sponsor 成本
- 单用户近 24h Gasless 使用量
- 当前未初始化 round 数与长期 `PendingVRF` 数

---

# 10. 部署建议

## 10.1 服务进程

建议至少拆为两个进程：

- `api`
- `worker`

其中：

- `api` 处理 HTTP
- `worker` 处理 indexer / jobs / 回执同步

## 10.2 目录建议

```text
packages/backend/
  cmd/
    api/
    worker/
  internal/
    app/
    config/
    api/
    auth/
    chain/
    contracts/
    gasless/
    reveal/
    indexer/
    jobs/
    risk/
    store/
    models/
    admin/
  migrations/
  openapi/
```

## 10.3 依赖建议

- HTTP: `gin` 或 `chi`
- DB: `pgx` / `sqlc` 或 `gorm` 任选其一
- Redis: `go-redis`
- Queue/Jobs: 自建 PostgreSQL job 表 + worker，或 `asynq`
- EVM: `go-ethereum`
- Config: `viper` 或纯环境变量
- Logging: `zap`

建议偏保守：

- `chi + pgx + sqlc + go-ethereum + zap`

---

# 11. 第一阶段最小后端实现

第一阶段建议只做下面这些：

1. 用户查询 API
2. Chain Indexer
3. Gasless Purchase
4. Gasless Scratch
5. Reveal Auth API
6. 基础风控
7. pool 成本台账

先不要一上来做：

- 复杂管理后台
- 多 relayer signer 调度
- 多链支持
- 自动运营策略
- 高级报表

---

# 12. 与 Next.js 的边界

`packages/nextjs` 不负责：

- 保存 relayer 私钥
- 直接调用 Zama 解密授权后端
- 常驻监听链上事件
- 执行结算任务
- 维护 sponsor 预算

`packages/nextjs` 负责：

- 钱包连接与签名
- 购票/刮奖 UI
- 调用 Go API
- 使用授权材料做前端揭晓

---

# 13. 结论

推荐的正式后端实现路线是：

- 用 Go 独立实现后端
- 用 PostgreSQL + Redis 支撑状态与任务
- 用 Indexer 维护本地读模型
- 用 Relayer 承接购票/刮奖 Gasless
- 用 Decryption Auth Service 承接 fhEVM 授权编排
- 用 Next.js 只做前端与轻量交互层

这套方案和当前合约设计一致，也适合后续继续扩展成生产级架构。
