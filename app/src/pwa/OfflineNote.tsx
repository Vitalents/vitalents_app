// "Available offline" note (NFR-01). Says only what is true on this device: shown once the app is precached,
// and switches to "Offline" while the browser has no network. Renders nothing before that.
import { PWA_S } from './strings'
import { usePwa } from './state'
import './pwa.css'

export function OfflineNote({ detail = false }: { detail?: boolean }) {
  const { offlineCapable, online } = usePwa()
  if (online && !offlineCapable) return null
  const offline = !online
  return (
    <p className={offline ? 'pwa-note pwa-note-off' : 'pwa-note'} role="status">
      <svg className="pwa-note-icon" viewBox="0 0 16 16" aria-hidden="true">
        {offline ? (
          <path d="M2 2l12 12M5.2 8.6a4 4 0 0 1 2.3-1.1M3 6.4A7 7 0 0 1 5 5.2m5.6.3A7 7 0 0 1 13 6.4M10.7 8.6c-.4-.4-.9-.7-1.4-.9M8 12.5h0" />
        ) : (
          <path d="M3.5 8.5l3 3 6-7" />
        )}
      </svg>
      <span>
        <strong>{offline ? PWA_S.offline.offlineNow : PWA_S.offline.available}</strong>
        {detail && <span className="pwa-note-detail"> · {offline ? PWA_S.offline.offlineNowDetail : PWA_S.offline.availableDetail}</span>}
      </span>
    </p>
  )
}
