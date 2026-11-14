// Offline / update state shared by the note and the toast. Filled by register.ts; no service-worker imports here,
// so components and tests can use it without the build-time virtual module.
import { create } from 'zustand'

export interface PwaState {
  /** The app shell and data are precached: the next visit opens without a network. */
  offlineCapable: boolean
  /** The browser reports no network right now. */
  online: boolean
  /** A new version is installed and waiting for the user to reload. */
  updateWaiting: boolean
  /** Activates the waiting version (skipWaiting) and reloads the page. Set by register.ts. */
  applyUpdate: () => Promise<void>
  dismissUpdate: () => void
}

const initialOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export const usePwa = create<PwaState>((set) => ({
  offlineCapable: false,
  online: initialOnline(),
  updateWaiting: false,
  applyUpdate: async () => {
    window.location.reload()
  },
  dismissUpdate: () => set({ updateWaiting: false }),
}))
