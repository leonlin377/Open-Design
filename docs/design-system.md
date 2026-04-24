# OpenDesign Design System

> Visual anchor (LOCKED): **Claude Design 2026-04-17 warm paper** + **Rauno Freiberg devouring-details craft** + **Emil Kowalski motion primitives**.
> `#F5F1EB` / `#1A1713` / `#C87E4F`. Not v0 shadcn-blue. Not ChatGPT green. Not Tailwind default.

---

## 1. Why this exists

OpenDesign is an AI × canvas design tool. Our visual identity is warm paper Claude + Rauno's devouring-details craft + Emil's restrained motion: flat surfaces, 1px hairlines, rust-terracotta accent, serif display, mono labels, 180ms ease-out everywhere. This document is the enforceable spec. The source of CSS truth lives in `apps/web/app/tokens.css`; the runtime TS catalog lives in `packages/ui/src/tokens.ts`; this document explains the *intent* behind both. All drift from the spec is a bug.

---

## 2. Palette

All hex values match `apps/web/app/tokens.css`. Contrast ratios are measured against the theme's `--paper` surface using the APCA-adjacent WCAG 2.1 formula; AA = 4.5:1 for body text, 3:1 for large text and non-text.

### 2.1 Light theme

| Token | Hex | Contrast vs `#F5F1EB` | When to use |
| --- | --- | --- | --- |
| `--paper` | `#F5F1EB` | — | App canvas, default surface. |
| `--paper-sunk` | `#EAE3D6` | 1.13 | Inputs, code blocks, recessed wells. |
| `--paper-raised` | `#FDFAF4` | 1.14 | Cards, menus, dialogs (slightly brighter than paper). |
| `--ink-1` | `#1A1713` | 14.8 AAA | Primary text, headings. |
| `--ink-2` | `#5C5348` | 7.1 AAA | Secondary text, metadata. |
| `--ink-3` | `#8A8070` | 3.6 AA-large | Muted labels, placeholder-dim. |
| `--ink-4` | `#B8AE9D` | 1.8 | Disabled text, decorative. Never for readable content. |
| `--hairline` | `#E3DCCB` | 1.08 | Borders, dividers. Always 1px. |
| `--rust` | `#C87E4F` | 3.4 AA-large | Primary accent; buttons, focus, active tab underline. |
| `--rust-hover` | `#B67244` | 4.1 AA-large | Primary accent hover. |
| `--rust-soft` | `#F0E0CF` | 1.05 | Accent surface wash (badges, highlights). |
| `--rust-contrast` | `#FFFFFF` | — | Text on solid rust. |
| `--success-500` | `#5F8A5C` | 3.7 AA-large | Semantic success text/icon. |
| `--warning-500` | `#7A5A12` | 6.3 AAA | Semantic warning text/icon. |
| `--danger-500`  | `#C84734` | 4.8 AA | Semantic danger text/icon. |
| `--info-500`    | `#3E6B9C` | 5.0 AA | Semantic info text/icon. |
| `signal-live`   | `#35B46C` | 2.7 | "Live" pulse dot only. Pairs with a text label, never a standalone affordance. |

### 2.2 Dark theme

| Token | Hex | Contrast vs `#1F1B15` | When to use |
| --- | --- | --- | --- |
| `--paper` | `#1F1B15` | — | App canvas. |
| `--paper-sunk` | `#17140F` | 1.35 | Recessed wells. |
| `--paper-raised` | `#2A2520` | 1.36 | Cards, menus, dialogs. |
| `--ink-1` | `#F0E8D8` | 13.9 AAA | Primary text. |
| `--ink-2` | `#B8AE9D` | 8.1 AAA | Secondary text. |
| `--ink-3` | `#8A8070` | 4.2 AA | Muted. |
| `--ink-4` | `#5C5348` | 1.9 | Disabled / decorative. |
| `--hairline` | `#3A342C` | 1.35 | Borders. |
| `--rust` | `#E09060` | 6.5 AAA | Primary accent (warmed for dark). |
| `--rust-hover` | `#EBA374` | 8.0 AAA | Hover. |
| `--rust-soft` | `#3D2E1F` | 1.7 | Accent wash. |
| `--rust-contrast` | `#1A1713` | — | Text on solid rust. |
| `--success-500` | `#8AB57E` | 6.1 AAA | Success. |
| `--warning-500` | `#E5B757` | 9.4 AAA | Warning. |
| `--danger-500`  | `#E07563` | 5.2 AA | Danger. |
| `--info-500`    | `#6FA3D6` | 6.0 AAA | Info. |
| `signal-live`   | `#4FD185` | 9.2 AAA | Live dot. |

### 2.3 When to use each

- **Paper ramp** is for surfaces only. Never set text in a paper colour.
- **Ink ramp** is for text and icons. `ink-1` = "I am the content". `ink-2` = "I am context". `ink-3` = "I am a label or affordance the user is not reading yet". `ink-4` = "I am a shape, not words".
- **Hairline** is the whole border system. Single weight (1px), single colour. No drop shadows pretending to be borders.
- **Rust** is the only chromatic accent in the UI. Reserve it for (a) the single primary action per view, (b) focus rings, (c) the active state of navigational primitives (tab underline, current chip). Do not paint headings or large areas rust — that is marketing drift.
- **Signal green** is for live/online dots only. It is not a success colour. Success is `success-500`.
- **Semantic colours** live in toasts, inline validation, and icon glyphs. They do not paint full surfaces; use the `-soft-bg` aliases (rust-soft for success, etc.) for washes.

---

## 3. Type scale

All named usage tokens. Prefer semantic names (`title-m`, `label`) over raw `h1`/`h2` — headings are markup, tokens are design intent.

| Token | Latin family | Size | Line | Tracking | Weight | CJK fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `display` | Instrument Serif | `clamp(44px, 6vw, 72px)` | 1.02 | -0.02em | 400 | Source Han Serif SC / Noto Serif CJK SC / Songti SC |
| `title-l` | Instrument Serif | `clamp(34px, 4vw, 44px)` | 1.15 | -0.012em | 400 | Source Han Serif SC / Noto Serif CJK SC / Songti SC |
| `title-m` | Inter | 22px | 1.3 | -0.005em | 600 | PingFang SC / Hiragino Sans GB |
| `title-s` | Inter | 18px | 1.3 | 0 | 600 | PingFang SC |
| `body-l` | Inter | 17px | 1.55 | 0 | 400 | PingFang SC |
| `body` | Inter | 15px | 1.55 | 0 | 400 | PingFang SC |
| `body-s` | Inter | 13.5px | 1.5 | 0 | 400 | PingFang SC |
| `label` | Inter | 13px | 1.3 | 0 | 500 | PingFang SC |
| `caption` | Inter | 12px | 1.4 | 0.02em | 400 | PingFang SC |
| `mono-label` | JetBrains Mono | 11.5px | 1.3 | 0.08em UPPERCASE | 500 | — (Latin-only by design) |
| `data` | JetBrains Mono | 13px (`tnum`) | 1.4 | 0 | 400 | — |

### 3.1 Usage rules

- **`display`** — only for page-one hero on the marketing site and artifact covers. Never in the product chrome.
- **`title-l`** — section-openers on marketing; artifact title in Studio.
- **`title-m`** — primary heading inside a card or panel; dialog titles.
- **`title-s`** — subsection within a card.
- **`body-l`** — long-form marketing body, docs leads.
- **`body`** — default UI body. This is what you reach for.
- **`body-s`** — supporting UI copy, tooltips, table cells when density matters.
- **`label`** — form labels, button text, tab text. Not for prose. If it's a sentence, use `body` or `body-s`.
- **`caption`** — timestamps, counts, "last edited 2m ago". Muted (`ink-3`).
- **`mono-label`** — section eyebrows, figure captions, `REF-001` style annotations. Always uppercase, always `ink-3`. This is Rauno's signature.
- **`data`** — tabular numbers, code inline, keyboard shortcuts, any value the user might read digit-by-digit.

### 3.2 CJK fallback rules

For `display`, `title-l`, `title-m`, the CSS font stack falls through the Latin serif to a **serif** CJK family so 中文标题 carries the same editorial texture instead of defaulting to bold sans. For all other tokens, the stack falls through to the platform's default Han sans (PingFang SC on macOS/iOS, Hiragino Sans GB, Noto Sans CJK SC). Never hard-code a CJK font; always rely on the fallback chain.

---

## 4. Spacing scale

4px baseline. 21 steps. Numbered so the index roughly corresponds to visual rank, not to the px value.

| Token | px | Token | px | Token | px |
| --- | --- | --- | --- | --- | --- |
| `space-0` | 0 | `space-7` | 20 | `space-14` | 80 |
| `space-1` | 2 | `space-8` | 24 | `space-15` | 96 |
| `space-2` | 4 | `space-9` | 32 | `space-16` | 128 |
| `space-3` | 6 | `space-10` | 40 | `space-17` | 160 |
| `space-4` | 8 | `space-11` | 48 | `space-18` | 192 |
| `space-5` | 12 | `space-12` | 56 | `space-19` | 240 |
| `space-6` | 16 | `space-13` | 64 | `space-20` | 320 |

### 4.1 Prescriptive pairings

| Role | Token | px |
| --- | --- | --- |
| Icon ↔ label, inline text chips | `space-4` | 8 |
| Input ↔ input within a row | `space-5` | 12 |
| Form field stack (label → input → helper) | `space-3` → `space-2` | 6 → 4 |
| Vertical stack between related blocks | `space-6` | 16 |
| Card padding (default) | `space-8` | 24 |
| Section spacing within a page | `space-11` | 48 |
| Block spacing between major page regions | `space-15` | 96 |
| Hero → first content band (marketing) | `space-17` | 160 |

Use the tokens; never write raw pixels in component styles.

---

## 5. Radius

| Token | px | Use |
| --- | --- | --- |
| `radius-sm` | 6 | Kbd keycaps, inline chips inside dense tables. |
| `radius-md` | 10 | Inputs, selects, textareas, tag-style filters. |
| `radius-lg` | 12 | Buttons, cards, menus, dialogs, popovers. (The default radius of the system.) |
| `radius-xl` | 16 | Full-page feature blocks on marketing only. |
| `radius-pill` | 9999 | Chips, badges, signal pills. |

**Full-bleed surfaces (the artifact canvas, the topbar, the marketing hero background) have radius 0.** Never round a surface that meets the viewport edge.

---

## 6. Shadows

Two tiers. That's it.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgba(26,23,19,0.06)` | `0 2px 4px rgba(0,0,0,0.35)` | Elements that momentarily float: the `<button>` a popover is anchored to, the "copied" toast. |
| `shadow-md` | `0 4px 12px rgba(26,23,19,0.08)` | `0 8px 20px rgba(0,0,0,0.45)` | Drawer, dialog, command palette, right-click menu. |

**Never introduce `shadow-lg`, `shadow-xl`, coloured shadows, ambient glow, or inner shadows.** Depth is communicated by hairline + surface tone, not by haze.

---

## 7. Focus ring

```css
outline: 2px solid var(--rust);
outline-offset: 2px;
```

That is the whole system. No `box-shadow` rings, no inner-shadow rings, no glow, no multi-layer rings. The ring applies to every interactive element on `:focus-visible`. The 2px offset is mandatory — it gives the ring breathing room against the hairline.

---

## 8. Motion catalog

Emil Kowalski primitives. Eight named tokens; every motion in the product resolves to one of them.

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `motion-quick` | 120ms | `cubic-bezier(0.2,0,0,1)` | Hover colour shifts, tooltip fade. |
| `motion-base` | 180ms | `cubic-bezier(0.2,0,0,1)` | Default UI transitions: tab switch, accordion toggle, input border tone. |
| `motion-enter` | 230ms | `cubic-bezier(0.2,0,0,1)` | Drawer / modal / popover *entering*. |
| `motion-exit` | 180ms | `cubic-bezier(0.4,0,1,1)` | Drawer / modal / popover *leaving*. Faster + sharper out than in. |
| `motion-spring` | 280ms | `cubic-bezier(0.3,1.4,0.5,1)` | Delightful overshoot — "item added to canvas" confirmations. Use rarely (≤ 2 per view). |
| `motion-indicator` | 2000ms | `cubic-bezier(0.2,0,0,1)` | Live-dot pulse, long breathing indicators. |
| `motion-blink` | 1050ms | `cubic-bezier(0,0,0,1)` | Terminal-style cursor blink, streaming caret. |
| `motion-reduce` | 1ms | `linear` | Automatically substituted when `prefers-reduced-motion: reduce`. |

CSS custom properties (to be added to `tokens.css` during the drift pass):
`--motion-quick`, `--motion-base`, `--motion-enter`, `--motion-exit`, `--motion-spring`, `--motion-indicator`, `--motion-blink`.

**Rules.** Never animate `transform` on `<button>` — no translate, no scale, no jiggle. Colour, opacity, border-colour, width/height only. Drawer/dialog entrance animates `opacity` + `transform: translateY(8px) → 0`. Never `translateY(20px+)` — Emil-soft, not marketing-bounce.

---

## 9. Layout system

### 9.1 Breakpoints and page widths

| Token | Breakpoint | Page max |
| --- | --- | --- |
| `bp-sm` | 640px | 100% |
| `bp-md` | 860px | 720px |
| `bp-lg` | 1040px | 960px |
| `bp-xl` | 1280px | 1040px |
| `bp-2xl` | 1600px | 1120px |

### 9.2 Columns and gutters

- Default layout is **flex stacks**; a 12-column grid is available but opt-in for marketing layouts.
- **Gutters**: 24px desktop (≥ `bp-lg`), 16px mobile.
- Content-column max width for prose is **680px** regardless of breakpoint. Long lines are a bug.

---

## 10. Iconography

- **Stroke**: 1.5px, uniform.
- **Sizes**: 14 / 16 / 18 / 20 / 24 px. 16 is the default next-to-text; 20 is the default in toolbars.
- **Style**: Lucide-style outline glyphs only. Inline SVG, never font icons, never PNG.
- **Colour**: `currentColor`, defaulting to `var(--ink-3)`. Active/selected states inherit `var(--ink-1)` or `var(--rust)` from the component.
- **No filled icons.** No rounded-corner icon sets (e.g. Material Rounded). No multi-colour illustrative icons. No emoji as glyphs.
- SVGs ship with `stroke-linecap: round` and `stroke-linejoin: round` — that's the only concession to warmth.

---

## 11. Component anatomy standards

Each primitive follows the same five-field format.

### 11.1 Button

- **Anatomy.** Optional leading icon · label · optional trailing icon. Horizontal padding scales with size; vertical padding centers to fixed height.
- **Sizes.** `sm` 32h / `md` 40h / `lg` 44h. Horizontal pad: `sm` 12px, `md` 16px, `lg` 20px. Label token: `label` (500 weight, 13px).
- **Variants.**
  - `primary` — `--rust` background, `--rust-contrast` text. One per view.
  - `secondary` — `--paper-sunk` background, `--ink-1` text, 1px hairline.
  - `outline` — transparent, 1px hairline, `--ink-1` text.
  - `ghost` — transparent, `--ink-2` text, hover → `--surface-hover`.
  - `danger` — `--danger-500` background, white text. Only for destructive.
- **States.**
  - `hover` — colour only (primary → `--rust-hover`; others → `--surface-hover` layer).
  - `active` — `--surface-active` layer.
  - `focus-visible` — 2px rust outline at 2px offset.
  - `disabled` — `--ink-4` text, no hover, `cursor: not-allowed`.
  - `loading` — replace leading icon with 14px spinner; label stays.
- **a11y.** Min target 40×40 (md/lg satisfy; sm only allowed in dense toolbars on pointer devices). Every icon-only button has an `aria-label`.
- **Don'ts.** No shadow. No `transform` on hover. No gradient fills. No rounded-full unless it's a pill chip, which is a different component.

### 11.2 Input

- **Anatomy.** Label (`label` token, above) · optional helper/error (`caption` token, below) · field.
- **Sizes.** `md` 40h · `lg` 44h. Horizontal pad 12px. Font `body`.
- **States.**
  - default — `--paper-raised` bg, 1px `--hairline`, radius `md` (10).
  - hover — border → `--ink-4`.
  - focus — border → `--rust` (1.5px, same box so no layout shift), plus the system focus ring.
  - disabled — `--paper-sunk` bg, `--ink-4` text.
  - error — border → `--danger-500`, helper text in `--danger-500`.
- **Placeholder.** `--ink-4`. Never used to replace the label.
- **a11y.** Label is always rendered (visually or `sr-only`). `aria-invalid` + `aria-describedby` wire to the error helper.
- **Don'ts.** No inner shadow. No floating label animation. No border-bottom-only inputs.

### 11.3 Card (Surface)

- **Anatomy.** Optional header row · content · optional footer row.
- **Sizing.** Radius `lg` (12). 1px hairline. `--paper-raised` bg. Default padding `space-8` (24px); dense variant `space-6` (16px).
- **States.**
  - static — no elevation by default.
  - interactive (whole card is a link) — hover: border tint rust at 50% alpha (`color-mix(in oklab, var(--rust) 50%, var(--hairline))`); no shadow, no lift.
  - focus-within — system focus ring on the card outline.
- **a11y.** If the whole card is actionable, wrap in a single `<a>`/`<button>`; avoid nested clickable regions.
- **Don'ts.** No gradients. No shadow. No hover scale. No "glassmorphism".

### 11.4 Tabs

- **Anatomy.** Horizontal list · underline indicator · optional trailing count chip per tab.
- **Label.** `label` token.
- **States.**
  - inactive — `--ink-3`.
  - hover — `--ink-1`.
  - active — `--ink-1` text, 1.5px `--rust` underline flush with the tab row's bottom hairline.
  - focus-visible — system focus ring around the tab button, not around the underline.
- **Motion.** Underline slides with `motion-base` (180ms).
- **a11y.** Follow WAI-ARIA tabs pattern; arrow-key navigation; `role="tablist"`, `role="tab"`, `role="tabpanel"`.
- **Don'ts.** No pill-background active state. No uppercase tab labels unless using `mono-label` for system-log style.

### 11.5 Menu / Dialog / Popover

- **Anatomy.** Surface · optional header · items / content · optional footer.
- **Sizing.** Radius `lg` (12). `--paper-raised` bg. 1px `--hairline`. `shadow-md`. Padding `space-6` (16px). Menu item height **32px**; horizontal pad 12px.
- **States.**
  - item hover — `--surface-hover` background.
  - item active — `--surface-active` background, `--rust` leading icon.
  - item disabled — `--ink-4` text.
- **Motion.** Enter: `motion-enter` (opacity + `translateY(8px → 0)`). Exit: `motion-exit`.
- **a11y.** Focus trap inside dialogs; return focus to trigger on close; `aria-modal="true"` for dialog, `role="menu"` + `role="menuitem"` for menus.
- **Don'ts.** No dimmed scrims darker than 35% ink-1. No blur (we don't do glass). No auto-dismiss on pointer-leave for menus triggered by click.

### 11.6 Chip / Tag / Badge

- **Anatomy.** Optional leading dot or icon · label · optional trailing `×`.
- **Sizing.** Height 24. Padding `2px / 10px`. Radius `pill`. Text token `label` (may drop to 12px for very dense UIs).
- **Variants.**
  - neutral — `--paper-sunk` bg, `--ink-2` text.
  - accent — `--rust-soft` bg, `--rust` text.
  - status — `--success-soft-bg` / `--warning-soft-bg` / `--danger-soft-bg` + matching text colour.
- **States.** Hover only if interactive (dismissible or filter chip); pointer cursor and `--surface-hover` overlay.
- **a11y.** Dismissible chips expose the `×` as a `<button aria-label="Remove ${label}">`.
- **Don'ts.** No gradients. No glow. No uppercase chips (use `mono-label` for system-log rows instead).

### 11.7 Kbd

- **Anatomy.** Single element wrapping one key ("K") or a key sequence joined by thin spaces ("⌘K").
- **Sizing.** Height 20. Padding `1px / 6px`. Radius `sm` (6). `--paper-sunk` bg. 1px `--hairline`. Bottom border 1.5px `--hairline` for the "key cap" illusion. Font `data` at 12px (override).
- **States.** Static only.
- **a11y.** Wrap in `<kbd>`; associate with actions via `aria-keyshortcuts` on the owning button.
- **Don'ts.** No shadow. No gradient. No filled background.

---

## 12. Page templates

### 12.1 Marketing (landing)

- Max width 1040 (aligned to `bp-xl` page-max). Generous vertical rhythm — `space-11` (48px) inside sections, `space-15` (96px) between sections, `space-17` (160px) before the first content band after the hero.
- **Asymmetric hero.** Title-l or display copy on the left 7 columns; a single `mono-label` eyebrow above; a product still or artifact preview in the right 5 columns, offset vertically by +24px to break the baseline (Rauno touch).
- **Numbered craft-strips.** Sections introduced by a `mono-label` "REF-001 / CRAFT" with a 1px hairline spanning the full content width.
- **Feature grid.** 3 columns at `bp-xl`, 2 at `bp-lg`, 1 below. Cards are plain (no border on marketing variants; just `space-6` internal padding and a hairline divider between rows).
- **Colophon footer.** `mono-label` region with version, build hash, contact. Minimal, not a sitemap.

### 12.2 Dashboard (projects)

- Content-dense. Page max 1120 (`bp-2xl`). Optional left sidebar (220px). 24px gutters.
- Row density target: 44px per list row; 32px for compact table cells.
- Use `body-s` for metadata columns so more fits per row without dropping to caption.
- No hero. First visible element is the page `title-m` + a utility bar.

### 12.3 Studio (artifact editing)

- Three-zone shell.
  - **Topbar** — 40px tall, full-bleed, 1px hairline bottom. Contains artifact title + undo/redo + share.
  - **Left chat** — 320px wide, `--paper-raised` surface, 1px hairline right. Fixed; scrolls internally.
  - **Canvas** — fills the rest. Full-bleed, radius 0, no inner padding (tool overlays provide their own).
- **No rail on the right.** Property panels slide in as drawers from the right edge (`motion-enter`/`motion-exit`) and dismiss on backdrop click.

---

## 13. Voice & copy tone

**English.** Plain declarative. Sentence case for UI ("Add artifact"), `UPPERCASE MONO` for system labels ("REF · 001"). No marketing hype, no exclamation marks, no emoji. Error messages say what happened and what to do, in that order. Empty states describe the space, not a cartoon.

**Chinese.** 冷静、准确、直接。用"你"不用"您"。无惊叹号，无 emoji，无营销修辞。系统标签使用大写拉丁 + 等宽字体（例："REF · 001"），界面正文使用正常的句式书写。错误信息先说发生了什么，再说可以怎么做。空状态描述这个位置本身，不要拟人化。

---

## 14. Drift found

The following gaps exist between this spec and `apps/web/app/tokens.css` / `apps/web/app/globals.css`. They are tracked for a follow-up pass; **do not fix inside this task**.

1. **Spacing scale is incomplete.** `tokens.css` defines only `--space-0, 1, 2, 3, 4, 6, 8, 12, 16` (9 steps) with values `0/4/8/12/16/24/32/48/64`. The spec requires 21 steps `space-0..space-20` mapping to `0/2/4/6/8/12/16/20/24/32/40/48/56/64/80/96/128/160/192/240/320`. Action: extend the CSS variables and renumber — note that the existing numbering (`--space-2 = 8px`) does **not** match the new index (`space-2 = 4px` in the new scale). This is a breaking rename; plan a codemod.
2. **Motion tokens are under-specified.** `tokens.css` has `--motion-duration-1/2/3` (140/180/280ms) and only two easings. The spec requires eight named tokens (`motion-quick` through `motion-reduce`) with distinct durations and easings including `spring (0.3,1.4,0.5,1)`, `blink`, `indicator`. Action: add the seven missing custom properties; keep the legacy duration aliases for one release.
3. **Type scale mismatch.** `tokens.css` uses raw-size tokens (`--text-xs .. --text-display`) keyed to pixel sizes. The spec requires named usage tokens (`display`, `title-l`, `title-m`, `title-s`, `body-l`, `body`, `body-s`, `label`, `caption`, `mono-label`, `data`) with distinct weights and line-heights per token. Action: add CSS custom properties like `--font-token-title-m-size/line/weight/tracking`, or ship utility classes `.t-title-m` etc.
4. **Display size is off.** CSS `--text-display: 2.75rem` (44px) is the spec's `title-l`, not `display`. The spec's `display` is `clamp(44px, 6vw, 72px)`. Action: add a separate `--text-display-fluid` token.
5. **Tracking on display.** CSS `--tracking-display: -0.01em`. Spec demands `-0.02em` on `display` and `-0.012em` on `title-l`. Action: split tracking tokens.
6. **Breakpoints are absent.** `tokens.css` ships no breakpoint custom properties. The spec defines `bp-sm/md/lg/xl/2xl` at 640/860/1040/1280/1600. Action: add `--bp-*` custom properties and a matching `@custom-media` set if PostCSS is available.
7. **Signal live green is absent.** No `--signal-live` token. Spec requires `#35B46C` light / `#4FD185` dark. Action: add.
8. **Dark-theme semantic drift.** Dark `--success` currently aliases `var(--rust)`; spec wants `#8AB57E`. Currently green success and rust are collapsed onto the same colour in dark, which is a bug.
9. **Legacy shadow aliases.** `--shadow-lg` and `--shadow-xl` still exist (collapsed onto `shadow-md`). Spec says the only two shadows are `sm` and `md`. Action: delete the legacy aliases once callers migrate.
10. **`--focus-ring` uses `box-shadow` syntax.** Current: `--focus-ring: 0 0 0 2px var(--rust)`. Spec uses `outline`, not box-shadow, to avoid layout/stacking interactions. Action: migrate focus styles from `box-shadow: var(--focus-ring)` to `outline: 2px solid var(--rust); outline-offset: 2px`.
11. **Radius `xl` unused.** Token exists (16px) but no component anatomy references it. Either adopt in marketing blocks per §12.1 or delete.
12. **Icon sizes & stroke not tokenised.** `tokens.css` has no icon-related custom properties. Spec lists sizes `14/16/18/20/24` and stroke `1.5px`. Action: add `--icon-stroke` and a sizes scale if icons are ever rendered via CSS mask.

---

*End of spec. Source of CSS truth: `apps/web/app/tokens.css`. Runtime catalog: `packages/ui/src/tokens.ts`. Owner: OpenDesign design systems. Locked anchor: CLAUDE-LOCK-001.*
