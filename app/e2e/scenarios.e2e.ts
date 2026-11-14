// S1 demo, step 6: other scenarios loaded from Settings (S3 no alternative, S4 symptom review).
import { expect, expectNoForbiddenWording, loadScenario, open, test } from './helpers'

test('S3: the rest window says there is no valid alternative', async ({ page }) => {
  await loadScenario(page, 'S3')
  await open(page, '/rest-window')
  const notice = page.getByRole('status').filter({ hasText: 'No valid alternative within the current constraints.' })
  await expect(notice).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request this change' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Rest opportunity, now and with the change' })).toHaveCount(0)
  await expectNoForbiddenWording(page, 'S3 /rest-window')
})

test('S4: the reported symptom has its follow-up at Review requested, despite a good Decode', async ({ page }) => {
  await loadScenario(page, 'S4')

  await open(page, '/')
  const symptoms = page.locator('svg.bodymap [role="link"][aria-label^="Symptoms"]')
  await expect(symptoms).toHaveAttribute('aria-label', /Follow-up: Review requested/)
  await expect(page.getByRole('list', { name: 'Areas' }).getByRole('link', { name: /Symptoms and temperature/ })).toContainText('Review requested')

  await open(page, '/domain/symptoms')
  await expect(page.locator('main')).toContainText('Review requested')

  await open(page, '/plan')
  await expect(page.locator('main')).toContainText('Review requested')
  await expectNoForbiddenWording(page, 'S4 /plan')
})

test('loading a scenario replaces local data and survives a reload', async ({ page }) => {
  await loadScenario(page, 'S3')
  await page.reload()
  await expect(page.getByText('Loaded: S3 (simulated)')).toBeVisible()
  await loadScenario(page, 'S1')
  await open(page, '/')
  await expect(page.locator('header .crew')).toContainText('Fahim')
})
