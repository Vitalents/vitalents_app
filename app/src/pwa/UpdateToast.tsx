// "New version available — Reload" toast. Nothing changes silently: the waiting version activates
// (skipWaiting) only when the user presses Reload.
import { useState } from 'react'
import { PWA_S } from './strings'
import { usePwa } from './state'
import './pwa.css'

export function UpdateToast() {
  const { updateWaiting, applyUpdate, dismissUpdate } = usePwa()
  const [busy, setBusy] = useState(false)
  if (!updateWaiting) return null
  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <span className="pwa-toast-msg">{PWA_S.update.message}</span>
      <button
        className="btn primary"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void applyUpdate()
        }}
      >
        {PWA_S.update.reload}
      </button>
      <button className="btn" onClick={dismissUpdate}>{PWA_S.update.later}</button>
    </div>
  )
}
