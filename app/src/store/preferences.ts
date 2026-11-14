// Learned and remembered preferences (FR-PE-05, DR-14). Display choices are remembered on this device
// (learned_from: explicit); the reminder time is learned from when daily checks are usually completed
// (learned_from: usage) and is only ever shown as a note, never sent as a notification.
// Preferences never change references, limits or rules (FR-PE-03). Storage failures fall back to defaults.
import { create } from 'zustand'
import { PWA_S } from '../pwa/strings'

export type Theme = 'system' | 'light' | 'dark'
export type DemoRole = 'astronaut' | 'medical' | 'planner'
export type DomainTab = 'now' | 'understand' | 'act'
export type LearnedFrom = 'explicit' | 'usage'

/** DR-14 Preference. */
export interface Preference<V> {
  key: PrefKey
  value: V
  learned_from: LearnedFrom
  updated_at: string
}

export interface PrefValues {
  theme: Theme
  scenario: string | null
  demo_role: DemoRole | null
  last_domain_tab: DomainTab | null
  /** "HH:MM" in UTC, or null when there are fewer than 3 completed checks. */
  reminder_time: string | null
}
export type PrefKey = keyof PrefValues

export const PREF_DEFAULTS: PrefValues = {
  theme: 'light', // light is the default; the header switch offers dark and the device setting
  scenario: null,
  demo_role: null,
  last_domain_tab: null,
  reminder_time: null,
}

const PREFIX = 'vitalents.pref.'
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Each key accepts only known values, so a damaged or old entry reads as the default.
const VALID: { [K in PrefKey]: (v: unknown) => v is PrefValues[K] } = {
  theme: (v): v is Theme => v === 'system' || v === 'light' || v === 'dark',
  scenario: (v): v is string | null => v === null || (typeof v === 'string' && /^S[1-9]$/.test(v)),
  demo_role: (v): v is DemoRole | null => v === null || v === 'astronaut' || v === 'medical' || v === 'planner',
  last_domain_tab: (v): v is DomainTab | null => v === null || v === 'now' || v === 'understand' || v === 'act',
  reminder_time: (v): v is string | null => v === null || (typeof v === 'string' && HHMM.test(v)),
}

const nowUtc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Reads one stored DR-14 record; null if absent, unreadable or invalid. */
export function readPreference<K extends PrefKey>(key: K): Preference<PrefValues[K]> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const rec = JSON.parse(raw) as Partial<Preference<unknown>>
    if (rec?.key !== key || !VALID[key](rec.value)) return null
    if (rec.learned_from !== 'explicit' && rec.learned_from !== 'usage') return null
    return rec as Preference<PrefValues[K]>
  } catch {
    return null
  }
}

export function getPreference<K extends PrefKey>(key: K): PrefValues[K] {
  return readPreference(key)?.value ?? PREF_DEFAULTS[key]
}

/** Stores a DR-14 record. Returns the record, or null if the value is invalid. Storage errors are ignored. */
export function writePreference<K extends PrefKey>(key: K, value: PrefValues[K], learnedFrom: LearnedFrom = 'explicit'): Preference<PrefValues[K]> | null {
  if (!VALID[key](value)) return null
  const rec: Preference<PrefValues[K]> = { key, value, learned_from: learnedFrom, updated_at: nowUtc() }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rec))
  } catch {
    /* storage unavailable or full: the choice still applies for this session */
  }
  return rec
}

function readAll(): PrefValues {
  return {
    theme: getPreference('theme'),
    scenario: getPreference('scenario'),
    demo_role: getPreference('demo_role'),
    last_domain_tab: getPreference('last_domain_tab'),
    reminder_time: getPreference('reminder_time'),
  }
}

// ---------- Theme ----------

/** Sets `data-theme` on <html> ("system" removes it, so prefers-color-scheme applies). */
export function applyTheme(theme: Theme, root: HTMLElement | undefined = typeof document === 'undefined' ? undefined : document.documentElement): void {
  if (!root) return
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** Call once at start-up (main.tsx) so the remembered theme applies before the first screen. */
export function applyStoredTheme(): void {
  applyTheme(getPreference('theme'))
}

/** Next theme for a single toggle button: light → dark → system → light. */
export function nextTheme(t: Theme): Theme {
  return t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'
}

// ---------- Reminder time learned from usage ----------

export interface CheckLike {
  subject_id?: string
  session_state?: string
  start_at_utc?: string | null
  end_at_utc?: string | null
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(:\d{2}(\.\d{1,3})?)?Z$/

/**
 * Suggested reminder time: the median time of day (UTC) of the last 7 completed daily checks, one per day
 * (the earliest completion that day). Null when fewer than 3 days have a completed check. Midnight is not
 * wrapped: checks are expected well inside the mission day.
 */
export function suggestReminderTime(completedAtUtc: readonly (string | null | undefined)[]): string | null {
  const firstPerDay = new Map<string, number>()
  for (const ts of completedAtUtc) {
    const m = ts ? ISO_UTC.exec(ts) : null
    if (!m) continue
    const day = ts!.slice(0, 10)
    const minutes = Number(m[1]) * 60 + Number(m[2])
    const prev = firstPerDay.get(day)
    if (prev === undefined || minutes < prev) firstPerDay.set(day, minutes)
  }
  const lastDays = [...firstPerDay.keys()].sort().slice(-7)
  if (lastDays.length < 3) return null
  const mins = lastDays.map((d) => firstPerDay.get(d)!).sort((a, b) => a - b)
  const mid = Math.floor(mins.length / 2)
  const median = mins.length % 2 ? mins[mid] : Math.floor((mins[mid - 1] + mins[mid]) / 2)
  return `${String(Math.floor(median / 60)).padStart(2, '0')}:${String(median % 60).padStart(2, '0')}`
}

/** Completion times of a subject's completed Decode rounds (the timed part of the daily check). */
export function completedCheckTimes(sessions: readonly CheckLike[], subjectId: string): string[] {
  return sessions
    .filter((s) => s.subject_id === subjectId && s.session_state === 'completed')
    .map((s) => s.end_at_utc ?? s.start_at_utc ?? '')
    .filter(Boolean)
}

/** The only wording for the learned reminder time. Null when there is nothing to show. */
export function reminderNote(hhmm: string | null): string | null {
  return hhmm ? PWA_S.reminder.usually(hhmm) : null
}

// ---------- React store ----------

interface PrefState extends PrefValues {
  set: <K extends Exclude<PrefKey, 'reminder_time'>>(key: K, value: PrefValues[K]) => void
  /** Recomputes the reminder time from completed checks and stores it with learned_from "usage" if it changed. */
  learnReminder: (sessions: readonly CheckLike[], subjectId: string) => string | null
}

export const usePreferences = create<PrefState>((set, get) => ({
  ...readAll(),
  set: (key, value) => {
    if (!writePreference(key, value, 'explicit')) return
    if (key === 'theme') applyTheme(value as Theme)
    set({ [key]: value } as Partial<PrefState>)
  },
  learnReminder: (sessions, subjectId) => {
    const value = suggestReminderTime(completedCheckTimes(sessions, subjectId))
    if (value !== get().reminder_time) {
      writePreference('reminder_time', value, 'usage')
      set({ reminder_time: value })
    }
    return value
  },
}))
