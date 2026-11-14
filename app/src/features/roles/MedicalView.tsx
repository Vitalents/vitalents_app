// Medical team view (route /medical, FR-SHR-03): delivered packages only, then mark reviewed,
// request a reading, or add a comment. Reads through filterData; writes through assertWrite.
import '../sharing/share.css'
import { useId, useState } from 'react'
import { DOMAINS } from '../../content/content'
import type { SharePackage } from '../../data/contract'
import { Emblem, Logo } from '../../shell/Logo'
import { FollowChip } from '../../shell/StatusChips'
import { useRole } from '../../store/role'
import { currentStatus } from '../../sync/engine'
import { markReviewed } from '../../sync/link'
import { SyncStatusRow } from '../sharing/SyncStatusRow'
import { parseSummaryText } from '../sharing/summary'
import { T, utcDateTime, utcTime } from '../sharing/strings'
import { addComment, requestMeasurement } from './actions'
import { useVisibleData } from './hooks'

const READINGS = DOMAINS.filter((d) => d.live)
  .flatMap((d) => d.indicators)
  .filter((i) => i.id !== 'symptom')

function PackageCard({ pkg, events }: { pkg: SharePackage; events: Parameters<typeof SyncStatusRow>[0]['events'] }) {
  const role = useRole((s) => s.role)
  const id = useId()
  const [reading, setReading] = useState(READINGS[0]?.name ?? '')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const status = currentStatus(events, pkg.share_package_id)
  const reviewedAt = events.find((e) => e.share_package_id === pkg.share_package_id && e.sync_status === 'reviewed')?.occurred_at_utc ?? null

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null)
    try {
      await fn()
      setDone(ok)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <article className="card sh-pkg" aria-labelledby={`${id}-h`}>
      <header className="sh-pkg-head">
        <Logo height={22} title="Vitalents" />
        <div className="sh-pkg-title">
          <h2 id={`${id}-h`}>{T.medical.packageTitle}</h2>
          <p className="muted small">
            {T.medical.prepared} {utcDateTime(pkg.prepared_at_utc)}, {T.medical.version(pkg.package_version)}
          </p>
        </div>
        <div className="sh-pkg-review">
          {status === 'reviewed' && reviewedAt ? (
            <p className="sh-reviewed">
              <span className="sh-dot" aria-hidden="true" />
              {T.sync.labels.reviewed} <time dateTime={reviewedAt}>{utcTime(reviewedAt)}</time>
            </p>
          ) : (
            <button type="button" className="btn primary" onClick={() => run(() => markReviewed(pkg, role), T.medical.reviewedDone)}>
              {T.medical.markReviewed}
            </button>
          )}
        </div>
      </header>

      <SyncStatusRow pkg={pkg} events={events} compact />

      <div className="sh-sections">
        {parseSummaryText(pkg.summary_text).map((b) => (
          <section key={b.title} className="sh-section">
            <h3>{b.title}</h3>
            <ul className="sh-items">
              {b.lines.map((l, i) =>
                l.text.startsWith('Limits: ') ? (
                  <li key={i} className="sh-limits small">{l.text.slice('Limits: '.length)}</li>
                ) : (
                  <li key={i} className={`sh-item${l.date ? '' : ' no-date'}`}>
                    {l.date && <time className="sh-date" dateTime={l.date}>{l.date}</time>}
                    <span className="sh-body"><span className="sh-text">{l.text}</span></span>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>

      <div className="sh-pkg-actions">
        <form
          className="sh-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => requestMeasurement(pkg, reading, role), T.medical.requestDone(reading))
          }}
        >
          <label className="field" htmlFor={`${id}-r`}>
            <span>{T.medical.requestTitle}</span>
            <select id={`${id}-r`} className="sh-select" value={reading} onChange={(e) => setReading(e.target.value)}>
              {READINGS.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn">{T.medical.requestSend}</button>
        </form>

        <form
          className="sh-form"
          onSubmit={(e) => {
            e.preventDefault()
            const text = comment
            void run(async () => {
              await addComment(pkg, text, role)
              setComment('')
            }, T.medical.commentDone)
          }}
        >
          <label className="field" htmlFor={`${id}-c`}>
            <span>{T.medical.commentLabel}</span>
            <textarea id={`${id}-c`} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={!comment.trim()}>{T.medical.commentSend}</button>
        </form>
      </div>
      {done && <p className="ok-note" role="status">{done}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </article>
  )
}

export function MedicalView({ subjectId }: { subjectId: string }) {
  const data = useVisibleData(subjectId)
  const packages = [...data.share_package].sort((a, b) => b.prepared_at_utc.localeCompare(a.prepared_at_utc))
  const followUps = data.follow_up.filter((f) => f.assigned_role === 'medical')

  return (
    <div className="page sh-page">
      <header className="page-head">
        <p className="eyebrow">{T.roles.medical}</p>
        <h1>{T.medical.title}</h1>
        <p className="muted">{T.medical.lede}</p>
      </header>

      {packages.length === 0 ? (
        <div className="loading-state">
          <Emblem size={88} />
          <p className="muted">{T.medical.empty}</p>
        </div>
      ) : (
        <div className="sh-pkg-list">
          {packages.map((p) => (
            <PackageCard key={p.share_package_id} pkg={p} events={data.sync_event} />
          ))}
        </div>
      )}

      <section className="card pad sh-followups" aria-labelledby="sh-fu">
        <h2 id="sh-fu">{T.medical.followTitle}</h2>
        {followUps.length === 0 ? (
          <p className="muted">{T.medical.followEmpty}</p>
        ) : (
          <ul className="fu-list">
            {followUps.map((f) => {
              const a = data.action.find((x) => x.action_id === f.action_id)
              return (
                <li key={f.follow_up_id}>
                  <FollowChip status={f.followup_status} />
                  <p className="fu-text">{a?.action_text ?? f.action_id}</p>
                  {f.specialist_note && (
                    <p className="sh-note small">
                      <span className="kicker">{T.medical.noteLabel}</span>
                      <span>{f.specialist_note}</span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
