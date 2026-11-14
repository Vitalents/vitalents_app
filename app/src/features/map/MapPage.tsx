// Today & map (UI-01): body map plus an accessible list of the seven areas.
// Each area carries three separate labels: follow-up, data status and the plan for today (FR-MAP-05).
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { S } from '../../content/strings'
import { dueFromView } from '../../engine/due'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useDomainViews, useReviewDate, useSubject } from '../../store/selectors'
import { BodyMap } from './BodyMap'
import { DueMark } from './DueMark'
import { M } from './strings'
import './map.css'

/** FR-MAP-07: sample areas say "Sample data" in the same dashed tag the data badge uses. */
function SampleTag() {
  return <span className="chip data data-sample">{M.sampleData}</span>
}

export function MapPage() {
  const views = useDomainViews()
  const date = useReviewDate()
  const subject = useSubject()
  const due = useMemo(() => new Map(views.map((v) => [v.content.id, dueFromView(v, date)])), [views, date])
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{subject?.crew_label}</p>
        <h1>{S.map.title}</h1>
        <p className="muted">{S.map.subtitle}</p>
      </header>
      <div className="map-grid">
        <section className="card map-card" aria-label={S.map.figureLabel}>
          <BodyMap views={views} due={due} />
          <div className="legend">
            <p className="legend-title">{S.map.legendTitle}</p>
            <p><FollowChip status="watching" compact /> {S.map.legendFollow}</p>
            <p><DataBadge status="limited" compact /> {S.map.legendData}</p>
            <p className="legend-due">
              <span className="legend-due-marks"><DueMark state="due" /><DueMark state="done" /><DueMark state="not_due" /></span>
              {M.legendDue}
            </p>
            <p><SampleTag /> {M.legendSample}</p>
            <p className="muted small">{S.map.legendNote}</p>
          </div>
        </section>
        <ul className="domain-list" aria-label={M.areas}>
          {views.map((v) => (
            <li key={v.content.id}>
              <Link to={`/domain/${v.content.id}`} className={`domain-row follow-${v.followStatus}`}>
                <span className="domain-top">
                  <span className="domain-name">{v.content.name}</span>
                  <DueMark state={due.get(v.content.id) ?? null} />
                </span>
                <span className="domain-chips">
                  <FollowChip status={v.followStatus} />
                  {v.dataStatus === null ? (
                    <SampleTag />
                  ) : (
                    <DataBadge status={v.dataStatus} reasons={v.indicators.flatMap((i) => (i.counts ? i.reasons : []))} />
                  )}
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
