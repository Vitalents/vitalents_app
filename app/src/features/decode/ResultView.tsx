// Result (FR-DEC-10/11): the Decode result BESIDE today's self-rating (ValuePair), never combined, with the data status.
import type { DecodeSession, PersonalReference } from '../../data/contract'
import { Link } from 'react-router-dom'
import { TASK_VERSION, type Quality } from '../../engine/decodeSession'
import { compareToReference } from '../../engine/reference'
import { S } from './strings'

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} %`)
const fmtSec = (ms: number | null | undefined) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)} s`)

// DataBadge (DESIGN.md): square tag; Valid is plain muted text, problems sit on a hatched grey background. Never green.
export function DataBadge({ status }: { status: string }) {
  return (
    <span className={`dc-badge${status === 'valid' ? '' : ' dc-badge-problem'}`}>
      {S.statusLabels[status] ?? status}
    </span>
  )
}

export function ResultView(props: {
  session: DecodeSession
  quality: Quality
  eventCount: number
  ruleset: string
  selfRating: number | null
  reference: PersonalReference | null
  onAgain: () => void
  onStory?: () => void
}) {
  const { session, quality, selfRating, reference } = props
  const comparable = quality.status === 'valid' && !session.is_practice
  const cmp =
    comparable && reference && reference.range_low != null && reference.range_high != null
      ? compareToReference({ value: session.correct_count ?? null, reference: { ...reference, range_low: reference.range_low, range_high: reference.range_high } })
      : null
  return (
    <section className="dc-card" aria-labelledby="dc-result-title">
      <h2 id="dc-result-title">{S.resultTitle}</h2>
      <div className="dc-side">
        <div className="dc-panel">
          <h3>{S.decodeTitle}</h3>
          <p className="dc-big">{session.correct_count ?? '—'}<span className="dc-unit">{S.correct.toLowerCase()}</span></p>
          <dl className="dc-stats">
            <div><dt>{S.accuracy}</dt><dd>{fmtPct(session.accuracy_percent)}</dd></div>
            <div><dt>{S.medianTime}</dt><dd>{fmtSec(session.median_correct_rt_ms)}</dd></div>
            <div><dt>{S.dataStatus}</dt><dd><DataBadge status={quality.status} /></dd></div>
          </dl>
          {quality.reason_codes.length > 0 && (
            <p className="dc-small">{quality.reason_codes.map((r) => S.reasonLabels[r] ?? r).join(', ')}</p>
          )}
          {session.is_practice && <p className="dc-small">{S.practiceNote}</p>}
          {!session.is_practice && quality.status !== 'valid' && <p className="dc-small">{S.notComparableNote}</p>}
          {cmp && cmp.position !== 'not_comparable' && reference && (
            <p className="dc-cmp">
              {S.comparison[cmp.position](reference.range_low as number, reference.range_high as number)}
              <span className="dc-small dc-block-text">{S.comparisonLimits}</span>
            </p>
          )}
          {comparable && (!cmp || cmp.position === 'not_comparable') && <p className="dc-reference-note">
            {reference?.reference_status === 'provisional' ? S.referencePending : S.noReference}
          </p>}
          <details className="dc-why">
            <summary>{S.why}</summary>
            <p>{S.whyCounted(session.accepted_responses ?? 0, session.correct_count ?? 0)}</p>
            <p>{S.whyNotWrong}</p>
            <p>{S.whyEvents(props.eventCount)}</p>
            {cmp && reference && <p>{S.referenceLine(reference.reference_version, reference.valid_record_count)}</p>}
            <p className="dc-small">{S.whyRule(TASK_VERSION, props.ruleset)}</p>
          </details>
        </div>
        <div className="dc-panel">
          <h3>{S.selfRatingTitle}</h3>
          {selfRating != null ? <p className="dc-big">{selfRating}<span className="dc-unit dc-unit-tight">/10</span></p> : <p className="dc-muted">{S.selfRatingNone}</p>}
          <p className="dc-small">{S.alertnessScale}</p>
        </div>
      </div>
      <div className="callout dc-callout">
        <p>{S.sideBySide}</p>
        <p className="dc-small">{S.validationLabel}</p>
      </div>
      <div className="dc-result-actions">
        <Link className="dc-btn" to="/review">{S.reviewDay}</Link>
        {props.onStory && <button type="button" className="dc-text-button" onClick={props.onStory}>{S.openStory}</button>}
        <button type="button" className="dc-text-button" onClick={props.onAgain}>{S.playAgain}</button>
      </div>
    </section>
  )
}
