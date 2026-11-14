// Today & map (UI-01): body map plus an accessible list of the seven areas.
import { Link } from 'react-router-dom'
import { S } from '../../content/strings'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useDomainViews, useSubject } from '../../store/selectors'
import { BodyMap } from './BodyMap'

export function MapPage() {
  const views = useDomainViews()
  const subject = useSubject()
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{subject?.crew_label}</p>
        <h1>{S.map.title}</h1>
        <p className="muted">{S.map.subtitle}</p>
      </header>
      <div className="map-grid">
        <section className="card map-card" aria-label="Body map">
          <BodyMap views={views} />
          <div className="legend">
            <p className="legend-title">{S.map.legendTitle}</p>
            <p><FollowChip status="watching" compact /> {S.map.legendFollow}</p>
            <p><DataBadge status="limited" compact /> {S.map.legendData}</p>
            <p className="muted small">{S.map.legendNote}</p>
          </div>
        </section>
        <ul className="domain-list" aria-label="Areas">
          {views.map((v) => (
            <li key={v.content.id}>
              <Link to={`/domain/${v.content.id}`} className={`domain-row follow-${v.followStatus}`} aria-label={S.map.openCard(v.content.name)}>
                <span className="domain-name">{v.content.name}</span>
                <span className="domain-chips">
                  <FollowChip status={v.followStatus} />
                  <DataBadge status={v.dataStatus} reasons={v.indicators.flatMap((i) => (i.counts ? i.reasons : []))} />
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
