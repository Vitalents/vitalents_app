// FR-FU-04: on or after the follow-up date the card asks what happened, beside the readings recorded since the step started.
// The readings are observations in their own columns; nothing here links them to the step as an effect.
import { useId, useState } from 'react'
import { DataBadge } from '../../shell/StatusChips'
import { formatDay } from '../../engine/mission'
import type { SinceReading } from './later'
import type { ReviewAnswer } from './records'
import { fmtDue, fmtMinutes, T } from './strings'

export function valueText(r: SinceReading): string {
  if (r.value === null) return T.noValue
  if (r.kind === 'sleep_record' && typeof r.value === 'number') return `${fmtMinutes(r.value)} asleep`
  if (typeof r.value === 'string') return `“${r.value}”`
  return `${r.value}${r.unit ? ` ${r.unit}` : ''}`
}

/** Readings grouped by indicator, each in its own column: side by side, never combined. */
export function ReadingsSince({ readings, since }: { readings: SinceReading[]; since: string }) {
  const groups = new Map<string, SinceReading[]>()
  for (const r of readings) groups.set(r.indicator, [...(groups.get(r.indicator) ?? []), r])
  return (
    <section className="act-since" aria-labelledby={`since-${since}`}>
      <div className="act-since-head">
        <h3 id={`since-${since}`}>{T.readingsTitle}</h3>
        <span className="act-small act-muted">{T.readingsSince(formatDay(since))}</span>
      </div>
      {groups.size === 0 ? (
        <p className="act-small">{T.readingsNone}</p>
      ) : (
        <div className="act-since-cols">
          {[...groups.entries()].map(([ind, list]) => (
            <div key={ind} className="act-since-col">
              <p className="act-since-ind">{T.indicator[ind] ?? ind}</p>
              <ul>
                {list.map((r) => (
                  <li key={r.record_id}>
                    <span className="act-since-date">{formatDay(r.date)}</span>
                    <span className="act-since-val act-num">{valueText(r)}</span>
                    <span className="act-since-meta">
                      {r.position && <span>{T.position[r.position]}</span>}
                      <DataBadge status={r.status ?? 'no_reading'} reasons={r.reasons} compact />
                    </span>
                    <details className="act-why">
                      <summary>{T.why}</summary>
                      <p className="act-small act-muted">{T.dataIds}</p>
                      <ul><li className="act-num">{r.record_id}</li></ul>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="act-small act-muted">{T.readingsLimits}</p>
    </section>
  )
}

export function ReviewQuestion(props: {
  due: string
  since: string
  readings: SinceReading[]
  busy: boolean
  onSave: (answer: ReviewAnswer, note: string) => void
}) {
  const id = useId()
  const [answer, setAnswer] = useState<ReviewAnswer | null>(null)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  return (
    <div className="act-review">
      <form
        className="act-review-form"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (answer) props.onSave(answer, note)
        }}
      >
        <p className="act-review-kicker act-num">{T.reviewKicker(fmtDue(props.due))}</p>
        <fieldset className="act-choices" aria-describedby={tried && !answer ? `${id}-err` : undefined}>
          <legend>{T.reviewQ}</legend>
          {(Object.keys(T.reviewOptions) as ReviewAnswer[]).map((k) => (
            <label key={k} className="act-choice">
              <input type="radio" name={`${id}-a`} value={k} checked={answer === k} onChange={() => setAnswer(k)} />
              <span>
                <span className="act-choice-label">{T.reviewOptions[k][0]}</span>
                <span className="act-choice-hint">{T.reviewOptions[k][1]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="act-form">
          <label htmlFor={`${id}-n`}>{T.reviewNote}</label>
          <textarea id={`${id}-n`} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {tried && !answer && <p id={`${id}-err`} className="act-error" role="alert">{T.reviewPick}</p>}
        <div className="act-controls">
          <button className="btn primary" type="submit" disabled={props.busy}>{T.reviewSave}</button>
        </div>
      </form>
      <ReadingsSince readings={props.readings} since={props.since} />
    </div>
  )
}
