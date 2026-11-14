// Plan & follow-ups (UI-08, read-only in Increment 1).
import { sourceTitle } from '../../content/format'
import { S } from '../../content/strings'
import { formatDay } from '../../engine/mission'
import { FOLLOW_RANK } from '../../engine/view'
import { FollowChip } from '../../shell/StatusChips'
import { useDataSet } from '../../store/selectors'

export function PlanPage() {
  const data = useDataSet()
  const fus = [...data.follow_up].sort((a, b) => FOLLOW_RANK[b.followup_status] - FOLLOW_RANK[a.followup_status] || b.opened_at_utc.localeCompare(a.opened_at_utc))
  return (
    <div className="page">
      <header className="page-head">
        <h1>{S.plan.title}</h1>
        <p className="muted">{S.plan.subtitle}</p>
      </header>
      {fus.length === 0 ? (
        <p className="card pad muted">{S.plan.none}</p>
      ) : (
        <ul className="plan-list">
          {fus.map((f) => {
            const a = data.action.find((x) => x.action_id === f.action_id)
            return (
              <li key={f.follow_up_id} className="card pad">
                <div className="plan-head">
                  <FollowChip status={f.followup_status} />
                  {a && <span className="muted small">{S.actionStatus[a.execution_status]}</span>}
                </div>
                <p className="fu-text">{a?.action_text ?? f.action_id}</p>
                {a && <p className="muted">{a.reason_text}</p>}
                <dl className="facts">
                  <div><dt>{S.plan.owner}</dt><dd>{S.owner[f.assigned_role]}</dd></div>
                  <div><dt>{S.plan.opened}</dt><dd>{formatDay(f.opened_at_utc)}</dd></div>
                  {f.next_review_due_utc && <div><dt>{S.plan.due}</dt><dd>{formatDay(f.next_review_due_utc)}</dd></div>}
                  {a && <div><dt>{S.review.sourceLabel}</dt><dd>{sourceTitle(a.source_reference_id)}</dd></div>}
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
