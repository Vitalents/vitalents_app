// Tonight's rest window: compare schedule alternatives and send one to the planner (FR-SCH-01..05). Mount on /rest-window.
import { useMemo, useState } from 'react'
import type { Action, MissionSchedule } from '../../data/contract'
import { restOpportunity, scheduleInputFor, type ScheduleItemInput } from '../../engine/schedule'
import { useStore } from '../../store/store'
import { Emblem } from '../../shell/Logo'
import { fmtMinutes, hm, T } from '../followups/strings'
import { describeChange, plannerRequest } from './request'
import { Timeline } from './Timeline'
import '../followups/act.css'

export interface RestWindowPageProps {
  /** Mission day of tonight's schedule (UTC date). Defaults to S1 day 27. */
  day?: string
  /** Override the schedule (dev page and tests); otherwise read from the store. */
  schedule?: MissionSchedule[]
  now?: () => string
  backHref?: string | null
}

export function RestWindowPage({ day = '2026-11-14', schedule, now = () => new Date().toISOString(), backHref = '/plan' }: RestWindowPageProps) {
  const stored = useStore((s) => s.data.mission_schedule)
  const actions = useStore((s) => s.data.action)
  const put = useStore((s) => s.put)
  const records = schedule ?? stored
  const [error, setError] = useState<string | null>(null)

  const { input, result, items } = useMemo(() => {
    const input = scheduleInputFor(records, day)
    return { input, result: restOpportunity(input), items: records.filter((r) => r.mission_day === day && r.item_kind === 'task') }
  }, [records, day])

  const after: ScheduleItemInput[] = input.items.map((it) => {
    const c = result.changes.find((x) => x.item_id === it.item_id)
    return c ? { ...it, start: c.new_start, end: c.new_end } : it
  })
  const moved = new Set(result.changes.map((c) => c.item_id))
  const existing: Action | undefined = actions.find(
    (a) => a.owner_role === 'planner' && result.changes.some((c) => a.source_reference_id === c.item_id && a.scheduled_for_utc === c.new_start),
  )

  async function request() {
    setError(null)
    try {
      await put('action', [plannerRequest(result.changes, records, result.current_minutes as number, result.best_minutes as number, now())])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const win = input.rest_window
  return (
    <div className="act">
      {backHref && <a className="act-link" href={backHref}>Back to Plan & follow-ups</a>}
      <header className="act-head">
        <p className="kicker">{T.restEyebrow}</p>
        <h1>{T.restTitle}</h1>
        <p className="act-muted">{T.restLead}</p>
      </header>

      {result.status === 'not_computable' || !win ? (
        <div className="act-card" style={{ justifyItems: 'start' }}>
          <Emblem size={80} />
          <h2>{T.noWindow}</h2>
          <p className="act-muted">{T.noWindowLead}</p>
        </div>
      ) : (
        <div className="act-rest">
          <div className="act-rest-main">
            {result.status === 'improved' ? (
              <div className="act-pair" role="group" aria-label="Rest opportunity, now and with the change">
                <div><span className="label">{T.now}</span><span className="value">{fmtMinutes(result.current_minutes)}</span><span className="unit">{T.restUnit}</span></div>
                <div><span className="label">{T.withChange}</span><span className="value">{fmtMinutes(result.best_minutes)}</span><span className="unit">{T.restUnit}</span></div>
              </div>
            ) : (
              <div className="act-card act-notice" role="status">
                <h2>{T.noAlt}</h2>
                <p className="act-muted">{T.noAltLead}</p>
                <p><span className="act-muted">{T.now}: </span><strong className="act-num">{fmtMinutes(result.current_minutes)}</strong> {T.restUnit}</p>
              </div>
            )}

            <Timeline
              window={win}
              caption={`Rest window ${hm(win.start as string)}–${hm(win.end as string)} UTC, ${result.status === 'improved' ? 'now and with the change' : 'now'}`}
              lanes={result.status === 'improved'
                ? [{ label: T.now, items: input.items }, { label: T.withChange, items: after, movedIds: moved }]
                : [{ label: T.now, items: input.items }]}
            />
          </div>

          <aside className="act-rest-side">
            {result.status === 'improved' && (
              <section className="act-card" aria-labelledby="rw-change">
                <h2 id="rw-change">{T.change}</h2>
                {result.changes.map((c) => {
                  const item = items.find((i) => i.mission_schedule_id === c.item_id)
                  return item ? <p key={c.item_id}>{describeChange(c, item)}.</p> : null
                })}
                <dl className="act-facts" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div><dt>{T.approver}</dt><dd>{T.planner}</dd></div>
                  <div><dt>{T.source}</dt><dd>{T.scheduleSource}</dd></div>
                </dl>
                {existing ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <span className="act-sync" role="status">{T.requested}</span>
                    <div className="callout">
                      <p className="act-small" style={{ fontWeight: 600 }}>{T.plannerSees}</p>
                      <p>{existing.action_text}</p>
                      <p className="act-small act-muted">{existing.reason_text}</p>
                    </div>
                  </div>
                ) : (
                  <button className="btn primary" onClick={request}>{T.request}</button>
                )}
                {error && <p className="act-error" role="alert">{error}</p>}
              </section>
            )}

            <section className="act-card" aria-labelledby="rw-cons">
              <h2 id="rw-cons">{T.constraints}</h2>
              <ul className="act-constraints">
                <li>
                  <span className="name">{T.restWindow}</span>
                  <span className="time">{hm(win.start as string)}–{hm(win.end as string)}</span>
                </li>
                {items.map((it) => {
                  const pre = (it.prep_minutes ?? 0) + (it.travel_minutes ?? 0)
                  return (
                    <li key={it.mission_schedule_id}>
                      <span className="name">{it.activity_label}</span>
                      <span className="time">{hm(it.start_at)}–{hm(it.end_at)}</span>
                      <span className="rule">
                        {it.is_fixed ? <span className="act-tag fixed">{T.fixed}</span>
                          : it.movable_earliest_start && it.movable_latest_end
                            ? <span className="act-tag">{T.movable(hm(it.movable_earliest_start), hm(it.movable_latest_end))}</span>
                            : <span className="act-tag fixed">{T.fixed}</span>}
                        {pre > 0 && T.prep(pre)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="act-small act-muted">All times {T.utc}. The comparison tries 15-minute steps and never moves a fixed task or its preparation.</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
