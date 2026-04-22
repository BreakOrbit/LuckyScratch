# LuckyScratch - Stitch UI Generation Prompt

本文档旨在为 UI 生成工具（如 Google Stitch、v0.dev 等）提供一份详细的系统提示词（Prompt）。结合 `doc/design.md` 和 `doc/detailed-design.md`，并将视觉风格定位为**《游戏王：大师决斗》(Yu-Gi-Oh! Master Duel) 风格的卡牌抽卡体验**，将传统的“刮刮乐”行为游戏化为“翻牌/开包”体验。

---

## 🎨 视觉风格与交互映射 (Design Concept mappings)

结合《游戏王：大师决斗》的视觉参考，LuckyScratch 的业务逻辑映射如下：

1. **奖池 (Pools)** = **卡包 / 秘密卡包 (Secret Packs)**
   - 界面上并排展示各种主题的卡包（例如：龙腾万里、宇宙大奖）。右侧或下方有卡包详情、出率展示。
2. **买票 (Buy Ticket)** = **购买卡包 (Purchase Pack)**
   - 购票后，进入开包（抽卡）界面。
3. **未刮开的彩票 (Unscratched Ticket)** = **背面朝上的卡牌 (Face-down Card)**
   - 经典的卡背设计，带有星空或魔法阵的动态光效。
4. **刮开 (Scratch)** = **翻牌揭晓 (Card Flip & Reveal)**
   - 强烈的视觉反馈：卡牌背面开始发光（金光/虹光），然后翻转，展示正面的卡面设计和奖金数值。
5. **中奖等级 (Prize Tiers)** = **卡牌稀有度 (UR/SR/R/N)**
   - 大奖 = UR（带有全息闪光特效，金色/彩虹边框）。
   - 小奖/回本奖 = SR/R（银色或普通发光）。
   - 未中奖 = N（普通边框，UI 表现较为暗淡）。

---

## 📝 发送给 Stitch 的提示词 (English Prompt for Stitch)

*请复制以下英文内容到 Stitch 中进行 UI 生成。英文对于此类 AI UI 生成工具效果最佳。*

```text
Please design a premium, highly interactive Web3 Lottery Web Application interface called "LuckyScratch". 

**Core Aesthetic & Reference**:
The design MUST closely emulate the UI/UX and dark-tech, neon-lit aesthetic of the game "Yu-Gi-Oh! Master Duel", specifically focusing on its card pack purchasing and card drawing (gacha) screens. 
- Colors: Deep space blues (`#0F1626`), dark purples, metallic golds (`#FFD700`), and neon cyan accents.
- Style: Cyberpunk/Tech meets premium Casino/TCG (Trading Card Game). Glassmorphism panels, glowing borders, angled tech-lines, and high-contrast text.
- Concept: Treat "Scratch/Lottery Tickets" as "Trading Cards". Buying a ticket is like opening a booster pack. Scratching a ticket is like flipping a face-down card.

**Pages & Components to Generate**:

1. **Main Pool Selection (The "Secret Pack" Store)**
   - Layout: A sleek dashboard. On the right side, a vertical scrolling list or grid of "Pools" (Treat them like booster packs: "Dragon Rise", "Cosmic Jackpot", "Starlight").
   - Each Pool item should show: Price (e.g., 10 USDC), Theme Art thumbnail, and tags like "High Hit Rate" or "Mega Jackpot".
   - Center/Left stage: A large, dynamic showcase of the currently selected Pool, featuring immersive background art, the grand prize amount (e.g., "Grand Prize: 300 USDC"), and a glowing "Purchase" button.

2. **The "Card Draw / Reveal" View (The "Scratch" mechanics)**
   - A dramatic, dark modal or full-screen view.
   - Display a row of 1 or up to 10 "Face-down Cards" (representing unscratched tickets) resting on a reflective glass surface.
   - The card backs should have a mysterious, magical, or high-tech pattern.
   - Some cards should have a glowing aura (gold or rainbow lights) signaling a potential big win.
   - Add a central action button: "Reveal All" (instead of scratch).

3. **The Result / Flipped Card Modal (The Prize Reveal)**
   - An expanded view of a flipped card.
   - The card design should mimic a Yu-Gi-Oh card layout: 
     - Top part: Theme Illustration (e.g., a cyber dragon).
     - Top corner: A rarity badge like "UR" (Ultra Rare) with a holo gradient, or "N" (Normal).
     - Bottom text box: The actual prize amount written in large neon font (e.g., "💰 50 USDC" or "0 USDC").
   - If it's a winning ticket (UR/SR), add intense particle effects, glowing borders, and lens flares around the card.
   - Include a "Claim Reward" glassmorphism button below the winning cards.

4. **Inventory (My Cards / Tickets)**
   - A collection grid showing all the user's tickets. 
   - Unscratched tickets are face-down. Scratched tickets are face-up showing their prize.
   - Filter tabs at the top: "All", "Unrevealed", "Revealed", "Claimable".

**Technical & CSS constraints for the LLM**:
- Use Tailwind CSS. 
- Extensively use dark mode classes (`bg-slate-900`, `text-slate-100`).
- Create glowing text and box-shadows (e.g., `drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]` for gold UR cards).
- Use `framer-motion` concepts or standard CSS animations (`animate-pulse`, `hover:scale-105`, CSS 3D transforms for card flipping) to make it feel like a living game interface.
- Make it responsive but target Desktop-first for a premium gaming experience.
```

---

## 🛠️ 将 UI 落地到 Next.js 的开发指南

当你使用 Stitch 生成代码后，在整合到当前的 Scaffold-ETH 2 项目时，请注意以下几点：

1. **组件化卡牌**: 把 Stitch 生成的卡牌 HTML 抽象为 `TicketCard.tsx`。
   - 需要接收 `isScratched` (对应布尔值，决定显示卡背还是卡面)。
   - 需要接收 `prizeTier` (对应 UR/SR/N，决定卡面边框的反光特效和特效类名)。
2. **动画处理**: 
   - Stitch 生成的可能只是静态的 3D 转换（`rotateY`）。在实际连智能合约时，应在用户点击“翻开（刮卡）”，等待钱包确认并拿到链上 `TicketScratched` 成功结果后，再触发卡牌翻转的 CSS 动画。
3. **DaisyUI 兼容**: 
   - Scaffold-ETH 2 自带 DaisyUI。可以将 Stitch 生成的玻璃拟态面板转换为 `<div className="card glass">`。
   - 统一提取配色变量至 `tailwind.config.js`，例如：`ur-glow`: `#FFD700`，`sr-glow`: `#c0c0c0`。
