# Vitalents · Design system (v1.1, 14 Nov 2026)

A shared visual language for the astronaut demonstration. Product and evidence constraints are documented in [CONTRIBUTING.md](../CONTRIBUTING.md). The implementation tokens in `app/src/styles/tokens.css` and component styles are the current source of truth; this document records design intent.

## Direction

**Calm mission instrument.** A quiet, precise tool used every morning on a spacecraft: warm paper background, deep ink text, one teal accent, generous space, no decoration that carries no meaning. Think a well-made field notebook crossed with a flight checklist, not a fitness app and not a sci-fi HUD. No gradients-as-decoration, no glassmorphism, no neon, no emoji, no stock space imagery, no NASA logos.

## Brand

The repository includes the Vitalents mark, wordmarks, icons and self-hosted display font under `app/public/brand/`.

- **Logo:** the figure mark (a person with raised arms forming a V) plus the lowercase wordmark **vitalents**. Vector paths are extracted exactly into `app/src/shell/brandPaths.ts`; use `<Logo/>`, `<Mark/>` or `<Emblem/>` from `app/src/shell/Logo.tsx`. Static files are in `app/public/brand/` (`lockup.svg`, `lockup-dark.svg`, `mark.svg`, `emblem.svg`, icons). Never redraw, stretch, outline or recolour the logo.
- **Logo colours:** mark in `--deep` (#00687A), wordmark in `--ink` (#18363D). On dark: mark #5FD0E3, wordmark #E7F0F1. On the teal cover colour (#31B9D4): mark and wordmark in ink.
- **Emblem:** the mark on the soft `--tint` (#BFEAF0) blob. Use it for loading, empty states and onboarding instead of any other illustration.
- **Favicon / app icon:** ink mark on the teal cover colour, rounded square.
- **Motifs:** small uppercase teal kicker above a heading (`.eyebrow` / `.kicker`); section numbers 01, 02 … in a tint circle (`.num-badge`); callouts on tint with a 4 px `--deep` left edge (`.callout`). Callouts carry information, never a health state.
- **Clear space:** at least the height of the mark's head circle around the logo. Minimum lockup height 20 px; below that use the mark alone.

## Tokens (`app/src/styles/tokens.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | #18363D | #E7F0F1 | Text, icons |
| `--muted` | #52666B | #9FB3B7 | Secondary text |
| `--paper` | #F5F3EB | #0F1F23 | Page background |
| `--card` | #FFFFFF | #152A30 | Surfaces |
| `--line` | #CFDBDC | #2A4249 | Borders, dividers |
| `--teal` | #31B9D4 | #31B9D4 | Brand accent (not for text or focus: ~2:1 on paper) |
| `--deep` | #00687A | #5FD0E3 | Links, primary buttons, labels |
| `--tint` | #BFEAF0 | #173E47 | Selected, subtle highlight |
| `--fu-watch-fg` / `--fu-watch-bg` | #7A4E0B / #F6EAD2 | #F0CD8A / #3A2E17 | Follow-up: watching, action_open |
| `--fu-review-fg` / `--fu-review-bg` | #93323B / #F6DFE1 | #F2AAB0 / #3B1D21 | Follow-up: review_requested, under_specialist_review |
| `--fu-none-fg` / `--fu-none-bg` | #3D5459 / #E6ECED | #C3D3D6 / #22383E | Follow-up: no_open_follow_up, closed |
| `--data-bad-fg` / `--data-bad-bg` | #464F52 / #ECEDEE | #C9D2D4 / #2A3336 | Data problems, with hatching |

Contrast target: text ≥ 4.5:1 on its background (WCAG AA). This design target is not a blanket accessibility certification. Colour never carries meaning alone: every state has text and a symbol.

## Type

- Display titles: **Bricolage Grotesque** 600, self-hosted in `app/public/brand/`, selected through `--font-display`.
- Interface headings and body: **Instrument Sans**, headings 600 and body 400/500, self-hosted through `@fontsource/instrument-sans`.
- Arabic (later, RTL): **Noto Sans Arabic**, as in the brand files (`@fontsource/noto-sans-arabic`, token `--font-ar`).
- Numbers in readings: Instrument Sans with `font-variant-numeric: tabular-nums`.
- Scale (rem): 0.75 label · 0.875 small · 1 body · 1.125 lead · 1.375 h3 · 1.75 h2 · 2.25 h1. Line height 1.5 body, 1.15 headings.
- Labels: 0.75 rem, 600, uppercase, letter-spacing 0.06em, `--deep`.

## Space, shape, motion

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Page gutter 16 px on phones, 32 px on desktop; max content width 1120 px.
- Radius tokens: 14 px cards, 9 px controls, 999 px chips. Borders 1 px `--line`. Use the `--shadow` token for restrained elevation.
- Touch targets ≥ 44 × 44 px. Focus: 3 px `--focus` outline (deep teal, #00687A light / #5FD0E3 dark), offset 2 px, always visible.
- Motion: 150–200 ms ease-out for state changes only; respect `prefers-reduced-motion`. No motion inside the Decode measurement window.

## Components (shared names; build once, reuse)

| Component | Spec |
|---|---|
| `FollowChip` | Pill, follow-up status: symbol + text. ● quiet "No open follow-up", ◐ watch "Watching", ◑ watch "Action open", ▲ review "Review requested", ▲ review "Under specialist review", ✓ quiet "Closed". |
| `DataBadge` | Small square-cornered tag, data status: "Valid", "Limited quality", "Out of date" (status `stale`), "Not comparable", "Incomplete", "No reading". Labels come from `content/language.json` `data_status`. Valid is plain text in `--muted`; problems use the hatched data-problem background. Never green. |
| `SyncLabel` | Inline text with a dot: "Saved on device", "Waiting to send", "Sent", "Delivered", "Reviewed", each with its time. |
| `Card` | `--card`, 1 px `--line`, `--radius`, 16–24 px padding. Title in Instrument Sans 600, 1.125 rem. |
| `Why` | `<details>` disclosure labelled "Why?"; inside: a compact table of supporting records (date, what, value, data status), then rule id + version, explanation, limitations in `--muted`. |
| `Source` | "Source: <title>, <publisher>" with a link only when a URL exists. |
| `Button` | Primary: `--deep` background, white text. Secondary: `--card` with `--line` border. Danger is never used for health; Request help uses the review palette with text "Request help". |
| `Banner` | Thin full-width strip at the very top: "Simulated data · not a medical device", `--ink` background, `--paper` text, 0.75 rem. |
| `ValuePair` | Two values side by side with separate labels and scales (e.g. Decode result | Self-rating). Never a combined number, never a difference. |

## Layout

- Phones (< 768 px): banner, compact header (mission day + Request help), content, bottom tab bar with the six entries (icons + short labels).
- Desktop: banner, header with crew label, mission day, sync label, Report something and Request help; left rail navigation with the six entries; content in cards on a 12-column grid.
- Today & map: figure on the left (desktop) or top (phone), domain list beside it. The figure is a simple, friendly line drawing, not anatomical.

## Writing

Plain, short, second person ("your reference"). Observations, never causes. Follow the product wording constraints in [CONTRIBUTING.md](../CONTRIBUTING.md). Dates as "13 Nov · day 26". Numbers with units and a source.
