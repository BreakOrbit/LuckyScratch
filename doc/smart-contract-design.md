# LuckyScratch 智能合约详细设计

> 版本：v1.0  
> 更新日期：2026-04-10  
> 适用范围：`packages/hardhat` 实现方案  
> 关联文档：[design.md](./design.md) / [detailed-design.md](./detailed-design.md)

---

# 1. 目标

本文件用于把 LuckyScratch 的产品设计落到可实现的合约架构上，重点回答：

- 合约拆成哪些模块
- 每个模块负责什么
- 核心状态如何存储
- 购票、刮奖、领奖、建池、刷新如何串起来
- Zama FHE、Chainlink VRF、Gasless Relayer 在合约层如何接入

本文档是实现蓝图，不是最终 ABI 承诺。实现阶段允许在不破坏核心模型的前提下做接口收敛。

---

# 2. 设计原则

## 2.1 核心原则

- 奖项结果在建池时一次性预分配
- 预分配顺序由 Chainlink VRF 洗牌决定
- 奖项内容、奖金库存、用户奖励余额使用 Zama FHE 加密
- 直接接入 Zama 官方现成的 `cUSDC` 合约
- `cUSDC` 在游戏流程中全程以加密态流转
- 购票与刮奖支持 Gasless
- 不在项目内设计 `USDC <-> cUSDC` 转换流程
- `claimReward`：把单张票奖励发放到用户钱包中的加密 `cUSDC`

已确认实现决策：

- Zama 官方 `cUSDC` 合约地址：
  - Sepolia: `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`
  - Ethereum Mainnet: `0xe978F22157048E5DB8E5d07971376e86671672B2`
- Zama fhEVM 解密授权接口由后端服务实现
- VRF 请求与回调成本按 pool 计提
- 自选购票对所有池开放
- “池实例数量”在实现中保留为独立 `pool instance`

## 2.2 不采用的方案

- 不在购票时实时抽随机数
- 不在刮开时实时生成中奖结果
- 不在运行时做“策略性出奖节奏调控”
- 不把用户游戏余额维护成明文 `USDC`

---

# 3. 推荐合约拆分

推荐使用“1 个核心协调合约 + 1 个 NFT 合约 + 1 个资金库 + 1 个 VRF 模块 + 若干库”的结构，而不是把逻辑过度拆散。

补充原则：

- 合约层不区分“官方池逻辑”和“用户池逻辑”。
- 所有池都走同一套状态机、同一套购票逻辑、同一套刮奖逻辑、同一套领奖逻辑。
- 差异只体现在配置参数、创建权限、费用归属和利润归属上。

## 3.1 合约列表

### `LuckyScratchCore`

主业务合约，负责：

- 统一的池管理
- 回合初始化
- 购票
- 自选购票
- 刮奖
- 领奖
- 用户累计中奖统计
- 创建者利润记账
- 循环池刷新
- Gasless 授权执行入口

### `LuckyScratchTicket`

ERC-721 合约，负责：

- 彩票 NFT 铸造
- 转让控制
- 仅允许 `Core` 更新票状态
- 已刮开 / 已领奖后禁止转让

### `LuckyScratchTreasury`

资金库合约，负责：

- 奖池保证金锁定
- 创建者利润提取
- Sponsor / Infra 成本归集

### `LuckyScratchVRFAdapter`

Chainlink VRF 适配层，负责：

- 发起随机数请求
- 将 requestId 映射到 pool / round
- 回调后把随机数交给 `Core`

说明：

- 每个独立 `pool instance` 自行发起 VRF 请求并单独计提成本。

### 库

- `PoolMathLib`
- `PrizeShuffleLib`
- `GaslessVerifyLib`
- `TicketStateLib`

---

# 4. 模块职责边界

## 4.1 `Core` 与 `Treasury` 的边界

### `Core` 负责

- 谁可以买
- 买哪张票
- 哪张票已售
- 哪张票已刮
- 哪张票可领奖
- 哪个池处于什么状态

### `Treasury` 负责

- 钱从哪来
- 持有奖池资金与销售收入
- 按规则向中奖用户转出官方 `cUSDC`
- 钱什么时候能提
- 创建者还有多少可提利润
- 保证金还有多少锁定

## 4.2 `Core` 与 `Ticket` 的边界

### `Ticket` 只负责

- NFT 标准逻辑
- 所有权
- 转让约束

### `Core` 决定

- 票面业务状态
- 是否允许刮奖
- 是否允许领奖
- 奖励金额归属

---

# 5. 关键状态模型

以下字段以“业务语义”为主，类型可在实现时微调。

## 5.1 Pool

```solidity
type PoolId is uint256;
type RoundId is uint256;
type TicketId is uint256;
```

```solidity
enum PoolMode {
    OneTime,
    Loop
}

enum PoolStatus {
    Initializing,
    Active,
    SoldOut,
    Closing,
    Closed
}
```

```solidity
struct PoolConfig {
    PoolMode mode;
    address creator;
    bool protocolOwned;
    uint32 poolInstanceGroupSize;
    // 仅用于产品层模板配置，表示同主题下计划创建多少个独立 pool instance；
    // 不参与单个 pool instance 的运行时状态机与结算。
    uint64 ticketPrice;
    uint32 totalTicketsPerRound;
    uint64 totalPrizeBudget;
    uint16 feeBps;
    uint16 targetRtpBps;
    uint16 hitRateBps;
    uint64 maxPrize;
    bytes32 themeId;
    bool selectable;
}
```

```solidity
struct PoolAccounting {
    uint64 lockedBond;
    uint64 lockedNextRoundBudget;
    uint64 realizedRevenue;
    uint64 settledPrizeCost;
    uint64 settledProtocolCost;
    uint64 accruedPlatformFee;
    uint64 creatorProfitClaimed;
}
```

```solidity
struct PoolState {
    PoolStatus status;
    uint32 currentRound;
    bool closeRequested;
    bool vrfPending;
    bool initialized;
}
```

## 5.2 Round

```solidity
enum RoundStatus {
    PendingVRF,
    Ready,
    SoldOut,
    Settled
}

struct RoundState {
    RoundStatus status;
    uint32 soldCount;
    uint32 claimedCount;
    uint32 scratchedCount;
    uint32 winClaimableCount;
    uint32 totalTickets;
    uint64 ticketPrice;
    uint64 roundPrizeBudget;
    bytes32 vrfRequestRef;
    bytes32 shuffleRoot;
}
```

说明：

- `shuffleRoot` 代表本轮预分配结果的承诺值或索引根。
- 奖项明文不直接明文存储在普通 `uint[]` 中。
- 结果可按 ticket index 映射到加密奖项槽位。

## 5.3 Ticket

```solidity
enum TicketStatus {
    Unscratched,
    ScratchedNoWin,
    ScratchedWinClaimable,
    Claimed
}

struct TicketData {
    PoolId poolId;
    RoundId roundId;
    uint32 ticketIndex;
    TicketStatus status;
    bool transferredBeforeScratch;
    uint64 claimedAmountPlainHint;
}
```

说明：

- `claimedAmountPlainHint` 仅在实现确需明文缓存时存在；默认建议不保留。
- 真正奖励金额应以 FHE 加密状态为准。

## 5.4 Encrypted State

```solidity
struct EncryptedRoundState {
    euint64 remainingPrizeBalance;
    euint32 remainingTicketCount;
    euint32[] remainingPrizeCounts;
}

struct EncryptedUserState {
    euint64 encryptedLifetimeWinnings;
}

struct EncryptedTicketState {
    euint64 encryptedPrizeAmount;
    ebool revealAuthorized;
}
```

说明：

- `encryptedPrizeAmount` 在建池并完成 VRF 洗牌后写入。
- 刮奖不生成新结果，只是把既有结果绑定到该 NFT 的揭晓流程。
- `revealAuthorized` 表示该票在链上状态更新后已允许当前持有人进入揭晓流程，不表达可转移的长期查看权。
- 不在项目内维护用户可消费 `cUSDC` 余额账本；用户钱包余额由官方 `cUSDC` 合约维护。
- `EncryptedUserState` 仅保留统计类字段，例如累计中奖额。

## 5.5 Gasless

```solidity
enum GaslessAction {
    Purchase,
    PurchaseSelection,
    Scratch,
    BatchScratch
}

struct GaslessRequest {
    address user;
    GaslessAction action;
    address targetContract;
    bytes32 paramsHash;
    uint256 nonce;
    uint256 deadline;
    uint256 chainId;
}
```

---

# 6. 关键映射关系

```solidity
mapping(PoolId => PoolConfig) public poolConfigs;
mapping(PoolId => PoolState) public poolStates;
mapping(PoolId => PoolAccounting) public poolAccounting;

mapping(PoolId => mapping(RoundId => RoundState)) public roundStates;
mapping(PoolId => mapping(RoundId => EncryptedRoundState)) internal encryptedRounds;

mapping(TicketId => TicketData) public tickets;
mapping(TicketId => EncryptedTicketState) internal encryptedTickets;

mapping(address => EncryptedUserState) internal users;
mapping(address => uint256) public nonces;

mapping(bytes32 => bool) public usedVrfRequest;
mapping(bytes32 => bool) public usedGaslessDigest;
mapping(PoolId => mapping(RoundId => mapping(uint32 => bool))) public soldTicketSlots;
```

---

# 7. 生命周期设计

## 7.1 池创建与初始化

1. 创建者提交奖项参数、票价、总票数、模式
2. 若该池需要保证金，则 `Treasury` 先锁定保证金
3. `Core` 创建 pool 与 round 1
4. 请求 Chainlink VRF
5. VRF 返回随机数
6. `Core` 使用随机数对奖项表洗牌
7. 将洗牌后的结果以加密状态写入本轮 ticket slots
8. round 状态从 `PendingVRF` 变为 `Ready`
9. 池状态变为 `Active`

补充：

- 若产品层配置一个主题下有多个“池实例数量”，实现中直接落为多个独立 `pool instance`。
- 每个 `pool instance` 拥有独立的 `poolId`、独立 round、独立收益核算与独立 VRF 请求。

## 7.2 购票

1. 用户钱包中已有足够的官方 `cUSDC`
2. 用户选择机选或自选
3. `Core` 校验 round 状态为 `Ready`
4. 用户默认只需对 `Treasury` 完成 `approve`
5. `Core` 调用 `Treasury.collectTicketPayment(...)`，由 `Treasury` 通过 `allowance + transferFrom` 从用户钱包消费 `cUSDC`
5. 若官方 `cUSDC` 后续支持 `permit`，可在不改变主流程的前提下增加单笔授权优化
6. 购票收入进入 `Treasury`，作为奖池兑付资金与利润结算基础
7. 标记对应 ticket slot 已售
8. 铸造 NFT
9. 更新销售收入与售票计数
10. 如全部售完，则 round 进入 `SoldOut`

## 7.3 刮奖

1. 校验调用人是 NFT 当前持有人
2. 校验 ticket 状态为 `Unscratched`
3. 读取该 ticket 预分配的加密奖项
4. 标记 ticket 已刮
5. 若奖项大于 0，则状态转为 `ScratchedWinClaimable`
   - `winClaimableCount += 1`
6. 若奖项等于 0，则状态转为 `ScratchedNoWin`
7. 将 `revealAuthorized` 标记为 `true`
8. 发出刮奖完成事件并锁定后续不可转让
9. 前端基于授权在本地揭晓

## 7.4 领奖

1. 校验 ticket 状态为 `ScratchedWinClaimable`
2. 读取 ticket 的加密奖励
3. `Treasury` 从池资金中向 `ownerOf(ticketId)` 转出官方 `cUSDC`
4. 更新用户累计加密奖励
5. ticket 状态改为 `Claimed`
6. round 的 claim 计数递增
7. 同步累计已结算奖金成本
8. `winClaimableCount -= 1`
9. 当 round 已 `SoldOut`，且 `scratchedCount == soldCount`，且 `winClaimableCount == 0` 时，round 进入 `Settled`

## 7.5 循环池刷新

触发方式：

- 不采用“售罄后在最后一笔购票交易里自动刷新”
- 采用显式链上函数触发下一轮，例如 `rollToNextRound(poolId)`
- 后端 worker 在检测到最后一张票售出后，默认自动调用一次 `rollToNextRound(poolId)`
- 同时保留“任何人可调用 + 合约内校验条件”的兜底能力，以降低卡死风险

补充说明：

- 若第一次自动触发时 round 尚未 `Settled`，则本次调用应直接失败或返回不可滚动状态
- 后端将该 pool 标记为 `waiting_settlement`，并在后续检测到满足条件后继续重试
- 因此“售完自动刷新”在实现上表示“售完后自动尝试进入下一轮”，而不是保证首个触发一定成功

执行条件：

1. 当前 round 已 `SoldOut`
2. 当前 pool 为 `Loop` 模式
3. 若要求严格结算后再开新轮，则当前 round 已 `Settled`
4. 可用资金足够覆盖下一轮奖金预算与必要保留金

执行流程：

1. 调用显式刷新函数
2. 合约结算已实现收入、已结算奖金、Sponsor/Infra 成本
3. 锁定下一轮奖金预算
4. 创建新 round
5. 请求新 VRF
6. round 状态进入 `PendingVRF`
7. VRF 回调完成后，写入新一轮加密结果
8. 新 round 状态变为 `Ready`
9. pool 状态回到 `Active`

失败路径：

1. 若余额不足：
   - pool 状态转为 `Closing`
   - 不再进入下一轮
2. 若 VRF 初始化未完成：
   - pool 保持不可售
   - 等待回调或重试

---

# 8. 合约接口建议

## 8.1 用户接口

```solidity
function purchaseTickets(PoolId poolId, uint32 quantity) external;
function purchaseTicketsWithSelection(PoolId poolId, uint32[] calldata ticketIndexes) external;

function scratchTicket(TicketId ticketId) external;
function batchScratch(TicketId[] calldata ticketIds) external;

function claimReward(
    TicketId ticketId,
    uint64 clearRewardAmount,
    bytes calldata decryptionProof
) external;

function batchClaimRewards(
    TicketId[] calldata ticketIds,
    uint64[] calldata clearRewardAmounts,
    bytes[] calldata decryptionProofs
) external;
```

## 8.2 Gasless 接口

```solidity
function executeGaslessPurchase(
    GaslessRequest calldata req,
    bytes calldata signature,
    PoolId poolId,
    uint32 quantity
) external;

function executeGaslessPurchaseSelection(
    GaslessRequest calldata req,
    bytes calldata signature,
    PoolId poolId,
    uint32[] calldata ticketIndexes
) external;

function executeGaslessScratch(
    GaslessRequest calldata req,
    bytes calldata signature,
    TicketId ticketId
) external;

function executeGaslessBatchScratch(
    GaslessRequest calldata req,
    bytes calldata signature,
    TicketId[] calldata ticketIds
) external;
```

## 8.2.1 后端可读状态接口

```solidity
function getTicketRevealState(TicketId ticketId)
    external
    view
    returns (TicketStatus status, bool revealAuthorized);

function claimableCreatorProfit(PoolId poolId) external view returns (uint256);
```

说明：

- `getTicketRevealState` 仅暴露后端编排解密授权所需的最小状态，不泄露奖项明文。
- 后端读取 owner 统一使用 ERC-721 标准 `ownerOf(ticketId)`，不再额外定义重复 owner 查询接口。
- 链上状态字段通过现有 public getter 读取：`poolConfigs`、`poolStates`、`poolAccounting`、`roundStates`、`tickets`、`nonces`。
- 创建者池列表、用户持票列表、聚合分页查询等列表型视图由后端 Indexer 基于事件与标准 ERC-721 状态维护，不强行塞进核心合约 ABI。

说明：

- 仅购票和刮奖提供 Gasless
- `claimReward` 默认用户自付 Gas
- `req.paramsHash` 必须与函数参数匹配
- 当前实现默认由 `Treasury` 作为唯一收款与扣款入口，依赖官方 `cUSDC` 的 `approve/allowance + transferFrom`
- `claimReward` 只要求官方 `cUSDC` 具备标准转账能力
- 当前版本的 Gasless 购票只覆盖“已完成授权后的执行交易”
- 若用户尚未对 `Treasury` 完成 `approve`，首次授权仍需用户自付 Gas 手动完成
- `permit` 不是当前版本的必需前提，只有在官方合约确认支持后才作为可选优化接入

## 8.3 池创建与管理接口

```solidity
function createPool(PoolConfig calldata config, PrizeTierInput[] calldata tiers) external;
function pausePool(PoolId poolId, bool paused) external;
function setRelayer(address relayer, bool allowed) external;
function setVrfAdapter(address adapter) external;
function setTreasury(address treasury) external;
```

说明：

- `createPool` 是统一入口。
- 协议池和社区池都调用同一个创建函数。
- 是否允许某个调用方创建某类池，由权限层或参数校验层决定，而不是再拆两套业务逻辑。
- 自选购票对所有池开放，不做池类型层面的能力分叉。

## 8.4 创建者接口

```solidity
function closePool(PoolId poolId) external;
function rollToNextRound(PoolId poolId) external;
function withdrawCreatorProfit(PoolId poolId, uint256 amount) external;
function refundBond(PoolId poolId) external;
```

说明：

- `rollToNextRound` 是循环池进入下一轮的显式链上触发入口。
- 后端在检测到 round 售罄后，默认自动触发一次该函数。
- 后端的自动触发不替代合约状态机；最终是否刷新仍由链上条件校验决定。

## 8.5 VRF 回调接口

```solidity
function fulfillPoolRandomness(
    bytes32 requestId,
    uint256 randomWord
) external;
```

约束：

- 只能由 `LuckyScratchVRFAdapter` 调用
- 同一 request 只能落账一次
- 只有 `PendingVRF` round 才能接收回调

---

# 9. 票面与奖项索引模型

## 9.1 为什么需要 ticket index

当前设计支持：

- 机选购票
- 自选购票
- 已售编号展示

因此每一轮必须有稳定的 `ticketIndex`。

## 9.2 建议模型

每轮的所有 ticket slots 以 `0..N-1` 编号。

```solidity
ticketId -> (poolId, roundId, ticketIndex)
```

VRF 洗牌后，本轮每个 `ticketIndex` 对应一个加密奖项值。

## 9.3 自选购票

用户选择的不是奖项，而是编号位置。

所以购买逻辑应校验：

- `ticketIndex < totalTickets`
- `soldTicketSlots[poolId][roundId][ticketIndex] == false`

---

# 10. 奖项洗牌与加密写入

## 10.1 输入

- 奖项分布表，例如：
  - `20U x 1`
  - `10U x 2`
  - `5U x 4`
  - `2U x 10`
  - `1U x 20`
  - `0U x 19`

## 10.2 过程

1. 先展开为长度为 `totalTickets` 的奖项数组
2. 使用 VRF 随机数做 Fisher-Yates 洗牌
3. 将洗牌结果逐项转换为 FHE 加密数值
4. 写入 `ticketIndex -> encryptedPrizeAmount`

## 10.3 输出

- 每张票在链上已有确定结果
- 结果不可被外部明文读取
- 购票与刮奖阶段不再使用新的随机数

---

# 11. 资金模型

## 11.1 用户资金路径

```text
official cUSDC
 -> purchaseTickets
 -> claimReward
 -> wallet cUSDC balance
```

## 11.2 创建者资金路径

```text
creator bond
 -> locked in Treasury
 -> pool runs
 -> creator profit realized
 -> withdrawCreatorProfit
```

协议控制池与社区创建池都走同一套核算路径，只是：

- 协议控制池的 `creator` 可配置为协议金库或运营地址
- 社区创建池的 `creator` 为普通用户地址

## 11.3 协议成本

协议承担以下三类成本：

- Gas Sponsor 成本
- Zama 协议费用
- Chainlink VRF 费用

建议按两个桶做内部核算：

- `SponsorBucket`：购票/刮奖 gas
- `InfraBucket`：Zama + VRF

补充：

- VRF 成本按 pool 计提，不按全局统一平摊。

---

# 12. 循环池与利润计算

## 12.1 可提利润定义

```text
claimableProfit
= realizedRevenue
- settledPrizeCost
- settledProtocolCost
- accruedPlatformFee
- lockedNextRoundBudget
- alreadyClaimedProfit
```

## 12.2 为什么必须锁下一轮预算

否则会出现：

- 创建者先提走利润
- 下一轮无资金初始化
- 循环模式名义存在但无法兑付

所以循环池必须先锁下一轮预算，再开放利润提取。

---

# 13. 访问控制设计

## 13.1 角色

```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
bytes32 public constant VRF_ROLE = keccak256("VRF_ROLE");
```

## 13.2 权限建议

- `ADMIN_ROLE`
  - 创建协议控制池
  - 设置关键地址
  - 紧急暂停
- `OPERATOR_ROLE`
  - 恢复池
  - 调整参数白名单
- `RELAYER_ROLE`
  - 调用 gasless 执行入口
- `VRF_ROLE`
  - 提交随机回调

普通池创建者不应拥有系统级角色，只能操作自己创建的 pool。

---

# 14. 事件设计

## 14.1 核心事件

```solidity
event PoolCreated(PoolId indexed poolId, address indexed creator, bool protocolOwned);
event PoolRoundRequested(PoolId indexed poolId, RoundId indexed roundId, bytes32 requestId);
event PoolRoundInitialized(PoolId indexed poolId, RoundId indexed roundId);
event RoundSettled(PoolId indexed poolId, RoundId indexed roundId);

event TicketPurchased(address indexed user, PoolId indexed poolId, TicketId indexed ticketId, uint32 ticketIndex);
event TicketScratched(address indexed user, PoolId indexed poolId, RoundId indexed roundId, TicketId ticketId, bool revealAuthorized);
event RewardClaimed(address indexed user, TicketId indexed ticketId, PoolId indexed poolId, RoundId roundId);

event CreatorProfitWithdrawn(PoolId indexed poolId, address indexed creator, uint256 amount);
event BondRefunded(PoolId indexed poolId, address indexed creator, uint256 amount);
event PoolClosed(PoolId indexed poolId);
event PoolRolledToNextRound(PoolId indexed poolId, RoundId indexed newRoundId);

event GaslessExecuted(address indexed user, GaslessAction action, bytes32 digest);
```

## 14.2 事件原则

- 不在事件里泄露奖项明文
- 可记录 ticketId、poolId、roundId
- 用户广播模块只消费不会破坏隐私的事件
- 后端 Indexer 必须同时监听 `LuckyScratchTicket` 的 ERC-721 `Transfer` 事件，以维护 ticket 当前 owner 缓存；关键权限判断仍以链上 `ownerOf(ticketId)` 为准
- Gasless 失败状态不通过链上 `GaslessRejected` 事件表达，而是由 relayer 服务结合交易回执和本地请求表维护

---

# 15. Gasless 详细约束

## 15.1 验签

- 推荐 EIP-712
- 每个用户独立 nonce
- 每次调用单独 digest
- 可选记录 `usedGaslessDigest`

## 15.2 白名单动作

- `Purchase`
- `PurchaseSelection`
- `Scratch`
- `BatchScratch`

明确不开放：

- `ClaimReward`
- `WithdrawCreatorProfit`
- `RefundBond`

## 15.3 风控边界

- 不设置按日次数上限
- 允许短时限流
- 限制单笔数量
- 限制单笔 sponsor gas
- sponsor 不足时自动降级为用户自付

---

# 16. 安全设计

## 16.1 基础安全

- 所有外部资金函数使用 `nonReentrant`
- 转账遵循 checks-effects-interactions
- 关键状态变更前后发事件
- 显式 pause 机制

## 16.2 业务安全

- `scratch` 必须校验 `ownerOf(ticketId)`
- `claimReward` 必须校验 ticket 已刮且未领奖
- `closePool` 只能影响未来轮次，不能影响已售票兑奖
- `refundBond` 只能在 pool 完整结算后执行

## 16.3 VRF 安全

- 一个 round 只能初始化一次
- requestId 不可复用
- 初始化未完成前禁止售票
- VRF 回调失败时 pool 维持 `Initializing`

## 16.4 FHE 安全

- 结果解密权限仅授予当前 NFT 持有人
- 已转让未刮开的票，其查看权随 owner 变更
- 已刮开后禁止转让，避免信息泄露后倒卖

---

# 17. 实现建议

## 17.1 第一阶段最小实现

建议先实现以下闭环：

1. 协议控制池
2. 单轮
3. 机选购票
4. 单张刮奖
5. 单张领奖
6. VRF 初始化
7. Gasless 购票 + Gasless 刮奖

先不要一上来实现：

- 用户自建池
- 循环模式
- 自选购票
- 批量领奖
- 广播系统

## 17.2 第二阶段扩展

- 自选购票
- 社区创建池
- 循环池
- 批量刮奖 / 批量领奖
- 创建者利润提取

---

# 18. 推荐文件布局

针对当前 `packages/hardhat`，建议合约文件组织如下：

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
```

---

# 19. 已确认实现项

1. Zama 官方 `cUSDC` 合约地址：
   - Sepolia: `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`
   - Ethereum Mainnet: `0xe978F22157048E5DB8E5d07971376e86671672B2`
2. Zama fhEVM 的具体解密授权接口通过后端实现。
3. VRF 请求与回调成本按 pool 计提。
4. 自选购票对所有池开放。
5. 当前产品文档里的“池实例数量”在实现里保留为独立 `pool instance`。

---

# 20. 结论

推荐的最终实现路线是：

- 用 `VRF` 在建池时确定奖项位置
- 用 `FHE` 保存奖项内容与用户余额
- 用 `ERC-721` 承载彩票所有权与转让约束
- 用 `Treasury` 单独收口资金
- 用 `Core` 收口状态机
- 用 `Relayer` 只代付购票与刮奖

这套结构与当前产品设计兼容，且适合在 Scaffold-ETH 2 的 Hardhat 目录中逐步落地。
