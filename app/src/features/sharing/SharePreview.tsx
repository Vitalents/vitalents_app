// SharePreview (FR-SHR-02): exactly what will be sent, to whom, and what is left out.
import { DataBadge } from '../../shell/StatusChips'
import type { Summary } from './summary'
import { T } from './strings'

export function SummarySections({ summary }: { summary: Summary }) {
  return (
    <div className="sh-sections">
      {summary.sections.map((s) => {
        const limits = [...new Set(s.items.map((i) => i.limits).filter((l): l is string => !!l))]
        return (
          <section key={s.key} className="sh-section" aria-labelledby={`sh-sec-${s.key}`}>
            <h3 id={`sh-sec-${s.key}`}>
              {s.title}
              {s.key !== 'question' && (
                <span className="sh-count">
                  {s.items.length}
                  <span className="sh-sr-only"> {T.share.itemsWord}</span>
                </span>
              )}
            </h3>
            {s.items.length === 0 ? (
              <p className="muted small">{s.key === 'question' ? T.sections.noQuestion : T.sections.none}</p>
            ) : (
              <ul className="sh-items">
                {s.items.map((i) => (
                  <li key={i.id} className={`sh-item${i.date ? '' : ' no-date'}`}>
                    {i.date && <time className="sh-date" dateTime={i.date}>{i.date}</time>}
                    <span className="sh-body">
                      <span className="sh-text">{i.text}</span>
                      {i.dataStatus && <DataBadge status={i.dataStatus} reasons={i.reasons} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {limits.map((l) => (
              <p key={l} className="sh-limits small">{l}</p>
            ))}
          </section>
        )
      })}
    </div>
  )
}

export function SharePreview({
  summary,
  onConfirm,
  busy,
}: {
  summary: Summary
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="sh-preview">
      <section className="card sh-manifest" aria-labelledby="sh-included">
        <header className="sh-manifest-head">
          <h2 id="sh-included">{T.share.includedTitle}</h2>
          <p className="muted small">{T.share.recordCount(summary.previewedRecordIds.length)}</p>
        </header>
        <SummarySections summary={summary} />
      </section>

      <aside className="sh-side">
        <dl className="card sh-to">
          <dt className="kicker">{T.share.to}</dt>
          <dd>{T.share.recipient}</dd>
        </dl>
        <section className="callout sh-excluded" aria-labelledby="sh-excluded">
          <h2 id="sh-excluded" className="sh-excluded-title">{T.share.excludedTitle}</h2>
          <ul>
            {summary.excludedFieldCodes.map((c) => (
              <li key={c}>{T.share.excluded[c] ?? c}</li>
            ))}
          </ul>
          <p className="small">{T.share.plannerNever}</p>
        </section>
        <button type="button" className="btn primary sh-confirm" onClick={onConfirm} disabled={busy || summary.isEmpty}>
          {T.share.confirm}
        </button>
        {summary.isEmpty && <p className="muted small">{T.share.empty}</p>}
      </aside>
    </div>
  )
}
