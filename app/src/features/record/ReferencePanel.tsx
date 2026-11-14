// FR-REF-07 reference panel "Your reference and what the system relies on", with the FR-REF-03 version history
// and the FR-REF-04 frozen label. Every value comes from personal_reference records; nothing is computed here.
import { Link } from 'react-router-dom'
import { formatNumber, formatValue } from '../../content/format'
import { S } from '../../content/strings'
import type { DomainId } from '../../content/content'
import type { FollowUp, PersonalReference } from '../../data/contract'
import { formatDay, formatTime } from '../../engine/mission'
import { referenceChangeLog, type ChangeLogEntry, type TrendPoint } from '../../engine/trends'
import { FollowChip } from '../../shell/StatusChips'
import { useRecordIndex } from '../../store/selectors'
import { T } from './strings'
import { WhyRecords } from './WhyRecords'

interface Props {
  reference: PersonalReference | null
  versions: PersonalReference[]
  followUps: FollowUp[]
  excluded: TrendPoint[]
  domainId: DomainId
  limitsNote: string
  unit: string | null
  headingId: string
}

export function ReferencePanel({ reference: r, versions, followUps, excluded, domainId, limitsNote, unit, headingId }: Props) {
  return (
    <aside className="tr-ref" aria-labelledby={headingId}>
      <h4 id={headingId} className="tr-ref-title">{T.ref.title}</h4>
      {!r ? (
        <>
          <p className="muted">{T.ref.none}</p>
          <p className="tr-limits"><span className="why-k">{T.ref.limits}</span> {limitsNote}</p>
          {versions.length > 0 && (
            <details className="why tr-reference-details">
              <summary>{T.ref.details}</summary>
              <VersionHistory versions={versions} unit={unit} />
            </details>
          )}
        </>
      ) : (
        <>
          {r.frozen ? <Frozen reference={r} followUps={followUps} /> : <p className="tr-updating muted small">{T.ref.updating}</p>}
          <dl className="facts tr-facts">
            <div><dt>{T.ref.status}</dt><dd>{S.refStatus[r.reference_status] ?? r.reference_status}</dd></div>
            <div><dt>{T.ref.value}</dt><dd className="num">{r.reference_value === null ? S.refStatus.not_built : formatValue(r.reference_value, unit)}</dd></div>
            <div><dt>{T.ref.range}</dt><dd className="num">{r.range_low == null || r.range_high == null ? '—' : `${formatNumber(r.range_low)}–${formatNumber(r.range_high)}`}</dd></div>
            <div><dt>{T.ref.data}</dt><dd>{T.ref.dataValue(r.valid_record_count)}</dd></div>
          </dl>
          <div className="tr-limits">
            <p><span className="why-k">{T.ref.limits}</span> {limitsNote}</p>
            {r.eligibility_notes && <p className="muted small">{r.eligibility_notes}</p>}
          </div>
          <details className="why tr-reference-details">
            <summary>{T.ref.details}</summary>
            <dl className="facts tr-facts">
            <div><dt>{T.ref.period}</dt><dd>{T.ref.periodValue(formatDay(r.start_date), formatDay(r.end_date))}</dd></div>
            <div><dt>{T.ref.method}</dt><dd>{r.method}</dd></div>
            <div><dt>{T.ref.version}</dt><dd><code className="tr-code">{r.reference_version}</code></dd></div>
            <div><dt>{T.ref.lastChange}</dt><dd>{formatDay(r.created_at_utc)}, {formatTime(r.created_at_utc)}</dd></div>
            {r.comparison_target_date && <div><dt>{T.ref.target}</dt><dd>{formatDay(r.comparison_target_date)}</dd></div>}
            <div><dt>{T.ref.approvedBy}</dt><dd>{r.approved_by_role ? S.owner[r.approved_by_role] ?? r.approved_by_role : T.ref.notApproved}</dd></div>
          </dl>
          <WhyRecords ids={r.source_record_ids} caption={T.whyRef} summary={`${T.why} ${T.ref.usedList} (${r.source_record_ids.length})`}>
            <SourceLinks ids={r.source_record_ids} domainId={domainId} />
            {excluded.length > 0 && (
              <>
                <p className="why-k">{T.ref.excludedList}</p>
                <ul className="tr-excluded">
                  {excluded.map((p) => (
                    <li key={p.id}>
                      {formatDay(p.date)} · {formatValue(p.value, unit)} · {p.status === 'valid' ? T.ref.excludedByMethod : S.info[p.status]}
                      <code className="rec-id">{p.id}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </WhyRecords>
          <p className="muted small">{T.ref.rule}</p>
          <VersionHistory versions={versions} unit={unit} />
          </details>
        </>
      )}
    </aside>
  )
}

function Frozen({ reference: r, followUps }: { reference: PersonalReference; followUps: FollowUp[] }) {
  return (
    <div className="tr-frozen" role="note">
      <p className="tr-frozen-label">
        <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false">
          <rect x="2.2" y="5.2" width="7.6" height="5.6" rx="1" fill="currentColor" />
          <path d="M3.8 5.2V3.8a2.2 2.2 0 0 1 4.4 0v1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {followUps.length ? T.ref.frozen : T.ref.frozenNoFollowUp}
      </p>
      {followUps.length > 0 && (
        <ul className="tr-frozen-fus">
          {followUps.map((f) => (
            <li key={f.follow_up_id}>
              <FollowChip status={f.followup_status} />
              <span className="small muted">{T.ref.followOwner(S.owner[f.assigned_role] ?? f.assigned_role)}</span>
              <Link to="/plan" className="tr-inline-link">{T.ref.openPlan}</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="small">{r.freeze_reason ?? T.ref.frozenNote}</p>
      {r.freeze_reason && <p className="small muted">{T.ref.frozenNote}</p>}
    </div>
  )
}

function SourceLinks({ ids, domainId }: { ids: string[]; domainId: DomainId }) {
  const idx = useRecordIndex()
  return (
    <ul className="tr-sources" aria-label={T.ref.usedList}>
      {ids.map((id) => {
        const rec = idx.get(id)
        const label = rec ? formatDay(rec.date) : id
        return (
          <li key={id}>
            <Link to={`/domain/${rec?.domain ?? domainId}`} aria-label={T.ref.openRecord(label)}>{label}</Link>
          </li>
        )
      })}
    </ul>
  )
}

function VersionHistory({ versions, unit }: { versions: PersonalReference[]; unit: string | null }) {
  const log = referenceChangeLog(versions)
  const first = versions[0]
  const current = versions[versions.length - 1]
  return (
    <section className="tr-log">
      <h5 className="tr-log-title">{T.log.title}</h5>
      {log.length === 0 && <p className="muted small">{T.log.empty}</p>}
      {(log.length > 0 || first) && (
        <ol className="tr-log-list">
          {log.map((e) => <LogEntry key={e.to.personal_reference_id} entry={e} unit={unit} current={e.to === current} />)}
          {first && (
            <li>
              <p className="tr-log-head">
                {T.log.first(first.reference_version, formatDay(first.created_at_utc))}
                {first === current && <span className="tr-current"> · {T.log.current}</span>}
              </p>
              <code className="rec-id">{first.personal_reference_id}</code>
            </li>
          )}
        </ol>
      )}
    </section>
  )
}

function show(v: string | number | boolean | null, unit: string | null): string {
  if (v === null) return '—'
  if (typeof v === 'boolean') return v ? T.log.yes : T.log.no
  if (typeof v === 'number') return unit === 'count' || unit === 'bpm' || unit === 'h' ? formatNumber(v) : String(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDay(v) : S.refStatus[v] ?? v
}

function LogEntry({ entry: e, unit, current }: { entry: ChangeLogEntry; unit: string | null; current: boolean }) {
  return (
    <li>
      <p className="tr-log-head">
        {T.log.entry(e.from.reference_version, e.to.reference_version)} · {formatDay(e.at)}
        {current && <span className="tr-current"> · {T.log.current}</span>}
      </p>
      <ul className="tr-log-changes">
        {e.changes.map((c) => <li key={c.field}>{T.log.field[c.field]}: {show(c.before, unit)} → {show(c.after, unit)}</li>)}
        {e.addedRecords.length > 0 && <li>{T.log.added(e.addedRecords.length)}</li>}
        {e.removedRecords.length > 0 && <li>{T.log.removed(e.removedRecords.length)}</li>}
        {e.changes.length === 0 && e.addedRecords.length === 0 && e.removedRecords.length === 0 && <li>{T.log.nothingElse}</li>}
      </ul>
      {e.to.freeze_reason && <p className="muted small">{e.to.freeze_reason}</p>}
      <code className="rec-id">{e.to.personal_reference_id}</code>
    </li>
  )
}
