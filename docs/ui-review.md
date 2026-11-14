# UI review · Increment 1 screens (14 Nov 2026)

Scope: Today & map, the domain cards (cognition, heart, symptoms), Today's review (with Why? open), Plan and Settings. Each was checked at 390 × 844 and 1280 × 900, in light and dark. Method:

- the `impeccable` and `frontend-design` skills, then a design critique and a WCAG 2.1 AA accessibility review of the screenshots
- an axe-core run on every route in both themes and both sizes
- a touch-target sweep and a keyboard pass

Rules: docs/DESIGN.md and CLAUDE.md. Where the two disagree, CLAUDE.md wins.

Status: **Fixed** in branch `wp-01-polish`, **Open** = still to do (with an owner where it is outside this pass).

## Findings, most important first

| # | Finding | Why it matters | Status |
|---|---|---|---|
| 1 | The body figure read as abstract shapes: a box chest, a dashed rectangle belly, bare-stick legs. Nothing named the moon or the ring. The follow-up symbols were Unicode glyphs; ◐ rendered as a tiny half-dot and ○ looked like a hole. | The figure is the home screen. If it doesn't read as a body, the whole "body map" idea is lost, and the state symbols were not legible. | **Fixed.** Now a friendly line figure with an ink outline: head, neck, rounded shoulders, chest, belly, arms with hands, legs with feet. The seven regions are unchanged. Sleep is a crescent labelled "Sleep". Radiation is a tick ring with "Radiation" written along it. Each region has an SVG symbol badge, filled by follow-up status, with a hatch overlay for data problems and a dashed outline for sample areas. |
| 2 | "Data: Valid reading" showed as a teal-tinted chip, the same tint as the "Saved" confirmation. | A tinted "valid" badge looks like a positive health signal (CLAUDE.md rule 1). DESIGN.md says plain `--muted` text. | **Fixed.** "Valid" is now plain muted text with no fill. The label changed from "Valid reading" to "Valid" to match DESIGN.md. |
| 3 | Contrast failures: (a) in dark mode, Request help had white text on #D4646C at 3.6:1; (b) in dark mode, primary buttons had white on #5FD0E3 at 1.8:1, which hit Settings "Confirm"; (c) the light-mode follow-up chip prefixes were 3.5–4.1:1 because of `opacity: .8`; (d) the light-mode review chip text was #B3434B on #F6E1E2 at 4.4:1; (e) the teal focus ring was 2.1:1 on paper. | WCAG 1.4.3 and 1.4.11. | **Fixed.** New `--on-review` and `--on-deep` tokens: dark text on light fills in dark mode (7.9:1 and 9.4:1). Chip prefixes are now full opacity. Review chip text uses #93323B. Focus follows DESIGN.md v1.1: a 3 px `--focus` outline (#00687A light, #5FD0E3 dark) on every control, and a 4 px `--focus` stroke on SVG regions. Teal is not used for focus. axe-core now reports 0 contrast issues on every route, theme and size. |
| 4 | Today's review hierarchy: Next step was the 4th of four equal cards (bottom right on desktop, about three screens down on a phone). The rows stretched, so Recorded and Missing became tall empty boxes. Why? was a wrapped flex list that repeated the explanation printed just above it. | The one action the astronaut should take was the least visible thing on the page. | **Fixed.** A "Next step: …" jump link in the page header goes straight to the step. Next step is a full-width callout (4 px `--deep` left border on `--tint`) with a 1.375 rem title. Recorded and Missing stack beside Changed. Why? follows DESIGN.md: a table of the data behind it (what + record id, value, date, data status), then rule + version, then limits. It no longer repeats text already on screen. On phones the table becomes labelled rows. |
| 5 | The rows in the map's area list had `aria-label="Open X"`, which replaced their visible content. | Screen readers heard "Open Heart and circulation" and never the follow-up or data status (WCAG 1.3.1). | **Fixed.** The aria-label is removed, so the link name now includes both labels. |
| 6 | The bottom tab bar on phones used a hard-coded 6 rem bottom padding with no safe-area inset. Focused elements could scroll under the bar. | Content was hidden behind the bar on notched phones; this is the overlap in the Increment 1 screenshots. | **Fixed.** New `--nav-h` token. The bar's height includes `env(safe-area-inset-bottom)`, and `.main` bottom padding is the bar height + the inset + 24 px. `scroll-padding-bottom` keeps focused items above the bar. |
| 7 | FollowChip symbols did not match DESIGN.md: ○ for "No open follow-up" and ● for "Closed", instead of ● and ✓. DataBadge was a pill, the same shape as FollowChip. | The three states must never look like one label (rule 2). | **Fixed.** All six symbols are drawn as SVG (● ◐ ◑ ▲ ▲ ✓) and shared by the chips and the figure. DataBadge is now a square-cornered tag, so shape separates the two labels as well as text does. |
| 8 | "Below your personal range" used the amber follow-up "watching" colours. | It mixed a reference comparison with follow-up state (rule 2) and implied an alarm. | **Fixed.** It is now a neutral, outlined box; the words carry the meaning. |
| 9 | Touch targets: "Go to the daily check" and the Why? summary were 36 px. Settings was 40 px on phones under 400 px. The phone brand link was 30 px. | WCAG 2.5.5 and DESIGN.md's ≥ 44 px rule. | **Fixed.** All are ≥ 44 px. The touch-target sweep on `/` is clean. Tiny figure regions (the crescent, the ring) get invisible hit areas. |
| 10 | The domain card tabs had `role="tablist"` but no arrow-key support, and all three tabs were tab stops. | They didn't follow the ARIA tabs pattern that screen-reader users expect. | **Fixed.** Roving tabindex; ←/→/Home/End move between tabs. |
| 11 | Reading numbers were proportional, so columns jittered (values in Recorded, the 7-day bars, Why? values and dates). | Numbers that line up are easier to compare and scan. | **Fixed.** `tabular-nums` on reading values, bar labels, Recorded values and Why? values and dates. |
| 12 | No `prefers-reduced-motion` handling. | DESIGN.md motion rule. | **Fixed.** Motion is limited to 150 ms ease-out state changes, all switched off under reduced motion. Smooth scroll for the jump link only when motion is allowed. |
| 13 | The legend heading "Two separate labels" didn't explain the figure, and the legend had no entry for the dashed sample areas. | It didn't teach how to read the map. | **Fixed.** Now titled "How to read the map", with three entries: fill and symbol for follow-up, stripes for a data problem, dashed outline for sample areas. "No reading never means nothing is wrong" is kept. |
| 14 | The simulated-data banner sits outside any landmark (axe best-practice `region`, moderate). | Screen-reader users who move by landmark skip it. | **Open.** The fix is in Layout.tsx's header area, which the coordinator is changing for the brand update. Move the banner inside `<header>` or give it `role="region"` with a label. |
| 15 | The header sync label adds "⇅" with CSS `content`, which some screen readers announce. | Minor noise. | **Open** (Layout/header, coordinator). Use an `aria-hidden` icon instead. |
| 16 | DESIGN.md calls the stale state "Stale"; the UI says "Out of date". | Naming drift between the spec and the UI. | **Open.** Keep "Out of date" (plainer English) and update DESIGN.md, or the reverse. Amr's call. |
| 17 | The figure still uses a single neutral pose, and the symptoms badge sits only on the left arm. | Fine for the demo. | **Open, low.** A later pass could add labels on hover or focus. |

## Product rules re-checked

- No "healthy", "normal" or "ready" wording: `scripts/check_language.py` finds 0 hits.
- Follow-up, data and sync status stay three separate components, now also different in shape (pill and tag).
- The self-rating and Decode stay side by side on the cognition card; there is still no combined number.
- No causal wording was added.
- Colour never carries meaning alone: every fill on the figure has a symbol badge and an accessible name, and every chip has text.

## How to verify

```bash
cd app && npx tsc -b && npm test && npm run build
python3 scripts/check_language.py && python3 scripts/validate_data.py
npm run dev    # then Tab through the map: every region shows a deep outline and announces name + both labels
```
