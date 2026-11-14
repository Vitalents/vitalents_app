// User-facing text for offline support and learned preferences (FR-PE-05). Kept in one place so it can move
// into content/strings.ts (S) and follow the Arabic/RTL work with the rest of the app.
export const PWA_S = {
  offline: {
    available: 'Available offline',
    availableDetail: 'This app and its simulated data are saved on this device.',
    offlineNow: 'Offline',
    offlineNowDetail: 'Everything you record is saved on this device.',
  },
  update: {
    message: 'New version available',
    reload: 'Reload',
    later: 'Later',
  },
  reminder: {
    /** FR-PE-05: shown only as a note, never as a notification. Times are mission time (UTC), as elsewhere in the app. */
    usually: (hhmm: string) => `Usually you do your check around ${hhmm} UTC`,
  },
} as const
