// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import { useStore, type Data } from '../../store/store'
import type { RoundEnd } from '../decode/useRound'
import { CheckPage } from './CheckPage'

const ended: RoundEnd = {
  state: 'completed', raw: [{ trial_index: 1, symbol_id: 'g1', correct_digit: 1, stimulus_ms: 0, response_ms: 400, response_digit: 1 }], interruptionReasons: [], cutMs: null, startedAt: new Date('2026-11-14T08:00:00Z'),
  elapsedMs: 90_000, inputMethod: 'keyboard', hidden: [], deviceClass: 'laptop',
}
vi.mock('../decode/DecodeRound', () => ({
  DecodeRound: ({ label, onEnd, onCheckpoint }: { label: string; onEnd: (end: RoundEnd) => void; onCheckpoint?: (end: RoundEnd) => void }) => <div>
    <p>{label}</p><button onClick={() => onEnd(ended)}>Complete test round</button>
    {onCheckpoint && <button onClick={() => onCheckpoint({ ...ended, state: 'started', elapsedMs: 1000 })}>Checkpoint test round</button>}
    <button onClick={() => onEnd({ ...ended, state: 'interrupted', cutMs: 5000, elapsedMs: 5000, interruptionReasons: ['interrupted_help'] })}>Interrupt test round</button>
  </div>,
}))

const put = vi.fn().mockResolvedValue(undefined)
const putMany = vi.fn().mockResolvedValue(undefined)
const open = (path = '/check') => render(<MemoryRouter initialEntries={[path]}><CheckPage /></MemoryRouter>)
function startRound() {
  fireEvent.click(screen.getByRole('button', { name: 'Go to Decode' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }))
  fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start the round' }))
}
beforeEach(() => {
  put.mockReset().mockResolvedValue(undefined)
  putMany.mockReset().mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  useStore.setState({ data: structuredClone(fixture) as unknown as Data, put, putMany })
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
  it('creates a new daily-check record for changed answers after a successful save during a story detour', async () => {
    let finishFirstSave!: () => void
    put.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirstSave = resolve }))
    open()
    fireEvent.click(screen.getByRole('radio', { name: '7' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Private note/ }), { target: { value: 'First check' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue to Decode' }))
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    await act(async () => finishFirstSave())
    fireEvent.click(screen.getByRole('button', { name: 'Back to daily check' }))
    fireEvent.click(screen.getByRole('radio', { name: '8' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Private note/ }), { target: { value: 'Second check' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue to Decode' }))
    await screen.findByRole('heading', { name: /^Decode$/ })
    const attempts = put.mock.calls.filter(([entity]) => entity === 'self_report').map(([, records]) => records[0])
    expect(attempts).toHaveLength(2)
    expect(attempts[0].self_report_id).not.toBe(attempts[1].self_report_id)
    expect(attempts.map((r) => [r.alertness_rating, r.private_note])).toEqual([[7, 'First check'], [8, 'Second check']])
  })
  it('uses this person’s mission date even when another person has a newer review', () => {
    const data = useStore.getState().data
    useStore.setState({ data: { ...data, daily_review: [...data.daily_review, { ...data.daily_review[0], subject_id: 'sim:crew:other', review_date: '2026-12-01' }] } })
    open('/check?story=home')
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
  })
  it('keeps access on save failure, retries original IDs, and preserves result through preview', async () => {
    putMany.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined)
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    fireEvent.click(await screen.findByRole('button', { name: /^No$/ }))
    await screen.findByRole('heading', { name: 'Your round could not be fully saved' })
    expect(screen.queryByText('Round saved on this device')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }))
    await screen.findByText('Round saved on this device')
    const saves = putMany.mock.calls
    expect(saves).toHaveLength(3)
    expect(saves[1][0]).toEqual(saves[2][0])
    expect(saves[0][0].decode_session[0].decode_session_id).toBe(saves[1][0].decode_session[0].decode_session_id)
    fireEvent.click(screen.getByRole('button', { name: 'Preview next story' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today’s story' }))
    fireEvent.click(screen.getByRole('button', { name: 'See your result' }))
    expect(screen.getByRole('heading', { name: 'Today’s Decode' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review my day' }).getAttribute('href')).toBe('/review')
  })
  it('rewards a completed reported interruption without a reference comparison', async () => {
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Yes$/ }))
    await screen.findByRole('heading', { name: 'The biggest star is yours.' })
    fireEvent.click(screen.getByRole('button', { name: 'See your result' }))
    expect(screen.getByText('Saved, but not used for comparison with your reference.')).toBeTruthy()
    expect(screen.queryByText(/Within your personal range/)).toBeNull()
  })
  it('serializes a slow checkpoint before the complete ledger and final answer with stable identities', async () => {
    let releaseCheckpoint!: () => void
    putMany.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseCheckpoint = resolve }))
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Checkpoint test round' }))
    await waitFor(() => expect(putMany).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    expect(screen.queryByRole('heading', { name: 'Was there an interruption during the round?' })).toBeNull()
    expect(putMany).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    await act(async () => releaseCheckpoint())
    await waitFor(() => expect(putMany).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('heading', { name: 'The biggest star is yours.' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'See your result' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to round status' }))
    fireEvent.click(await screen.findByRole('button', { name: /^No$/ }))
    await screen.findByRole('button', { name: 'See your result' })
    expect(putMany).toHaveBeenCalledTimes(3)
    const batches = putMany.mock.calls.map(([batch]) => batch)
    expect(batches.map((b) => b.decode_session[0].session_state)).toEqual(['started', 'completed', 'completed'])
    expect(new Set(batches.map((b) => b.decode_session[0].decode_session_id)).size).toBe(1)
    expect(new Set(batches.map((b) => b.decode_response_event[0].decode_response_event_id)).size).toBe(1)
    expect(batches[1].information_status[0].reason_codes).toContain('pending_interruption_check')
    expect(batches[1].information_status[0].reference_eligible).toBe(false)
    expect(batches[2].information_status[0].reason_codes).not.toContain('pending_interruption_check')
  })
  it('retries a failed pre-question save without publishing a result or losing the interruption answer', async () => {
    putMany.mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined)
    open(); startRound()
    fireEvent.click(screen.getByRole('button', { name: 'Complete test round' }))
    await screen.findByRole('heading', { name: 'Your round could not be fully saved' })
    expect(screen.queryByRole('button', { name: /^No$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A message from home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }))
    await screen.findByText('Round saved on this device')
    expect(putMany.mock.calls[0][0]).toEqual(putMany.mock.calls[1][0])
    expect(screen.queryByRole('button', { name: 'See your result' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to round status' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Yes$/ }))
    await screen.findByRole('button', { name: 'See your result' })
    expect(putMany.mock.calls[2][0].information_status[0].reason_codes).toContain('reported_interruption')
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
