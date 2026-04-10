# LuckyScratch 智能合约实现计划

> 版本：v1.0  
> 更新日期：2026-04-10  
> 适用范围：`packages/hardhat`  
> 关联文档：[smart-contract-design.md](./smart-contract-design.md) / [backend-design.md](./backend-design.md)

---

# 1. 目标

本文件用于把 [智能合约详细设计](./smart-contract-design.md) 转成可执行的实现计划，明确：

- 先做哪些模块
- 每个阶段交付什么
- 哪些功能依赖前置模块
- 每阶段需要完成哪些测试
- 如何控制实现风险

目标不是一次性把所有功能写完，而是按闭环逐步交付。

---

# 2. 实现原则

## 2.1 总体策略

- 先跑通最小链路，再扩展复杂功能
- 先做协议控制池，再做社区创建池
- 先做单轮，再做循环池
- 先做机选，再做自选
- 先做单张操作，再做批量操作
- 先做链上闭环，再对接后端自动化与前端体验

## 2.2 优先级

优先级从高到低：

1. 类型与接口
2. 核心状态机
3. 资金流
4. 票 NFT 转让控制
5. VRF 初始化
6. Gasless
7. 循环池刷新
8. 社区创建池与利润提取

## 2.3 明确不在第一阶段完成

- 社区池
- 循环池
- 自选购票
- 批量刮奖 / 批量领奖
- 复杂报表和管理功能

---

# 3. 目标代码结构

计划采用以下目录：

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
      GaslessVerifyLib.sol
      TicketStateLib.sol
    types/
      LuckyScratchTypes.sol

packages/hardhat/test/
  luckyScratch/
    core.create-pool.ts
    core.purchase.ts
    core.scratch.ts
    core.claim.ts
    ticket.transfer.ts
    vrf.init.ts
    gasless.purchase.ts
    gasless.scratch.ts
    roll.next-round.ts
```

---

# 4. 阶段划分

## 4.1 阶段 0：基础准备

目标：

- 建立合约目录
- 建立类型、接口、事件、错误定义
- 确认外部依赖与部署配置

任务：

1. 创建 `luckyScratch/` 目录结构
2. 新建 `LuckyScratchTypes.sol`
3. 新建 4 个接口文件
4. 新建空骨架合约文件
5. 在 Hardhat 配置中补齐 LuckyScratch 部署入口
6. 确认 Zama fhEVM 与 Chainlink VRF 依赖接入方式

产出：

- 可编译的空骨架
- 所有核心类型集中在 `LuckyScratchTypes.sol`
- 所有事件、枚举、struct 命名冻结

验收标准：

- `yarn compile` 通过
- 基础合约文件和接口文件已存在

## 4.2 阶段 1：最小闭环

目标：

实现“协议控制池 + 单轮 + 机选 + 单张刮奖 + 单张领奖”的最小业务闭环。

阶段边界说明：

- 本阶段允许使用本地 stub / mock 奖项结果完成单轮闭环测试。
- 本阶段的“单轮初始化”不等于真实生产版建池初始化。
- 真实的 `VRF -> 洗牌 -> encryptedPrizeAmount` 写入在阶段 2 完成。
- 因此阶段 1 的重点是状态机和资金流，不是随机性接入。

范围：

- `createPool`
- 单轮初始化
- `purchaseTickets`
- `scratchTicket`
- `claimReward`
- `LuckyScratchTicket` 转让限制
- `LuckyScratchTreasury` 基础收款与派奖

任务拆分：

1. `LuckyScratchTicket`
   - ERC-721 基础实现
   - 仅允许 `Core` mint
   - 已刮开/已领奖后禁止转让
2. `LuckyScratchTreasury`
   - 持有官方 `cUSDC`
   - `collectTicketPayment`
   - `payoutReward`
3. `LuckyScratchCore`
   - pool / round 基础状态
   - 机选售票
   - ticket 状态机
   - 单张领奖
4. 只读接口
   - `getTicketRevealState`
5. 基础事件
   - `PoolCreated`
   - `TicketPurchased`
   - `TicketScratched`
   - `RewardClaimed`

产出：

- 单轮池可售票、刮奖、领奖
- NFT 可在未刮开时转让
- 资金由 `Treasury` 收取和发放

验收标准：

- 单轮完整 happy path 测试通过
- 已刮开后转让会 revert
- 无奖票不能领奖
- 已领奖不能重复领奖

## 4.3 阶段 2：VRF 初始化

目标：

把奖项预分配从本地 stub 升级为“VRF 请求 -> 回调初始化”。

阶段边界说明：

- 从本阶段开始，池初始化流程才接近生产语义。
- 阶段 1 中使用的 stub / mock 奖项初始化逻辑应在本阶段被替换或隔离到测试环境。
- 阶段 2 完成后，`createPool -> PendingVRF -> Ready` 应成为默认建池流程。

范围：

- `LuckyScratchVRFAdapter`
- `fulfillPoolRandomness`
- `PendingVRF -> Ready`
- `PoolRoundRequested`
- `PoolRoundInitialized`

任务拆分：

1. 实现 requestId 与 `(poolId, roundId)` 映射
2. 实现 round 初始化状态校验
3. 接入奖项表洗牌逻辑
4. 写入 `encryptedPrizeAmount`
5. 写入 `shuffleRoot`

产出：

- 新池创建后进入 `PendingVRF`
- VRF 回调后进入 `Ready`
- 未完成初始化的池不可售票

验收标准：

- 无 VRF 回调前无法购票
- 同一个 requestId 不能重复处理
- 回调成功后可购票

## 4.4 阶段 3：Gasless 基础版

目标：

支持 Gasless 购票与 Gasless 刮奖。

范围：

- `executeGaslessPurchase`
- `executeGaslessScratch`
- `GaslessVerifyLib`
- nonce / digest / deadline 校验

任务拆分：

1. EIP-712 digest 组装
2. `paramsHash` 校验
3. `nonce` 递增与重放保护
4. relayer 白名单权限
5. 事件：
   - `GaslessExecuted`
   - 失败状态由 relayer 服务结合交易回执记录，不依赖链上 `GaslessRejected`

产出：

- 用户签名后可由 relayer 代发购票/刮奖交易
- 首次 `approve Treasury` 仍保留用户自付

验收标准：

- 错误 nonce 会失败
- 错误签名会失败
- 过期请求会失败
- 参数被篡改会失败

## 4.5 阶段 4：自选购票

目标：

支持按 `ticketIndex` 自选购票。

范围：

- `purchaseTicketsWithSelection`
- `soldTicketSlots`
- index 边界校验

任务拆分：

1. 校验 index 不重复
2. 校验 index 未售
3. 校验数量上限
4. 同步 mint 多张 NFT

验收标准：

- 选择已售票位会失败
- 重复 index 会失败
- 越界 index 会失败

## 4.6 阶段 5：批量操作

目标：

支持批量刮奖与批量领奖。

范围：

- `batchScratch`
- `batchClaimRewards`
- `executeGaslessBatchScratch`

任务拆分：

1. 批量状态遍历
2. 批量事件与 gas 控制
3. 失败策略
   - 全部回滚
   - 或逐个处理

建议：

- 第一版采用“单笔中任一失败则整笔回滚”

验收标准：

- 多张票可批量刮
- 已领奖票混入批量请求时整笔失败

## 4.7 阶段 6：循环池刷新

目标：

实现循环池的显式刷新与后续 round 创建能力。

范围：

- `rollToNextRound`
- `RoundSettled`
- `PoolRolledToNextRound`
- `SoldOut -> Settled -> PendingVRF -> Ready`

任务拆分：

1. `RoundSettled` 判定
2. `rollToNextRound` 条件校验
3. 锁定下一轮预算
4. 创建新 round 并请求 VRF
5. 更新 `PoolStatus`

后端依赖：

- 后端已能监听 `SoldOut`
- 后端已能监听 `RoundSettled`
- 后端已能在售罄后自动尝试一次 `rollToNextRound`
- 后端已支持 `waiting_settlement` 状态重试

验收标准：

- 售罄但未结算时调用 `rollToNextRound` 会失败
- 已满足结算条件后可刷新到新 round
- 余额不足时 pool 进入 `Closing`

## 4.8 阶段 7：社区创建池与利润提取

目标：

支持普通创建者建池、提取利润与退还保证金。

范围：

- `createPool` 权限分层
- 保证金锁定
- `withdrawCreatorProfit`
- `refundBond`

任务拆分：

1. 创建者池参数校验
2. 保证金比例与锁定规则
3. 可提利润计算
4. pool 完整关闭后的保证金退还

验收标准：

- 未结算时不能退保证金
- 超过可提利润不能提取
- 关闭后可退保证金

---

# 5. 模块实施顺序

建议的实际编码顺序：

1. `LuckyScratchTypes.sol`
2. `ILuckyScratch*` 接口
3. `LuckyScratchTicket.sol`
4. `LuckyScratchTreasury.sol`
5. `LuckyScratchCore.sol` 的阶段 1 功能
6. `LuckyScratchVRFAdapter.sol`
7. `GaslessVerifyLib.sol`
8. 自选/批量/循环池

原因：

- 类型先稳定，避免后续反复改 ABI
- `Ticket` 和 `Treasury` 边界清楚，先实现最省返工
- `Core` 最复杂，应该在类型与边界稳定后实现

## 5.1 ABI 收敛规则

- 阶段 0 到阶段 1：允许根据实现需要收敛接口与 struct 字段
- 阶段 2 完成后：核心用户接口冻结
  - `purchaseTickets`
  - `purchaseTicketsWithSelection`
  - `scratchTicket`
  - `claimReward`
  - `rollToNextRound`
- 阶段 3 完成后：Gasless 请求结构冻结
- 阶段 4 完成后：前后端依赖事件结构冻结

说明：

- 如确需继续改 ABI，必须同步更新设计文档、部署脚本、前端和后端接口契约

---

# 6. 测试计划

## 6.1 测试层次

需要同时具备：

- 单元测试
- 状态机测试
- 权限测试
- 回归测试

## 6.1.1 本地替身策略

为保证阶段 1-3 可以稳定推进，测试环境采用以下替身方案：

- `cUSDC`
  - 本地使用 mock ERC-20 / mock cUSDC 合约
  - 重点验证 `approve -> Treasury.collectTicketPayment -> payoutReward`
- VRF
  - 本地使用 mock `LuckyScratchVRFAdapter`
  - 手动驱动 `fulfillPoolRandomness`
- Reveal / fhEVM 解密
  - 合约测试不验证真实后端解密
  - 只验证 `getTicketRevealState`、`revealAuthorized` 和 ticket 状态变化

说明：

- 真实 Zama 解密授权编排放在后端联调阶段验证
- 合约测试重点是权限与状态，不是浏览器端 reveal 流程

## 6.2 第一阶段必测用例

1. 创建池成功
2. 未初始化池不可购票
3. 购票成功后 NFT 铸造成功
4. 刮奖后 ticket 状态正确变化
5. 无奖票不能领取奖励
6. 中奖票领取后转为 `Claimed`
7. 已刮开后不可转让
8. 未刮开可转让
9. 领奖时由 `Treasury` 出款

## 6.3 第二阶段新增测试

1. VRF 回调前不可售
2. requestId 不可重复使用
3. 回调后结果写入成功
4. `shuffleRoot` 被正确保存

## 6.4 Gasless 测试

1. 正确签名可执行
2. 过期签名失败
3. nonce 重放失败
4. 错误 `paramsHash` 失败
5. 非 relayer 地址调用失败

## 6.5 循环池测试

1. `SoldOut` 但未 `Settled` 时不能 roll
2. `Settled` 后可 roll
3. roll 后 round 进入 `PendingVRF`
4. 新 round 初始化成功后回到 `Ready`
5. 余额不足进入 `Closing`

---

# 7. Definition Of Done

任一阶段宣告完成，至少满足：

1. 对应代码已实现并通过 `yarn compile`
2. 对应测试已补齐并通过
3. 部署脚本或部署参数已同步更新
4. 相关事件已能被前端/后端正确消费或至少完成本地验证
5. 文档已同步更新，不保留过时接口描述
6. 未完成项和已知风险已明确记录

---

# 8. 部署与联调顺序

## 7.1 本地联调顺序

1. 部署 `Ticket`
2. 部署 `Treasury`
3. 部署 `VRFAdapter`
4. 部署 `Core`
5. 配置 `Core <-> Ticket`
6. 配置 `Core <-> Treasury`
7. 配置 `Core <-> VRFAdapter`
8. 配置 relayer 白名单

## 7.2 前后端联调顺序

1. 先对接只读查询
2. 再对接购票
3. 再对接刮奖
4. 再对接 reveal auth
5. 最后对接循环池刷新

---

# 9. 风险点与控制

## 8.1 风险点

- `Core` 状态机过重
- VRF 初始化链路复杂
- FHE 状态写入与读取接口复杂
- Gasless 验签容易出错
- 循环池刷新会和结算条件耦合

## 8.2 控制方式

- 先做阶段 1 最小闭环
- 复杂功能全部拆成独立阶段
- 每阶段只增加一种新复杂度
- 每阶段完成后再继续扩展 ABI

---

# 10. 建议里程碑

## M1：最小闭环

交付：

- 单轮协议池
- 机选购票
- 单张刮奖
- 单张领奖
- NFT 转让控制

## M2：可初始化生产流程

交付：

- VRF 初始化
- 奖项洗牌
- reveal 状态可读接口
- 完整事件集

## M3：交互优化

交付：

- Gasless 购票
- Gasless 刮奖
- 自选购票

## M4：高级运营能力

交付：

- 循环池刷新
- 批量操作
- 社区创建池
- 利润提取与保证金退还

---

# 11. 结论

推荐的实现路径是：

- 先交付阶段 1 的最小闭环
- 再补 VRF 初始化
- 再补 Gasless
- 再补自选和批量
- 最后实现循环池与社区池

这样可以保证每一阶段都有可运行、可测试、可联调的成果，避免一开始就把所有复杂功能耦合在一起。
