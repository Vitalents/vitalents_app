// Record & trends (UI-07) with the reference screen per indicator (UI-06): FR-REF-03, FR-REF-04, FR-REF-07.
// Follow-up status and data status stay separate labels (CLAUDE.md rule 2); the self-rating and Decode stay separate cards.
import { PatternCard } from '../research/PatternCard'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DOMAINS } from '../../content/content'
import { describeRecord, formatNumber, formatValue, reasonText } from '../../content/format'
import { S } from '../../content/strings'
import { formatDay } from '../../engine/mission'
import { buildTrend, excludedFromReference, openFollowUpsForReference, referenceVersions, summarizeTrend, type TrendPoint } from '../../engine/trends'
import { infoStatusOf, type DomainView, type IndicatorView } from '../../engine/view'
import { DataBadge, FollowChip } from '../../shell/StatusChips'
import { useDataSet, useDomainViews, useRecordIndex, useReviewDate } from '../../store/selectors'
import { T } from './strings'
import { TrendChart } from './TrendChart'
import { ReferencePanel } from './ReferencePanel'
import type { FollowUp, PersonalReference } from '../../data/contract'
import { WhyRecords } from './WhyRecords'
import './record.css'

export function RecordPage() {
  const views = useDomainViews()
  const live = views.filter((v) => v.content.live && v.indicators.length > 0)
  const sample = DOMAINS.filter((d) => !d.live).map((d) => d.name)
  return (
    <div className="page tr-page">
      <header className="page-head">
        <p className="kicker">{T.kicker}</p>
        <h1>{T.title}</h1>
        <p className="muted">{T.lead}</p>
      </header>
      <PatternCard />
      <nav className="tr-jump" aria-label={T.jumpLabel}>
        <ul>
          {live.flatMap((v) => v.indicators.map((i) => (
            <li key={i.content.id}><a href={`#trend-${i.content.id}`}>{i.content.name}</a></li>
          )))}
        </ul>
      </nav>
      {live.map((v) => <DomainSection key={v.content.id} view={v} />)}
      {sample.length > 0 && <p className="muted small tr-sample">{T.sampleDomains(sample.join(', '))}</p>}
    </div>
  )
}

function DomainSection({ view }: { view: DomainView }) {
  const headId = `dom-${view.content.id}`
  const sideBySide = view.content.id === 'cognition' && view.indicators.length > 1
  return (
    <section className="tr-domain" aria-labelledby={headId}>
      <header className="tr-domain-head">
        <h2 id={headId}><Link to={`/domain/${view.content.id}`}>{view.content.name}</Link></h2>
        <FollowChip status={view.followStatus} />
      </header>
      {sideBySide && <p className="muted small tr-side">{S.domain.sideBySide}</p>}
      <div className="tr-cards">
        {view.indicators.map((ind) => <IndicatorTrend key={ind.content.id} ind={ind} view={view} />)}
      </div>
    </section>
  )
}

function IndicatorTrend({ ind, view }: { ind: IndicatorView; view: DomainView }) {
  const data = useDataSet()
  const date = useReviewDate()
  const c = ind.content
  const ref = ind.reference
  const points = useMemo(() => buildTrend(ind.history, { to: date, daily: c.frequency === 'daily', reference: ref }), [ind.history, date, c.frequency, ref])
  const versions = useMemo(() => referenceVersions(data.personal_reference, c.id), [data.personal_reference, c.id])
  const followUps = useMemo(() => (ref ? openFollowUpsForReference(data, ref) : []), [data, ref])
  const summary = summarizeTrend(points)
  const numeric = c.unit !== null
  const anchor = `trend-${c.id}`
  const latestStatus = summary.latest?.status ?? 'no_reading'
  const latestReasons = summary.latest?.id ? infoStatusOf(data, summary.latest.id).reasons : []

  return (
    <article className="card tr-card" id={anchor} aria-labelledby={`${anchor}-h`}>
      <div className="tr-main">
        <header className="tr-head">
          <h3 id={`${anchor}-h`}>{c.name}</h3>
          {numeric && <DataBadge status={latestStatus} reasons={latestReasons} />}
        </header>
        {points.length === 0 ? (
          <p className="muted">{T.noData}</p>
        ) : numeric ? (
          <>
            <Stats ind={ind} points={points} />
            <figure className="tr-figure" aria-label={T.chartLabel(c.name)}>
              <TrendChart points={points} reference={ref} unit={c.unit} name={c.name} />
              <Legend hasRef={!!ref && ref.reference_value !== null} hasProblem={summary.problem > 0} hasGap={summary.noReading > 0} />
              <figcaption className="muted small">{T.counts(summary.valid, summary.problem, summary.noReading)} · {T.chartHint}</figcaption>
            </figure>
            <ValueTable points={points} name={c.name} unit={c.unit} />
          </>
        ) : (
          <TextEntries points={points} />
        )}
      </div>
      {numeric && (
        <ReferencePanelSlot ind={ind} points={points} versions={versions} followUps={followUps} view={view} />
      )}
    </article>
  )
}

function ReferencePanelSlot({ ind, points, versions, followUps, view }: { ind: IndicatorView; points: TrendPoint[]; versions: PersonalReference[]; followUps: FollowUp[]; view: DomainView }) {
  const ref = ind.reference
  return (
    <ReferencePanel
      reference={ref} versions={versions} followUps={followUps}
      excluded={ref ? excludedFromReference(points, ref) : []}
      domainId={view.content.id} limitsNote={view.content.limits_note} unit={ind.content.unit}
      headingId={`ref-${ind.content.id}`}
    />
  )
}

function Stats({ ind, points }: { ind: IndicatorView; points: TrendPoint[] }) {
  const s = summarizeTrend(points)
  const last = s.latestWithValue
  const ref = ind.reference
  const c = last?.comparison ?? null
  const unit = ind.content.unit
  const noCompare = !ref
    ? T.noComparisonWhy.noRef
    : ref.reference_status !== 'usable_for_question'
      ? T.noComparisonWhy.notUsable
      : last && last.kind !== 'valid'
        ? T.noComparisonWhy.notValid
        : T.noComparisonWhy.inPeriod
  const latestGap = s.latest && s.latest.kind === 'no_reading' && s.latest !== last ? s.latest : null
  return (
    <div className="tr-stats">
      <div className="tr-stat">
        <p className="tr-stat-label">{T.latest}</p>
        {last ? (
          <>
            <p className="tr-stat-value num">{formatValue(last.value, unit)}</p>
            <p className="tr-stat-sub muted">
              {T.latestOn(formatDay(last.date))}
              {last.kind !== 'valid' && <> · {S.info[last.status]}</>}
            </p>
          </>
        ) : (
          <p className="tr-stat-value none">{T.noValueYet}</p>
        )}
        {latestGap && <p className="tr-stat-sub muted">{T.noReading}: {formatDay(latestGap.date)}</p>}
        {last?.id && <WhyRecords ids={[last.id]} caption={T.whyLatest} />}
      </div>
      <div className="tr-stat">
        <p className="tr-stat-label">{T.changeFromRef}</p>
        {c && c.absolute_change !== null && ref ? (
          <>
            <p className="tr-stat-value num">{c.absolute_change > 0 ? '+' : c.absolute_change < 0 ? '−' : ''}{formatValue(Math.abs(c.absolute_change), unit)}</p>
            <p className="tr-stat-sub">
              <span className={`tr-pos tr-pos-${c.position}`}>{S.position[c.position]}</span>
              <span className="muted"> · {formatNumber(last!.value)} vs {formatNumber(ref.reference_value)} ({formatNumber(ref.range_low ?? null)}–{formatNumber(ref.range_high ?? null)})</span>
            </p>
            <WhyRecords ids={[last!.id!, ref.personal_reference_id]} caption={T.whyChange}>
              <p><span className="why-k">{T.whyMethod}</span> {ref.method}</p>
            </WhyRecords>
          </>
        ) : (
          <>
            <p className="tr-stat-value none">{T.noComparison}</p>
            <p className="tr-stat-sub muted">{noCompare}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Legend({ hasRef, hasProblem, hasGap }: { hasRef: boolean; hasProblem: boolean; hasGap: boolean }) {
  return (
    <ul className="tr-legend">
      <li><svg width="22" height="12" aria-hidden="true"><line x1="1" y1="6" x2="21" y2="6" stroke="var(--deep)" strokeWidth="2" /><circle cx="11" cy="6" r="4" fill="var(--deep)" stroke="var(--card)" strokeWidth="1.5" /></svg>{T.legend.valid}</li>
      {hasRef && <li><svg width="22" height="12" aria-hidden="true"><rect x="1" y="1" width="20" height="10" rx="2" fill="var(--tint)" /></svg>{T.legend.band}</li>}
      {hasRef && <li><svg width="22" height="12" aria-hidden="true"><line x1="1" y1="6" x2="21" y2="6" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="5 3" /></svg>{T.legend.median}</li>}
      {hasProblem && (
        <li>
          <svg width="22" height="14" aria-hidden="true">
            <defs><pattern id="tr-legend-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="var(--card)" /><line x1="0" y1="0" x2="0" y2="3" stroke="var(--data-hatch)" strokeWidth="1.3" /></pattern></defs>
            <path d="M11 1L17 7L11 13L5 7Z" fill="url(#tr-legend-hatch)" stroke="var(--data-hatch)" strokeWidth="1.3" />
          </svg>
          {T.legend.problem}
        </li>
      )}
      {hasGap && <li><svg width="22" height="14" aria-hidden="true"><line x1="11" y1="0" x2="11" y2="14" stroke="var(--data-hatch)" strokeWidth="1.3" strokeDasharray="2 3" /></svg>{T.legend.noReading}</li>}
    </ul>
  )
}

/** Text alternative for the chart: every point, its data status and its change from the reference. */
function ValueTable({ points, name, unit }: { points: TrendPoint[]; name: string; unit: string | null }) {
  const data = useDataSet()
  return (
    <details className="why tr-table">
      <summary>{T.table.summary}</summary>
      <div className="why-body">
        <table className="why-table">
          <caption>{T.table.caption(name)}</caption>
          <thead>
            <tr>
              <th scope="col">{T.table.date}</th><th scope="col">{T.table.value}</th><th scope="col">{T.table.status}</th><th scope="col">{T.table.reference}</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p, i) => {
              const reasons = p.id ? infoStatusOf(data, p.id).reasons : []
              const ref = p.comparison && p.comparison.absolute_change !== null
                ? `${p.comparison.absolute_change > 0 ? '+' : ''}${formatNumber(p.comparison.absolute_change)} · ${S.position[p.comparison.position]}`
                : p.inReference ? T.table.usedInRef : T.table.notCompared
              return (
                <tr key={p.id ?? `gap-${p.date}-${i}`}>
                  <td>{formatDay(p.date)}{p.id ? <code className="rec-id">{p.id}</code> : <span className="rec-id muted">{T.table.noRecord}</span>}</td>
                  <td className="num">{p.value === null ? T.noReading : formatValue(p.value, unit)}</td>
                  <td>{S.info[p.status]}{reasons.length > 0 && <span className="muted"> ({reasonText(reasons)})</span>}</td>
                  <td>{ref}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function TextEntries({ points }: { points: TrendPoint[] }) {
  const idx = useRecordIndex()
  const entries = [...points].reverse().filter((p) => p.id)
  return (
    <div className="tr-entries">
      <p className="muted small">{T.textEntriesNote}</p>
      <ul className="tr-entry-list" aria-label={T.textEntries}>
        {entries.map((p) => {
          const r = idx.get(p.id!)
          const d = r ? describeRecord(r) : null
          return (
            <li key={p.id}>
              <span className="tr-entry-date">{formatDay(p.date)}</span>
              <span className="tr-entry-text">{d?.value ?? '—'}</span>
              <WhyRecords ids={[p.id!]} caption={T.whyLatest} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
