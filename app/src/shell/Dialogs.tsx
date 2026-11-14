// Request help (FR-SH-06) and Report something (FR-SH-05): reachable from every screen.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { S } from '../content/strings'
import { buildHelpRecords, buildReportRecords } from '../store/records'
import { useCurrentReview, useReviewDate, useSubject } from '../store/selectors'
import { useStore } from '../store/store'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const modal = ref.current!
    const controls = () => [...modal.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
      .filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
    const focusFirst = () => (controls()[0] ?? modal).focus({ preventScroll: true })
    focusFirst()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close.current()
      } else if (e.key === 'Tab') {
        const items = controls()
        const first = items[0] ?? modal
        const last = items[items.length - 1] ?? modal
        const current = document.activeElement
        if (!modal.contains(current) || current === modal || (e.shiftKey ? current === first : current === last)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        }
      }
    }
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Node && !modal.contains(e.target)) focusFirst()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      if (prev?.isConnected) prev.focus({ preventScroll: true })
    }
  }, [])
  // A save can replace the form with a confirmation. Keep focus inside that new content,
  // while leaving normal typing and parent re-renders at the user's chosen control.
  useEffect(() => {
    if (ref.current && !ref.current.contains(document.activeElement)) {
      ;(ref.current.querySelector<HTMLElement>('button:not(:disabled), textarea, input') ?? ref.current).focus({ preventScroll: true })
    }
  })
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function useCtx() {
  const subject = useSubject()
  const review = useCurrentReview()
  return { subjectId: subject?.subject_profile_id ?? 'sim:crew:fahim', reviewId: review?.daily_review_id ?? 'sim:daily_review:unknown' }
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const putMany = useStore((s) => s.putMany)
  const ctx = useCtx()
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    const r = buildHelpRecords({ ...ctx, note })
    await putMany({ finding: [r.finding], action: [r.action], follow_up: [r.follow_up] })
    setBusy(false)
    setDone(true)
  }
  return (
    <Modal title={S.help.title} onClose={onClose}>
      {done ? (
        <>
          <p role="status" className="ok-note">{S.help.done}</p>
          <div className="modal-actions"><button className="btn primary" onClick={onClose}>OK</button></div>
        </>
      ) : (
        <>
          <p className="muted">{S.help.intro}</p>
          <label className="field">
            <span>{S.help.noteLabel}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.help.notePlaceholder} rows={3} />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>{S.help.cancel}</button>
            <button className="btn danger" onClick={submit} disabled={busy}>{S.help.submit}</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function ReportDialog({ onClose }: { onClose: () => void }) {
  const putMany = useStore((s) => s.putMany)
  const ctx = useCtx()
  const reportDate = useReviewDate()
  const [text, setText] = useState('')
  const [onset, setOnset] = useState(reportDate)
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  async function submit() {
    if (!text.trim()) {
      setError(S.report.needText)
      return
    }
    const r = buildReportRecords({ ...ctx, text, onset, severity, reportDate })
    await putMany({ self_report: [r.self_report], finding: [r.finding], action: [r.action], follow_up: [r.follow_up] })
    setDone(true)
  }
  return (
    <Modal title={S.report.title} onClose={onClose}>
      {done ? (
        <>
          <p role="status" className="ok-note">{S.report.done}</p>
          <div className="modal-actions"><button className="btn primary" onClick={onClose}>OK</button></div>
        </>
      ) : (
        <>
          <p className="muted">{S.report.intro}</p>
          <label className="field">
            <span>{S.report.textLabel}</span>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setError('') }} placeholder={S.report.textPlaceholder} rows={3} aria-invalid={!!error} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="field-row">
            <label className="field">
              <span>{S.report.onsetLabel}</span>
              <input type="date" value={onset} max={reportDate} onChange={(e) => setOnset(e.target.value)} />
            </label>
            <fieldset className="field">
              <legend>{S.report.severityLabel}</legend>
              <div className="seg">
                {(['mild', 'moderate', 'severe'] as const).map((s) => (
                  <label key={s} className={severity === s ? 'on' : ''}>
                    <input type="radio" name="severity" value={s} checked={severity === s} onChange={() => setSeverity(s)} />
                    {S.report.severity[s]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>{S.report.cancel}</button>
            <button className="btn primary" onClick={submit}>{S.report.submit}</button>
          </div>
        </>
      )}
    </Modal>
  )
}
