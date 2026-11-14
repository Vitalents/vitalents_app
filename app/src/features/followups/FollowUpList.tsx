// Plan & follow-ups list (SRS 5.7). Mount on /plan (or inside PlanPage). Reads and writes through the store.
import { useMemo } from 'react'
import type { Action, FollowUp } from '../../data/contract'
import { useStore } from '../../store/store'
import { filterData } from '../../store/permissions'
import { useRole } from '../../store/role'
import { Emblem } from '../../shell/Logo'
import { ActionCard, type ActionWrites } from './ActionCard'
import { laterReading, readingsSince } from './later'
import { reviewDue, visibleTo, type Role } from './records'
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

export function FollowUpList({ role: roleProp, scheduleHref = '/rest-window', now, embedded = false }: FollowUpListProps) {
  const activeRole = useRole((s) => s.role)
  // A dev preview may narrow the visible role, but never impersonate a more privileged active role.
  const role = roleProp ?? activeRole
  const raw = useStore((s) => s.data)
  const subjectId = raw.subject_profile[0]?.subject_profile_id ?? ''
  const data = useMemo(() => filterData(role, filterData(activeRole, raw, { subjectId }), { subjectId }), [activeRole, role, raw, subjectId])
  const putMany = useStore((s) => s.putMany)

  const { open, earlier, fuOf } = useMemo(() => {
    const fuOf = new Map<string, FollowUp>()
    for (const f of [...data.follow_up].sort((x, y) => x.opened_at_utc.localeCompare(y.opened_at_utc))) fuOf.set(f.action_id, f)
    const t = (now ?? (() => new Date().toISOString()))()
    const dueFirst = (a: Action) => (reviewDue(a, fuOf.get(a.action_id) ?? null, t) ? 0 : 1)
    const latestReview = [...data.daily_review].sort((x, y) => x.review_date.localeCompare(y.review_date)
      || Date.parse(x.created_at_utc) - Date.parse(y.created_at_utc)).at(-1)
    const currentFindings = new Set(latestReview?.finding_ids ?? [])
    const list = visibleTo(data.action, role).filter((a) =>
      // A changed review can replace an untouched proposal, but never erase a step the owner acted on.
      a.execution_status !== 'proposed' || fuOf.has(a.action_id) || !a.finding_id || !latestReview
      || currentFindings.has(a.finding_id) || latestReview.selected_action_id === a.action_id).sort((x, y) =>
      dueFirst(x) - dueFirst(y) || ORDER[x.execution_status] - ORDER[y.execution_status] || KIND[x.step_category] - KIND[y.step_category]
      || (fuOf.get(x.action_id)?.next_review_due_utc ?? x.follow_up_due_utc ?? '').localeCompare(fuOf.get(y.action_id)?.next_review_due_utc ?? y.follow_up_due_utc ?? ''))
    // an open follow-up keeps its step in Open until the owner closes it (FR-FU-04/06), whatever the step's status
    const isOpen = (a: Action) => {
      const f = fuOf.get(a.action_id)
      return f ? f.followup_status !== 'closed' : !['rejected', 'completed', 'unable'].includes(a.execution_status)
    }
    return { open: list.filter(isOpen), earlier: list.filter((a) => !isOpen(a)), fuOf }
  }, [data.action, data.follow_up, data.daily_review, role, now])

  const opensSchedule = (a: Action) => {
    const f = data.finding.find((x) => x.finding_id === a.finding_id)
    return f?.rule_id.endsWith('R-PLAN-01') ? scheduleHref : null
  }

  async function onWrite(w: ActionWrites) {
    await putMany({
      ...(w.action ? { action: [w.action] } : {}),
      ...(w.follow_up ? { follow_up: [w.follow_up] } : {}),
      ...(w.feedback_entry ? { feedback_entry: [w.feedback_entry] } : {}),
    })
  }

  const card = (a: Action) => (
    <li key={a.action_id}>
      <ActionCard
        action={a}
        followUp={fuOf.get(a.action_id) ?? null}
        role={activeRole}
        laterReading={(x, after, until) => laterReading(data, x, after, until)}
        readingsSince={(x, since, until) => readingsSince(data, x, since, until)}
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
