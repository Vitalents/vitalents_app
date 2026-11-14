// FR-PE-07 pattern card (UI-07): one descriptive co-occurrence in the astronaut's own record.
// Counts only, always the "pattern, not a cause" line, the records behind it under "Why?". Never a recommendation,
// never a step, never a combined score. Meant to sit in Record & trends (see the mount note in the final report).
import { useMemo } from 'react'
import { formatNumber, sourceTitle } from '../../content/format'
import { formatDay } from '../../engine/mission'
import { sleepDecodePattern, type PatternPair, type SleepDecodePattern } from '../../engine/patterns'
import { useCurrentReview, useDataSet, useReviewDate } from '../../store/selectors'
import { WhyRecords } from '../record/WhyRecords'
import { P } from './strings'
import './research.css'

export function PatternCard({ to }: { to?: string } = {}) {
  const data = useDataSet()
  const reviewDate = useReviewDate()
  const review = useCurrentReview()
  const date = to ?? reviewDate
  const asOf = date === review?.review_date ? review.created_at_utc : undefined
  const p = useMemo(() => sleepDecodePattern(data, { to: date, asOf }), [data, date, asOf])
  return <PatternCardView pattern={p} />
}

export function PatternCardView({ pattern: p }: { pattern: SleepDecodePattern }) {
  const ref = p.decodeReference
  const pairs = [...p.short.pairs, ...p.other.pairs].sort((a, b) => a.date.localeCompare(b.date))
  const shortNoDecode = p.short.nights - p.short.compared
  return (
    <article className="card pc" aria-labelledby="pc-title">
      <header className="pc-head">
        <p className="kicker">{P.kicker}</p>
        <h3 id="pc-title">{P.title}</h3>
      </header>

      {p.state === 'pattern' ? (
        <>
          <p className="pc-headline">
            <span className="pc-count num" aria-hidden="true">{p.short.below}<span className="pc-of">/{p.short.compared}</span></span>
            <span>{P.headline(p.short.below, p.short.compared)}</span>
          </p>
          <div className="pc-notes">
            {shortNoDecode > 0 && <p>{P.shortNoDecode(shortNoDecode)}</p>}
            <p>{p.other.nights === 0 ? P.otherNone : P.otherLine(p.other.below, p.other.compared, p.other.nights)}</p>
            {p.short.compared + p.other.compared < 10 && <p className="muted">{P.small}</p>}
          </div>
        </>
      ) : (
        <p className="pc-empty">{P.states[p.state]}</p>
      )}

      <p className="pc-caveat">{P.caveat}</p>

      {pairs.length > 0 && <Mornings pairs={pairs} />}

      {p.recordIds.length > 0 && (
        <WhyRecords ids={p.recordIds} caption={P.whyCaption} summary={P.why}>
          {p.from && <p>{P.period(formatDay(p.from), formatDay(p.to))}</p>}
          <p>
            {p.shortNight.basis === 'rule'
              ? P.shortDefRule(formatNumber(p.shortNight.hours), p.shortNight.ruleId ?? '', p.shortNight.ruleVersion)
              : P.shortDefRef(formatNumber(p.shortNight.hours))}
          </p>
          {ref && ref.range_low != null && ref.range_high != null && <p>{P.range(ref.range_low, ref.range_high)}</p>}
          {p.shortNight.sourceId && <p><span className="why-k">{P.source}:</span> {sourceTitle(p.shortNight.sourceId)}</p>}
          <p className="muted">{P.caveat}</p>
        </WhyRecords>
      )}
    </article>
  )
}

/** Each morning in the period as one row: the night before (short or not) beside the Decode result. Two values, never merged. */
function Mornings({ pairs }: { pairs: PatternPair[] }) {
  return (
    <table className="pc-table">
      <caption className="muted small">{P.table.caption}</caption>
      <thead>
        <tr><th scope="col">{P.table.morning}</th><th scope="col">{P.table.night}</th><th scope="col">{P.table.decode}</th></tr>
      </thead>
      <tbody>
        {pairs.map((x) => (
          <tr key={x.sleepId} className={x.kind === 'short' ? 'pc-short' : undefined}>
            <th scope="row">{formatDay(x.date)}</th>
            <td>
              <span className="num">{formatNumber(x.sleepHours)} h</span>
              <span className={`pc-tag pc-tag-${x.kind}`}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  {x.kind === 'short' ? <path d="M5 0.75A4.25 4.25 0 0 1 5 9.25Z" fill="currentColor" /> : null}
                  <circle cx="5" cy="5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {x.kind === 'short' ? P.table.short : P.table.other}
              </span>
            </td>
            <td className={x.decode === null || x.outcome === 'not_comparable' || x.outcome === 'no_decode' ? 'pc-none' : undefined}>
              {x.outcome === 'no_decode' ? (
                P.outcome.no_decode
              ) : x.outcome === 'not_comparable' ? (
                <>{x.decode !== null && <span className="num">{P.correct(x.decode)} · </span>}{P.outcome.not_comparable}</>
              ) : (
                <><span className="num">{P.correct(x.decode as number)}</span> · {P.outcome[x.outcome]}</>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
