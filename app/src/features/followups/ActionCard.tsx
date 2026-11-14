// One step with its follow-up (FR-FU-02..07). Every write goes through records.ts, which checks the role.
import { useState } from 'react'
import type { Action, FollowUp } from '../../data/contract'
import { LIBRARY } from '../../content/content'
import { FollowChip } from '../../shell/StatusChips'
import { fmtDue, T } from './strings'
import {
  accept, answerReview, closeFollowUp, decline, markDone, rate, reviewDue, reviewLaterReading, splitOutcome, start, unable,
  type LaterReading, type Role, type Usefulness,
} from './records'
import type { SinceReading } from './later'
import { ReadingsSince, ReviewQuestion } from './ReviewQuestion'
import './act.css'

export interface ActionWrites {
  action?: Action
  follow_up?: FollowUp | null
  feedback_entry?: import('../../data/contract').FeedbackEntry
}

export interface ActionCardProps {
  action: Action
  followUp: FollowUp | null
  role: Role
  /** Reading after the action, for "Mark done"; null keeps it awaiting_impact_review. */
  laterReading: (a: Action, after: string, until: string) => LaterReading
  /** FR-FU-04: readings of the step's indicators between two times; without it the question shows no readings. */
  readingsSince?: (a: Action, since: string, until: string) => SinceReading[]
  onWrite: (w: ActionWrites) => Promise<void>
  /** Shown when the step opens schedule alternatives (FR-SCH-01). */
  scheduleHref?: string | null
  now?: () => string
}

function sourceText(id: string | null | undefined): { title: string; url: string | null } {
  if (!id) return { title: 'TODO(question: source missing)', url: null }
  const s = LIBRARY.get(id)
  if (s) return { title: `${s.title}, ${s.publisher}`, url: s.url }
  if (id.includes(':mission_schedule:')) return { title: T.scheduleSource, url: null }
  return { title: id, url: null }
}

export function ActionCard({ action: a, followUp: fu, role, laterReading, readingsSince, onWrite, scheduleHref, now = () => new Date().toISOString() }: ActionCardProps) {
  const [mode, setMode] = useState<'idle' | 'decline' | 'unable' | 'close'>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const src = sourceText(a.source_reference_id)
  const mine = a.owner_role === role
  const finished = ['completed', 'awaiting_impact_review', 'rejected', 'unable'].includes(a.execution_status)
  const titleId = `t-${a.action_id.replace(/[^a-z0-9]/gi, '-')}`
  const due = mine && reviewDue(a, fu, now())
  const outcome = fu?.outcome_note ? splitOutcome(fu.outcome_note) : null
  const canClose = !!fu && fu.followup_status !== 'closed' && fu.assigned_role === role && ['completed', 'unable', 'rejected'].includes(a.execution_status)
  const waitingForReview = mine && !!fu && fu.assigned_role === role && fu.followup_status !== 'closed' && a.execution_status === 'awaiting_impact_review'
  const completedAt = a.completed_at_utc ?? fu?.opened_at_utc ?? null
  const reviewTime = now()
  const observation = waitingForReview && completedAt ? laterReading(a, completedAt, reviewTime) : null

  async function run(fn: () => ActionWrites) {
    setError(null)
    setBusy(true)
    try {
      await onWrite(fn())
      setMode('idle')
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const doRate = (v: Usefulness) => run(() => rate(a, v, now()))

  const ratedLabel = a.feedback_rating === 1 ? T.useful : a.feedback_rating === 0 ? T.notUseful : null

  return (
    <article className={`act-card${finished ? ' is-quiet' : ''}`} aria-labelledby={titleId}>
      <div className="act-card-top">
        <span className="act-kind">{T.stepKind[a.step_category]}</span>
        {fu && <FollowChip status={fu.followup_status} />}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 className="act-title" id={titleId}>{a.action_text}</h2>
        <p className="act-reason"><span className="act-muted">{T.reason}: </span>{a.reason_text}</p>
      </div>

      <dl className="act-facts">
        <div><dt>{T.owner}</dt><dd>{T.ownerLabel[a.owner_role]}</dd></div>
        <div><dt>{T.status}</dt><dd aria-live="polite">{T.exec[a.execution_status]}</dd></div>
        <div><dt>{T.due}</dt><dd className="act-num">{fmtDue(fu?.next_review_due_utc ?? a.follow_up_due_utc)}</dd></div>
        <div><dt>{T.source}</dt><dd>{src.url ? <a href={src.url}>{src.title}</a> : src.title}</dd></div>
      </dl>

      {a.execution_status === 'rejected' && <p className="act-small act-muted">{T.declinedWith(a.rejection_reason ?? null)}</p>}
      {a.execution_status === 'unable' && <p className="act-small act-muted">{T.unableWith(a.rejection_reason ?? null)}</p>}
      {outcome && (
        <div className="act-note" role="status">
          <strong>{waitingForReview ? T.previousOutcome : T.outcome}</strong>
          <p>{outcome.text}</p>
          {outcome.ids.length > 0 && (
            <details className="act-why">
              <summary>{T.why}</summary>
              <p className="act-small act-muted">{T.dataIds}</p>
              <ul>{outcome.ids.map((id) => <li key={id} className="act-num">{id}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {fu?.followup_status === 'closed' && <p className="act-small act-muted">{T.closedWith(fu.closing_reason ?? null)}</p>}
      {a.execution_status === 'awaiting_impact_review' && !fu?.outcome_note && <p className="act-small act-muted">{T.waitingNote}</p>}

      {due && fu && mode === 'idle' && (
        <ReviewQuestion
          due={fu.next_review_due_utc as string}
          since={fu.opened_at_utc}
          readings={readingsSince ? readingsSince(a, fu.opened_at_utc, now()) : []}
          busy={busy}
          onSave={(answer, note) => run(() => {
            const t = now()
            const readings = readingsSince ? readingsSince(a, fu.opened_at_utc, t) : []
            return answerReview(a, fu, answer, note, readings.map((r) => r.record_id), null, role, t)
          })}
        />
      )}

      {waitingForReview && fu && completedAt && mode === 'idle' && (
        <section className="act-review" aria-label={T.laterReviewTitle}>
          <h3>{T.laterReviewTitle}</h3>
          <p className="act-small act-muted">{observation ? T.laterReviewAvailable : T.laterReviewWaiting}</p>
          <ReadingsSince readings={readingsSince ? readingsSince(a, completedAt, reviewTime) : []} since={completedAt} />
          <button className="btn primary" disabled={busy || !observation} onClick={() => run(() => {
            const t = now()
            return reviewLaterReading(a, fu, laterReading(a, completedAt, t), role, t)
          })}>{T.reviewLaterReading}</button>
        </section>
      )}

      {mine && mode === 'idle' && !finished && !due && (
        <div className="act-controls">
          {(a.execution_status === 'proposed' || a.execution_status === 'deferred') && (
            <>
              <button className="btn primary" disabled={busy} onClick={() => run(() => accept(a, fu, role, now()))}>{T.accept}</button>
              <button className="btn" disabled={busy} onClick={() => setMode('decline')}>{T.decline}</button>
            </>
          )}
          {a.execution_status === 'accepted' && (
            <button className="btn" disabled={busy} onClick={() => run(() => ({ action: start(a, role) }))}>{T.start}</button>
          )}
          {(a.execution_status === 'accepted' || a.execution_status === 'in_progress') && (
            <>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => run(() => { const t = now(); return markDone(a, fu, laterReading(a, t, t), role, t) })}
              >{T.done}</button>
              <button className="btn" disabled={busy} onClick={() => setMode('unable')}>{T.unable}</button>
            </>
          )}
          {scheduleHref && a.execution_status !== 'rejected' && <a className="act-link" href={scheduleHref}>{T.openSchedule}</a>}
        </div>
      )}

      {canClose && mode === 'idle' && (
        <div className="act-controls">
          <button className="btn" disabled={busy} onClick={() => setMode('close')}>{T.closeFu}</button>
        </div>
      )}

      {(mine || mode === 'close') && mode !== 'idle' && (
        <form
          className="act-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'close') run(() => ({ follow_up: closeFollowUp(fu as FollowUp, a, reason, role, now()) }))
            else run(() => ({ action: mode === 'decline' ? decline(a, reason, role) : unable(a, reason, role) }))
          }}
        >
          <label htmlFor={`${titleId}-r`}>{mode === 'decline' ? T.declineReason : mode === 'close' ? T.closeReason : T.unableReason}</label>
          <textarea id={`${titleId}-r`} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required={mode === 'close'} />
          <div className="act-controls">
            <button className="btn primary" type="submit" disabled={busy}>{mode === 'decline' ? T.confirmDecline : mode === 'close' ? T.closeConfirm : T.confirmUnable}</button>
            <button className="btn" type="button" onClick={() => { setMode('idle'); setReason('') }}>{T.cancel}</button>
          </div>
        </form>
      )}

      {mine && finished && a.execution_status !== 'rejected' && (
        ratedLabel ? (
          <p className="act-small act-muted">{T.rated(ratedLabel)}</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <p id={`${titleId}-q`} className="act-small" style={{ fontWeight: 600 }}>{T.rateQ}</p>
            <div className="act-controls" role="group" aria-labelledby={`${titleId}-q`}>
              <button className="btn" disabled={busy} onClick={() => doRate('useful')}>{T.useful}</button>
              <button className="btn" disabled={busy} onClick={() => doRate('not_useful')}>{T.notUseful}</button>
            </div>
          </div>
        )
      )}
      {error && <p className="act-error" role="alert">{error}</p>}
    </article>
  )
}
