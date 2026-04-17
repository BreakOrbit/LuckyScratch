# Design System Document

## 1. Overview & Creative North Star: "The Celestial Vault"
This design system is engineered to evoke the high-stakes, cinematic tension of a premium Trading Card Game (TCG). The "Creative North Star" is **The Celestial Vault**—a concept where the interface isn't a flat website, but a sophisticated, dark-tech deck-builder. 

We break the "template" look by leaning into the **Master Duel aesthetic**: high-contrast typography, layered glass surfaces that feel like physical artifacts, and a "Deep Space" depth that prioritizes immersive atmosphere over utility-only grids. Expect intentional asymmetry, where information "floats" in a vast cosmic void, anchored by heavy-weight gold accents and neon-pulsing micro-interactions.

---

## 2. Colors: Tonal Depth & Cosmic Contrast
Our palette moves beyond simple hex codes into a functional hierarchy of light and shadow.

### Palette Strategy
- **Primary Highlights:** Use `primary_container` (#FFD700) and `primary_fixed` (#FFE16D) to denote "Legendary" or high-value actions. Gold should feel like a rare metal, not a common filler.
- **Secondary Accents:** `secondary` (#CABEFF) and `secondary_container` (#4719C9) provide a mystical, "arcane" feel. Use these for secondary navigation or active states that require a different energy than the "Gold" win-state.
- **Micro-Interactions:** Tertiary tokens (Neon Cyan) like `tertiary_fixed_dim` (#00DAF3) are reserved exclusively for focus states, progress bars, and high-tech UI feedback.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts.
- To separate sections, transition from `surface` (#0C1323) to `surface_container_low` (#141B2C).
- To highlight an area, use `surface_bright` (#32394A) as a soft flood of light rather than a stroke.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of frosted glass.
1. **Background:** `surface` (#0C1323)
2. **Main Content Area:** `surface_container` (#181F30)
3. **Elevated Cards/Modules:** `surface_container_high` (#232A3B)
4. **Active/Interactive Elements:** `surface_container_highest` (#2E3546)

### The "Glass & Gradient" Rule
To achieve the TCG look, use **Glassmorphism**. Floating modals or tooltips must use `surface_container` at 70% opacity with a `24px` backdrop-blur. 
*Signature Texture:* Apply a subtle linear gradient from `primary_container` to `primary_fixed_dim` on major call-to-actions to give them a "metallic sheen."

---

## 3. Typography: Tech-Editorial
We pair the geometric precision of **Space Grotesk** with the utilitarian readability of **Inter**.

- **Display & Headlines (Space Grotesk):** Use `display-lg` to `headline-sm` for titles. These should be high-contrast (`on_surface` or `primary_fixed`). Space Grotesk’s unique letterforms provide the "Dark-Tech" signature.
- **Body & Titles (Inter):** Use for all functional text. `body-lg` (1rem) is your workhorse. It provides a grounded, stable feeling against the aggressive headlines.
- **Labels (Inter):** `label-md` and `label-sm` should be used for metadata. In this system, labels act as "Tech-Specs" on a card. Use `on_surface_variant` (#D0C6AB) to keep them legible but secondary.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "web." We use **Ambient Radiance**.

- **The Layering Principle:** Place a `surface_container_lowest` (#070E1D) card on a `surface_container_low` section to create a "recessed" look. Place a `surface_container_highest` card on a `surface` background to create a "protruding" look.
- **Ambient Shadows:** When an element must float (like a prize reveal), use a shadow with a 40px blur, 0px offset, at 8% opacity. The color should be `secondary_fixed` (#E6DEFF) to create a subtle "purple glow" rather than a grey shadow.
- **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` (#4D4732) at 15% opacity. It should be barely felt, acting more like a light catch on the edge of a lens than a box line.

---

## 5. Components: The Artifacts

### Buttons
- **Primary (Gold):** Background `primary_container`, text `on_primary_container`. No border. Apply a 1px inner-glow (top only) using `primary_fixed`.
- **Secondary (Arcane):** Background `secondary_container`, text `on_secondary_container`.
- **Ghost (Glass):** No background, `outline_variant` (20% opacity) border, text `primary_fixed`.

### Input Fields
Avoid the "boxy" look. Use `surface_container_lowest` for the field background. The active state should not change the border color, but instead trigger a 2px neon cyan (`tertiary_fixed_dim`) underline or side-accent.

### Cards & Lists
**Forbid Divider Lines.** Use `0.75rem` (Round Four md) of vertical whitespace to separate items. 
- *Card Style:* Use `surface_container_high`. Radius: `1rem` (xl). 
- *Hover State:* Increase background to `surface_container_highest` and apply a subtle backdrop-filter: `brightness(1.2)`.

### Signature Component: The "Scratch Overlay"
A specialized glassmorphism component. Use `surface_bright` with a 60% opacity and a `blur(12px)`. This creates a frosted "shroud" over hidden content, fitting the LuckyScratch gameplay loop.

---

## 6. Do's and Don'ts

### Do:
- **Do** use `primary_fixed_dim` for icons to give them a "gold-leaf" appearance.
- **Do** allow for generous negative space. The "Space Blue" background is part of the brand.
- **Do** use `Round Four` (0.5rem) for most elements, but bump to `1rem` (lg) for large containers to soften the tech-edge.

### Don't:
- **Don't** use pure black (#000000). Always use the `surface` tokens to maintain the deep blue depth.
- **Don't** use standard blue for links. Use `tertiary_fixed` (#9CF0FF) for any interactive text links.
- **Don't** stack more than three layers of surfaces. It breaks the "Celestial" clarity.
- **Don't** use 100% opaque borders. They flatten the "Master Duel" cinematic atmosphere.