// FR-PE-02 Alert rating on one finding: "Useful" / "False alarm" (+ optional reason).
// Mount inside each finding on the Review page's Changed items. Astronaut only; the write is checked by assertWrite.
import { useId, useState } from 'react'
import type { Finding } from '../../data/contract'
import { useRole } from '../../store/role'
import { useVisibleData } from '../roles/hooks'
import { ALERT, latestFeedback, type AlertValue } from './records'
import { F } from './strings'
import { saveAlertRating } from './write'
import './feedback.css'

export function AlertRating({ finding, now }: { finding: Finding; now?: () => string }) {
  const role = useRole((s) => s.role)
  const data = useVisibleData(finding.subject_id)
  const id = useId()
  const [mode, setMode] = useState<'idle' | 'reason'>('idle')
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (role !== 'astronaut') return null

  const last = latestFeedback(data.feedback_entry, finding.finding_id, 'alert_usefulness')
  const showControls = !last || editing

  async function save(value: AlertValue) {
    setError(null)
    setBusy(true)
    try {
      await saveAlertRating(finding, value, reason, role, now ? now() : new Date())
      setMode('idle')
      setEditing(false)
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fb fb-alert" role="group" aria-labelledby={`${id}-q`}>
      {showControls ? (
        <>
          <p id={`${id}-q`} className="fb-alert-q">{F.alert.question}</p>
          {mode === 'idle' ? (
            <div className="fb-alert-btns">
              <button type="button" className="btn" disabled={busy} onClick={() => save('useful')}>{F.alert.useful}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => setMode('reason')}>{F.alert.falseAlarm}</button>
              {editing && <button type="button" className="link-btn fb-link" onClick={() => setEditing(false)}>{F.alert.cancel}</button>}
            </div>
          ) : (
            <form className="fb-alert-form" onSubmit={(e) => { e.preventDefault(); void save('false_alarm') }}>
              <label className="field" htmlFor={`${id}-r`}>
                <span>{F.alert.reasonLabel}</span>
                <textarea id={`${id}-r`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="fb-alert-btns">
                <button type="submit" className="btn primary" disabled={busy}>{F.alert.save}</button>
                <button type="button" className="btn" disabled={busy} onClick={() => { setMode('idle'); setReason('') }}>{F.alert.cancel}</button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className="fb-alert-done">
          <p id={`${id}-q`} role="status">
            {F.alert.saved(last.rating === ALERT.useful)}
            {last.comment && <span className="muted"> “{last.comment}”</span>}
          </p>
          <button type="button" className="link-btn fb-link" onClick={() => setEditing(true)}>{F.alert.change}</button>
        </div>
      )}
      {showControls && <p className="fb-alert-note small muted">{F.alert.shared} {F.neverChanges}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
