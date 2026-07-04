# Kodara — Design System

Editorial warmth for money software. The page is paper, not plastic. Inspired by
Apple's restraint and Cosmos' quiet, image-forward cleanliness: generous space,
one accent, typography does the talking, chrome disappears.

Every screen must feel calm enough to trust with rent money.

## 1. Atmosphere

Banking trust through editorial restraint. Cream-warm canvas, warm-gray ink,
one emerald action per view. Information density borrows from Linear; tone
borrows from a financial broadsheet. Numbers are first-class citizens.

Mood words: calm, precise, tactile, patient, assured.

Never: gradient soup, glassmorphism-as-decoration, emoji in UI copy, left-border
accent stripes, decorative icons that repeat the label, more than one accent hue
in a viewport.

## 2. Color — tokens live in `app/globals.css`

All color flows through semantic tokens. Never hardcode Tailwind palette classes
(`slate-*`, `indigo-*`) in components; use token classes (`bg-background`,
`text-muted-foreground`, `text-primary`…).

```
--background   oklch(98.5% 0.004 85)   warm paper, the page
--foreground   oklch(20%   0.012 75)   warm ink
--card         white                    floats above paper
--primary      oklch(51%  0.115 166)   deep emerald — money, M-Pesa, growth
--secondary    oklch(96.2% 0.006 85)   quiet warm surface
--muted-fg     oklch(52%  0.014 80)    supporting text
--accent       oklch(96%  0.014 166)   faint mint wash (hover only)
--destructive  oklch(55%  0.19  27)    errors only
--border       oklch(90.5% 0.008 85)   warm hairline
```

Roles, not preferences:
- **Emerald is for action and identity** — primary buttons, links, active nav,
  focus rings. It never tints body text or backgrounds at scale.
- **Status is semantic**: emerald = reconciled/paid, amber = unmatched/pending,
  red = failed/overdue. Status colors appear only on badges and status dots.
- **Hierarchy comes from ink, not weight of color**: foreground → muted-foreground
  → muted-foreground/70. If a screen needs a third gray, the layout is wrong.

## 3. Typography

Plus Jakarta Sans everywhere (loaded in `app/layout.tsx` as `--font-sans`).

- **Display / page titles**: 28–36px, weight 600–700, tracking −2%. One per page.
- **Section titles / card titles**: 15–17px, weight 600, tracking −1%.
- **Body / table cells**: 13–14px, weight 400–500, line-height 1.5.
- **Support / captions / eyebrows**: 11–12px; eyebrows uppercase, +6% tracking,
  weight 600, muted color.
- **Money**: always `tabular-nums`. Large KPI numerals 24–30px weight 700,
  tracking −1.5%. KES amounts in tables: 13–14px weight 600.

Headlines get `text-wrap: balance`. Never center-align body text in cards.

## 4. Space & Shape

- Base rhythm: 4px grid. Section gaps 32px (`gap-8`), card padding 24px,
  intra-group gaps 8–12px. When in doubt add space, don't add borders.
- Radius: `--radius` (16px) for cards and drawers, 10–12px for inputs/buttons,
  full for avatars/pills. Never mix radii inside one component group.
- Borders are hairlines (`border-border`, often at /40–/60 opacity). Shadows are
  for elevation states, not decoration: `--shadow-subtle` at rest,
  `--shadow-elevated` on hover, `--shadow-float` for overlays.
- One card style per view. Cards never nest inside cards; use hairline dividers.

## 5. Motion — easing lives in `app/globals.css`

- `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` — entrances, hovers (150–300ms)
- `--ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)` — drawers, sheets (300ms)
- Hover lifts are 1–2px max. Nothing bounces. Nothing autoplays.
- Motion states what changed, never performs. Respect `prefers-reduced-motion`
  (already globally enforced).

## 6. Brand

- The mark is the traced house SVG: `components/brand/logo.tsx` (`LogoMark`,
  `Logo`). It renders in `currentColor` — ink on light, white on dark. Never
  recolor it in brand hues, never stretch, never add effects.
- Favicon `public/logo-mark.svg` adapts to OS theme via `prefers-color-scheme`.
- Clear space around the mark ≥ 50% of its height. Minimum size 20px.
- Wordmark is set in the UI font, weight 700, tracking −2%; it is text, not SVG.

## 7. Voice

Labels are nouns ("Payments"), actions are verbs ("Record payment"). Sentence
case everywhere except eyebrow labels. No exclamation marks. Empty states say
what will appear and offer the first action, in one sentence each.

## 8. Screens must pass this checklist

1. One focal point per viewport (isolation) — remove until it's obvious.
2. One emerald moment per view (accent) — a second one demotes both.
3. Eye can trace aligned groups (grouping) — related items share an edge.
4. All money in tabular figures, right-aligned in tables.
5. Interactive targets ≥ 40px on touch; focus rings visible on keyboard nav.
6. Works at 375px, 768px, 1440px. Sidebar → drawer under `lg`.
7. Nothing decorative that doesn't earn its pixels (denoising).
