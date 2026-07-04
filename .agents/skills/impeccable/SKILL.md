---
name: impeccable
description: Gives AI agents the missing design vocabulary for typography, spacing, color, hierarchy, contrast, and restraint. Stops AI from generating generic, boring frontends. Use when you want rigorous design-system discipline, anti-slop principles, and access to the Impeccable command vocabulary (bolder, quieter, distill, polish, typeset, colorize, layout, adapt, animate, delight, overdrive).
---

# Impeccable: Design Vocabulary & Anti-Slop System

## Why This Skill Exists

AI frontends all share one look: no words for hierarchy, contrast, or restraint. Impeccable gives the agent the designer's vocabulary — so you stop guessing and start directing, live, in your production codebase.

Source: [impeccable.style](https://impeccable.style) | [github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)

---

## The 12 Design Commands

These are the core Impeccable commands. When the user invokes any of these (by name or intent), apply the full protocol for that command.

### `impeccable` — Freeform direction
Accept natural language design direction and apply it holistically. Read the intent, map it to design tokens, and output revised code.

### `bolder`
Increase visual weight and presence. Apply: heavier font weight, larger type scale step, stronger color contrast, more saturated accent, reduced whitespace to tighten rhythm. Do NOT add decorations — achieve boldness through weight and scale.

### `quieter`
Reduce visual noise. Apply: lighter font weight, one type scale step smaller, muted colors (reduce saturation 15-25%), increased whitespace, remove decorative elements, soften borders. Quieter ≠ invisible. The element should still be readable.

### `distill`
Strip to essentials. Remove every element that doesn't carry load. If content can be understood without an element, delete the element. No placeholder text, no decorative dividers, no ornamental icons. What remains should feel inevitable.

### `polish`
Refine micro-details. Apply: pixel-perfect alignment, consistent spacing rhythm (4/8/16/24/32/48px scale), hover and active states on every interactive element, focus rings, smooth transitions (150-250ms, `cubic-bezier(0.23, 1, 0.32, 1)`). Polish is invisible to users who haven't seen the unpolished version.

### `typeset`
Set type correctly. Apply:
- Headline: `tracking-tighter leading-none` or `leading-[0.95]`
- Body: `leading-relaxed max-w-[65ch]`
- Captions / meta: `text-sm text-muted-foreground`
- Correct optical sizing: display type at 48px+ gets `font-feature-settings: "ss01"` where available
- No widows (lone words on final line): add `text-wrap: balance` to headlines
- Check and fix italic descender clipping: add `pb-1` when italic display type contains `g j p q y`

### `colorize`
Resolve color intent. Apply: max 1 accent color, saturation ≤ 80%, tint shadows to background hue, ensure WCAG AA contrast on all text/background pairs. No pure-black `#000000` or pure-white `#ffffff` — use `oklch(7% 0.006 95)` and `oklch(97% 0 0)` equivalents. One palette temperature per page (do not mix warm and cool grays).

### `layout`
Fix structural composition. Apply: CSS Grid over flexbox math, correct semantic HTML landmark elements (`<header>`, `<main>`, `<section>`, `<footer>`), max content width `max-w-7xl` or `max-w-[1400px]`, `min-h-[100dvh]` not `h-screen`, explicit mobile collapse per section. Check: nav on one line at desktop, hero fits viewport.

### `adapt`
Optimize for target context (device / breakpoint / user preference). Apply: responsive breakpoints `sm:640 md:768 lg:1024 xl:1280 2xl:1536`, `prefers-reduced-motion` fallbacks for all animations, `prefers-color-scheme` support if dark mode is in scope, touch target minimum 44×44px.

### `animate`
Add or fix motion. Apply Emil Kowalski's motion framework:
- Never use `transition: all`. Specify exact properties.
- Enter/exit: `ease-out` custom curve `cubic-bezier(0.23, 1, 0.32, 1)`
- On-screen movement: `ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`
- Duration: buttons 100-160ms, tooltips 125-200ms, dropdowns 150-250ms, modals 200-500ms
- Never animate from `scale(0)` — start from `scale(0.95)` + `opacity: 0`
- Buttons: add `transform: scale(0.97)` on `:active`
- Never animate keyboard-initiated actions (used 100+ times/day)

### `delight`
Add purposeful micro-interactions. Apply: staggered list entrances (30-50ms per item), spring physics for drag interactions (`{ type: "spring", duration: 0.5, bounce: 0.15 }`), morphing state transitions (button → loading → success), confetti or celebration for rare positive events. Delight ≠ decoration. Every interaction must have a purpose.

### `overdrive`
Maximum visual intensity for the current design direction. Increase DESIGN_VARIANCE by +2, MOTION_INTENSITY by +2. Apply the boldest valid choices within the established palette — do not break the design system, amplify it.

---

## Design Token Vocabulary

Use these concepts when discussing or implementing design decisions.

### Hierarchy vocabulary
- **Primary** — the one thing users must see first
- **Secondary** — supporting context
- **Tertiary / Ghost** — background, metadata, affordance hints
- **Destructive** — irreversible actions (red family)
- **Disabled** — reduced opacity 40-50%, `pointer-events: none`

### Spacing rhythm
Use the 4px base unit. Valid multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Never use ad-hoc pixel values like 7px, 13px, 23px.

```css
--space-xs:  8px;
--space-sm:  16px;
--space-md:  24px;
--space-lg:  32px;
--space-xl:  48px;
--space-2xl: 80px;
--space-3xl: 112px;
```

### Corner radius system
Pick ONE scale for the project and lock it.

| Mode | Scale |
|---|---|
| Sharp / tech | 0-2px |
| Standard | 4-8px |
| Rounded / consumer | 12-16px |
| Pill | 999px |

Mixed systems are allowed ONLY with a documented rule (e.g. "buttons are full-pill, cards are 8px, inputs are 4px") applied everywhere.

### Typography scale
Maximum 4 type sizes on a page (display, headline, body, caption). Each size gets exactly one weight. Do not use 6 different font sizes.

```
Display:  48-80px / weight 600-700 / tracking-tighter
Headline: 24-40px / weight 500-600 / tracking-tight  
Body:     16-18px / weight 400     / leading-relaxed
Caption:  12-14px / weight 400-500 / text-muted
```

---

## Anti-Pattern Detection

When you see any of these patterns in existing code, flag and fix them:

| Anti-Pattern | Fix |
|---|---|
| `transition: all 300ms` | Specify exact properties |
| `scale(0)` on enter animation | Use `scale(0.95)` + `opacity: 0` |
| `ease-in` on UI animations | Use `ease-out` with custom curve |
| No `:active` state on buttons | Add `transform: scale(0.97)` |
| `h-screen` on hero | Use `min-h-[100dvh]` |
| `w-[calc(33%-1rem)]` flexbox math | Use CSS Grid |
| `transition: all` | Specify `transform, opacity` explicitly |
| `border-radius` inconsistency | Audit and lock to one scale |
| Pure `#000` / `#fff` | Use perceptual near-black/near-white |
| Multiple font families per page | One pair maximum: display + mono |
| `placeholder` as label | Label above input, always |
| 3+ consecutive zigzag sections | Break with full-width or bento |
| Generic card grid × 6 | Add visual variation to 2-3 cells |
| Eyebrow on every section | Max 1 per 3 sections |
| Centered hero (always) | Force left-aligned when VARIANCE > 4 |
| Inter as default font | Use Geist, Satoshi, Cabinet Grotesk |
| AI-purple gradient | Neutral base + singular accent |
| Warm beige + brass accent (default) | Rotate palette family |

---

## The Kit Consumption Rule

Before inventing a new CSS class, ask: is there a primitive for this?

- **Buttons**: reach for a variant class before writing `.hero-cta-primary`
- **Cards / tiles**: use a shared tile primitive before writing `.feature-card`
- **Sections**: use a shared section scaffold before writing per-section containers
- **Typography**: use the type scale before writing per-component font sizes

Bespoke class names are the sign of a design system that hasn't been applied.

---

## Contrast & Accessibility (Non-Negotiable)

Every interface must meet WCAG AA:
- Body text: **4.5:1** contrast ratio minimum
- Large text (18px+ regular, 14px+ bold): **3:1** minimum
- Interactive focus rings: **3:1** against adjacent colors
- Ghost buttons over photo backgrounds: add scrim, backdrop, or stroke

Check with browser DevTools > Accessibility or the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

Touch targets: **44×44px minimum** on mobile (WCAG 2.5.5).

---

## Impeccable Design Principles Summary

1. **Hierarchy first** — every element has a rank; nothing competes equally
2. **One accent, one temperature** — max 1 accent color, consistent warm/cool gray
3. **Spacing rhythm** — 4px base unit, no ad-hoc values
4. **One corner-radius scale** — pick sharp, standard, rounded, or pill; lock it
5. **Type: max 4 sizes** — display, headline, body, caption
6. **No `transition: all`** — specify exact properties
7. **Enter from near, not nowhere** — `scale(0.95)` + `opacity: 0`, never `scale(0)`
8. **Ease-out for enter/exit** — custom curve `cubic-bezier(0.23, 1, 0.32, 1)`
9. **Active state on every button** — `scale(0.97)` on press
10. **Real images or labeled slots** — no div-based fake screenshots
11. **Copy self-audit before ship** — flag AI-sounding, broken, or fake-precise strings
12. **Pre-flight before declaring done** — run the full checklist
