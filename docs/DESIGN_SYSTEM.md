# Kodara Design System
## A 9/10 visual system, built on the 11 aesthetic principles

This is the single source of truth for color, type, spacing, radius, shadow, and
motion across the web app (Next.js) and the mobile app (Flutter). Both
platforms must implement these exact values so the product feels like one
brand, not two. Every decision below maps to a specific aesthetic principle —
implementers should not invent new tokens; extend this document first if a
gap is found.

---

## 1. Color — "The Accent" + "Symbolism"

Kodara currently has ~10 slightly different greens scattered across the
codebase (#14b8a6, #0f766e, #0b2922, #087a63, #12a880, #0ba976, #116d5a,
#0d7a63, #20b58f, #0b8d70...). That's not an accent, it's noise — when
everything is green, nothing reads as *the* important thing. Consolidate to
exactly two green tokens.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#0B8D70` | The ONE accent. Primary buttons, active nav/tab state, links, the live-payment dot, focus rings, chart fill, the single "hero" number per screen. Nothing else gets this color. |
| `--accent-dark` | `#087A63` | Hover/pressed state of accent only. Never used standalone. |
| `--accent-tint` | `rgba(11,141,112,.08)` | Subtle backgrounds: active nav row, selected badge, hover row. |
| `--accent-tint-strong` | `rgba(11,141,112,.14)` | Focus ring glow, stronger badge fill. |
| `--ink` | `#0B2922` | The one dark chrome surface: sidebar, tenant balance card, dark headers. Not used for body text. |
| `--bg` | `#F8FAFC` | App background. |
| `--surface` | `#FFFFFF` | Card/panel background. |
| `--text-primary` | `#1E2937` | Body text, headings on light surfaces. |
| `--text-secondary` | `#64748B` | Labels, captions, helper text. |
| `--border` | `#E2E8F0` | All hairline borders/dividers. |
| `--success` | `#10B981` | Completed/paid states ONLY. Never decorative. |
| `--warning` | `#F59E0B` | Overdue/attention states ONLY. |
| `--error` | `#EF4444` | Failed/destructive states ONLY. |

**Rule:** delete `--color-teal` (#14b8a6), `--color-teal-dark` (#0f766e), and
`--color-navy` (#0f172a) — replace every reference with `--accent`,
`--accent-dark`, or `--ink`. Delete every hardcoded hex in component files
(Tailwind arbitrary values like `bg-[#087A63]`, inline `style={{color:...}}`)
and replace with the token. Audit: if more than ~20% of a screen's surface
area is green, that screen has lost the accent — desaturate the rest to
neutral gray and let one element carry the color.

## 2. Typography — "Golden Ratio" + "Isolation"

Body-adjacent sizes use a tight 1.11–1.25 modular scale (easy to scan,
low-drama). Exactly one size per screen — the "hero" number (tenant balance,
the top dashboard metric, a chart's headline stat) — jumps by the golden
ratio (×1.618) against body text, so it's the one thing the eye lands on
first. That's isolation and golden-ratio proportion working together.

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 12px | Meta, timestamps |
| `--text-sm` | 13px | Labels, captions |
| `--text-base` | 14px | Body |
| `--text-md` | 16px | Body-lg, `h4` |
| `--text-lg` | 18px | `h4`/emphasis |
| `--text-xl` | 20px | `h3` |
| `--text-2xl` | 25px | `h2` (20 × 1.25) |
| `--text-display` | 34px | `h1` (~21 × 1.618) |
| `--text-hero` | 40px | The ONE golden-ratio hero number per screen only (balance amount, headline chart stat) — never more than one per screen. |

Font weight: 600 for all headings, 650–700 reserved for the hero number and
nav-active state only (weight is also a form of accent — don't overuse bold).

## 3. Spacing — "Grouping" + "Framing"

8px base grid, unchanged, but now *enforced* — no more ad hoc 14px/18px/22px/
26px/34px paddings invented per component.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-8` | 48px |
| `--space-10` | 64px |

**Grouping rule:** items inside one logical cluster (e.g. a metric's label +
value, a form's fields) use `--space-2`/`--space-3` between them. Distinct
sections/cards use `--space-5`/`--space-6` between them. Never mix — the gap
size IS the signal for what's related.

**Framing rule:** exactly two content-width containers exist:
`--frame-workspace: 1480px` (owner/manager workspace) and
`--frame-tenant: 520px` (tenant portal, intentionally narrow/mobile-first —
framing tenants into a focused single-column experience). No other max-width
values anywhere.

## 4. Radius — "Denoising"

| Token | Value |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 22px (bottom sheets / full-screen mobile modals only) |
| `--radius-full` | 999px (pills, avatars, dots) |

No other radius values. Round every ad hoc 9px/10px/11px/24px currently in
the codebase to the nearest token.

## 5. Shadow — "Shadows" + "Symbolism"

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | `0 1px 3px rgba(15,23,42,.08)` | Default card |
| `--shadow-elevated` | `0 4px 12px rgba(15,23,42,.12)` | Hover/dropdown/popover |
| `--shadow-modal` | `0 10px 30px rgba(15,23,42,.2)` | Modal/sheet |
| `--shadow-accent` | `0 16px 32px rgba(11,141,112,.22)` | The ONE featured surface per screen (tenant balance card, primary CTA) — a green-tinted shadow so the shadow itself signals "this is the important one," not just generic elevation. |

No inline/ad hoc `box-shadow` values anywhere. If a component needs
elevation, it uses one of these four.

## 6. Motion — "Movement"

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | Button press, toggle |
| `--motion-base` | 180ms | Hover, focus, tab switch |
| `--motion-slow` | 260ms | Modal/sheet enter |
| `--ease-standard` | `cubic-bezier(.4,0,.2,1)` | Default for everything |
| `--ease-spring` | `cubic-bezier(.32,.72,0,1)` | Modal/sheet entrance only |

Every transition in the codebase currently has its own one-off duration
(0.1s, 0.15s, 0.2s...) — consolidate to these three. Motion should always
answer "what is this telling the user to look at" — no decorative animation.

## 7. Principle checklist for every screen

Before shipping a screen, verify:

1. **Isolation** — is there one clear focal element with real breathing room
   around it, or is everything shouting equally?
2. **The Accent** — is `--accent` used sparingly (one CTA, one live state, one
   hero number), or has green taken over the screen?
3. **Grouping** — do related items sit at the tight spacing tokens and
   unrelated sections sit at the loose ones?
4. **Framing** — is the content width one of the two approved frames? Is
   there a clear "what matters" crop, not just a full data dump?
5. **Golden Ratio** — does the one hero number use `--text-hero` against
   `--text-base` body copy nearby?
6. **Movement** — do all transitions use the three motion tokens?
7. **Diptych** — for any before/after or owner/tenant comparison view, are
   the two sides matched in size/style except for the one differentiator?
8. **Tension** — does the hero section avoid dead-centered symmetry (prefer a
   golden-ratio-ish split, e.g. 62/38, over 50/50)?
9. **Shadows** — only the four shadow tokens, nothing inline.
10. **Symbolism** — success/warning/error colors used only for their real
    semantic meaning, never decoratively.
11. **Denoising** — if you covered any one element with your thumb, would the
    screen feel cleaner? If yes and it's not carrying real information,
    remove it.
