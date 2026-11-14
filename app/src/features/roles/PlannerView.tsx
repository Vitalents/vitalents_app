// Planner view (route /planner, FR-SHR-04, FR-SCH-05): schedule items and operational requests only.
// The data layer already removed every health record; this screen cannot show what it never receives.
import '../sharing/share.css'
import { Emblem } from '../../shell/Logo'
import { ACTION_STATUS, T } from '../sharing/strings'
import { useVisibleData } from './hooks'

const hm = (iso: string) => `${iso.slice(11, 16)}Z`

export function PlannerView({ subjectId }: { subjectId: string }) {
  const data = useVisibleData(subjectId)
  const schedule = [...data.mission_schedule].sort((a, b) => a.start_at.localeCompare(b.start_at))
  const requests = data.action.filter((a) => a.owner_role === 'planner')

  return (
    <div className="page sh-page">
      <header className="page-head">
        <p className="eyebrow">{T.roles.planner}</p>
        <h1>{T.planner.title}</h1>
        <p className="muted">{T.planner.lede}</p>
      </header>

      <div className="sh-planner">
        <section className="card pad" aria-labelledby="sh-req">
          <h2 id="sh-req">{T.planner.requests}</h2>
          {requests.length === 0 ? (
            <div className="sh-empty">
              <Emblem size={64} />
              <p className="muted">{T.planner.requestsEmpty}</p>
            </div>
          ) : (
            <ul className="sh-items">
              {requests.map((a) => (
                <li key={a.action_id} className="sh-item">
                  <span className="sh-text">{a.action_text}</span>
                  <span className="chip sh-neutral">{ACTION_STATUS[a.execution_status] ?? a.execution_status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card pad" aria-labelledby="sh-sched">
          <h2 id="sh-sched">{T.planner.schedule}</h2>
          {schedule.length === 0 ? (
            <p className="muted">{T.planner.scheduleEmpty}</p>
          ) : (
            <ol className="sh-schedule">
              {schedule.map((s) => (
                <li key={s.mission_schedule_id} className="sh-slot">
                  <time className="sh-slot-time" dateTime={s.start_at}>
                    {hm(s.start_at)}
                    <span className="muted">{hm(s.end_at)}</span>
                  </time>
                  <div>
                    <p className="sh-slot-label">{s.activity_label}</p>
                    <p className="small muted">
                      <span className="chip sh-neutral">{s.is_fixed ? T.planner.fixed : T.planner.movable}</span>{' '}
                      {!s.is_fixed && s.movable_earliest_start && s.movable_latest_end
                        ? T.planner.movableWindow(hm(s.movable_earliest_start), hm(s.movable_latest_end))
                        : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
