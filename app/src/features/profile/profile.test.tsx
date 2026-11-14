// FR-SH-04: the mission profile shows the DR-16 facts and today's schedule, read-only.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import type { MissionSchedule, SubjectProfile } from '../../data/contract'
import { ProfileView } from './ProfilePage'
import { P } from './strings'

const profile = fixture.subject_profile[0] as unknown as SubjectProfile
const schedule = fixture.mission_schedule as unknown as MissionSchedule[]
const html = renderToStaticMarkup(<ProfileView profile={profile} schedule={schedule} date="2026-11-14" />)
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('ProfileView (S1, Fahim, mission day 27)', () => {
  it('shows crew, mode, phase, day and date, timezone, versions, language and realm', () => {
    for (const s of ['Fahim (fictional crew member)', 'Mission simulation', 'During the mission', 'Day 27', '14 Nov 2026',
      'Mission clock', 'demo-1', 'English (en)', 'Simulated mission', 'sim · mission simulation', 'sim:crew:fahim'])
      expect(text).toContain(s)
  })

  it('says it is simulated and read only', () => {
    expect(text).toContain(P.simulated)
    expect(text).toContain(P.readOnly)
  })

  it('lists today’s schedule in time order, fixed and movable told apart', () => {
    const order = ['EVA procedure review', 'Planning meeting', 'Rest window'].map((s) => text.indexOf(s))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toContain('pf-tag-fixed')
    expect(html).toContain('pf-tag-movable')
    expect(html).toContain('pf-rest')
    expect(text).toContain('Can move within 21:00–00:00 UTC')
    expect(text).toContain(P.nextDay)
  })

  it('has no editing controls', () => {
    expect(html).not.toMatch(/<(input|select|textarea|button|form)\b/)
  })

  it('shows another day’s or another person’s schedule as empty, never borrowed', () => {
    const other = renderToStaticMarkup(<ProfileView profile={{ ...profile, subject_profile_id: 'sim:crew:c2' }} schedule={schedule} date="2026-11-14" />)
    expect(other).toContain(P.scheduleEmpty)
    const tomorrow = renderToStaticMarkup(<ProfileView profile={profile} schedule={schedule} date="2026-11-15" />)
    expect(tomorrow).toContain(P.scheduleEmpty)
  })
})
