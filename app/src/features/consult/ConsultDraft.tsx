// ConsultDraft (FR-AS-09): "Draft a summary for the medical team". Live mode asks the onboard assistant to word the
// share summary; otherwise (public site, service down, draft blocked) the same five sections are built from the
// record. The astronaut edits the draft before it goes in the package; a number that is not in the record is
// highlighted and blocks sending. The parent decides what to do with `onChange` (see the mount notes).
import './consult.css'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CONSULT_KEYS, allowedNumbers, requestConsult, toConsultInput, type ConsultKey, type ConsultSections, type NumberSpan } from '../../assistant/consult'
import type { AskMode } from '../../assistant/client'
import type { Summary } from '../sharing/summary'
import { checkSections, draftToText, failingSections, liveSections, originLabel, templateSections, type Draft, type DraftOrigin } from './draft'
import { C } from './strings'

export interface ConsultDraftState {
  /** Plain text for the package (share_package.summary_text), titled blocks like the rest of the summary. */
  text: string
  /** False while any section has a number that is not in the record, or is empty. */
  sendable: boolean
  origin: DraftOrigin
}

export interface ConsultDraftProps {
  summary: Summary
  /** Called with the current draft after every change, and with null when there is no draft. */
  onChange?: (state: ConsultDraftState | null) => void
  /** Overrides VITE_ASSISTANT_MODE (tests, dev entry). */
  mode?: AskMode
  fetchImpl?: typeof fetch
}

/** Text with the unsupported numbers wrapped in <mark>, for the layer under the textarea. */
function Marked({ text, spans }: { text: string; spans: NumberSpan[] }) {
  const parts: ReactNode[] = []
  let at = 0
  spans.forEach((s, n) => {
    parts.push(text.slice(at, s.start), <mark key={n}>{text.slice(s.start, s.end)}</mark>)
    at = s.end
  })
  parts.push(text.slice(at), '​') // keeps a trailing empty line the same height as in the textarea
  return <>{parts}</>
}

function SectionField({
  k,
  value,
  spans,
  onEdit,
}: {
  k: ConsultKey
  value: string
  spans: NumberSpan[]
  onEdit: (v: string) => void
}) {
  const id = `cd-${k}`
  const bad = [...new Set(spans.map((s) => s.value))]
  const empty = !value.trim()
  const describedBy = bad.length || empty ? `${id}-issue` : undefined
  return (
    <div className={`cd-section${bad.length ? ' has-issue' : ''}`}>
      <label className="cd-label" htmlFor={id}>{C.sections[k]}</label>
      <div className="cd-field">
        <div className="cd-layer" aria-hidden="true">
          <Marked text={value} spans={spans} />
        </div>
        <textarea
          id={id}
          className="cd-input"
          rows={1}
          spellCheck
          value={value}
          aria-invalid={bad.length > 0 || empty}
          aria-describedby={describedBy}
          onChange={(e) => onEdit(e.target.value)}
        />
      </div>
      {bad.length > 0 && (
        <p id={`${id}-issue`} className="cd-issue small">
          <span aria-hidden="true">▲ </span>
          {C.issue}{' '}
          {bad.map((v, n) => (
            <span key={v}>
              {n > 0 && ', '}
              <mark>{v}</mark>
            </span>
          ))}
          . {C.issueFix}
        </p>
      )}
      {!bad.length && empty && (
        <p id={`${id}-issue`} className="cd-issue small">
          <span aria-hidden="true">▲ </span>
          {C.emptySection}
        </p>
      )}
    </div>
  )
}

export function ConsultDraft({ summary, onChange, mode, fetchImpl }: ConsultDraftProps) {
  const input = useMemo(() => toConsultInput(summary), [summary])
  const basis = useMemo(() => JSON.stringify(input), [input])
  const allowed = useMemo(() => allowedNumbers(input), [input])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [edited, setEdited] = useState<ConsultSections | null>(null)
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState(false)
  const run = useRef(0)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  const check = useMemo(() => (edited ? checkSections(edited, allowed) : null), [edited, allowed])
  const failing = check ? failingSections(check) : []
  const empties = edited ? CONSULT_KEYS.filter((k) => !edited[k].trim()) : []
  const sendable = !!edited && failing.length === 0 && empties.length === 0

  useEffect(() => {
    changeRef.current?.(draft && edited ? { text: draftToText({ origin: draft.origin, sections: edited }), sendable, origin: draft.origin } : null)
  }, [draft, edited, sendable])

  async function makeDraft() {
    const ticket = ++run.current
    setBusy(true)
    setRemoved(false)
    const r = await requestConsult(input, { mode, fetchImpl })
    if (ticket !== run.current) return
    const next: Draft =
      r.source === 'live'
        ? { origin: { kind: 'assistant', model: r.model }, sections: liveSections(r.sections, input), basis }
        : { origin: { kind: 'template', why: r.source }, sections: templateSections(input), basis }
    setDraft(next)
    setEdited(next.sections)
    setBusy(false)
  }

  function remove() {
    run.current++
    setDraft(null)
    setEdited(null)
    setBusy(false)
    setRemoved(true)
  }

  return (
    <section className="card cd" aria-labelledby="cd-title" aria-busy={busy}>
      <header className="cd-head">
        <h2 id="cd-title">{C.title}</h2>
        {!draft && <p className="muted small">{C.lede}</p>}
      </header>

      {!draft ? (
        <div className="cd-start">
          <button type="button" className="btn cd-draft" onClick={() => void makeDraft()} disabled={busy}>
            {busy ? C.drafting : C.draft}
          </button>
          <p className="muted small cd-live" role="status">{busy ? C.drafting : removed ? C.removed : ''}</p>
        </div>
      ) : (
        <>
          <div className="cd-meta">
            <span className="cd-tag">{C.draftLabel}</span>
            <span className="muted small">{originLabel(draft.origin)}</span>
          </div>
          {draft.origin.kind === 'template' ? (
            <p className="callout small cd-notice">{C.notice[draft.origin.why]}</p>
          ) : (
            <p className="muted small cd-notice-plain">{C.assistantNote}</p>
          )}
          {draft.basis !== basis && (
            <p className="cd-stale small" role="status">
              <span aria-hidden="true">◐ </span>
              {C.stale}
            </p>
          )}

          <div className="cd-sections">
            {CONSULT_KEYS.map((k) => (
              <SectionField
                key={k}
                k={k}
                value={edited![k]}
                spans={check![k]}
                onEdit={(v) => setEdited((e) => (e ? { ...e, [k]: v } : e))}
              />
            ))}
          </div>

          <footer className="cd-foot">
            <p className={`cd-verdict small${sendable ? '' : ' is-blocked'}`} role="status">
              <span aria-hidden="true">{sendable ? '✓ ' : '▲ '}</span>
              {failing.length ? C.blockedSend(failing.length) : empties.length ? C.emptySection : C.allOk}
            </p>
            <div className="cd-actions">
              <button type="button" className="btn" onClick={() => void makeDraft()} disabled={busy} aria-describedby="cd-again-hint">
                {busy ? C.drafting : C.again}
              </button>
              <span id="cd-again-hint" className="cd-sr">{C.againHint}</span>
              <button type="button" className="btn cd-remove" onClick={remove}>{C.remove}</button>
            </div>
          </footer>
        </>
      )}
    </section>
  )
}
