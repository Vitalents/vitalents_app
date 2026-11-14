// FR-RT-01 research track (route /research, off the main navigation): a transparent per-person model on
// simulated data, its evaluation against the personal-median baseline, its inputs and limits.
// Labelled "Research prototype on simulated data"; it feeds no step, alert, finding or reference.
import { useEffect, useState } from 'react'
import { formatNumber } from '../../content/format'
import { formatDay } from '../../engine/mission'
import { useSubject } from '../../store/selectors'
import { HeldOutChart } from './HeldOutChart'
import { loadResearchModel, type LoadResult } from './load'
import { R } from './strings'
import type { CheckKey, Evaluation, ResearchModel } from './types'
import './research.css'

const CHECKS: CheckKey[] = ['leave_one_day_out', 'forward_only']

export function ResearchPage() {
  const subject = useSubject()
  const sid = subject?.subject_profile_id ?? null
  const [res, setRes] = useState<{ sid: string | null; result: LoadResult } | null>(null)
  useEffect(() => {
    let live = true
    loadResearchModel(sid).then((result) => live && setRes({ sid, result }))
    return () => { live = false }
  }, [sid])
  const result = res && res.sid === sid ? res.result : null

  return (
    <div className="page rs-page">
      <p className="rs-label" role="note">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.5h4M6.75 1.5v4.2L2.6 12.9A1.1 1.1 0 0 0 3.55 14.5h8.9a1.1 1.1 0 0 0 .95-1.6L9.25 5.7V1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
        {R.label}
      </p>
      <header className="page-head">
        <p className="kicker">{R.kicker}</p>
        <h1>{R.title}</h1>
        <p className="rs-lead">{R.lead}</p>
        <p className="muted small">{R.never}{subject?.crew_label && <> {R.crew(subject.crew_label)}.</>}</p>
      </header>
      {!result ? (
        <p className="muted" role="status">{R.loading}</p>
      ) : result.state === 'ok' ? (
        <ModelView model={result.model} />
      ) : (
        <p className="card rs-empty">{result.state === 'missing' ? R.missing : R.failed}</p>
      )}
    </div>
  )
}

function ModelView({ model: m }: { model: ResearchModel }) {
  const [check, setCheck] = useState<CheckKey>('leave_one_day_out')
  const ev = m.evaluation[check]
  return (
    <>
      <section className="card rs-verdict" aria-labelledby="rs-verdict-h">
        <h2 id="rs-verdict-h">{R.verdictTitle}</h2>
        <p className={`rs-verdict-text rs-v-${m.verdict}`}>{R.verdict[m.verdict]}</p>
        <div className="rs-checks">
          {CHECKS.map((k) => <CheckSummary key={k} name={R.check[k]} ev={m.evaluation[k]} />)}
        </div>

        {ev && ev.days.length > 0 && (
          <div className="rs-days">
            <div className="rs-days-head">
              <h3>{R.chartTitle}</h3>
              <div className="rs-switch" role="group" aria-label={R.checkSwitch}>
                {CHECKS.map((k) => (
                  <button key={k} type="button" className="rs-switch-btn" aria-pressed={check === k} onClick={() => setCheck(k)} disabled={!m.evaluation[k]?.days.length}>
                    {R.check[k]}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted small">{ev.method}</p>
            <figure className="rs-figure" aria-label={R.chartLabel(R.check[check])}>
              <HeldOutChart days={ev.days} label={R.chartLabel(R.check[check])} />
              <Legend />
            </figure>
            <DaysTable ev={ev} name={R.check[check]} />
          </div>
        )}
      </section>

      <div className="rs-grid">
        <section className="card rs-section" aria-labelledby="rs-inputs-h">
          <h2 id="rs-inputs-h">{R.inputsTitle}</h2>
          <p className="muted small">{R.inputsNote}</p>
          <ul className="rs-inputs">
            {m.inputs.map((inp) => {
              const c = m.fit?.coefficients.find((x) => x.input === inp.key)
              return (
                <li key={inp.key}>
                  <p className="rs-input-name">{inp.label} <span className="muted">({inp.unit})</span></p>
                  {c?.used && c.per_unit !== null && c.per_unit_sd !== null ? (
                    <p className="num">{R.slope(`${c.per_unit > 0 ? '+' : c.per_unit < 0 ? '−' : ''}${formatNumber(Math.abs(c.per_unit))}`, formatNumber(c.per_unit_sd), R.unitWord[inp.unit] ?? inp.unit)}</p>
                  ) : (
                    <p className="muted">{c?.note}</p>
                  )}
                  <p className="muted small">{R.sourceField} <code>{inp.source}</code></p>
                </li>
              )
            })}
          </ul>
          <p className="small">{R.rowsUsed(m.rows_used.length)}</p>
          {m.excluded.length > 0 && (
            <div className="small">
              <p>{R.leftOut(m.excluded.length)}</p>
              <ul className="rs-excluded">
                {m.excluded.map((e) => <li key={e.record_id}>{formatDay(e.date)}: {e.reason} <code className="rec-id">{e.record_id}</code></li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="card rs-section" aria-labelledby="rs-how-h">
          <h2 id="rs-how-h">{R.howTitle}</h2>
          <dl className="rs-how">
            <dt>{R.howModel}</dt><dd>{m.model.name}. {m.model.settings}</dd>
            <dt>{R.howRange}</dt><dd>{m.model.range}</dd>
            <dt>{R.howBaseline}</dt><dd>{m.model.baseline}</dd>
            <dt>{R.howChecks}</dt><dd>{CHECKS.map((k) => m.evaluation[k]?.method).filter(Boolean).join(' ')}</dd>
            <dt>{R.howVerdict}</dt><dd>{m.verdict_rule}</dd>
          </dl>
        </section>
      </div>

      <section className="card rs-section rs-limits" aria-labelledby="rs-limits-h">
        <h2 id="rs-limits-h">{R.limitsTitle}</h2>
        <ul>{m.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="rs-validation">{R.validation}</p>
        <p className="muted small">{R.file(m.source_file, m.model_version)} · <code>sha256 {m.source_sha256.slice(0, 12)}</code></p>
      </section>
    </>
  )
}

function CheckSummary({ name, ev }: { name: string; ev: Evaluation | null }) {
  const s = ev?.summary
  if (!ev || !s) return null
  return (
    <div className="rs-check">
      <h3>{name} <span className="muted rs-n">· {R.heldOut(ev.held_out_days)}</span></h3>
      <p className="rs-check-label">{R.avgMiss}</p>
      <div className="rs-pair">
        <p><span className="rs-pair-k">{R.model}</span><span className="rs-pair-v num">{R.missUnit(formatNumber(s.model_mae, 2))}</span></p>
        <p><span className="rs-pair-k">{R.baseline}</span><span className="rs-pair-v num">{R.missUnit(formatNumber(s.baseline_mae, 2))}</span></p>
      </div>
      <p className="small">{R.closer(s.model_closer_days, s.baseline_closer_days, s.tied_days)}</p>
      <p className="small muted">{R.inRange(s.model_in_range_days, s.baseline_in_range_days, ev.held_out_days, formatNumber(s.model_mean_range_width), formatNumber(s.baseline_mean_range_width))}</p>
    </div>
  )
}

function Legend() {
  return (
    <ul className="rs-legend">
      <li><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="var(--ink)" stroke="var(--card)" strokeWidth="2" /></svg>{R.legend.actual}</li>
      <li><svg width="14" height="16" aria-hidden="true"><rect x="2" y="1" width="10" height="14" rx="3" fill="var(--tint)" stroke="var(--deep)" /></svg>{R.legend.range}</li>
      <li><svg width="22" height="12" aria-hidden="true"><line x1="1" y1="6" x2="21" y2="6" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4" /></svg>{R.legend.baseline}</li>
    </ul>
  )
}

function DaysTable({ ev, name }: { ev: Evaluation; name: string }) {
  return (
    <details className="why rs-table">
      <summary>{R.table.summary}</summary>
      <div className="why-body">
        <table className="why-table">
          <caption>{R.table.caption(name)}</caption>
          <thead>
            <tr><th scope="col">{R.table.day}</th><th scope="col">{R.table.inputs}</th><th scope="col">{R.table.actual}</th><th scope="col">{R.table.model}</th><th scope="col">{R.table.baseline}</th></tr>
          </thead>
          <tbody>
            {ev.days.map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date)}<code className="rec-id">{d.record_ids[0]}</code></td>
                <td>{R.tip.inputs(formatNumber(d.sleep_h), d.alertness)}</td>
                <td className="num">{formatNumber(d.actual, 0)}</td>
                <td className="num">{formatNumber(d.model.low)}–{formatNumber(d.model.high)}</td>
                <td className="num">{formatNumber(d.baseline.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
