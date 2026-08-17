# Design System: Google Stitch - Project Hub (Quản Lý Dự Án)

## 1. Visual Theme & Atmosphere
A restrained, executive-dense yet gallery-airy project catalog interface (`Density: 6`, `Variance: 7`, `Motion: 6`). The atmosphere combines structured enterprise engineering with architectural minimalism — clean Slate/Zinc surfaces, high-contrast monospace metrics, crisp borders, and subtle spring-physics hover interactions.

## 2. Color Palette & Roles
- **Canvas Background** (`#F8FAFC`) — Primary application background surface (Slate-50 depth)
- **Pure Surface Card** (`#FFFFFF`) — Container fills, card surfaces, modal elevated panels
- **Charcoal Ink** (`#0F172A`) — Primary headings, titles, high-priority numbers (Zinc-900 depth)
- **Muted Slate Ink** (`#64748B`) — Secondary text, metadata, subtle labels (Slate-500)
- **Whisper Structural Line** (`#E2E8F0`) — 1px clean grid borders and section dividers
- **Accent Indigo** (`#4F46E5`) — Primary CTAs, active pills, progress highlight (Saturation < 80%)
- **Status Emerald** (`#10B981`) — Healthy projects, 100% completion tag
- **Status Amber** (`#F59E0B`) — In-progress tags, moderate risk indicators
- **Status Rose** (`#F43F5E`) — Overdue, high-risk flags, delete actions

*(Strict rules: Pure black `#000000` is banned. Neon/purple outer glows are banned.)*

## 3. Typography Rules
- **Display & Headings:** Modern High-Agency Sans-Serif (`Cabinet Grotesk` / `Outfit` / System Stack) — Track-tight (`-0.025em`), weight-driven hierarchy (`font-weight: 700-800`), clean font sizing.
- **Body:** System Sans-Serif (`14px` / `0.875rem` base) — Relaxed leading (`line-height: 1.5`), 65ch maximum width for descriptions.
- **Monospace Metrics:** `JetBrains Mono` / `Fira Code` / `var(--font-mono)` — Mandatory for project codes (`[PROJ-01]`), document counts, progress percentages, and status counts.
- **Banned:** `Inter` font in default setups, generic serifs (`Times New Roman`, `Georgia`).

## 4. Component Stylings
* **Buttons:** Flat, tactile surface with 1px structural border. Micro active push translate (`transform: translateY(1px)`). Accent fill (`#4F46E5`) for primary CTA, ghost background for secondary actions.
* **Cards (Bento Grid):** Generously rounded corners (`16px`/`1rem`). Diffused whisper shadow (`0 4px 16px rgba(15, 23, 42, 0.04)`). Hardware-accelerated hover lift (`translateY(-3px)` + `0 12px 28px rgba(15, 23, 42, 0.08)`).
* **Progress Bars:** Dual-layer rounded tracks (`height: 6px`, background `#F1F5F9`). Smooth gradient fill (`#4F46E5` to `#6366F1` or `#10B981` on 100%).
* **Search & Filters:** Pill-style filter tabs with subtle active background. Focused search input with clean 2px Indigo ring (`rgba(79, 70, 229, 0.15)`).
* **Empty States:** Structured composition with SVG outline icon and descriptive action guide — never plain text.

## 5. Layout Principles
- **Asymmetric Header:** Header contains title badge, summary text, search input, filter pills, and primary action in a balanced flex-wrap strip.
- **Executive Metrics Strip:** 4-column compact grid above project cards displaying overall portfolio statistics.
- **Bento Grid Cards:** `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` for optimal card density.
- **Mobile First Collapse:** Single-column stacked layout below 768px. Touch targets minimum `44px`.

## 6. Motion & Interaction
- **Spring Physics Hover:** `transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease`.
- **Live Status Pulsing:** Active project status dot with gentle CSS keyframe pulse (`0 0 0 4px rgba(16, 185, 129, 0.2)`).
- **Transform Only:** Animations strictly confined to `transform` and `opacity` for 60fps hardware acceleration.

## 7. Anti-Patterns (Banned)
- No emojis anywhere in UI headers or buttons.
- No pure black (`#000000`) or white-on-neon contrasts.
- No 3-column identical card rows without visual distinction.
- No generic filler text ("Lorem ipsum", "Scroll to explore").
- No broken image links or unstyled browser defaults.
