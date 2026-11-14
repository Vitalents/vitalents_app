/// <reference types="vite-plugin-pwa/vanillajs" />
// Service-worker registration (NFR-01). Call registerPwa() once from main.tsx. In `npm run dev` the plugin
// serves a no-op module, so nothing is registered while developing.
import { registerSW } from 'virtual:pwa-register'
import { usePwa } from './state'

let registered = false

export function registerPwa(): void {
  if (registered || typeof window === 'undefined') return
  registered = true

  const setOnline = () => usePwa.setState({ online: navigator.onLine !== false })
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOnline)

  if (!('serviceWorker' in navigator)) return

  // A page already controlled by a service worker was opened from the precache at least once before.
  if (navigator.serviceWorker.controller) usePwa.setState({ offlineCapable: true })

  const update = registerSW({
    onOfflineReady: () => usePwa.setState({ offlineCapable: true }),
    // registerType 'prompt': the new worker waits; update(true) sends SKIP_WAITING, then the page reloads.
    onNeedRefresh: () => usePwa.setState({ updateWaiting: true }),
    onRegisteredSW: (_url, reg) => {
      if (reg?.active) usePwa.setState({ offlineCapable: true })
    },
  })
  usePwa.setState({ applyUpdate: () => update(true) })
}
