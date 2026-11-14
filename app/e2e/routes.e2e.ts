// Every route: forbidden wording scan of the rendered text (step 7) and a phone-width smoke (step 8).
import { expect, expectNoForbiddenWording, forbiddenHits, open, ROUTES, test } from './helpers'

test('the wording scan itself flags forbidden words and allows negated ones', () => {
  expect(forbiddenHits('You look healthy today')).toHaveLength(1)
  expect(forbiddenHits('Readiness 82 %')).toHaveLength(1)
  expect(forbiddenHits('The rest step worked')).toHaveLength(1)
  expect(forbiddenHits('Low Decode caused by short sleep')).toHaveLength(1)
  expect(forbiddenHits('Status: normal')).toHaveLength(1)
  expect(forbiddenHits('A change from your reference, not a diagnosis.')).toEqual([])
  expect(forbiddenHits('Already recorded today')).toEqual([])
})

for (const route of ROUTES) {
  test(`wording on ${route}`, async ({ page, consoleErrors }) => {
    await open(page, route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    await expectNoForbiddenWording(page, route)
    expect(consoleErrors).toEqual([])
  })
}

test.describe('phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  for (const route of ROUTES) {
    test(`no horizontal scroll on ${route}`, async ({ page }) => {
      await open(page, route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
      await expect(page.getByRole('complementary', { name: 'Data notice' })).toBeVisible()
      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        view: document.documentElement.clientWidth,
      }))
      expect(m.view).toBe(390)
      expect(m.doc, `document wider than the viewport on ${route}`).toBeLessThanOrEqual(m.view)
      expect(m.body, `body wider than the viewport on ${route}`).toBeLessThanOrEqual(m.view)
    })
  }
})
