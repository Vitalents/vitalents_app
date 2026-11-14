import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHealthCache, resolveMode } from './client'

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))

describe('auto mode (team laptop through the tunnel)', () => {
  beforeEach(() => resetHealthCache())

  it('uses the onboard model when /health answers', async () => {
    const f = vi.fn(() => ok({ ok: true, model: 'gpt-oss:20b' })) as unknown as typeof fetch
    expect(await resolveMode('auto', f)).toBe('live')
  })

  it('falls back to recorded answers when the laptop is off', async () => {
    const f = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    expect(await resolveMode('auto', f)).toBe('cached')
  })

  it('checks /health at most once per 30 s', async () => {
    const f = vi.fn(() => ok({ ok: true })) as unknown as typeof fetch
    await resolveMode('auto', f)
    await resolveMode('auto', f)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('leaves live and cached unchanged', async () => {
    const f = vi.fn() as unknown as typeof fetch
    expect(await resolveMode('live', f)).toBe('live')
    expect(await resolveMode('cached', f)).toBe('cached')
    expect(f).not.toHaveBeenCalled()
  })
})
