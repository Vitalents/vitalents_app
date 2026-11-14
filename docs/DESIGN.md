# Vitalents · Design system (v1, 14 Nov 2026)

One look for every screen. Agents: load the `anthropic-skills:impeccable` and `frontend-design:frontend-design` skills before styling, and follow this file. Where a skill suggests something that conflicts with CLAUDE.md's product rules, CLAUDE.md wins.

## Direction

**Calm mission instrument.** A quiet, precise tool used every morning on a spacecraft: warm paper background, deep ink text, one teal accent, generous space, no decoration that carries no meaning. Think a well-made field notebook crossed with a flight checklist, not a fitness app and not a sci-fi HUD. No gradients-as-decoration, no glassmorphism, no neon, no emoji, no stock space imagery, no NASA logos.

## Tokens (CSS variables, defined once in `app/src/index.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | #18363D | #E7F0F1 | Text, icons |
| `--muted` | #52666B | #9FB3B7 | Secondary text |
| `--paper` | #F5F3EB | #0F1F23 | Page background |
| `--card` | #FFFFFF | #152A30 | Surfaces |
| `--line` | #CFDBDC | #2A4249 | Borders, dividers |
| `--teal` | #31B9D4 | #31B9D4 | Brand accent, focus ring |
| `--deep` | #00687A | #5FD0E3 | Links, primary buttons, labels |
| `--tint` | #BFEAF0 | #173E47 | Selected, subtle highlight |
| `--watch` | #8A5A16 / bg #F6ECD9 | #E8B96A / bg #3A2E17 | Follow-up: watching, action_open |
| `--review` | #B3434B / bg #F6E1E2 | #F09AA0 / bg #3B1D21 | Follow-up: review_requested, under_specialist_review |
| `--quiet` | #52666B / bg #ECEFEF | #9FB3B7 / bg #1D3238 | Follow-up: no_open_follow_up, closed |
| `--data` | #52666B on hatched #ECEFEF | | Data problems: no_reading, incomplete, not_comparable, stale, limited |

Contrast: all text ≥ 4.5:1 on its background (WCAG AA). Colour never carries meaning alone: every state has text and a symbol.

## Type

- Headings: **Bricolage Grotesque** 600 (Google Fonts), fallback `ui-sans-serif, system-ui`.
- Body and UI: **Instrument Sans** 400/500/600, fallback `system-ui`.
- Numbers in readings: Instrument Sans with `font-variant-numeric: tabular-nums`.
- Scale (rem): 0.75 label · 0.875 small · 1 body · 1.125 lead · 1.375 h3 · 1.75 h2 · 2.25 h1. Line height 1.5 body, 1.15 headings.
- Labels: 0.75 rem, 600, uppercase, letter-spacing 0.06em, `--deep`.

## Space, shape, motion

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Page gutter 16 px on phones, 32 px on desktop; max content width 1120 px.
- Radius: 12 px cards, 8 px controls, 999 px chips. Borders 1 px `--line`. Shadow: none, or `0 1px 2px rgb(0 0 0 / 0.05)` on raised cards only.
- Touch targets ≥ 44 × 44 px. Focus: 2 px `--teal` outline, offset 2 px, always visible.
- Motion: 150–200 ms ease-out for state changes only; respect `prefers-reduced-motion`. No motion inside the Decode measurement window.

## Components (shared names; build once, reuse)

| Component | Spec |
|---|---|
| `FollowChip` | Pill, follow-up status: symbol + text. ● quiet "No open follow-up", ◐ watch "Watching", ◑ watch "Action open", ▲ review "Review requested", ▲ review "Under specialist review", ✓ quiet "Closed". |
| `DataBadge` | Small square-cornered tag, data status: "Valid", "Limited quality", "Stale", "Not comparable", "Incomplete", "No reading". Valid is plain text in `--muted`; problems use the hatched `--data` background. Never green. |
| `SyncLabel` | Inline text with a dot: "Saved on device", "Waiting to send", "Sent", "Delivered", "Reviewed", each with its time. |
| `Card` | `--card`, 1 px `--line`, 12 px radius, 16–24 px padding. Title in Bricolage 1.125 rem. |
| `Why` | `<details>` disclosure labelled "Why?"; inside: a compact table of supporting records (date, what, value, data status), then rule id + version, explanation, limitations in `--muted`. |
| `Source` | "Source: <title>, <publisher>" with a link only when a URL exists. |
| `Button` | Primary: `--deep` background, white text. Secondary: `--card` with `--line` border. Danger is never used for health; Request help uses the `--review` colour with text "Request help". |
| `Banner` | Thin full-width strip at the very top: "Simulated data · not a medical device", `--ink` background, `--paper` text, 0.75 rem. |
| `ValuePair` | Two values side by side with separate labels and scales (e.g. Decode result | Self-rating). Never a combined number, never a difference. |

## Layout

- Phones (< 768 px): banner, compact header (mission day + Request help), content, bottom tab bar with the six entries (icons + short labels).
- Desktop: banner, header with crew label, mission day, sync label, Report something and Request help; left rail navigation with the six entries; content in cards on a 12-column grid.
- Today & map: figure on the left (desktop) or top (phone), domain list beside it. The figure is a simple, friendly line drawing, not anatomical.

## Writing

Plain, short, second person ("your reference"). Observations, never causes. Use the CLAUDE.md wording table. Dates as "13 Nov · day 26". Numbers with units and a source.
