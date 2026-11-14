// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { makeKey, makeSequence } from '../../engine/decodeSession'
import { DecodeRound } from './DecodeRound'
import type { RoundEnd } from './useRound'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function setup({ checkpoint = false, strict = false, durationMs = 90_000 } = {}) {
  const onEnd = vi.fn<(end: RoundEnd) => void>()
  const onCheckpoint = vi.fn<(end: RoundEnd) => void>()
  const round = <DecodeRound keyMap={makeKey(42)} sequence={makeSequence(42)} durationMs={durationMs} label="Measured round" onEnd={onEnd} onCheckpoint={checkpoint ? onCheckpoint : undefined} />
  const view = render(strict ? <StrictMode>{round}</StrictMode> : round)
  const finish = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    return onEnd.mock.calls[0][0]
  }
  return { onEnd, onCheckpoint, finish, unmount: view.unmount }
}

describe('Decode input guards', () => {
  it('leaves digits typed in editable fields untouched', () => {
    const { finish } = setup()
    const host = document.createElement('div')
    host.innerHTML = '<input /><textarea></textarea><div contenteditable="true"><span>edit here</span></div>'
    document.body.append(host)
    try {
      for (const target of [host.querySelector('input')!, host.querySelector('textarea')!, host.querySelector('span')!]) {
        expect(fireEvent.keyDown(target, { key: '4', cancelable: true })).toBe(true)
      }
      const end = finish()
      expect(end.raw.filter((r) => r.response_digit !== null)).toHaveLength(0)
    } finally {
      host.remove()
    }
  })

  it('accepts numeric keyboard input and ignores repeat, composing and already-handled keys', () => {
    const { finish } = setup()
    fireEvent.keyDown(window, { key: '4', repeat: true })
    fireEvent.keyDown(window, { key: '4', isComposing: true })
    const handled = new KeyboardEvent('keydown', { key: '4', cancelable: true })
    handled.preventDefault()
    fireEvent(window, handled)
    fireEvent.keyDown(window, { key: '4' })
    const end = finish()
    expect(end.raw.filter((r) => r.response_digit !== null)).toHaveLength(1)
    expect(end.inputMethod).toBe('keyboard')
  })

  it('accepts semantic activation once and does not also count the pointer click', () => {
    const { finish } = setup()
    const digit = screen.getByRole('button', { name: 'Digit 4' })
    // Browser-generated Enter/Space and assistive-technology clicks have detail 0.
    fireEvent.click(digit, { detail: 0 })
    act(() => vi.advanceTimersByTime(160))
    fireEvent.pointerDown(digit, { pointerType: 'mouse', button: 0, isPrimary: true })
    fireEvent.click(digit, { detail: 1 })
    const answers = finish().raw.filter((r) => r.response_digit !== null)
    expect(answers.map((r) => r.response_digit)).toEqual([4, 4])
    expect(answers.map((r) => r.trial_index)).toEqual([1, 2])
  })

  it.each(['Enter', ' '])('cancels repeated %j button defaults while keeping single and assistive activation', (key) => {
    const { finish } = setup()
    const digit = screen.getByRole('button', { name: 'Digit 4' })
    digit.focus()
    expect(fireEvent.keyDown(digit, { key, repeat: false, cancelable: true })).toBe(true)
    // jsdom does not synthesize native button clicks; perform the permitted default action.
    fireEvent.click(digit, { detail: 0 })
    act(() => vi.advanceTimersByTime(160))
    expect(fireEvent.keyDown(digit, { key, repeat: true, cancelable: true })).toBe(false)
    expect(fireEvent.keyDown(digit, { key, repeat: true, cancelable: true })).toBe(false)
    // An assistive-technology activation remains available independently of key events.
    fireEvent.click(digit, { detail: 0 })
    const answers = finish().raw.filter((r) => r.response_digit !== null)
    expect(answers.map((r) => r.response_digit)).toEqual([4, 4])
    expect(answers.map((r) => r.trial_index)).toEqual([1, 2])
  })

  it('finalises in-round help once and ignores later numeric input', () => {
    const { onEnd } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Request help' }))
    fireEvent.keyDown(window, { key: '4' })
    act(() => vi.advanceTimersByTime(91_000))
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0]).toMatchObject({ state: 'interrupted', interruptionReasons: ['interrupted_help'] })
    expect(onEnd.mock.calls[0][0].raw.filter((r) => r.response_digit !== null)).toHaveLength(0)
  })

  it('checkpoints without a phantom StrictMode interruption, then preserves the partial round on unmount', () => {
    const { onEnd, onCheckpoint, unmount } = setup({ checkpoint: true, strict: true })
    expect(onEnd).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(0))
    expect(onCheckpoint).toHaveBeenCalledOnce()
    fireEvent.keyDown(window, { key: '4' })
    act(() => vi.advanceTimersByTime(160))
    unmount()
    expect(onEnd).toHaveBeenCalledOnce()
    const end = onEnd.mock.calls[0][0]
    expect(end).toMatchObject({ state: 'aborted', interruptionReasons: ['aborted'] })
    expect(end.raw.map((r) => r.response_digit)).toEqual([4, null])
    expect(onCheckpoint.mock.calls.at(-1)?.[0].raw.map((r) => r.response_digit)).toEqual([4])
  })

  it('does not finalise twice when help is followed by pagehide and unmount', () => {
    const { onEnd, unmount } = setup({ checkpoint: true })
    act(() => vi.advanceTimersByTime(0))
    fireEvent.click(screen.getByRole('button', { name: 'Request help' }))
    fireEvent(window, new Event('pagehide'))
    unmount()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0]).toMatchObject({ state: 'interrupted', interruptionReasons: ['interrupted_help'] })
  })

  it('keeps a completed round completed when pagehide occurs during the late-response grace window', () => {
    const { onEnd, unmount } = setup({ checkpoint: true, durationMs: 1_000 })
    act(() => vi.advanceTimersByTime(1_060))
    expect(onEnd).not.toHaveBeenCalled()
    fireEvent(window, new Event('pagehide'))
    unmount()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0]).toMatchObject({ state: 'completed', interruptionReasons: [], elapsedMs: 1_000, cutMs: null })
  })
})
