# LuckyScratch 智能合约详细设计

> 版本：v1.1
> 更新日期：2026-04-22
> 适用范围：`packages/hardhat` 当前实现
> 关联文档：[design.md](./design.md) / [detailed-design.md](./detailed-design.md) / [smart-contract-implementation-plan.md](./smart-contract-implementation-plan.md)

---

# 1. 目标

本文件描述 LuckyScratch 当前智能合约的模块边界、状态模型与外部接口。重点关注：

- 奖项如何在链上初始化并保持加密
- 建池、购票、刮奖、领奖与循环池如何串联
- `Core` / `Ticket` / `Treasury` / `VRFAdapter` 的职责划分
- 前后端应依赖哪些链上接口

当前实现只保留用户钱包直连交易路径。购票、刮奖、领奖和创建者资金操作都由用户钱包直接提交链上交易。

---

# 2. 当前实现边界

- 奖项在 round 初始化时一次性洗牌，并以 fhEVM 加密状态写入链上
- 购票只是在已初始化的 round 中分配 ticket slot，不在购买时重新抽随机数
- 刮奖不生成新随机性，只把预分配结果绑定到具体 ticket 的 reveal 流程
- 领奖必须走 `claimReward(ticketId, clearRewardAmount, decryptionProof)` 或批量等价接口
- 列表型查询不在核心合约内实现，统一交给 backend indexer
- 合约不再维护额外的签名代发 nonce、digest 或白名单状态

---

# 3. 合约组成

## 3.1 `LuckyScratchCore`

负责：

- pool / round 生命周期
- 购票与自选购票
- 单张 / 批量刮奖
- 单张 / 批量领奖
- 创建者利润记账
- 循环池滚动到下一轮
- reveal 最小状态查询

## 3.2 `LuckyScratchTicket`

ERC-721 彩票合约，负责：

- ticket NFT 铸造
- 所有权维护
- 未刮开 ticket 的正常转让
- 已刮开或已领奖 ticket 的转让限制
- 在转让时回调 `Core` 更新业务状态

## 3.3 `LuckyScratchTreasury`

负责：

- cUSDC 托管
- 票款收取
- 奖励支付
- 创建者利润提取
- 保证金锁定与退还

## 3.4 `LuckyScratchVRFAdapter`

负责：

- 发起 Chainlink VRF v2.5 请求
- 维护 request 与 `(poolId, roundId)` 的对应关系
- 把随机数回调给 `Core`

本地测试保留 mock fulfillment，线上网络走真实 VRF subscription。

## 3.5 类型与库

- `types/LuckyScratchTypes.sol`
- `libraries/PoolMathLib.sol`
- `libraries/PrizeShuffleLib.sol`
- `libraries/TicketStateLib.sol`

---

# 4. 状态模型

## 4.1 关键业务结构

- `PoolConfig`
- `PoolState`
- `PoolAccounting`
- `RoundState`
- `TicketData`
- `EncryptedTicketState`
- `EncryptedUserState`

## 4.2 关键存储入口

前后端当前应优先依赖这些公开 getter：

- `poolConfigs(poolId)`
- `poolStates(poolId)`
- `poolAccounting(poolId)`
- `roundStates(poolId, roundId)`
- `tickets(ticketId)`
- `getTicketRevealState(ticketId)`
- `getTicketPrizeHandle(ticketId)`
- `claimableCreatorProfit(poolId)`
- ERC-721 `ownerOf(ticketId)`

没有额外的链上列表 view，也没有签名代发相关状态映射。

---

# 5. 核心流程

## 5.1 建池与初始化

1. 创建者调用 `createPool`
2. `Treasury` 锁定所需保证金
3. `Core` 创建 pool 与首轮 round
4. `VRFAdapter` 请求随机数
5. VRF 回调后，`Core` 洗牌奖项并写入加密 slot
6. round 从 `PendingVRF` 进入可售状态

## 5.2 购票

1. 用户钱包持有足够的 `cUSDC`
2. 用户调用 `purchaseTickets` 或 `purchaseTicketsWithSelection`
3. `Treasury` 收取票款
4. `Ticket` 铸造 NFT
5. `Core` 记录 ticket 与 slot 绑定关系

## 5.3 刮奖与揭晓

1. 用户调用 `scratchTicket` 或 `batchScratch`
2. `Core` 校验当前持有人与 ticket 状态
3. ticket 状态进入已刮开
4. `Core` 打开 reveal 授权最小状态
5. 前端再通过 backend reveal 流程读取并解密结果

## 5.4 领奖

1. 前端完成 `clearRewardAmount + decryptionProof` 组装
2. 用户钱包调用 `claimReward` 或 `batchClaimRewards`
3. `Core` 校验 ticket 状态与 proof
4. `Treasury` 向用户发放加密 `cUSDC`

## 5.5 循环池与结算

1. 当前轮全部 ticket 已刮开且中奖 ticket 已领奖
2. round 标记为 `Settled`
3. 仅 loop 模式 pool 可继续 `rollToNextRound`
4. 若利润不足以锁定下一轮预算，pool 进入 `Closing`

---

# 6. 对外接口

## 6.1 管理与配置

- `setVrfAdapter(address)`
- `setTreasury(address)`
- `setTicket(address)`
- `pausePool(uint256,bool)`

## 6.2 用户写接口

- `createPool(PoolConfig, PrizeTierInput[])`
- `closePool(uint256)`
- `rollToNextRound(uint256)`
- `purchaseTickets(uint256,uint32)`
- `purchaseTicketsWithSelection(uint256,uint32[])`
- `scratchTicket(uint256)`
- `batchScratch(uint256[])`
- `claimReward(uint256,uint64,bytes)`
- `batchClaimRewards(uint256[],uint64[],bytes[])`

## 6.3 只读与回调接口

- `fulfillPoolRandomness(bytes32,uint256)`
- `getTicketRevealState(uint256)`
- `getTicketPrizeHandle(uint256)`
- `claimableCreatorProfit(uint256)`
- `onTicketTransfer(uint256,address,address)`

---

# 7. 权限与信任边界

- `Core` 当前只有 `DEFAULT_ADMIN_ROLE` 与 `ADMIN_ROLE`
- 管理员负责配置 `ticket` / `treasury` / `vrfAdapter`
- `fulfillPoolRandomness` 只接受当前配置的 `vrfAdapter`
- pool 创建者或管理员可执行 `pausePool`、`closePool`、`rollToNextRound`
- ticket owner 才能刮奖和领奖
- backend 只消费公开 getter 与事件，不应要求新增包装 view

---

# 8. 事件面

当前核心事件：

- `PoolCreated`
- `PoolRoundRequested`
- `PoolRoundInitialized`
- `RoundSettled`
- `TicketPurchased`
- `TicketScratched`
- `RewardClaimed`
- `CreatorProfitWithdrawn`
- `BondRefunded`
- `PoolClosed`
- `PoolRolledToNextRound`

事件不暴露奖项明文。后端应同时监听 ERC-721 `Transfer` 维护 owner 缓存。

---

# 9. 设计约束

- 合约字节码和 gas 敏感，避免新增冗余 wrapper view
- 避免重复 struct copy 和不必要的 storage 写入
- 不在链上维护高成本列表型查询
- 奖励金额必须保持加密存储，直到 claim proof 验证通过
- 关闭 pool 后，旧 VRF 回调不得把 pool 重新带回可售状态

---

# 10. 推荐文件布局

```text
packages/hardhat/contracts/
  luckyScratch/
    LuckyScratchCore.sol
    LuckyScratchTicket.sol
    LuckyScratchTreasury.sol
    LuckyScratchVRFAdapter.sol
    interfaces/
      ILuckyScratchCore.sol
      ILuckyScratchTicket.sol
      ILuckyScratchTreasury.sol
      ILuckyScratchVRFAdapter.sol
    libraries/
      PoolMathLib.sol
      PrizeShuffleLib.sol
      TicketStateLib.sol
    types/
      LuckyScratchTypes.sol
```
