// Indicator card (UI-02, FR-MAP-06): Now / Understand / Act.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { domainById, LIBRARY } from '../../content/content'
import { describeRecord, formatNumber, formatValue, reasonText, sourceTitle } from '../../content/format'
import { S } from '../../content/strings'
import { addDays, formatDay } from '../../engine/mission'
import type { DomainView, IndicatorView } from '../../engine/view'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useDataSet, useDomainViews, useReviewDate } from '../../store/selectors'

type Tab = 'now' | 'understand' | 'act'

export function DomainPage() {
  const { id = '' } = useParams()
  const content = domainById(id)
  const view = useDomainViews().find((v) => v.content.id === id)
  const [tab, setTab] = useState<Tab>('now')
  if (!content || !view) {
    return (
      <div className="page">
        <p>{S.domain.notFound}</p>
        <Link to="/">{S.domain.back}</Link>
      </div>
    )
  }
  return (
    <div className="page">
      <Link to="/" className="back">‹ {S.domain.back}</Link>
      <header className="page-head">
        <h1>{content.name}</h1>
        <div className="domain-chips">
          <FollowChip status={view.followStatus} />
          <DataBadge status={view.dataStatus} reasons={view.indicators.flatMap((i) => (i.counts ? i.reasons : []))} />
        </div>
      </header>
      <div className="tabs" role="tablist" aria-label={content.name}>
        {(['now', 'understand', 'act'] as Tab[]).map((t) => (
          <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>
            {S.domain.tabs[t]}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'now' && <NowTab view={view} />}
        {tab === 'understand' && <UnderstandTab view={view} />}
        {tab === 'act' && <ActTab view={view} />}
      </section>
    </div>
  )
}

function NowTab({ view }: { view: DomainView }) {
  if (!view.content.live || view.indicators.length === 0) return <p className="card pad muted">{S.sampleNote}</p>
  const sideBySide = view.content.id === 'cognition' && view.indicators.length > 1
  return (
    <>
      <div className={sideBySide ? 'ind-grid two' : 'ind-grid'}>
        {view.indicators.map((ind) => <IndicatorCard key={ind.content.id} ind={ind} />)}
      </div>
      {sideBySide && <p className="muted small note-line">{S.domain.sideBySide}</p>}
    </>
  )
}

function IndicatorCard({ ind }: { ind: IndicatorView }) {
  const shown = ind.today ?? ind.latest
  const d = shown ? describeRecord(shown) : null
  return (
    <article className="card ind">
      <header className="ind-head">
        <h2>{ind.content.name}</h2>
        <DataBadge status={ind.today ? ind.status : 'no_reading'} reasons={ind.reasons} compact />
      </header>
      {ind.today && d ? (
        <p className="ind-value">{d.value}</p>
      ) : (
        <>
          <p className="ind-value none">{shown ? S.domain.noReadingToday : S.domain.nothingYet}</p>
          {shown && d && <p className="muted">{S.domain.lastReading(d.value, formatDay(shown.date))}</p>}
        </>
      )}
      {ind.today && ind.reasons.length > 0 && <p className="muted small">{reasonText(ind.reasons)}</p>}
      {shown && d && (
        <dl className="facts">
          <div><dt>{S.domain.recorded}</dt><dd>{formatDay(shown.date)}</dd></div>
          {d.source && <div><dt>{S.domain.source}</dt><dd>{d.source}</dd></div>}
        </dl>
      )}
      {ind.reference && <ReferenceBlock ind={ind} />}
      {ind.content.frequency === 'daily' && <History ind={ind} />}
    </article>
  )
}

function ReferenceBlock({ ind }: { ind: IndicatorView }) {
  const r = ind.reference!
  const c = ind.comparison
  const range = r.range_low != null && r.range_high != null ? `${formatNumber(r.range_low)}–${formatNumber(r.range_high)}` : '—'
  return (
    <div className="ref">
      <h3>{S.domain.reference}</h3>
      {c && c.position !== 'not_comparable' && (
        <p className={`position pos-${c.position}`}>
          {S.position[c.position]} ({range})
          {c.absolute_change !== null && (
            <span className="muted"> · {formatValue(ind.value, ind.content.unit)} vs {formatNumber(r.reference_value)} ({c.absolute_change > 0 ? '+' : ''}{formatNumber(c.absolute_change)})</span>
          )}
        </p>
      )}
      <dl className="facts">
        <div><dt>{S.review.status}</dt><dd>{S.refStatus[r.reference_status]}</dd></div>
        <div><dt>Value</dt><dd>{r.reference_value === null ? '—' : S.domain.referenceValue(formatNumber(r.reference_value), formatNumber(r.range_low ?? null), formatNumber(r.range_high ?? null))}</dd></div>
        <div><dt>Data</dt><dd>{S.domain.referenceWindow(r.valid_record_count, formatDay(r.start_date), formatDay(r.end_date))}</dd></div>
        <div><dt>{S.domain.referenceMethod}</dt><dd>{r.method}</dd></div>
        <div><dt>{S.domain.frozen}</dt><dd>{r.frozen ? r.freeze_reason ?? S.domain.frozen : S.domain.notFrozen}</dd></div>
      </dl>
      {r.eligibility_notes && <p className="muted small">{r.eligibility_notes}</p>}
    </div>
  )
}

/** Last 7 days as separate bars: a gap stays a visible gap, never a line drawn across it. */
function History({ ind }: { ind: IndicatorView }) {
  const today = useReviewDate()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const byDate = new Map(ind.history.map((h) => [h.date, h]))
  const values = ind.history.filter((h) => h.value !== null).map((h) => h.value as number)
  // Bars start at zero so small differences are not exaggerated.
  const top = Math.max(1e-6, ...values, ind.reference?.range_high ?? 0)
  const scale = (v: number) => 4 + (Math.max(0, v) / top) * 80
  return (
    <div className="history">
      <h3>{S.domain.last7}</h3>
      <ol className="bars">
        {days.map((day) => {
          const h = byDate.get(day)
          const label = h && h.value !== null ? formatValue(h.value, ind.content.unit) : S.domain.gap
          return (
            <li key={day} aria-label={`${formatDay(day)}: ${label}${h && h.status !== 'valid' ? `, ${S.info[h.status]}` : ''}`}>
              <span className="bar-track">
                {h && h.value !== null ? (
                  <span className={`bar ${h.status !== 'valid' ? 'bar-problem' : ''}`} style={{ height: `${scale(h.value)}%` }} />
                ) : (
                  <span className="bar-gap" aria-hidden="true">–</span>
                )}
              </span>
              <span className="bar-val" aria-hidden="true">{h && h.value !== null ? formatNumber(h.value) : ''}</span>
              <span className="bar-day" aria-hidden="true">{day.slice(8)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function UnderstandTab({ view }: { view: DomainView }) {
  const c = view.content
  return (
    <div className="stack">
      <section className="card pad">
        <h2>{S.domain.why}</h2>
        <p>{c.why_space}</p>
        <h3>{S.domain.limits}</h3>
        <p>{c.limits_note}</p>
        <dl className="facts">
          <div><dt>{S.domain.hazard}</dt><dd>{c.hazard}</dd></div>
          <div><dt>{S.domain.risk}</dt><dd>{c.risk}</dd></div>
        </dl>
      </section>
      <section className="card pad">
        <h2>{S.domain.sources}</h2>
        <ul className="sources">
          {c.sources.map((id) => {
            const s = LIBRARY.get(id)
            return (
              <li key={id}>
                {s?.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : <span>{s?.title ?? id}</span>}
                {s && <span className="muted"> · {s.publisher}</span>}
              </li>
            )
          })}
        </ul>
      </section>
      <p className="card pad muted">{S.domain.askLater}</p>
    </div>
  )
}

function ActTab({ view }: { view: DomainView }) {
  const data = useDataSet()
  const c = view.content
  return (
    <div className="stack">
      <section className="card pad">
        <h2>{S.domain.howToMeasure}</h2>
        <p>{c.how_to_measure}</p>
        <h3>{S.domain.whenSpecialist}</h3>
        <p>{c.when_to_involve_specialist}</p>
      </section>
      <section className="card pad">
        <h2>{S.domain.openFollowUps}</h2>
        {view.followUps.length === 0 ? (
          <p className="muted">{S.domain.noFollowUps}</p>
        ) : (
          <ul className="fu-list">
            {view.followUps.map((f) => {
              const a = data.action.find((x) => x.action_id === f.action_id)
              return (
                <li key={f.follow_up_id}>
                  <FollowChip status={f.followup_status} compact />
                  <p className="fu-text">{a?.action_text ?? f.action_id}</p>
                  <p className="muted small">
                    {S.domain.owner}: {S.owner[f.assigned_role]} · {S.review.sourceLabel}: {sourceTitle(a?.source_reference_id)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
