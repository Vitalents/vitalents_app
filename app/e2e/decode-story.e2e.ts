import { expect, open, test } from './helpers'

const title = 'The biggest star is yours.'

test('home story opens independently, previews honestly, and has no automatic playback', async ({ page, consoleErrors }) => {
  await open(page, '/check?story=home')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Fictional mission story · generated image and voice.')).toBeVisible()
  await expect(page.getByText('An old friend', { exact: true })).toHaveCount(0)
  const audio = page.locator('audio')
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(0)
  expect(await audio.evaluate((el: HTMLAudioElement) => el.paused && !el.autoplay)).toBe(true)
  await page.getByRole('button', { name: 'Preview next story' }).click()
  await expect(page.getByText('Story preview only. Your mission date and measurements stay the same.')).toBeVisible()
  await expect(page.getByText('An old friend', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to today’s story' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Back to daily check' }).click()
  await expect(page.getByRole('heading', { name: 'Daily check' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('prepared photo and voice play after an offline restart', async ({ page, context, consoleErrors }) => {
  await open(page, '/check?story=home')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(async () => {
    const voice = await caches.match('/media/decode/daughter-message-v1.mp3', { ignoreSearch: true })
    const photo = await caches.match('/media/decode/daughter-home-v1.webp', { ignoreSearch: true })
    return !!voice && !!photo
  })).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const picture = page.getByAltText('A fictional daughter holding a colourful drawing at home.')
  await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  const audio = page.locator('audio')
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(0)
  // Chromium's native play control; time advancement verifies decoding, not just a cached URL.
  await audio.click({ position: { x: 24, y: 22 } })
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0.1)
  await page.getByRole('button', { name: 'Back to daily check' }).click()
  await expect(page.locator('audio')).toHaveCount(0)
  await context.setOffline(false)
  expect(consoleErrors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'))).toEqual([])
})

test.describe('missing media without an installed cache', () => {
  test.use({ serviceWorkers: 'block' })
  test('the complete message remains available when voice and photo fail', async ({ page }) => {
    await page.route('**/media/decode/*', (route) => route.abort())
    await open(page, '/check?story=home')
    // The real aborted request must produce a media error; no synthetic error event is dispatched.
    await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.error?.code ?? 0)).toBeGreaterThan(0)
    await expect(page.getByText('The audio could not be loaded. The full message is written above.')).toBeVisible()
    await expect(page.getByText('The picture could not be loaded.')).toBeVisible()
    await expect(page.getByText('Hi Dad! I made you a drawing today.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Back to daily check' }).click()
    await expect(page.getByRole('heading', { name: 'Daily check' })).toBeVisible()
  })
})
