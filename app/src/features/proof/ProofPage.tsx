// Proof screen (route /proof, Increment 6): how the software was checked and what the checks wrote.
// FR-SIM-04 (validation numbers), FR-AS-08 (assistant evaluation), NFR-11 (golden vectors in the TS engine).
// Every figure is read from proof.json (scripts/publish_proof.py) or computed by running contracts/vectors/ here.
import './proof.css'
import { useEffect, useMemo, useState } from 'react'
import { AREA_IDS, PROOF_FILE, loadProof, type AreaId, type ModelEval, type Proof, type ProofCheck, type SectionStatus } from './proofData'
import { runAllVectors, type VectorResult } from './vectors'
import { P, utcTime } from './strings'

interface Props {
  /** Pass a parsed proof (tests, dev entry) or null for "no file"; leave undefined to fetch /data/proof.json. */
  proof?: Proof | null
  vectors?: VectorResult[]
}

export function ProofPage({ proof: given, vectors: givenVectors }: Props) {
  const [fetched, setFetched] = useState<Proof | null | undefined>(undefined)
  useEffect(() => {
    if (given !== undefined) return
    let live = true
    loadProof().then((p) => live && setFetched(p))
    return () => { live = false }
  }, [given])
  const proof = given !== undefined ? given : fetched
  const vectors = useMemo(() => givenVectors ?? runAllVectors(), [givenVectors])

  return (
    <div className="page pf-page">
      <header className="page-head">
        <p className="eyebrow">{P.kicker}</p>
        <h1>{P.title}</h1>
        <p className="muted">{P.lede}</p>
      </header>

      {proof === undefined ? (
        <p className="muted" role="status">{P.loading}</p>
      ) : (
        <>
          <SourceIndex proof={proof} vectors={vectors} />
          <Methods />
          <section className="pf-section" aria-labelledby="pf-results">
            <h2 id="pf-results">{P.resultsTitle}</h2>
            <p className="muted pf-lede">{P.resultsLede}</p>
            <ValidationResults proof={proof} />
            <EvalResults proof={proof} />
            <VectorResults vectors={vectors} />
          </section>
          <Limits />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- provenance index
function StatusTag({ status }: { status: SectionStatus | 'partial' }) {
  const cls = status === 'generated' ? 'pf-tag pf-tag-ok' : 'pf-tag data chip'
  return <span className={cls}>{status === 'generated' ? '✓ ' : ''}{P.status[status]}</span>
}

function SourceIndex({ proof, vectors }: { proof: Proof | null; vectors: VectorResult[] }) {
  const v = proof?.validation
  const a = proof?.assistant_eval
  const reproduced = vectors.filter((r) => r.outcome === 'reproduced').length
  const rows: { file: string; status: SectionStatus | 'partial'; when: string }[] = [
    { file: v?.source ?? 'science/out/validation.json', status: v?.status ?? 'not_generated', when: v?.source_generated_at_utc ? utcTime(v.source_generated_at_utc) : '' },
    {
      file: a?.source_pattern ?? 'science/out/assistant_eval*.json',
      status: a?.status ?? 'not_generated',
      when: a?.models?.length ? a.models.map((m) => utcTime(m.source_modified_at_utc)).join(' · ') : '',
    },
  ]
  return (
    <section className="pf-index card" aria-label={P.indexLabel}>
      <p className="pf-index-head small muted">
        {proof ? P.published(proof.generated_by, utcTime(proof.generated_at_utc)) : P.noProofFile}
        <span className="pf-file"> {PROOF_FILE}</span>
      </p>
      <ul className="pf-index-list">
        {rows.map((r) => (
          <li key={r.file}>
            <code className="pf-path">{r.file}</code>
            <StatusTag status={r.status} />
            <span className="small muted pf-when">{r.when}</span>
          </li>
        ))}
        <li>
          <code className="pf-path">contracts/vectors/</code>
          <span className={vectors.length && reproduced === vectors.length ? 'pf-tag pf-tag-ok' : 'pf-tag data chip'}>
            {vectors.length && reproduced === vectors.length ? '✓ ' : ''}{P.ofCount(reproduced, vectors.length)}
          </span>
          <span className="small muted pf-when">{P.vectorsIndex}</span>
        </li>
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------- 1. how it was checked
function Methods() {
  return (
    <section className="pf-section" aria-labelledby="pf-how">
      <h2 id="pf-how">{P.howTitle}</h2>
      <p className="muted pf-lede">{P.howLede}</p>
      <dl className="pf-methods card">
        {P.methods.map((m) => (
          <div key={m.id} className="pf-method">
            <dt>{m.title}</dt>
            <dd>
              <p>{m.how}</p>
              <p className="small muted">{P.where} <code className="pf-path">{m.file}</code></p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---------------------------------------------------------------- 2/3. results or "not generated yet"
function NotGenerated({ file, status, commands, problems }: { file: string; status: SectionStatus; commands: string[]; problems: string[] }) {
  return (
    <div className="pf-empty">
      <StatusTag status={status} />
      <p>{status === 'invalid' ? P.invalidBody(file) : P.notGeneratedBody(file)}</p>
      <p className="small muted pf-cmd-label">{P.howToGenerate}</p>
      <pre className="pf-cmd">{commands.join('\n')}</pre>
      <Problems problems={problems} />
    </div>
  )
}

function Problems({ problems }: { problems: string[] }) {
  if (!problems.length) return null
  return (
    <details className="why">
      <summary>{P.problemsTitle(problems.length)}</summary>
      <ul className="why-body pf-problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
    </details>
  )
}

/** Shows a number as written in the file; rates (0–1) as a percentage that never rounds to 0 % or 100 % falsely. */
export function formatCheckValue(c: Pick<ProofCheck, 'value' | 'unit'>): string {
  const v = c.value
  if (v === null) return P.noValue
  if (c.unit === 'rate') {
    const pct = v * 100
    let s = pct.toFixed(1)
    if ((s === '100.0' && v < 1) || (s === '0.0' && v > 0)) s = pct.toFixed(3)
    return `${s.replace(/\.0+$/, '')} %`
  }
  const n = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)))
  if (!c.unit || c.unit === 'count') return n
  return `${n} ${c.unit}`
}

export function formatCount(c: Pick<ProofCheck, 'numerator' | 'denominator'>): string {
  if (c.numerator !== null && c.denominator !== null) return P.ofCount(c.numerator, c.denominator)
  if (c.denominator !== null) return P.outOf(c.denominator)
  return P.noCount
}

function ValidationResults({ proof }: { proof: Proof | null }) {
  const v = proof?.validation
  const file = v?.source ?? 'science/out/validation.json'
  if (!v || v.status !== 'generated' || !v.areas) {
    return (
      <article className="card pf-card">
        <h3>{P.validationTitle}</h3>
        <NotGenerated file={file} status={v?.status ?? 'not_generated'} commands={P.validationCommands} problems={v?.problems ?? []} />
      </article>
    )
  }
  const written = utcTime(v.source_generated_at_utc)
  return (
    <>
      <p className="small muted pf-meta">
        {P.sourceLine(file, written)}
        {v.source_generated_by && <> · {P.writtenBy(v.source_generated_by)}</>}
        {v.seed !== null && <> · {P.seed} {v.seed}</>}
      </p>
      {AREA_IDS.map((id) => {
        const area = v.areas![id]
        if (id === 'knowledge_assistant' && !area) return null
        return <AreaCard key={id} id={id} checks={area?.checks ?? null} file={file} written={written} />
      })}
      {v.illustrative_parameters && v.illustrative_parameters.length > 0 && (
        <article className="card pf-card">
          <h3>{P.illustrativeTitle}</h3>
          <p className="small muted">{P.illustrativeNote}</p>
          <ul className="pf-chips">{v.illustrative_parameters.map((p) => <li key={p}><code className="pf-path">{p}</code></li>)}</ul>
        </article>
      )}
      <Problems problems={v.problems} />
    </>
  )
}

function AreaCard({ id, checks, file, written }: { id: AreaId; checks: ProofCheck[] | null; file: string; written: string }) {
  return (
    <article className="card pf-card">
      <h3>{P.area[id]}</h3>
      {!checks || checks.length === 0 ? (
        <div className="pf-empty">
          <StatusTag status="not_generated" />
          <p className="muted">{P.areaEmpty}</p>
        </div>
      ) : (
        <table className="pf-table">
          <thead>
            <tr><th scope="col">{P.col.check}</th><th scope="col">{P.col.result}</th><th scope="col">{P.col.count}</th><th scope="col">{P.col.source}</th></tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <th scope="row" data-label={P.col.check}>
                  <span className="pf-check">{c.label}</span>
                  {c.method && <span className="small muted pf-method-note">{c.method}</span>}
                  {c.scenario && <span className="small muted pf-method-note">{P.scenario(c.scenario)}</span>}
                </th>
                <td data-label={P.col.result} className="pf-num">
                  <span className={c.value === null ? 'muted' : 'pf-value'}>{formatCheckValue(c)}</span>
                  {c.passed !== null && <span className="pf-pass">{c.passed ? `✓ ${P.passed.yes}` : `✕ ${P.passed.no}`}</span>}
                </td>
                <td data-label={P.col.count} className="pf-num">{formatCount(c)}</td>
                <td data-label={P.col.source} className="small muted pf-src">
                  <code className="pf-path">{file}</code>
                  <span>{written}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  )
}

// ---------------------------------------------------------------- assistant evaluation (meter list)
function Meter({ label, of, n, d }: { label: string; of: string; n: number | null; d: number | null }) {
  const hasBar = n !== null && d !== null && d > 0
  const pct = hasBar ? Math.min(100, (n! / d!) * 100) : 0
  return (
    <li className="pf-meter">
      <span className="pf-meter-name">
        {label}
        <span className="small muted"> {of}</span>
      </span>
      {hasBar ? (
        <span className="pf-meter-track" aria-hidden="true" title={P.ofCount(n!, d!)}>
          <span className="pf-meter-fill" style={{ width: `${pct}%` }} />
        </span>
      ) : <span className="pf-meter-track pf-meter-none" aria-hidden="true" />}
      <span className="pf-meter-fig pf-num">{n !== null && d !== null ? P.ofCount(n, d) : P.noValue}</span>
    </li>
  )
}

function ModelCard({ m }: { m: ModelEval }) {
  return (
    <article className="card pf-card pf-model">
      <h4>{P.evalModel(m.model)}</h4>
      {m.library_version && <p className="small muted">{P.evalLibrary(m.library_version)}</p>}
      <ul className="pf-meters">
        <Meter label={P.evalRows.correct_source.label} of={P.evalRows.correct_source.of} n={m.correct_source} d={m.answerable} />
        <Meter label={P.evalRows.correct_abstention.label} of={P.evalRows.correct_abstention.of} n={m.correct_abstention} d={m.unanswerable} />
        <Meter label={P.evalRows.blocked.label} of={P.evalRows.blocked.of} n={m.blocked} d={m.total} />
      </ul>
      <p className="small muted pf-src-line"><code className="pf-path">{m.source}</code> · {utcTime(m.source_modified_at_utc)}</p>
    </article>
  )
}

function EvalResults({ proof }: { proof: Proof | null }) {
  const a = proof?.assistant_eval
  const models = a?.models ?? []
  return (
    <div className="pf-block">
      <h3 className="pf-block-title">{P.evalTitle}</h3>
      {!a || a.status !== 'generated' || models.length === 0 ? (
        <article className="card pf-card">
          <NotGenerated file={a?.source_pattern ?? 'science/out/assistant_eval*.json'} status={a?.status ?? 'not_generated'} commands={P.evalCommands} problems={a?.problems ?? []} />
        </article>
      ) : (
        <>
          <div className="pf-models">{models.map((m) => <ModelCard key={m.source} m={m} />)}</div>
          <p className="small muted">{P.evalDerived(models[0].derived_by)}</p>
          <Problems problems={a.problems} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- golden vectors
function VectorResults({ vectors }: { vectors: VectorResult[] }) {
  const reproduced = vectors.filter((r) => r.outcome === 'reproduced').length
  return (
    <div className="pf-block">
      <h3 className="pf-block-title">{P.vectorsTitle}</h3>
      <article className="card pf-card">
        {vectors.length === 0 ? (
          <p className="muted">{P.vectorsNone}</p>
        ) : (
          <>
            <p className="pf-vec-sum"><span className="pf-num pf-value">{P.ofCount(reproduced, vectors.length)}</span> {P.vectorsTail}</p>
            <p className="small muted">{P.vectorsSource}</p>
            <details className="why">
              <summary>{P.showVectors}</summary>
              <table className="pf-table pf-vec-table">
                <thead><tr><th scope="col">{P.vectorCol.file}</th><th scope="col">{P.vectorCol.fn}</th><th scope="col">{P.vectorCol.tol}</th><th scope="col">{P.vectorCol.outcome}</th></tr></thead>
                <tbody>
                  {vectors.map((r) => (
                    <tr key={r.path}>
                      <th scope="row" data-label={P.vectorCol.file}><code className="pf-path">{r.path}</code></th>
                      <td data-label={P.vectorCol.fn}><code className="pf-path">{r.fn}</code></td>
                      <td data-label={P.vectorCol.tol} className="pf-num">{r.tolerance}</td>
                      <td data-label={P.vectorCol.outcome}>
                        <span className={r.outcome === 'reproduced' ? 'pf-pass' : 'pf-tag data chip'}>{r.outcome === 'reproduced' ? '✓ ' : ''}{P.outcome[r.outcome]}</span>
                        {r.detail && <span className="small muted pf-method-note">{r.detail}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </article>
    </div>
  )
}

// ---------------------------------------------------------------- 4. limits
function Limits() {
  return (
    <section className="pf-section" aria-labelledby="pf-limits">
      <h2 id="pf-limits">{P.limitsTitle}</h2>
      <div className="callout">
        <ul className="pf-limits">{P.limits.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </section>
  )
}
