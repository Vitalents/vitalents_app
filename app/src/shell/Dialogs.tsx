// Request help (FR-SH-06) and Report something (FR-SH-05): reachable from every screen.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { S } from '../content/strings'
import { buildHelpRecords, buildReportRecords } from '../store/records'
import { useCurrentReview, useReviewDate, useSubject } from '../store/selectors'
import { useStore } from '../store/store'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('textarea, input, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
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
  const put = useStore((s) => s.put)
  const ctx = useCtx()
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    const r = buildHelpRecords({ ...ctx, note })
    await put('finding', [r.finding])
    await put('action', [r.action])
    await put('follow_up', [r.follow_up])
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
  const put = useStore((s) => s.put)
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
    await put('self_report', [r.self_report])
    await put('finding', [r.finding])
    await put('action', [r.action])
    await put('follow_up', [r.follow_up])
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
