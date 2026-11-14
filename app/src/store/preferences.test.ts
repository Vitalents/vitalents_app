// @vitest-environment jsdom
// FR-PE-05: display choices are remembered; the reminder time is learned from usage and shown only as a note.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import {
  applyTheme,
  completedCheckTimes,
  getPreference,
  nextTheme,
  readPreference,
  reminderNote,
  suggestReminderTime,
  usePreferences,
  writePreference,
} from './preferences'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('suggestReminderTime', () => {
  it('is null with fewer than 3 completed checks', () => {
    expect(suggestReminderTime([])).toBeNull()
    expect(suggestReminderTime(['2026-11-01T07:10:00Z', '2026-11-02T07:20:00Z'])).toBeNull()
  })

  it('is the median time of day of 3 checks', () => {
    expect(suggestReminderTime(['2026-11-01T07:10:00Z', '2026-11-02T09:00:00Z', '2026-11-03T07:40:00Z'])).toBe('07:40')
  })

  it('uses only the last 7 days with a completed check', () => {
    const old = ['2026-10-01T20:00:00Z', '2026-10-02T20:00:00Z', '2026-10-03T20:00:00Z', '2026-10-04T20:00:00Z']
    const recent = Array.from({ length: 7 }, (_, i) => `2026-11-0${i + 1}T07:${String(10 + i).padStart(2, '0')}:00Z`)
    expect(suggestReminderTime([...old, ...recent])).toBe('07:13')
  })

  it('counts one check per day (the earliest) and averages the two middle values for an even count', () => {
    const ts = ['2026-11-01T07:00:00Z', '2026-11-01T18:00:00Z', '2026-11-02T08:00:00Z', '2026-11-03T09:00:00Z', '2026-11-04T10:00:00Z']
    expect(suggestReminderTime(ts)).toBe('08:30')
  })

  it('ignores missing and malformed timestamps (missing is never zero)', () => {
    expect(suggestReminderTime([null, undefined, '', 'yesterday', '2026-11-01T07:00:00+02:00', '2026-11-01T07:00:00Z', '2026-11-02T07:30:00Z'])).toBeNull()
  })

  it('order of input does not matter', () => {
    const ts = ['2026-11-03T07:40:00Z', '2026-11-01T07:10:00Z', '2026-11-02T09:00:00Z']
    expect(suggestReminderTime(ts)).toBe(suggestReminderTime([...ts].reverse()))
  })
})

describe('completedCheckTimes', () => {
  it('keeps only completed rounds of the subject and prefers the end time', () => {
    const sessions = [
      { subject_id: 'sim:crew:fahim', session_state: 'completed', start_at_utc: '2026-11-01T07:00:00Z', end_at_utc: '2026-11-01T07:01:30Z' },
      { subject_id: 'sim:crew:fahim', session_state: 'interrupted', start_at_utc: '2026-11-02T07:00:00Z', end_at_utc: null },
      { subject_id: 'sim:crew:other', session_state: 'completed', start_at_utc: '2026-11-03T07:00:00Z', end_at_utc: null },
      { subject_id: 'sim:crew:fahim', session_state: 'completed', start_at_utc: '2026-11-04T08:00:00Z', end_at_utc: null },
    ]
    expect(completedCheckTimes(sessions, 'sim:crew:fahim')).toEqual(['2026-11-01T07:01:30Z', '2026-11-04T08:00:00Z'])
  })

  it('gives a time or null for the S1 fixture, never a made-up value', () => {
    const subject = fixture.subject_profile[0].subject_profile_id
    const v = suggestReminderTime(completedCheckTimes(fixture.decode_session, subject))
    expect(v === null || /^\d{2}:\d{2}$/.test(v)).toBe(true)
  })
})

describe('reminderNote', () => {
  it('is the only wording and is absent without a time', () => {
    expect(reminderNote('07:40')).toBe('Usually you do your check around 07:40 UTC')
    expect(reminderNote(null)).toBeNull()
  })
})

describe('stored preferences (DR-14)', () => {
  it('round-trips a display choice with learned_from explicit and a UTC timestamp', () => {
    writePreference('theme', 'dark')
    const rec = readPreference('theme')
    expect(rec).toMatchObject({ key: 'theme', value: 'dark', learned_from: 'explicit' })
    expect(rec!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('remembers scenario, demo role and last domain tab', () => {
    writePreference('scenario', 'S3')
    writePreference('demo_role', 'medical')
    writePreference('last_domain_tab', 'understand')
    expect([getPreference('scenario'), getPreference('demo_role'), getPreference('last_domain_tab')]).toEqual(['S3', 'medical', 'understand'])
  })

  it('rejects invalid values and falls back to defaults for damaged entries', () => {
    expect(writePreference('theme', 'neon' as never)).toBeNull()
    localStorage.setItem('vitalents.pref.scenario', '{not json')
    localStorage.setItem('vitalents.pref.demo_role', JSON.stringify({ key: 'demo_role', value: 'admin', learned_from: 'explicit' }))
    expect(getPreference('theme')).toBe('system')
    expect(getPreference('scenario')).toBeNull()
    expect(getPreference('demo_role')).toBeNull()
  })

  it('works when storage throws (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => writePreference('theme', 'light')).not.toThrow()
    expect(getPreference('theme')).toBe('system')
  })
})

describe('usePreferences store', () => {
  it('applies and remembers the theme', () => {
    usePreferences.getState().set('theme', 'dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getPreference('theme')).toBe('dark')
    usePreferences.getState().set('theme', 'system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('stores the learned reminder time with learned_from usage', () => {
    const sessions = ['2026-11-01T07:10:00Z', '2026-11-02T07:20:00Z', '2026-11-03T07:30:00Z'].map((t) => ({
      subject_id: 'sim:crew:fahim',
      session_state: 'completed',
      start_at_utc: t,
      end_at_utc: null,
    }))
    expect(usePreferences.getState().learnReminder(sessions, 'sim:crew:fahim')).toBe('07:20')
    expect(readPreference('reminder_time')).toMatchObject({ value: '07:20', learned_from: 'usage' })
    expect(usePreferences.getState().reminder_time).toBe('07:20')
  })
})

describe('theme helpers', () => {
  it('cycles system, light, dark', () => {
    expect([nextTheme('system'), nextTheme('light'), nextTheme('dark')]).toEqual(['light', 'dark', 'system'])
  })
  it('applyTheme ignores a missing root', () => {
    expect(() => applyTheme('dark', undefined)).not.toThrow()
  })
})
