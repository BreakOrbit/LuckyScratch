# LuckyScratch 合约 / 后端 / 前端联通落地计划

> 版本：v1.0
> 更新日期：2026-04-23
> 适用范围：当前 `packages/hardhat` + `packages/backend` + `packages/nextjs`
> 关联文档：
> - `doc/刮刮乐.xlsx`
> - `doc/smart-contract-design.md`
> - `doc/backend-design.md`
> - `doc/backend-codegen-plan.md`

## 1. 目标

本计划用于把 LuckyScratch 现有的三层能力真正打通：

- 合约继续作为写操作真相源
- 后端继续作为列表、聚合、授权、IPFS 上传和读模型真相源
- 前端从“静态 mock 页面”切到“真实调用后端 + 钱包直连合约”的工作模式

本计划重点覆盖以下问题：

- `myprofile`、`pool-detail` 等页面不能继续展示当前拿不到的“已售彩票中奖数量 / 已中奖金额”
- 池子图片和票面图需要改成“前端选图 -> 后端上传 IPFS -> 后端保存元数据 -> 前端消费”
- `create-pool`、`pool-detail`、`purchase`、`scratch`、`myprofile` 需要形成一条真实联动链路

---

## 2. 当前问题与边界

### 2.1 当前页面数据口径问题

当前前端多个页面仍然使用静态 mock，问题主要有两类：

1. 展示了当前系统没有稳定真值的数据
2. 展示了后端暂未提供、也不适合直接从合约拉取聚合结果的数据

最典型的错误口径：

- 当前已售彩票的获奖张数
- 当前已售彩票的中奖总金额
- 当前轮次的实时中奖流水

这些字段在现有架构下不能作为前端稳定展示字段，原因如下：

- 合约不提供高成本列表聚合 view
- 后端当前读模型没有“实时已售中奖彩票金额汇总”的权威字段
- 奖励金额是加密状态，刮奖与解密是分阶段发生的，不能把“已售出”直接等价成“可统计中奖结果”

### 2.2 当前已经具备的真实基础

当前仓库已经具备以下真实能力，可以作为联通基础：

- 合约写路径已经齐备：`createPool` / `purchaseTickets` / `scratchTicket` / `claimReward`
- 后端读模型已经齐备：`pools` / `rounds` / `tickets`
- 后端 reveal / claim-precheck / Zama 代理已经可用
- 前端钱包直连合约的基础设施已经存在

因此本次不建议推翻现有架构，而是围绕现有边界补齐缺失的中间层：

- 图片上传与元数据绑定
- 真实池子详情聚合接口
- 创作者视图聚合接口
- 购票上下文接口
- 小时销售统计接口

---

## 3. 页面展示口径重定义

### 3.1 可直接展示的真实字段

以下字段可以作为前端真实展示口径：

- `ticketPrice`
- `totalTicketsPerRound`
- `totalPrizeBudget`
- `targetRtpBps`
- `hitRateBps`
- `maxPrize`
- `currentRound`
- `round.soldCount`
- `round.totalTickets`
- `round.scratchedCount`
- `round.claimedCount`
- `round.winClaimableCount`
- `realizedRevenue`
- `accruedPlatformFee`
- `claimableCreatorProfit`
- `lockedBond`
- `reservedPrizeBudget`
- `lockedNextRoundBudget`
- `creatorProfitClaimed`
- `settledPrizeCost`
- `status`
- `mode`

### 3.2 页面级别推荐展示

#### `myprofile` / `My Pools`

池子卡片推荐展示：

- 池子名称 / 图片 / 状态 / 模式
- 当前轮次 `已售 / 总票数`
- 销售金额 `realizedRevenue`
- 平台费 `accruedPlatformFee`
- 可提收益 `claimableCreatorProfit`
- 保证金状态 `locked / refundable`

不要展示：

- 当前已售中奖张数
- 当前已中奖金额

#### `pool-detail`

页面顶部推荐展示：

- 已售票数 `soldCount`
- 总票数 `totalTickets`
- 票价 `ticketPrice`
- 目标 RTP `targetRtpBps`
- 命中率 `hitRateBps`
- 最大奖项 `maxPrize`
- 奖池预算 `totalPrizeBudget`

页面中段推荐展示：

- 当前轮次状态
- 已刮开数量 `scratchedCount`
- 已领奖数量 `claimedCount`
- 待领奖中奖票数 `winClaimableCount`
- 已实现销售额 `realizedRevenue`
- 平台费 `accruedPlatformFee`
- 可提收益 `claimableCreatorProfit`
- 锁定保证金 `lockedBond`

页面图表推荐展示：

- 最近 24 小时按小时销售张数
- 最近 24 小时销售额
- 与上一个 24 小时窗口的对比增减

不要展示：

- 伪造的中奖流水表
- 当前已售中奖彩票数量
- 当前已售中奖彩票总金额

#### `purchase`

页面推荐展示：

- 当前轮次已售索引
- 当前轮次剩余票数
- 池子基础配置
- 奖项结构
- 是否支持选号

#### 历史 / 排行类页面

如果后续需要“中奖金额排行”，只允许对以下范围使用：

- 非循环池：已关闭且已结算池子
- 循环池：已结束并已结算轮次

该类历史指标应基于后端聚合后的已结算字段，例如：

- `settledPrizeCost`
- 已结算轮次聚合

不能用当前活跃轮次的“已售出票”做实时中奖金额展示。

---

## 4. 目标架构

```text
Next.js Frontend
  -> 读：Go Backend API
  -> 写：用户钱包直连 LuckyScratch 合约
  -> 图片：上传到 Go Backend，再由后端上传 IPFS

Go Backend
  -> Pool / Round / Ticket Read Model
  -> Pool Metadata / Asset Metadata
  -> IPFS Upload Provider
  -> Reveal Auth / Claim Precheck / Zama Proxy
  -> Hourly Sales Aggregation
  -> Creator Summary / Ledger Aggregation

Contracts
  -> Pool create / purchase / scratch / claim
  -> 保持写路径真相源
```

核心原则：

- 交易写入只走钱包，不通过后端代发
- 列表与聚合只走后端，不让前端自己拼装链上列表
- 图片文件只存 IPFS CID / URI / 网关地址，不存进合约
- 合约只保留元数据锚点，不承担大文本 URI 存储

---

## 5. 建池与图片联动主流程

推荐采用“两阶段 metadata 绑定”。

### 5.1 推荐主流程

1. 前端上传封面图和票面图到后端
2. 后端把文件上传到 IPFS
3. 后端创建 `pool draft`，生成 metadata JSON，并上传 metadata JSON 到 IPFS
4. 后端返回：
   - `draftId`
   - `metadataCid`
   - `metadataUri`
   - `themeId`
5. 前端用返回的 `themeId` 调用合约 `createPool`
6. 前端从交易回执中解析 `PoolCreated(poolId, ...)`
7. 前端调用后端 finalize 接口，把 `draftId` 绑定到真实 `poolId`
8. 后端校验链上 `poolConfigs(poolId).themeId` 与 draft 一致后落库
9. 后续所有池子列表 / 详情接口都从读模型 + metadata 联表返回

### 5.2 为什么这样设计

这样做的好处是：

- 不需要立即改 `LuckyScratchCore`
- 现有 `bytes32 themeId` 可以直接作为 metadata 锚点
- 图片和文案可以完整保存在 IPFS metadata JSON 里
- 后端可以在 finalize 时做链上校验，防止错误绑定

### 5.3 `themeId` 推荐生成规则

建议由后端统一生成：

```text
themeId = keccak256("luckyscratch:pool-metadata:v1:" + metadataCid)
```

这样具备几个好处：

- 前端不需要自己算 hash
- 规则稳定，可重放
- 可以把链上 `themeId` 与 IPFS metadata 一一对应

---

## 6. 合约层计划

## 6.1 P0：不改核心写路径，复用现有 `themeId`

本阶段建议不修改 `LuckyScratchCore.createPool` 的参数结构。

理由：

- 当前核心合约 gas 和字节码敏感
- 现有 `themeId` 已经足够作为 metadata 锚点
- 当前最缺的是联通和真实接口，不是链上大字段存储

本阶段要求：

- 前端 create-pool 不再写死主题图
- `themeId` 改为后端返回的 metadata 锚点

## 6.2 P1：可选新增独立元数据 Registry

如果后续产品强需求是“链上可直接解析池子 metadata URI”，再新增独立合约，例如：

- `PoolMetadataRegistry`

推荐只提供最小能力：

- `setPoolMetadata(uint256 poolId, bytes32 metadataHash or string uri)`
- `poolMetadata(uint256 poolId)`

注意：

- 不建议把 URI 直接塞进 `LuckyScratchCore`
- 独立 registry 更容易演进，也不会污染核心奖池逻辑

## 6.3 合约侧不需要新增的内容

本阶段不建议新增：

- 池子列表分页 view
- 当前中奖张数 / 当前中奖金额聚合 view
- 已售 ticket index 列表 view

这些都应由后端 indexer 和读模型承担。

---

## 7. 后端计划

## 7.1 必要新增能力

### 7.1.1 图片上传到 IPFS

新增后端 provider 抽象：

- `storage/ipfs`

建议配置：

- `IPFS_PROVIDER`
- `IPFS_GATEWAY_BASE_URL`
- `IPFS_PINATA_JWT` 或其他 pinning provider 凭证

建议统一返回：

- `cid`
- `ipfsUri`
- `gatewayUrl`

### 7.1.2 钱包认证

当前仓库没有用户级后台写接口认证能力，这是联通落地的硬阻塞。

最小可行方案：

- 用钱包签名 challenge 做后端 mutation 鉴权

推荐接口：

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`

返回：

- 短期 session cookie 或 bearer token

备注：

- 如果后续希望标准化，可升级为 SIWE
- 如果只是快速联通，也可以先用“每次 mutation 携带签名”的轻量方案

### 7.1.3 池子 metadata draft / finalize

建议新增表：

- `uploaded_assets`
- `pool_metadata_drafts`
- `pool_metadata`

推荐表结构：

#### `uploaded_assets`

- `id`
- `owner_address`
- `kind`：`pool_cover` / `ticket_art` / `avatar` / ...
- `cid`
- `ipfs_uri`
- `gateway_url`
- `mime_type`
- `size_bytes`
- `sha256`
- `created_at`

#### `pool_metadata_drafts`

- `id`
- `owner_address`
- `name`
- `description`
- `theme_key`
- `cover_asset_id`
- `ticket_art_asset_id`
- `metadata_cid`
- `metadata_uri`
- `theme_id`
- `status`：`draft` / `finalized` / `expired`
- `expires_at`
- `created_at`
- `updated_at`

#### `pool_metadata`

- `pool_id`
- `owner_address`
- `theme_id`
- `metadata_cid`
- `metadata_uri`
- `cover_asset_id`
- `ticket_art_asset_id`
- `name`
- `description`
- `theme_key`
- `created_at`
- `updated_at`

### 7.1.4 池子聚合查询

当前后端已经有：

- `GET /api/v1/pools`
- `GET /api/v1/pools/{poolId}`
- `GET /api/v1/pools/{poolId}/rounds/{roundId}`

但还不足以支撑真实页面。

需要扩展为：

- 支持 metadata join
- 支持 creator 过滤
- 支持 current round 聚合
- 支持前端直接消费的 summary shape

### 7.1.5 小时销售聚合

为了支持 `pool-detail` 的 24 小时销售图，需要增加真实时间桶聚合。

当前 `indexed_logs` 没有专门的事件时间桶聚合输出，因此建议新增：

- `pool_sales_hourly`

字段建议：

- `pool_id`
- `bucket_start`
- `sold_count`
- `revenue_amount`
- `created_at`
- `updated_at`

重要说明：

- 这里必须使用链上 block timestamp 或 indexer 解出的事件时间
- 不能用数据库插入时间 `created_at` 代替

### 7.1.6 创作者收入流水

为了支撑 `myprofile` 后续的收入记录列表，建议新增聚合视图或表：

- `creator_pool_ledger`

来源可包括：

- `CreatorProfitWithdrawn`
- `BondRefunded`
- 其他后续需要展示的现金流事件

---

## 7.2 后端新增接口草案

以下接口是本次联通的最小推荐集。

### 7.2.1 图片上传

`POST /api/v1/uploads/images`

用途：

- 上传封面图
- 上传票面图
- 后端 pin 到 IPFS

请求：

```http
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

表单字段：

- `file`
- `kind`

响应：

```json
{
  "assetId": "123",
  "kind": "pool_cover",
  "cid": "bafy...",
  "ipfsUri": "ipfs://bafy...",
  "gatewayUrl": "https://gateway.example/ipfs/bafy..."
}
```

### 7.2.2 创建池子 draft

`POST /api/v1/pool-drafts`

用途：

- 把前端表单、图片资产和 metadata JSON 固化到后端
- 生成 `themeId`

请求：

```json
{
  "name": "Ancient Solar Engine",
  "description": "Legend-grade scratch pool",
  "themeKey": "ancient-solar-engine",
  "coverAssetId": "123",
  "ticketArtAssetId": "124",
  "poolConfigPreview": {
    "mode": "loop",
    "ticketPrice": "5000000",
    "totalTicketsPerRound": 100,
    "totalPrizeBudget": "450000000",
    "targetRtpBps": 9000,
    "hitRateBps": 2500,
    "maxPrize": "50000000",
    "selectable": true
  },
  "prizeTiers": [
    { "prizeAmount": "50000000", "count": 1 },
    { "prizeAmount": "10000000", "count": 5 }
  ]
}
```

响应：

```json
{
  "draftId": "88",
  "metadataCid": "bafy...",
  "metadataUri": "ipfs://bafy...",
  "themeId": "0xabc123..."
}
```

### 7.2.3 finalize 建池

`POST /api/v1/pools/{poolId}/finalize`

用途：

- 把 draft 和真实 poolId 绑定
- 校验链上 `themeId`

请求：

```json
{
  "draftId": "88",
  "createTxHash": "0x..."
}
```

后端校验项：

- 当前认证钱包地址是否等于链上 creator
- 该交易是否真的创建了 `poolId`
- `poolConfigs(poolId).themeId` 是否等于 draft 的 `themeId`

响应：

```json
{
  "poolId": "42",
  "themeId": "0xabc123...",
  "metadataUri": "ipfs://bafy...",
  "coverImageUrl": "https://gateway.example/ipfs/bafy-cover",
  "ticketArtUrl": "https://gateway.example/ipfs/bafy-ticket"
}
```

### 7.2.4 池子列表

`GET /api/v1/pools?creator=0x...&status=active&sort=latest&limit=20&offset=0`

推荐响应：

```json
{
  "items": [
    {
      "poolId": "42",
      "creator": "0x...",
      "name": "Ancient Solar Engine",
      "description": "Legend-grade scratch pool",
      "coverImageUrl": "https://gateway.example/ipfs/...",
      "ticketArtUrl": "https://gateway.example/ipfs/...",
      "mode": "loop",
      "status": "active",
      "ticketPrice": "5000000",
      "totalPrizeBudget": "450000000",
      "targetRtpBps": 9000,
      "hitRateBps": 2500,
      "maxPrize": "50000000",
      "currentRound": 3,
      "currentRoundSoldCount": 34,
      "currentRoundTotalTickets": 56,
      "realizedRevenue": "68000000",
      "accruedPlatformFee": "5440000",
      "claimableCreatorProfit": "12560000",
      "lockedBond": "540000000"
    }
  ],
  "page": {
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### 7.2.5 单池详情

`GET /api/v1/pools/{poolId}`

推荐响应包含三块：

- pool config
- current round
- metadata

### 7.2.6 当前轮次上下文

`GET /api/v1/pools/{poolId}/rounds/current`

推荐响应：

```json
{
  "poolId": "42",
  "roundId": "3",
  "status": "ready",
  "soldCount": 34,
  "scratchedCount": 12,
  "claimedCount": 4,
  "winClaimableCount": 3,
  "totalTickets": 56,
  "ticketPrice": "5000000",
  "roundPrizeBudget": "450000000"
}
```

### 7.2.7 购票上下文

`GET /api/v1/pools/{poolId}/purchase-context`

推荐响应：

```json
{
  "poolId": "42",
  "roundId": "3",
  "status": "ready",
  "selectable": true,
  "ticketPrice": "5000000",
  "totalTickets": 56,
  "soldCount": 34,
  "remainingCount": 22,
  "soldTicketIndexes": [0, 2, 5, 8, 13]
}
```

说明：

- 当前合约把 `totalTicketsPerRound` 限制在 `256`
- 因此后端直接返回 `soldTicketIndexes` 数组是可行的
- 不必为这个场景额外改合约

### 7.2.8 小时销售图

`GET /api/v1/pools/{poolId}/sales-hourly?window=24h`

推荐响应：

```json
{
  "poolId": "42",
  "windowHours": 24,
  "series": [
    { "bucketStart": "2026-04-23T00:00:00Z", "soldCount": 3, "revenueAmount": "15000000" }
  ],
  "comparison": {
    "currentSoldCount": 38,
    "previousSoldCount": 31,
    "deltaSoldCount": 7,
    "deltaPct": "22.58"
  }
}
```

### 7.2.9 创作者池子概览

`GET /api/v1/users/{address}/created-pools/summary`

推荐响应：

```json
{
  "creator": "0x...",
  "totalPoolCount": 12,
  "activePoolCount": 2,
  "lockedBondTotal": "650000000",
  "realizedRevenueTotal": "4800000000",
  "claimableCreatorProfitTotal": "126000000",
  "currentRoundSoldCountTotal": 1248,
  "currentRoundRemainingCountTotal": 236
}
```

---

## 7.3 后端实现注意事项

### 7.3.1 金额字段一律返回字符串

新的接口建议把 cUSDC 金额统一按“6 位小数整数”返回字符串，例如：

- `"5000000"` 表示 `5.000000`

原因：

- 避免前端浮点误差
- 避免 JS number 精度问题
- 与链上 / PostgreSQL bigint 更一致

前端自己格式化成人类可读的 `5.00 USDC`。

### 7.3.2 未 finalize 的 draft 需要清理

建议增加后台任务：

- 定期清理过期 `pool_metadata_drafts`

避免：

- 用户取消建池后遗留大量孤儿 metadata
- 无人引用的上传资产无限累积

### 7.3.3 写接口校验必须依赖链上

`finalize` 不能只信任前端传参，必须校验：

- 链上 creator
- 链上 themeId
- 交易回执中的 `PoolCreated`

---

## 8. 前端计划

## 8.1 服务层改造

新增或扩展：

- `packages/nextjs/services/luckyScratch/api.ts`
- `packages/nextjs/services/luckyScratch/types.ts`
- `packages/nextjs/hooks/luckyScratch/*`

建议拆分：

- `pool queries`
- `pool mutations (backend metadata side)`
- `asset uploads`
- `purchase context queries`

## 8.2 页面联通计划

### 8.2.1 `create-pool`

#### 当前问题

- 图片按钮还是静态视觉稿
- 没有上传、draft、链上 create、finalize 的真实流程

#### 落地步骤

1. 用户选择封面图和票面图
2. 前端先上传图片到后端
3. 前端提交 draft，拿到 `themeId`
4. 前端调用 `createPool`
5. 从 tx receipt 解析 `poolId`
6. 调用 finalize 接口
7. 跳转到 `pool-detail/{poolId}` 或 `profile`

#### 前端需要处理的状态

- 图片上传中
- draft 生成中
- 钱包确认中
- 交易打包中
- finalize 中
- 成功 / 失败回滚提示

### 8.2.2 `myprofile`

#### 目标

- 不再使用静态池子卡片
- `My Pools` 改成读真实 creator pool list

#### 落地步骤

1. 用连接钱包地址请求 `GET /users/{address}/created-pools/summary`
2. 用连接钱包地址请求 `GET /api/v1/pools?creator=...`
3. 卡片字段切换为真实字段
4. `Withdraw` 弹窗的数字改成来自后端聚合字段

### 8.2.3 `pool-detail`

#### 目标

- 去掉假的中奖流水
- 换成真实池子配置、当前轮次进度、账务快照、小时销售图

#### 落地步骤

1. 请求 `GET /api/v1/pools/{poolId}`
2. 请求 `GET /api/v1/pools/{poolId}/rounds/current`
3. 请求 `GET /api/v1/pools/{poolId}/sales-hourly?window=24h`
4. 如果当前用户是 creator，再展示收益操作区

### 8.2.4 `purchase`

#### 目标

- 用真实已售 ticket index 驱动选号

#### 落地步骤

1. 请求 `GET /api/v1/pools/{poolId}/purchase-context`
2. 根据 `soldTicketIndexes` 标记不可选卡片
3. 钱包提交 `purchaseTickets` 或 `purchaseTicketsWithSelection`
4. 交易成功后轮询刷新 purchase-context 和 detail

### 8.2.5 `scratch` / `tickets`

本链路当前已经有基础能力，重点是把购票后的真实 ticket 流转接进来。

推荐动作：

1. 购票成功后从后端读自己的 ticket 列表
2. 进入 scratch 页面后走现有 reveal-auth 和 Zama 代理
3. claim 完成后刷新 ticket / pool / profile 相关数据

---

## 9. 推荐实施阶段

## 阶段 A：修正展示口径

目标：

- 先把不真实的中奖数量 / 中奖金额展示下线

交付：

- `myprofile`、`pool-detail` 使用真实字段渲染
- 页面即使数据还不全，也不再展示错误口径

## 阶段 B：后端图片上传 + draft

目标：

- 打通图片上传到 IPFS
- 生成 metadata draft 和 `themeId`

交付：

- 上传接口
- draft 接口
- metadata 表结构

## 阶段 C：建池 finalize 联通

目标：

- 完成 “后端 draft -> 合约 createPool -> 后端 finalize”

交付：

- create-pool 页面真实建池成功
- 新建池子能在列表和详情页看到正确图片和文本

## 阶段 D：池子详情 / Creator 视图联通

目标：

- `pool-detail` 和 `myprofile` 切到真实后端聚合

交付：

- creator summary
- pool list metadata join
- current round detail

## 阶段 E：purchase 联通

目标：

- 手选购票和随机购票基于真实购票上下文

交付：

- `purchase-context`
- 交易后刷新

## 阶段 F：小时销售图 / 收益流水

目标：

- 完善运营和创作者视图

交付：

- 小时销售聚合
- 创作者收入流水

---

## 10. 联调验收标准

### 10.1 建池链路

- 前端能上传封面图和票面图
- 后端能把图片 pin 到 IPFS
- 前端能拿到 `themeId`
- 前端能用 `themeId` 成功调用 `createPool`
- 前端能从交易回执里拿到真实 `poolId`
- finalize 后，`pool-detail` 和 `myprofile` 能展示真实图片和文案

### 10.2 查询链路

- `myprofile` 能查出当前钱包创建的池子
- `pool-detail` 能显示真实当前轮次进度
- `purchase` 能拿到真实已售 ticket index

### 10.3 购票与刮奖链路

- 购票成功后，池子已售数会刷新
- 用户 tickets 列表会刷新
- scratch 和 reveal-auth 现有链路保持可用
- claim 后 profile 和 ticket 数据能刷新

### 10.4 口径正确性

- 活跃池页面不再出现“当前已售中奖彩票数量 / 金额”
- 历史结算页若展示中奖金额，只使用已结算读模型字段

---

## 11. 当前最关键的实施顺序

如果只按最小闭环推进，建议严格按下面顺序执行：

1. 先改页面展示口径，移除错误数据
2. 再做后端上传 IPFS + metadata draft
3. 再做 `createPool` finalize 联通
4. 再接 `myprofile` 与 `pool-detail`
5. 再接 `purchase`
6. 最后补小时销售图和收入流水

原因：

- 第 1 步能立即消除错误展示
- 第 2 到第 4 步能形成“建池 -> 详情 -> 个人中心”的最小真实闭环
- `purchase` 和 `scratch` 可以在已有基础上继续增量接入

---

## 12. 建议的首批任务单

建议先拆成以下任务：

1. 前端：`myprofile` 和 `pool-detail` 展示口径替换为真实字段
2. 后端：增加 `uploaded_assets`、`pool_metadata_drafts`、`pool_metadata`
3. 后端：实现 `POST /uploads/images`
4. 后端：实现 `POST /pool-drafts`
5. 前端：create-pool 接入图片上传和 draft 创建
6. 前端：create-pool 在交易回执后调用 finalize
7. 后端：实现 `POST /pools/{poolId}/finalize`
8. 后端：扩展 `GET /pools`、`GET /pools/{poolId}` 返回 metadata + current round summary
9. 前端：myprofile 接入 creator summary + creator pool list
10. 后端：实现 `GET /pools/{poolId}/purchase-context`
11. 前端：purchase 页面接入真实购票上下文
12. 后端：补 `pool_sales_hourly` 和销售对比接口

这 12 项完成后，LuckyScratch 前端才算真正从视觉稿阶段进入真实联通阶段。
