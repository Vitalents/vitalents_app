// FR-MAP-05: due today from the plan frequency and today's records.
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixtures/S1.json'
import { DOMAINS } from '../content/content'
import { domainDue, dueFromView, indicatorDue, isoWeekday } from './due'
import { buildDomainViews, type DataSet } from './view'

const DATE = '2026-11-14' // a Saturday, mission day 27

describe('indicatorDue', () => {
  it('daily: due until recorded, then done', () => {
    expect(indicatorDue({ frequency: 'daily', recordedToday: false }, DATE)).toBe('due')
    expect(indicatorDue({ frequency: 'daily', recordedToday: true }, DATE)).toBe('done')
  })

  it('as needed: never due on a given day', () => {
    expect(indicatorDue({ frequency: 'as_needed', recordedToday: false }, DATE)).toBe('not_due')
    expect(indicatorDue({ frequency: 'as_needed', recordedToday: true }, DATE)).toBe('not_due')
  })

  it('weekly: due only on its due days', () => {
    expect(isoWeekday(DATE)).toBe(6)
    expect(indicatorDue({ frequency: 'weekly', due_days: [6], recordedToday: false }, DATE)).toBe('due')
    expect(indicatorDue({ frequency: 'weekly', due_days: [6], recordedToday: true }, DATE)).toBe('done')
    expect(indicatorDue({ frequency: 'weekly', due_days: [1, 4], recordedToday: false }, DATE)).toBe('not_due')
  })

  it('weekly without due days, or a missing or unknown frequency: no answer, never a guess', () => {
    expect(indicatorDue({ frequency: 'weekly', recordedToday: false }, DATE)).toBeNull()
    expect(indicatorDue({ frequency: 'weekly', due_days: [], recordedToday: true }, DATE)).toBeNull()
    expect(indicatorDue({ frequency: null, recordedToday: true }, DATE)).toBeNull()
    expect(indicatorDue({ frequency: undefined, recordedToday: false }, DATE)).toBeNull()
    expect(indicatorDue({ frequency: 'fortnightly', recordedToday: false }, DATE)).toBeNull()
  })
})

describe('domainDue', () => {
  it('one daily indicator still missing makes the domain due, even when another is done', () => {
    expect(domainDue([{ frequency: 'daily', recordedToday: true }, { frequency: 'daily', recordedToday: false }], DATE)).toBe('due')
  })
  it('done when everything due today is recorded', () => {
    expect(domainDue([{ frequency: 'daily', recordedToday: true }, { frequency: 'as_needed', recordedToday: false }], DATE)).toBe('done')
  })
  it('not due when nothing is planned today', () => {
    expect(domainDue([{ frequency: 'as_needed', recordedToday: false }, { frequency: 'as_needed', recordedToday: true }], DATE)).toBe('not_due')
  })
  it('an unknown indicator hides the marker unless something is clearly still due', () => {
    expect(domainDue([{ frequency: 'daily', recordedToday: true }, { frequency: null, recordedToday: false }], DATE)).toBeNull()
    expect(domainDue([{ frequency: 'daily', recordedToday: false }, { frequency: null, recordedToday: false }], DATE)).toBe('due')
  })
  it('no indicators (sample domains): no marker', () => {
    expect(domainDue([], DATE)).toBeNull()
  })
})

describe('dueFromView on the S1 fixture (mission day 27)', () => {
  const views = buildDomainViews(fixture as unknown as DataSet, DOMAINS, DATE)
  const due = (id: string) => dueFromView(views.find((v) => v.content.id === id)!, DATE)

  it('cognition is due: alertness is recorded but Decode is not', () => {
    expect(due('cognition')).toBe('due')
  })
  it('symptoms are recorded as needed, so not due', () => {
    expect(due('symptoms')).toBe('not_due')
  })
  it('sample domains show no marker', () => {
    for (const id of ['nutrition', 'movement', 'radiation']) expect(due(id)).toBeNull()
  })
  it('sleep and heart are done: today has a record, whatever its data status (heart is limited)', () => {
    expect(due('sleep')).toBe('done')
    expect(due('heart')).toBe('done')
  })
  it('a record marked no_reading today does not count as done', () => {
    const d = fixture as unknown as DataSet
    const marked: DataSet = {
      ...d,
      information_status: [
        ...d.information_status,
        { record_ref: 'sim:sleep_record:d27', status: 'no_reading', reason_codes: ['no_reading_due'], created_at_utc: '2026-11-14T23:59:00Z' },
      ],
    }
    const v = buildDomainViews(marked, DOMAINS, DATE).find((x) => x.content.id === 'sleep')!
    expect(dueFromView(v, DATE)).toBe('due')
  })
})
