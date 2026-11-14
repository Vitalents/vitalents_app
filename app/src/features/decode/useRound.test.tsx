// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeKey, makeSequence } from '../../engine/decodeSession'
import { useRound } from './useRound'

describe('durable Decode attempt lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })
  const start = () => {
    const onEnd = vi.fn(); const onCheckpoint = vi.fn()
    const keyMap = makeKey(4); const sequence = makeSequence(4)
    const hook = renderHook(() => useRound({ keyMap, sequence, durationMs: 90_000, onEnd, onCheckpoint }), { wrapper: StrictMode })
    return { ...hook, onEnd, onCheckpoint, keyMap, sequence }
  }
  it('survives the StrictMode probe and retains answered trials when navigation unmounts it', () => {
    const h = start()
    expect(h.onEnd).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(h.onCheckpoint).toHaveBeenCalledTimes(1)
    act(() => { h.result.current.respond(h.keyMap[h.sequence[0]], 'keyboard') })
    expect(h.onCheckpoint.mock.lastCall![0].raw[0].response_digit).toBe(h.keyMap[h.sequence[0]])
    act(() => { vi.advanceTimersByTime(200) })
    h.unmount()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
    const ended = h.onEnd.mock.lastCall![0]
    expect(ended.state).toBe('aborted')
    expect(ended.raw).toHaveLength(2)
    expect(ended.raw[0].response_digit).toBe(h.keyMap[h.sequence[0]])
    expect(ended.raw[1].response_digit).toBeNull()
  })
  it('pagehide saves one final attempt even when unmount follows', () => {
    const h = start()
    act(() => { vi.advanceTimersByTime(1000); window.dispatchEvent(new Event('pagehide')) })
    h.unmount()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
    expect(h.onEnd.mock.lastCall![0].state).toBe('aborted')
  })
  it('a completed round is not overwritten as aborted during result navigation', () => {
    const h = start()
    act(() => { vi.advanceTimersByTime(91_000) })
    expect(h.onEnd).toHaveBeenCalledTimes(1)
    expect(h.onEnd.mock.lastCall![0].state).toBe('completed')
    h.unmount()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })
  it('navigation during the late-response grace period preserves the completed window', () => {
    const h = start()
    act(() => { vi.advanceTimersByTime(90_100) })
    expect(h.onEnd).not.toHaveBeenCalled()
    h.unmount()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
    expect(h.onEnd.mock.lastCall![0]).toMatchObject({ state: 'completed', elapsedMs: 90_000 })
  })
})
