---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check. Use when building any marketing page, portfolio, or doing a redesign.
---

# tasteskill: Anti-Slop Frontend Skill

> Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI.
> Every rule below is **contextual**. None of it fires automatically. First read the brief, then pull only what fits.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** - landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used - "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** - URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** - B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** - logo, color, type, photography. For redesigns, these are starting material, not optional input.
6. **Quiet constraints** - accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: \<page kind\> for \<audience\>, with a \<vibe\> language, leaning toward \<design system or aesthetic family\>."**

Example reads:
- *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*
- *"Reading this as: solo designer portfolio for hiring managers, with an editorial / kinetic-type language, leaning toward native CSS + scroll-driven animation + custom typography."*

### 0.C If the brief is ambiguous, ask one question, do not guess
Ask exactly **one** clarifying question and only when the design read genuinely diverges. If you can confidently infer from context, **do not ask**. Just declare the design read and proceed.

### 0.D Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision below is gated by these.

* **`DESIGN_VARIANCE: 8`** - 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** - 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** - 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them.

### 1.A Dial Inference (design read → dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

---

## 2. BRIEF → DESIGN SYSTEM MAP

Once you have the design read and dials, pick the right foundation. Do not invent CSS for things that have an official package.

### 2.A When to reach for a real design system (use official packages)
| Brief reads as… | Reach for |
|---|---|
| Microsoft / enterprise SaaS / dashboards | `@fluentui/react-components` |
| Google-ish UI, Material-flavored product | `@material/web` + Material 3 tokens |
| IBM-style B2B / enterprise analytics | `@carbon/react` + `@carbon/styles` |
| Shopify app surfaces | Polaris React |
| Public-sector UK service | `govuk-frontend` |
| Modern accessible React foundation | `@radix-ui/themes` |
| Modern SaaS where you own the components | shadcn/ui |
| Tailwind-based modern SaaS / AI marketing | Tailwind v4 utilities + `dark:` variant |

**One system per project.** Do not mix systems in the same tree.

### 2.B When the brief is an aesthetic, not a system
For these directions, there is **no single official package**. Build with native CSS + Tailwind + a maintained component library.

| Aesthetic | Honest implementation |
|---|---|
| Glassmorphism / "frosted glass" | `backdrop-filter`, layered borders, highlight overlays. Provide solid-fill fallback. |
| Bento (Apple-style tile grids) | CSS Grid with mixed cell sizes. No single library owns this. |
| Brutalism | Native CSS, monospace, raw borders. No library. |
| Editorial / magazine | Serif type, asymmetric grid, generous whitespace. No library. |
| Dark tech / hacker | Mono + accent neon, terminal motifs. No library. |
| Aurora / mesh gradients | SVG or layered radial gradients. No library. |
| Apple Liquid Glass | Web implementations are approximations using `backdrop-filter` + layered borders. Label as approximation. |

---

## 3. DEFAULT ARCHITECTURE & CONVENTIONS

### 3.A Stack
* **Framework:** React or Next.js. Default to Server Components (RSC).
  * **RSC SAFETY:** Global state works ONLY in Client Components.
  * **INTERACTIVITY ISOLATION:** Any component using Motion, scroll listeners, or pointer physics MUST be an isolated leaf with `'use client'`.
* **Styling:** **Tailwind v4** (default). For v4: use `@tailwindcss/postcss` or the Vite plugin.
* **Animation:** **Motion** (formerly Framer Motion). Import from `motion/react`.
* **Fonts:** Always use `next/font` (Next.js) or self-host with `@font-face` + `font-display: swap`. Never link Google Fonts via `<link>` in production.

### 3.B State
* **NEVER** use `useState` to track continuous values driven by user input (mouse position, scroll progress, pointer physics). Use Motion's `useMotionValue` / `useTransform` / `useScroll`.

### 3.C Icons
* **Allowed libraries (priority order):** `@phosphor-icons/react`, `hugeicons-react`, `@radix-ui/react-icons`, `@tabler/icons-react`.
* **Discouraged:** `lucide-react`. Acceptable only when the user explicitly asks or the project already depends on it.
* **NEVER hand-roll SVG icons.** One family per project.

### 3.D Responsiveness & Layout Mechanics
* **Viewport Stability:** NEVER use `h-screen` for full-height Hero sections. ALWAYS use `min-h-[100dvh]`.
* **Grid over Flex-Math:** NEVER use complex flexbox percentage math. ALWAYS use CSS Grid.

---

## 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

LLMs default to clichés. Override these defaults proactively.

### 4.1 Typography
* **Display / Headlines:** Default `text-4xl md:text-6xl tracking-tighter leading-none`.
* **Body / Paragraphs:** Default `text-base text-gray-600 leading-relaxed max-w-[65ch]`.
* **Sans font choice:** Discouraged as default: `Inter`. Pick `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi` first.

* **SERIF DISCIPLINE (VERY DISCOURAGED AS DEFAULT):**
  * Serif is **very discouraged as the default font for any project.**
  * **Serif is only acceptable when ONE of these is explicitly true:**
    - The brand brief literally names a serif font, OR
    - The aesthetic family is genuinely editorial / luxury / publication / heritage AND you can articulate why
  * **Specifically BANNED as defaults:** `Fraunces` and `Instrument_Serif` (the two LLM-favorite display serifs).
  * For everything else, default **sans-serif display** (Geist Display, Cabinet Grotesk, Satoshi, GT Walsheim, PP Neue Montreal).

* **EMPHASIS RULE:** When you want to emphasize a word within a headline, use **italic or bold of the SAME font**. Do NOT inject a random serif word into a sans headline just to add visual interest.

### 4.2 Color Calibration
* Max 1 accent color. Saturation < 80% by default.
* **THE LILA RULE:** No automatic purple button glows, no random neon gradients. Use neutral bases (Zinc / Slate / Stone) with high-contrast singular accents.
* **One palette per project.** Do not fluctuate between warm and cool grays.
* **COLOR CONSISTENCY LOCK (mandatory):** Once an accent color is chosen, it is used on the WHOLE page.

* **PREMIUM-CONSUMER PALETTE BAN (mandatory):**
  * Banned backgrounds as default: `#f5f1ea`, `#f7f5f1`, `#fbf8f1`, `#efeae0` (all "warm paper / cream / chalk / bone")
  * Banned accents as default: `#b08947`, `#b6553a`, `#9a2436` (all "brass / clay / oxblood")
  * **Default alternatives:** Cold Luxury (silver-grey + chrome), Forest (deep green + bone + amber), Black and Tan, Cobalt + Cream, Terracotta + Slate, Pure monochrome + single saturated pop.

### 4.3 Layout Diversification
* **ANTI-CENTER BIAS:** Centered Hero / H1 sections are avoided when `DESIGN_VARIANCE > 4`. Force "Split Screen", "Left-aligned content / right-aligned asset", "Asymmetric white-space".

### 4.4 Materiality, Shadows, Cards
* Use cards ONLY when elevation communicates real hierarchy. Otherwise group with `border-t`, `divide-y`, or negative space.
* **SHAPE CONSISTENCY LOCK (mandatory):** Pick ONE corner-radius scale for the page and stick to it.

### 4.5 Interactive UI States
Always implement full cycles:
* **Loading:** Skeletal loaders matching the final layout's shape.
* **Empty States:** Beautifully composed; indicate how to populate.
* **Error States:** Clear, inline (forms), or contextual (toasts only for transient).
* **Tactile Feedback:** On `:active`, use `-translate-y-[1px]` or `scale-[0.98]`.
* **BUTTON CONTRAST CHECK (mandatory, a11y):** Verify button text is readable against the button background. WCAG AA min (4.5:1).
* **CTA BUTTON WRAP BAN (mandatory):** Button text MUST fit on one line at desktop.
* **NO DUPLICATE CTA INTENT (mandatory):** Two CTAs with the same intent on one page is a Pre-Flight Fail.

### 4.6 Layout Discipline (Hard Rules)

* **Hero MUST fit in the initial viewport.** Headline max 2 lines on desktop, subtext max **20 words**, CTAs visible without scroll.
* **Hero font-scale discipline.** Plan font size and image size *together*. Default sensible range: `text-4xl md:text-5xl lg:text-6xl`.
* **HERO TOP PADDING CAP (mandatory):** Hero top padding max `pt-24` (≈6rem) at desktop.
* **HERO STACK DISCIPLINE (max 4 text elements).** 1. Eyebrow OR brand strip. 2. Headline (max 2 lines). 3. Subtext (max 20 words). 4. CTAs (1 primary + max 1 secondary). BANNED in the hero: trust micro-strip, pricing teaser, feature bullet list, social-proof avatar row.
* **Navigation MUST render on a single line on desktop.**
* **Navigation height cap: 80px max desktop, default 64-72px.**
* **Section-Layout-Repetition Ban.** A landing page with 8 sections must use at least 4 different layout families.
* **ZIGZAG ALTERNATION CAP (mandatory).** Max 2 sections in a row with image+text-split pattern. The 3rd consecutive is a Pre-Flight Fail.
* **EYEBROW RESTRAINT (mandatory).** Maximum 1 eyebrow per 3 sections. If section A has an eyebrow, the next 2 sections cannot have one.
* **SPLIT-HEADER BAN (mandatory).** "left big headline + right small explainer paragraph" layout is banned as default.
* **Bento Background Diversity (mandatory).** At least 2-3 cells in any multi-cell grid need real visual variation.
* **Mobile collapse must be explicit per section.**

### 4.7 Image & Visual Asset Strategy

**Priority order for visual assets:**
1. **Image-generation tool first.** If ANY image-gen tool is available, use it to create section-specific assets.
2. **Real web images second.** `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}` for placeholder photography.
3. **Last resort: tell the user.** Do NOT fill the page with hand-rolled SVG illustrations or div-based "fake screenshots."

**Div-based fake screenshots are banned.** A "hand-built product preview" rendered with `<div>` rectangles is a Tell.

**Hero needs a real visual.** Text + gradient blob is not a hero - it's a placeholder.

### 4.8 Content Density

* **Default content shape per section:** short headline (≤ 8 words) + short sub-paragraph (≤ 25 words) + one visual asset OR one CTA.
* **COPY SELF-AUDIT (mandatory before ship):** Re-read every visible string. Flag grammatically broken, unclear, AI-hallucinated, or LLM-sounding copy. Rewrite every flagged string.
* **Fake-precise numbers are flagged.** Numbers like `92%`, `4.1×` must come from real data or be explicitly labeled as mock.
* **One copy register per page.**

### 4.9 Quotes & Testimonials

* Max 3 lines of quote text. Truncate with "Read more" if longer.
* Real attribution: name + role/company. No generic "— Happy Customer".
* One testimonial layout per page (do not mix quote cards + inline pullquotes + marquee testimonials).

---

## 5. PRE-FLIGHT CHECKLIST

Before declaring any task done, verify:

- [ ] Design Read stated before any code
- [ ] No LLM default aesthetic (AI-purple, beige+brass, centered dark mesh hero)
- [ ] Hero fits viewport: max 2-line headline, max 20-word subtext, CTAs visible
- [ ] No duplicate CTA intent across page
- [ ] All buttons pass WCAG AA contrast
- [ ] No button text wraps at desktop
- [ ] Eyebrow count ≤ ceil(sectionCount / 3)
- [ ] No split-header pattern used as default
- [ ] No 3+ consecutive zigzag image+text sections
- [ ] Shape consistency maintained (corner radius)
- [ ] Color consistency maintained (one accent, no palette drift)
- [ ] All interactive states implemented (loading, empty, error, active)
- [ ] All sections have mobile collapse declared
- [ ] Copy self-audit completed, no AI-hallucinated strings
- [ ] No fake-precise numbers
- [ ] Real images used (not div-based fake screenshots)
