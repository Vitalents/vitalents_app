// Today's review (UI-05): Recorded / Changed / Missing / Next step, then other open follow-ups.
// FR-REV-01/03/04/05: every finding and step explains itself; no score or verdict anywhere.
import { Link } from 'react-router-dom'
import { describeRecord, reasonText, sourceTitle } from '../../content/format'
import { S } from '../../content/strings'
import type { Action, Finding, FollowUp } from '../../data/contract'
import { formatDay } from '../../engine/mission'
import { infoStatusOf } from '../../engine/view'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useDataSet, useRecordIndex, useReviewView } from '../../store/selectors'

export function ReviewPage() {
  const view = useReviewView()
  const data = useDataSet()
  if (!view) return <div className="page"><p className="muted">{S.review.noReview}</p></div>
  const nextFinding = view.nextStep?.finding_id ? data.finding.find((f) => f.finding_id === view.nextStep!.finding_id) : undefined
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{formatDay(view.date)}</p>
        <h1>{S.review.title}</h1>
        <p className="muted">{S.review.subtitle}</p>
      </header>

      <div className="review-grid">
        <Block title={S.review.recorded} n={1}>
          {view.recorded.length === 0 ? (
            <p className="muted">{S.review.noneRecorded}</p>
          ) : (
            <ul className="rec-list">
              {view.recorded.map(({ record, status, reasons }) => {
                const d = describeRecord(record)
                return (
                  <li key={record.id}>
                    <span className="rec-label">{d.label}</span>
                    <span className="rec-value">{d.value}</span>
                    <DataBadge status={status} reasons={reasons} compact />
                    {reasons.length > 0 && <span className="muted small">{reasonText(reasons)}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </Block>

        <Block title={S.review.changed} n={2}>
          {view.changed.length === 0 ? (
            <p className="muted">{S.review.noneChanged}</p>
          ) : (
            view.changed.map((f) => (
              <div key={f.finding_id} className="finding">
                <p>{f.explanation}</p>
                <p className="muted small">{f.limitations}</p>
                <Why finding={f} />
              </div>
            ))
          )}
        </Block>

        <Block title={S.review.missing} n={3}>
          {view.missing.length === 0 ? (
            <p className="muted">{S.review.noneMissing}</p>
          ) : (
            <ul className="miss-list">
              {view.missing.map(({ domain, indicator }) => (
                <li key={`${domain.id}-${indicator.id}`}>
                  <DataBadge status="no_reading" compact />
                  <span>{S.review.missingItem(indicator.name, domain.name)}</span>
                  {indicator.source_entity === 'decode_session' && <Link to="/check" className="link-btn">{S.review.goCheck}</Link>}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={S.review.next} n={4} highlight>
          {view.nextStep ? <ActionCard action={view.nextStep} finding={nextFinding} /> : <p className="muted">{S.review.noneNext}</p>}
        </Block>
      </div>

      <section className="card pad other">
        <h2>{S.review.other}</h2>
        {view.otherFollowUps.length === 0 ? (
          <p className="muted">{S.review.noneOther}</p>
        ) : (
          <ul className="fu-list">
            {view.otherFollowUps.map((f) => <FollowUpItem key={f.follow_up_id} fu={f} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function Block({ title, n, highlight, children }: { title: string; n: number; highlight?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card pad block ${highlight ? 'highlight' : ''}`} aria-labelledby={`block-${n}`}>
      <h2 id={`block-${n}`}><span className="block-n" aria-hidden="true">{n}</span>{title}</h2>
      {children}
    </section>
  )
}

function ActionCard({ action, finding }: { action: Action; finding?: Finding }) {
  return (
    <div className="action">
      <p className="action-text">{action.action_text}</p>
      <p className="muted small">{S.stepCategory[action.step_category]}</p>
      <dl className="facts">
        <div><dt>{S.review.reason}</dt><dd>{action.reason_text}</dd></div>
        <div><dt>{S.review.owner}</dt><dd>{S.owner[action.owner_role]}</dd></div>
        <div><dt>{S.review.status}</dt><dd>{S.actionStatus[action.execution_status]}</dd></div>
        {action.follow_up_due_utc && <div><dt>{S.review.due}</dt><dd>{formatDay(action.follow_up_due_utc)}</dd></div>}
        <div><dt>{S.review.sourceLabel}</dt><dd>{sourceTitle(action.source_reference_id)}</dd></div>
      </dl>
      {finding && <Why finding={finding} />}
    </div>
  )
}

function FollowUpItem({ fu }: { fu: FollowUp }) {
  const data = useDataSet()
  const action = data.action.find((a) => a.action_id === fu.action_id)
  const finding = action?.finding_id ? data.finding.find((f) => f.finding_id === action.finding_id) : undefined
  return (
    <li>
      <FollowChip status={fu.followup_status} />
      <p className="fu-text">{action?.action_text ?? fu.action_id}</p>
      <p className="muted small">
        {S.review.owner}: {S.owner[fu.assigned_role]} · {S.review.opened}: {formatDay(fu.opened_at_utc)}
        {fu.next_review_due_utc ? ` · ${S.review.due}: ${formatDay(fu.next_review_due_utc)}` : ''}
      </p>
      {finding && <Why finding={finding} />}
    </li>
  )
}

/** FR-REV-04: the data ids, values and rule behind a finding or step. */
function Why({ finding }: { finding: Finding }) {
  const idx = useRecordIndex()
  const data = useDataSet()
  return (
    <details className="why">
      <summary>{S.review.why}</summary>
      <div className="why-body">
        <p><strong>{S.review.rule}:</strong> {finding.rule_id} · v{finding.rule_version}</p>
        <p>{finding.explanation}</p>
        <p className="muted small"><strong>{S.review.limitations}:</strong> {finding.limitations}</p>
        {finding.supporting_record_ids.length > 0 && (
          <>
            <p className="why-sub">{S.review.supporting}</p>
            <ul className="why-list">
              {finding.supporting_record_ids.map((id) => {
                const r = idx.get(id)
                if (!r) return <li key={id}><code>{id}</code></li>
                const d = describeRecord(r)
                const st = r.entity === 'personal_reference' ? null : infoStatusOf(data, id)
                return (
                  <li key={id}>
                    <span className="rec-label">{d.label}</span>
                    <span>{d.value}</span>
                    <span className="muted small">{d.date}</span>
                    {st && <DataBadge status={st.status} reasons={st.reasons} compact />}
                    <code className="rec-id">{id}</code>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}
