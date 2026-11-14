// Plan & follow-ups list (SRS 5.7). Mount on /plan (or inside PlanPage). Reads and writes through the store.
import { useMemo } from 'react'
import type { Action, FollowUp } from '../../data/contract'
import { useStore } from '../../store/store'
import { Emblem } from '../../shell/Logo'
import { ActionCard, type ActionWrites } from './ActionCard'
import { laterReading } from './later'
import { visibleTo, type Role } from './records'
import { T } from './strings'
import './act.css'

const ORDER: Record<Action['execution_status'], number> = {
  proposed: 1, accepted: 2, in_progress: 2, deferred: 3, awaiting_impact_review: 4, completed: 5, unable: 5, rejected: 6,
}
const KIND: Record<Action['step_category'], number> = { request_review: 0, approved_plan_step: 1, complete_measurement: 2, observe: 3 }

export interface FollowUpListProps {
  role?: Role
  /** Where "Compare schedule options" goes (FR-SCH-01). */
  scheduleHref?: string
  now?: () => string
  /** Hide the page heading when embedded in another page. */
  embedded?: boolean
}

export function FollowUpList({ role = 'astronaut', scheduleHref = '/rest-window', now, embedded = false }: FollowUpListProps) {
  const data = useStore((s) => s.data)
  const put = useStore((s) => s.put)

  const { open, earlier, fuOf } = useMemo(() => {
    const fuOf = new Map<string, FollowUp>()
    for (const f of [...data.follow_up].sort((x, y) => x.opened_at_utc.localeCompare(y.opened_at_utc))) fuOf.set(f.action_id, f)
    const list = visibleTo(data.action, role).sort((x, y) =>
      ORDER[x.execution_status] - ORDER[y.execution_status] || KIND[x.step_category] - KIND[y.step_category]
      || (fuOf.get(x.action_id)?.next_review_due_utc ?? x.follow_up_due_utc ?? '').localeCompare(fuOf.get(y.action_id)?.next_review_due_utc ?? y.follow_up_due_utc ?? ''))
    const isOpen = (a: Action) => fuOf.get(a.action_id)?.followup_status !== 'closed' && !['rejected', 'completed', 'unable'].includes(a.execution_status)
    return { open: list.filter(isOpen), earlier: list.filter((a) => !isOpen(a)), fuOf }
  }, [data.action, data.follow_up, role])

  const opensSchedule = (a: Action) => {
    const f = data.finding.find((x) => x.finding_id === a.finding_id)
    return f?.rule_id.endsWith('R-PLAN-01') ? scheduleHref : null
  }

  async function onWrite(w: ActionWrites) {
    if (w.action) await put('action', [w.action])
    if (w.follow_up) await put('follow_up', [w.follow_up])
    if (w.feedback_entry) await put('feedback_entry', [w.feedback_entry])
  }

  const card = (a: Action) => (
    <li key={a.action_id}>
      <ActionCard
        action={a}
        followUp={fuOf.get(a.action_id) ?? null}
        role={role}
        laterReading={(x, after) => laterReading(data, x, after)}
        onWrite={onWrite}
        scheduleHref={role === 'astronaut' ? opensSchedule(a) : null}
        now={now}
      />
    </li>
  )

  return (
    <div className="act">
      {!embedded && (
        <header className="act-head">
          {role === 'planner' && <p className="kicker">{T.ownerLabel.planner}</p>}
          <h1>{T.followTitle}</h1>
          <p className="act-muted">{role === 'planner' ? T.plannerLead : T.followLead}</p>
        </header>
      )}
      <section className="act-section" aria-label={T.sectionOpen}>
        {open.length ? <ul className="act-list">{open.map(card)}</ul> : (
          <div className="act-card" style={{ justifyItems: 'center', textAlign: 'center', padding: 32 }}>
            <Emblem size={88} />
            <p style={{ fontWeight: 600 }}>{T.emptyOpen}</p>
          </div>
        )}
      </section>
      {earlier.length > 0 && (
        <section className="act-section">
          <h2>{T.sectionEarlier}</h2>
          <ul className="act-list">{earlier.map(card)}</ul>
        </section>
      )}
    </div>
  )
}
