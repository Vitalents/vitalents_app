import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import { DOMAINS } from '../../content/content'
import type { SubjectProfile } from '../../data/contract'
import { buildDomainViews, type DataSet } from '../../engine/view'
import * as selectors from '../../store/selectors'
import { MapPage } from './MapPage'
import { M } from './strings'

vi.mock('../../store/selectors')
const date = '2026-11-14'
const views = () => buildDomainViews(fixture as unknown as DataSet, DOMAINS, date)
const render = () => renderToStaticMarkup(<MemoryRouter><MapPage /></MemoryRouter>)

describe('Today next step follows the measurement plan', () => {
  beforeEach(() => {
    vi.mocked(selectors.useDomainViews).mockReturnValue(views())
    vi.mocked(selectors.useReviewDate).mockReturnValue(date)
    vi.mocked(selectors.useSubject).mockReturnValue(fixture.subject_profile[0] as unknown as SubjectProfile)
  })

  it('offers the due daily check and an independent family-message link for Fahim', () => {
    const html = render()
    expect(html).toContain(M.dailyTitle)
    expect(html).toContain('href="/check"')
    expect(html).toContain('href="/check?story=home"')
  })

  it('offers the actual due area when cognition is not due, without borrowing Fahim’s family story', () => {
    const sleep = views().find((v) => v.content.id === 'sleep')!
    vi.mocked(selectors.useDomainViews).mockReturnValue([{ ...sleep, indicators: sleep.indicators.map((i) => ({ ...i, today: null, status: 'no_reading' })) }])
    vi.mocked(selectors.useSubject).mockReturnValue({ ...fixture.subject_profile[0], subject_profile_id: 'sim:crew:other' } as unknown as SubjectProfile)
    const html = render()
    expect(html).toContain(M.dueTitle)
    expect(html).toContain('href="/domain/sleep"')
    expect(html).not.toContain(M.dailyTitle)
    expect(html).not.toContain('story=home')
  })

  it('does not invent a due task or claim completion when the plan is unavailable', () => {
    vi.mocked(selectors.useDomainViews).mockReturnValue([])
    const html = render()
    expect(html).toContain('href="/review"')
    expect(html).toContain(M.reviewTitle)
    expect(html).not.toContain(M.dailyTitle)
    expect(html).not.toContain(M.dueTitle)
  })
})
