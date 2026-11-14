// @vitest-environment jsdom
// NFR-01: the offline note says only what is true on this device; the update toast waits for the user.
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import manifest from '../../public/manifest.webmanifest?raw'
import { OfflineNote } from './OfflineNote'
import { usePwa } from './state'
import { UpdateToast } from './UpdateToast'

const html = (el: ReactElement) => render(el).container.innerHTML
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

afterEach(cleanup)

beforeEach(() => usePwa.setState({ offlineCapable: false, online: true, updateWaiting: false }))

describe('OfflineNote', () => {
  it('renders nothing before the app is saved for offline use', () => {
    expect(html(<OfflineNote />)).toBe('')
  })
  it('says "Available offline" once precached', () => {
    usePwa.setState({ offlineCapable: true })
    expect(text(html(<OfflineNote />))).toBe('Available offline')
  })
  it('says "Offline" while there is no network', () => {
    usePwa.setState({ online: false })
    const t = text(html(<OfflineNote detail />))
    expect(t).toContain('Offline')
    expect(t).toContain('saved on this device')
  })
})

describe('UpdateToast', () => {
  it('is hidden until a new version is waiting', () => {
    expect(html(<UpdateToast />)).toBe('')
  })
  it('offers Reload and Later', () => {
    usePwa.setState({ updateWaiting: true })
    const t = text(html(<UpdateToast />))
    expect(t).toContain('New version available')
    expect(t).toContain('Reload')
    expect(t).toContain('Later')
  })
})

describe('manifest.webmanifest', () => {
  const m = JSON.parse(manifest)
  it('names the app and uses brand colours', () => {
    expect(m.name).toBe('Vitalents')
    expect(m.background_color).toBe('#F5F3EB')
    expect(m.display).toBe('standalone')
  })
  it('lists the 192 and 512 icons', () => {
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  })
})
