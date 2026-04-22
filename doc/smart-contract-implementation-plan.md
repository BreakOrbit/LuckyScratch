# LuckyScratch 智能合约实现计划

> 版本：v1.1
> 更新日期：2026-04-22
> 适用范围：`packages/hardhat`
> 关联文档：[smart-contract-design.md](./smart-contract-design.md) / [backend-design.md](./backend-design.md)

---

# 1. 目标

本文件把当前 LuckyScratch 合约实现拆成持续可维护的交付顺序，并给出默认验证面。当前范围只保留用户钱包直连交易路径。

---

# 2. 当前实现状态

仓库已经具备以下核心代码与测试：

- 合约：
  - `LuckyScratchCore.sol`
  - `LuckyScratchTicket.sol`
  - `LuckyScratchTreasury.sol`
  - `LuckyScratchVRFAdapter.sol`
- 部署入口：
  - `packages/hardhat/deploy/02_deploy_lucky_scratch.ts`
- 测试：
  - `core.create-pool.ts`
  - `core.purchase.ts`
  - `core.scratch.ts`
  - `core.claim.ts`
  - `ticket.transfer.ts`
  - `vrf.init.ts`
  - `roll.next-round.ts`

---

# 3. 实施顺序

## 3.1 阶段 1：类型、接口与基础状态机

目标：

- 稳定 `LuckyScratchTypes.sol`
- 收敛 `ILuckyScratch*` 接口
- 固定 pool / round / ticket 的基础状态机

完成标准：

- `createPool`
- `closePool`
- `pausePool`
- `purchaseTickets`
- `scratchTicket`
- `claimReward`

## 3.2 阶段 2：资金流与 NFT 约束

目标：

- 接通 `Treasury`
- 接通 `Ticket`
- 保证转让限制与领奖资金路径正确

完成标准：

- 购票时能收票款并 mint NFT
- 已刮开 / 已领奖后禁止转让
- 领奖时由 `Treasury` 出款

## 3.3 阶段 3：VRF 初始化

目标：

- 接入 `LuckyScratchVRFAdapter`
- 建立 requestId 与 `(poolId, roundId)` 映射
- 在回调时写入加密奖项 slot

完成标准：

- 未完成 VRF 初始化的 round 不可售票
- 同一 request 不可重复初始化
- 初始化完成后可购票

## 3.4 阶段 4：自选与批量操作

目标：

- `purchaseTicketsWithSelection`
- `batchScratch`
- `batchClaimRewards`

完成标准：

- 自选 index 越界 / 重复 / 已售时失败
- 批量刮奖与领奖在混入非法 ticket 时整笔回滚

## 3.5 阶段 5：循环池与创建者结算

目标：

- `rollToNextRound`
- 创建者利润提取
- 保证金退还

完成标准：

- 未结算 round 不能 roll
- 利润不足时 pool 进入 `Closing`
- 关闭后可提利润、退保证金

## 3.6 阶段 6：前后端联调边界

目标：

- 稳定 reveal 所需只读接口
- 保持 ABI 与 backend indexer / frontend hooks 一致

必须保留的最小链上读取面：

- `poolConfigs`
- `poolStates`
- `poolAccounting`
- `roundStates`
- `tickets`
- `getTicketRevealState`
- `getTicketPrizeHandle`
- `claimableCreatorProfit`
- `ownerOf`

---

# 4. 默认验证面

## 4.1 合约验证命令

```bash
yarn compile
yarn hardhat:check-types
yarn test
```

## 4.2 必测场景

1. 创建池成功，非法配置失败
2. VRF 初始化前不可购票
3. 机选购票与自选购票都能正确 mint ticket
4. 刮奖后 reveal 状态与 ticket 状态正确
5. 无奖票不能领奖
6. 中奖票领奖后状态正确变化
7. 已刮开 ticket 不可转让
8. round 结算前不能 `rollToNextRound`
9. 循环池在满足条件后可创建下一轮

---

# 5. Definition Of Done

任一阶段完成至少满足：

1. 对应代码已实现并通过 `yarn compile`
2. 对应测试已补齐并通过
3. 部署脚本已同步更新
4. 需要给前端 / 后端消费的接口与事件已稳定
5. 文档与 `AGENTS.md` 已同步更新

---

# 6. 变更约束

- 不再引入签名代发相关入口、库、事件或测试
- 不新增仅为后端方便而设计的高成本链上列表接口
- 涉及 ABI、事件或部署方式的修改必须同步更新前端、后端与文档
