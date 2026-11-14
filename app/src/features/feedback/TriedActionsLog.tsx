// FR-PE-01 Tried-actions log. Mount on /plan below the follow-up list.
// Reads through the permission layer (useVisibleData → filterData); the planner never receives feedback.
import { describeRecord, sourceTitle } from '../../content/format'
import { S } from '../../content/strings'
import { formatDay } from '../../engine/mission'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useRole } from '../../store/role'
import { useSubject } from '../../store/selectors'
import { useVisibleData } from '../roles/hooks'
import { triedActions, type Afterwards, type TriedEntry } from './records'
import { F } from './strings'
import './feedback.css'

const ratingText = (r: number | null) => (r === 1 ? F.tried.useful : r === 0 ? F.tried.notUseful : F.tried.notRated)

function Reading({ a }: { a: Afterwards }) {
  const d = describeRecord(a.record)
  return (
    <li className="fb-reading">
      <div className="fb-reading-main">
        <span className="fb-reading-what">{d.label}</span>
        <span className="fb-num">{d.value}</span>
        <DataBadge status={a.status} reasons={a.reasons} compact />
      </div>
      <details className="why fb-why">
        <summary>{F.why}</summary>
        <div className="why-body">
          <p><span className="why-k">{F.tried.dataLink}: </span><code>{a.record.id}</code></p>
          <p className="muted">{d.date}{d.source ? `, ${d.source}` : ''}</p>
        </div>
      </details>
    </li>
  )
}

function Entry({ e }: { e: TriedEntry }) {
  const a = e.action
  return (
    <li className="fb-tried">
      <div className="fb-tried-step">
        <p className="fb-kind">{S.stepCategory[a.step_category]}</p>
        <p className="fb-step-text">{a.action_text}</p>
        <div className="fb-chips">
          <span className="fb-status">{F.tried.status}: {S.actionStatus[a.execution_status]}</span>
          {e.followUp && <FollowChip status={e.followUp.followup_status} compact />}
        </div>
        <p className="muted small">{sourceTitle(a.source_reference_id)}</p>
      </div>

      <div className="fb-tried-after">
        <p className="fb-label">
          {F.tried.afterwards}
          <span className="fb-label-sub fb-num">{F.tried.due}: {e.dueUtc ? formatDay(e.dueUtc) : F.tried.notSet}</span>
        </p>
        {e.afterwards.length > 0 ? (
          <ul className="fb-readings">{e.afterwards.map((x) => <Reading key={x.record.id} a={x} />)}</ul>
        ) : (
          <p className="muted small">{e.kinds === 0 ? F.tried.noKinds : F.tried.noReadingYet}</p>
        )}
        {e.followUp?.outcome_note && (
          <p className="fb-outcome small"><span className="fb-label">{F.tried.outcome}</span>{e.followUp.outcome_note}</p>
        )}
      </div>

      <div className="fb-tried-rating">
        <p className="fb-label">{F.tried.rating}</p>
        <p className={e.rating === null ? 'muted' : 'fb-rated'}>{ratingText(e.rating)}</p>
      </div>
    </li>
  )
}

export function TriedActionsLog({ subjectId }: { subjectId?: string }) {
  const role = useRole((s) => s.role)
  const fallback = useSubject()?.subject_profile_id ?? ''
  const data = useVisibleData(subjectId ?? fallback)
  if (role === 'planner') return null // the data layer gives the planner no feedback; nothing to show
  const entries = triedActions(data)

  return (
    <section className="fb fb-log card" aria-labelledby="fb-tried-h">
      <header className="fb-head">
        <h2 id="fb-tried-h">{F.tried.title}</h2>
        <p className="muted">{F.tried.lede}</p>
      </header>
      {entries.length === 0 ? (
        <p className="muted">{F.tried.empty}</p>
      ) : (
        <ul className="fb-tried-list">{entries.map((e) => <Entry key={e.action.action_id} e={e} />)}</ul>
      )}
      <p className="fb-foot small muted">{F.neverChanges}</p>
    </section>
  )
}
