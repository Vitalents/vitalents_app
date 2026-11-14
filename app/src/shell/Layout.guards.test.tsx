// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeKey, makeSequence } from '../engine/decodeSession'
import { DecodeRound } from '../features/decode/DecodeRound'
import { HELP_EVENT, REPORT_EVENT, type RoundEnd } from '../features/decode/useRound'
import { useStore } from '../store/store'
import { useRole } from '../store/role'
import { loadS1WithPrivate } from '../sync/testkit'
import { Layout } from './Layout'

vi.mock('../sync/link', () => ({ useOutboxTicker: () => undefined }))
vi.mock('../pwa', () => ({ OfflineNote: () => null }))

const original = useStore.getState()
const originalRole = useRole.getState()
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  useStore.setState({ ready: true, error: null, init: vi.fn(), data: loadS1WithPrivate() })
  useRole.setState({ role: 'astronaut' })
})
afterEach(() => {
  cleanup()
  useStore.setState(original, true)
  useRole.setState(originalRole, true)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup() {
  const onEnd = vi.fn<(end: RoundEnd) => void>()
  render(<MemoryRouter initialEntries={['/check']}><Routes><Route element={<Layout />}>
    <Route path="check" element={<DecodeRound keyMap={makeKey(42)} sequence={makeSequence(42)} durationMs={90_000} label="Measured round" onEnd={onEnd} />} />
    <Route index element={<h1>Map route</h1>} />
  </Route></Routes></MemoryRouter>)
  return { onEnd }
}

describe('shell round guards', () => {
  it.each([
    ['Request help', 'interrupted_help'],
    ['Report something', 'reported_interruption'],
  ])('%s interrupts the active round before dialog typing', (label, reason) => {
    const { onEnd } = setup()
    const header = document.querySelector('header')!
    const opener = within(header).getByRole('button', { name: label })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(header.hasAttribute('inert')).toBe(true)
    expect(document.querySelector('main')?.closest('[inert]')).toBeTruthy()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0]).toMatchObject({ state: 'interrupted', interruptionReasons: [reason] })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: '5' })
    act(() => vi.advanceTimersByTime(91_000))
    expect(onEnd).toHaveBeenCalledOnce()
    expect(onEnd.mock.calls[0][0].raw.filter((r) => r.response_digit !== null)).toHaveLength(0)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(header.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('resets scroll after a route change without waiting for a smooth animation', () => {
    setup()
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByRole('link', { name: 'Vitalents' }))
    expect(screen.getByRole('heading', { name: 'Map route' })).toBeTruthy()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it.each(['medical', 'planner'] as const)('dismisses the dialog on switching to %s without leaving an inert shell or reopening it later', (role) => {
    setup()
    const header = document.querySelector('header')!
    fireEvent.click(within(header).getByRole('button', { name: 'Request help' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    act(() => useRole.setState({ role }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(header.hasAttribute('inert')).toBe(false)
    expect(document.querySelector('main')?.closest('[inert]')).toBeNull()
    expect(within(header).queryByRole('button', { name: 'Request help' })).toBeNull()
    expect(within(header).queryByRole('button', { name: 'Report something' })).toBeNull()
    act(() => {
      window.dispatchEvent(new CustomEvent(HELP_EVENT))
      window.dispatchEvent(new CustomEvent(REPORT_EVENT))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => useRole.setState({ role: 'astronaut' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(within(header).getByRole('button', { name: 'Report something' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
