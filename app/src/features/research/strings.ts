// Every user-facing string for the research track (FR-RT-01) and the pattern card (FR-PE-07), in one file
// (CLAUDE.md rule 11). TODO(review: Amr — merge into content/strings.ts when the Arabic/RTL pass starts).
import type { Verdict } from './types'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const P = {
  kicker: 'A pattern in your record',
  title: 'Short nights and Decode the morning after',
  caveat: 'Two observations that happen together are a pattern in your record, not a cause.',
  headline: (below: number, compared: number) =>
    `On ${below} of the ${compared} ${compared === 1 ? 'morning' : 'mornings'} after a short night, your Decode result was below your personal range.`,
  shortNoDecode: (n: number) => `${plural(n, 'short night has', 'short nights have')} no comparable Decode round the morning after, so ${n === 1 ? 'it is' : 'they are'} not counted.`,
  otherLine: (below: number, compared: number, nights: number) =>
    compared === 0
      ? `After the other ${plural(nights, 'night', 'nights')} in this period: no comparable Decode round yet, so there is nothing to set this against.`
      : `After the other ${plural(nights, 'night', 'nights')} in this period: below your range on ${below} of ${compared} ${compared === 1 ? 'morning' : 'mornings'}.`,
  otherNone: 'There were no other nights in this period, so there is nothing to set this against.',
  small: 'These are small counts from a short period.',
  period: (from: string, to: string) => `Mornings from ${from} to ${to}, after your Decode reference period.`,
  shortDefRule: (hours: string, rule: string, version: string | null) =>
    `Short night: under ${hours} h of recorded sleep, the same line rule ${rule}${version ? ` v${version}` : ''} uses.`,
  shortDefRef: (hours: string) => `Short night: below the low end of your sleep reference range (${hours} h).`,
  source: 'Source',
  states: {
    no_decode_reference: 'No pattern to show yet: there is no Decode reference to compare against.',
    no_short_nights: 'No short night in this period, so there is no pattern to show.',
    nothing_comparable: 'Short nights are recorded in this period, but no comparable Decode round followed them yet.',
  } as Record<string, string>,
  table: {
    caption: 'Each morning in this period',
    morning: 'Morning',
    night: 'Night before',
    decode: 'Decode that morning',
    short: 'Short night',
    other: 'Not short',
  },
  outcome: {
    below_range: 'below your range',
    within_range: 'within your range',
    above_range: 'above your range',
    no_decode: 'No reading',
    not_comparable: 'Not comparable',
  } as Record<string, string>,
  correct: (n: number) => `${n} correct`,
  range: (lo: number, hi: number) => `Your Decode range: ${lo}–${hi} correct.`,
  why: 'Why?',
  whyCaption: 'Records behind these counts',
}

export const R = {
  label: 'Research prototype on simulated data — not used for any step or alert',
  kicker: 'Research track',
  title: 'Expected Decode range on simulated data',
  lead:
    'A small per-person model relates two things in a simulated record, recorded sleep the night before and the morning self-rating, to the Decode correct count. It is checked against the simplest alternative: the personal median.',
  never: 'This page never changes your record, your reference, a step or an alert. It is not a health prediction.',
  loading: 'Loading the research model…',
  missing: 'No research model is published for this simulated crew member.',
  failed: 'The research model could not be loaded.',
  crew: (label: string) => `Simulated crew member: ${label}`,

  verdictTitle: 'Against the baseline',
  verdict: {
    better: 'On this simulated record the model was closer than the personal median in both checks. With this few days that is a weak signal, not a result.',
    mixed: 'It does not clearly beat the baseline. It was slightly better in one check and not in the other, and closer on fewer than half of the days.',
    not_better: 'It does not beat the baseline. The personal median alone was closer on average.',
    not_evaluated: 'Too few days to check it against the baseline.',
  } as Record<Verdict, string>,
  check: { leave_one_day_out: 'Leave one day out', forward_only: 'Forward only' } as Record<string, string>,
  avgMiss: 'Average miss',
  missUnit: (v: string) => `${v} correct`,
  model: 'Model',
  baseline: 'Personal median',
  closer: (m: number, b: number, t: number) => `Closer: model on ${m} ${m === 1 ? 'day' : 'days'}, median on ${b}${t ? `, tied on ${t}` : ''}.`,
  inRange: (m: number, b: number, n: number, mw: string, bw: string) =>
    `Inside the 80 % range: model ${m} of ${n} (about ${mw} wide), median ${b} of ${n} (about ${bw} wide).`,
  heldOut: (n: number) => plural(n, 'held-out day', 'held-out days'),

  chartTitle: 'Each held-out day',
  chartLabel: (check: string) => `Decode correct count on each held-out day (${check}), with the model's expected range and the personal median`,
  axisDay: 'Mission day',
  legend: {
    actual: 'Decode correct count that day',
    range: "Model's expected range (80 %)",
    baseline: 'Personal median of the other days',
  },
  tip: {
    actual: 'Recorded',
    expected: 'Model expected',
    range: 'Range',
    baseline: 'Median',
    inputs: (h: string, a: number) => `Night before ${h} h · self-rating ${a}/10`,
  },
  table: {
    summary: 'Show every held-out day as a table',
    caption: (check: string) => `Held-out days (${check})`,
    day: 'Day',
    inputs: 'Inputs',
    actual: 'Recorded',
    model: 'Model range',
    baseline: 'Median',
  },
  checkSwitch: 'Check',

  inputsTitle: 'Inputs',
  inputsNote: 'From the simulated record only. A day with a missing or not-comparable value is left out, never filled in.',
  slope: (v: string, sd: string, unit: string) => `Slope in this model: ${v} correct per ${unit} (± ${sd})`,
  unitWord: { h: 'hour', '1-10': 'rating point' } as Record<string, string>,
  rowsUsed: (n: number) => `${plural(n, 'day', 'days')} used.`,
  leftOut: (n: number) => `${plural(n, 'day', 'days')} left out:`,
  sourceField: 'From',

  howTitle: 'How it works',
  howModel: 'Model',
  howRange: 'Expected range',
  howBaseline: 'Baseline',
  howChecks: 'Checks',
  howVerdict: 'How the verdict is set',
  file: (f: string, v: string) => `Model ${v}, from ${f}`,

  limitsTitle: 'Limits',
  validation: 'Needs independent validation before anyone relies on it.',
}
