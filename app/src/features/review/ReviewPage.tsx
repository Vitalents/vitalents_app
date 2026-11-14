// Today's review (UI-05): Recorded / Changed / Missing / Next step, then other open follow-ups.
// FR-REV-01/03/04/05: every finding and step explains itself; no score or verdict anywhere.
// The next step is the focal card; the page header links straight to it.
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
        {view.nextStep && (
          <a href="#block-4" className="jump">
            <span className="jump-label">{S.review.next}:</span> {view.nextStep.action_text}
          </a>
        )}
      </header>

      <div className="review-grid">
        <Block title={S.review.recorded} n={1} area="recorded">
          {view.recorded.length === 0 ? (
            <p className="muted">{S.review.noneRecorded}</p>
          ) : (
            <ul className="rec-list">
              {view.recorded.map(({ record, status, reasons }) => {
                const d = describeRecord(record)
                return (
                  <li key={record.id}>
                    <span className="rec-label">{d.label}</span>
                    <span className="rec-value num">{d.value}</span>
                    <DataBadge status={status} reasons={reasons} compact />
                    {reasons.length > 0 && <span className="rec-reason muted small">{reasonText(reasons)}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </Block>

        <Block title={S.review.changed} n={2} area="changed">
          {view.changed.length === 0 ? (
            <p className="muted">{S.review.noneChanged}</p>
          ) : (
            view.changed.map((f) => (
              <div key={f.finding_id} className="finding">
                <p>{f.explanation}</p>
                <p className="muted small">{f.limitations}</p>
                <Why finding={f} repeatText={false} />
              </div>
            ))
          )}
        </Block>

        <Block title={S.review.missing} n={3} area="missing">
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

        <Block title={S.review.next} n={4} area="next" highlight>
          {view.nextStep ? <ActionCard action={view.nextStep} finding={nextFinding} /> : <p className="muted">{S.review.noneNext}</p>}
        </Block>
      </div>

      <section className="card pad other" aria-labelledby="other-title">
        <h2 id="other-title">{S.review.other}</h2>
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

function Block({ title, n, area, highlight, children }: { title: string; n: number; area: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card pad block block-${area} ${highlight ? 'highlight' : ''}`} aria-labelledby={`block-${n}`}>
      <h2 id={`block-${n}`} tabIndex={-1}><span className="num-badge" aria-hidden="true">{String(n).padStart(2, '0')}</span>{title}</h2>
      {children}
    </section>
  )
}

function ActionCard({ action, finding }: { action: Action; finding?: Finding }) {
  return (
    <div className="action">
      <p className="action-kind">{S.stepCategory[action.step_category]}</p>
      <p className="action-text">{action.action_text}</p>
      <p className="action-reason">{action.reason_text}</p>
      <dl className="facts action-facts">
        <div><dt>{S.review.owner}</dt><dd>{S.owner[action.owner_role]}</dd></div>
        <div><dt>{S.review.status}</dt><dd>{S.actionStatus[action.execution_status]}</dd></div>
        {action.follow_up_due_utc && <div><dt>{S.review.due}</dt><dd className="num">{formatDay(action.follow_up_due_utc)}</dd></div>}
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
      <p className="muted small num">
        {S.review.owner}: {S.owner[fu.assigned_role]} · {S.review.opened}: {formatDay(fu.opened_at_utc)}
        {fu.next_review_due_utc ? ` · ${S.review.due}: ${formatDay(fu.next_review_due_utc)}` : ''}
      </p>
      {finding && <Why finding={finding} />}
    </li>
  )
}

/**
 * FR-REV-04: the data behind a finding or step. DESIGN.md order: a compact table of supporting
 * records (what, value, date, data status, record id), then rule id + version, explanation, limits.
 * `repeatText` is false where the explanation is already printed just above the disclosure.
 */
function Why({ finding, repeatText = true }: { finding: Finding; repeatText?: boolean }) {
  const idx = useRecordIndex()
  const data = useDataSet()
  return (
    <details className="why">
      <summary>{S.review.why}</summary>
      <div className="why-body">
        {finding.supporting_record_ids.length > 0 && (
          <table className="why-table">
            <caption>{S.review.supporting}</caption>
            <thead>
              <tr>
                <th scope="col">{S.review.colWhat}</th>
                <th scope="col">{S.review.colValue}</th>
                <th scope="col">{S.review.colDate}</th>
                <th scope="col">{S.review.colData}</th>
              </tr>
            </thead>
            <tbody>
              {finding.supporting_record_ids.map((id) => {
                const r = idx.get(id)
                if (!r) return <tr key={id}><td colSpan={4}><code>{id}</code></td></tr>
                const d = describeRecord(r)
                const st = r.entity === 'personal_reference' ? null : infoStatusOf(data, id)
                return (
                  <tr key={id}>
                    <td data-label={S.review.colWhat}>{d.label}<code className="rec-id">{id}</code></td>
                    <td data-label={S.review.colValue} className="num">{d.value}</td>
                    <td data-label={S.review.colDate} className="num">{d.date}</td>
                    <td data-label={S.review.colData}>{st ? <DataBadge status={st.status} reasons={st.reasons} compact /> : <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="why-rule"><span className="why-k">{S.review.rule}</span> <code>{finding.rule_id}</code> · v{finding.rule_version}</p>
        {repeatText && <p>{finding.explanation}</p>}
        <p className="muted small"><span className="why-k">{S.review.limitations}</span> {finding.limitations}</p>
      </div>
    </details>
  )
}
