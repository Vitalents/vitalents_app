import { expect, open, test } from './helpers'

test('research data loads offline after the initial app visit', async ({ page, context }) => {
  await open(page, '/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/research')
  await expect(page.locator('.rs-verdict')).toBeVisible()
  await expect(page.locator('main')).toContainText('Research prototype on simulated data')
  await expect(page.locator('.rs-empty')).toHaveCount(0)
})
