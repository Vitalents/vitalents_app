// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import { useStore, type Data } from '../../store/store'
import type { RoundEnd } from '../decode/useRound'
import { CheckPage } from './CheckPage'

const ended: RoundEnd = {
  state: 'completed', raw: [], interruptionReasons: [], cutMs: null, startedAt: new Date('2026-11-14T08:00:00Z'),
  elapsedMs: 90_000, inputMethod: 'keyboard', hidden: [], deviceClass: 'laptop',
}
vi.mock('../decode/DecodeRound', () => ({
  DecodeRound: ({ label, onEnd }: { label: string; onEnd: (end: RoundEnd) => void }) => <div>
    <p>{label}</p><button onClick={() => onEnd(ended)}>Complete test round</button>
    <button onClick={() => onEnd({ ...ended, state: 'interrupted', cutMs: 5000, elapsedMs: 5000, interruptionReasons: ['interrupted_help'] })}>Interrupt test round</button>
  </div>,
}))

const put = vi.fn().mockResolvedValue(undefined)
const open = (path = '/check') => render(<MemoryRouter initialEntries={[path]}><CheckPage /></MemoryRouter>)
function startRound() {
  fireEvent.click(screen.getByRole('button', { name: 'Go to Decode' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }))
  fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start the round' }))
}
beforeEach(() => {
  put.mockReset().mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  useStore.setState({ data: structuredClone(fixture) as unknown as Data, put })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Decode story and save boundaries', () => {
  it('preserves the entire daily-check draft through the story and next-story preview', () => {
    open()
    fireEvent.click(screen.getByRole('radio', { name: '7' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tense' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Private note/ }), { target: { value: 'My unsaved private note' } })
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'The biggest star is yours.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview next story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today’s story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to daily check' }))
    expect(screen.getByRole('radio', { name: '7' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Tense' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByRole('textbox', { name: /Private note/ }) as HTMLTextAreaElement).value).toBe('My unsaved private note')
    expect(put).not.toHaveBeenCalled()
  })
  it.each(['resolve', 'reject'] as const)('does not replace the story when a daily-check save later %ss', async (outcome) => {
    let resolveSave!: () => void
    let rejectSave!: (error: Error) => void
    put.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { resolveSave = resolve; rejectSave = reject }))
    open()
    fireEvent.click(screen.getByRole('radio', { name: '7' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tense' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Private note/ }), { target: { value: 'Keep through saving' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue to Decode' }))
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    await act(async () => { if (outcome === 'resolve') resolveSave(); else rejectSave(new Error('storage unavailable')) })
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to daily check' }))
    expect(screen.getByRole('radio', { name: '7' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByRole('textbox', { name: /Private note/ }) as HTMLTextAreaElement).value).toBe('Keep through saving')
    if (outcome === 'reject') {
      expect(screen.getByRole('alert').textContent).toContain('Your daily check could not be saved')
      fireEvent.click(screen.getByRole('button', { name: 'Save and continue to Decode' }))
      await screen.findByRole('heading', { name: /^Decode$/ })
      const attempts = put.mock.calls.filter(([entity]) => entity === 'self_report')
      expect(attempts).toHaveLength(2)
      expect(attempts[0][1][0].self_report_id).toBe(attempts[1][1][0].self_report_id)
    }
  })
  it('opens independently; preview changes no records and returns to the same story', () => {
    open('/check?story=home')
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
    expect(screen.queryByText('An old friend')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview next story' }))
    expect(screen.getByText('Story preview only. Your mission date and measurements stay the same.')).toBeTruthy()
    expect(screen.getByText('An old friend')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to today’s story' }))
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
    expect(put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to daily check' }))
    expect(screen.getByRole('heading', { name: 'Daily check' })).toBeTruthy()
  })
  it('uses this person’s mission date even when another person has a newer review', () => {
    const data = useStore.getState().data
    useStore.setState({ data: { ...data, daily_review: [...data.daily_review, { ...data.daily_review[0], subject_id: 'sim:crew:other', review_date: '2026-12-01' }] } })
    open('/check?story=home')
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
  })
  it('keeps access on save failure, retries original IDs, and preserves result through preview', async () => {
    let fail = true
    put.mockImplementation(async (entity) => { if (entity === 'decode_response_event' && fail) { fail = false; throw new Error('quota') } })
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    fireEvent.click(screen.getByRole('button', { name: /^No$/ }))
    await screen.findByRole('heading', { name: 'Your round could not be fully saved' })
    expect(screen.queryByText('Round saved on this device')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }))
    await screen.findByText('Round saved on this device')
    const saves = put.mock.calls.filter(([entity]) => entity === 'decode_session')
    expect(saves).toHaveLength(2)
    expect(saves[0][1]).toEqual(saves[1][1])
    fireEvent.click(screen.getByRole('button', { name: 'Preview next story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today’s story' }))
    fireEvent.click(screen.getByRole('button', { name: 'See your result' }))
    expect(screen.getByRole('heading', { name: 'Today’s Decode' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review my day' }).getAttribute('href')).toBe('/review')
  })
  it('rewards a completed reported interruption without a reference comparison', async () => {
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    fireEvent.click(screen.getByRole('button', { name: /^Yes$/ }))
    await screen.findByRole('heading', { name: 'The biggest star is yours.' })
    fireEvent.click(screen.getByRole('button', { name: 'See your result' }))
    expect(screen.getByText('Saved, but not used for comparison with your reference.')).toBeTruthy()
    expect(screen.queryByText(/Within your personal range/)).toBeNull()
  })
  it('lets a stopped round read the same story without claiming completion', async () => {
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Interrupt test round' }))
    await screen.findByRole('heading', { name: 'Round interrupted' })
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to round status' }))
    expect(screen.getByRole('heading', { name: 'Round interrupted' })).toBeTruthy()
  })
  it('keeps the transcript and navigation when both assets fail and stops audio on exit', async () => {
    const { container } = open('/check?story=home')
    const audio = container.querySelector('audio')!
    expect(audio.autoplay).toBe(false)
    fireEvent.error(audio)
    fireEvent.error(screen.getByAltText('A fictional daughter holding a colourful drawing at home.'))
    expect(screen.getByText(/The audio could not be loaded/)).toBeTruthy()
    expect(screen.getByText(/Hi Dad! I made you a drawing today/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to daily check' }))
    await waitFor(() => expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled())
  })
})
