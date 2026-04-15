# Design System Strategy: The Celestial Vault

## 1. Overview & Creative North Star
**The Creative North Star: "The Celestial Vault"**
This design system moves away from the flat, utilitarian nature of traditional e-commerce to embrace a high-stakes, cinematic "Editorial Gaming" aesthetic. Inspired by the deep tonal layering and atmospheric depth of high-end digital card games, the system treats the browser as a window into a premium vault. 

We break the "template" look through **Intentional Asymmetry** and **Atmospheric Depth**. By overlapping glass cards and utilizing light-source-driven glows rather than rigid containers, we create a sense of tactile luxury. The layout doesn't just display information; it "presents" it with the gravity of a rare artifact.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the "Abyssal Neutral" range, providing a high-contrast stage for gold and thematic pool colors to act as "light sources."

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or tonal transitions. To separate a pool section from the main feed, transition from `surface` (#0E0E0E) to `surface-container-low` (#131313).

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of frosted Obsidian.
*   **Base Layer:** `surface` (#0E0E0E) – The infinite void.
*   **Section Layer:** `surface-container-low` (#131313) – Large content blocks.
*   **Card Layer:** `surface-container-high` (#201F1F) – The primary interactive unit.
*   **Active/Elevated Layer:** `surface-bright` (#2C2C2C) – To be used for hovered states or active modal content.

### The "Glass & Gradient" Rule
To achieve the "Master Duel" feel, all cards must utilize Glassmorphism.
*   **Fill:** `surface-variant` (#262626) at 60% opacity.
*   **Effect:** 20px - 40px Backdrop Blur.
*   **Signature Texture:** Use a subtle linear gradient on the primary CTA: `primary-container` (#FFD709) to `primary` (#FFE792) at a 135-degree angle. This creates a "metallic sheen" that flat colors cannot replicate.

---

## 3. Typography: Authoritative Editorial
We pair the geometric precision of **Space Grotesk** with the functional clarity of **Inter**.

*   **Display & Headlines (Space Grotesk):** Used for jackpot amounts and pool titles. The wide apertures and technical feel of Space Grotesk convey a sense of modern "high-tech" luck.
    *   *Scale:* `display-lg` (3.5rem) for major wins; `headline-md` (1.75rem) for pool categories.
*   **UI & Body (Inter):** Used for mechanics, odds, and navigation. Inter provides the necessary legibility against dark, complex backgrounds.
    *   *Scale:* `body-md` (0.875rem) is our workhorse for descriptions.
*   **The Power of Tracking:** For `label-sm` (0.6875rem), use +5% letter spacing and Uppercase transform to create a "premium tag" look for ticket statuses.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows have no place in a void. Instead, we use **Light Emission**.

*   **The Layering Principle:** Place a `surface-container-highest` card on a `surface-container-low` background. The shift in value creates natural lift without artificial "ink" lines.
*   **Ambient Glows:** Floating elements (like an active scratch-off card) use a shadow with a blur of 40px, set to 8% opacity, using the `primary` (#FFE792) color. This mimics light reflecting off a gold surface.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token (#484847) at **15% opacity**. It should feel like a catch-light on the edge of glass, not a stroke.
*   **Holographic Accents:** For specific pool themes (e.g., Cosmic Purple), use the `tertiary` (#A18EFF) token as a radial gradient "glow" behind the card to signify rarity.

---

## 5. Components

### Buttons (The "Power-Up" Pattern)
*   **Primary:** Gold gradient (`primary-container` to `primary`), `0.25rem` (4px) radius. On hover: Add a `primary_dim` outer glow.
*   **Secondary:** Glass-fill (`surface-variant` @ 40%) with a Ghost Border.
*   **Tertiary:** Text-only in `primary`, but with an animated underline that expands from the center on hover.

### The "Lottery Card" (Signature Component)
Cards must never have visible borders.
*   **Background:** `surface-container-highest` with a 40px backdrop blur.
*   **Header:** Use `title-lg` for the pool name.
*   **Interactive State:** On hover, the card should scale to 102% and trigger a "Sweep Gradient" animation across the surface to simulate a light reflecting off a foil card.

### Inputs & Fields
*   **Style:** Underlined only or "Deep Recess" (using `surface-container-lowest`).
*   **Focus State:** The underline transforms into a `primary` gold glow. Labels move to `label-sm` above the field in `on-surface-variant`.

### Chips (Pool Badges)
*   No solid fills. Use a 10% opacity version of the theme color (e.g., `tertiary` for Cosmic Purple) with a text color of the full-strength token.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use extreme vertical white space (64px+) between different lottery pool sections to allow the "Abyssal" background to breathe.
*   **Do** use asymmetrical positioning. A jackpot total can be slightly offset from the grid center to feel more like a dynamic game UI.
*   **Do** use pool-specific colors (`tertiary` for Purple, `error` for Red) as subtle "environmental lighting" in the background of their respective sections.

### Don't:
*   **Don't** use 100% white (#FFFFFF) for body text. Use `on-surface-variant` (#ADAAAA) to prevent eye strain and maintain the "moody" atmosphere. Reserve pure white for headings.
*   **Don't** use hard-edged tooltips. Tooltips must follow the Glassmorphism rule with a `surface-bright` fill.
*   **Don't** use "Default" Roundedness (0.25rem) for everything. Use `none` (0px) for high-end technical accents and `full` for interactive pill-buttons to create a contrast in shapes.
*   **Don't** ever use a solid black (#000000) border. It breaks the "Celestial Vault" immersion. Use tone-on-tone shifts instead.