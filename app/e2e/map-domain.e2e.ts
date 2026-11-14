// S1 demo, steps 1-2: the map and the Cognition card.
import { expect, open, test } from './helpers'

test('map loads with the banner, seven regions and Fahim, without console errors', async ({ page, consoleErrors }) => {
  await open(page, '/')

  await expect(page.getByRole('complementary', { name: 'Data notice' })).toHaveText('Simulated data · not a medical device')
  await expect(page.getByRole('heading', { level: 1, name: 'Today & map' })).toBeVisible()

  // Seven tappable regions on the figure, and the same seven in the accessible list.
  const figure = page.locator('svg.bodymap')
  await expect(figure).toBeVisible()
  await expect(figure.locator('[role="link"]')).toHaveCount(7)
  const list = page.getByRole('list', { name: 'Areas' })
  await expect(list.getByRole('listitem')).toHaveCount(7)
  // Names come from content/ and may be reworded, so check the stable domain ids (the link targets).
  for (const id of ['cognition', 'sleep', 'heart', 'symptoms', 'nutrition', 'movement', 'radiation']) {
    const link = list.locator(`a[href="/domain/${id}"]`)
    await expect(link).toBeVisible()
    await expect(link).toContainText(/\w{4,}/)
    await expect(link).toContainText('Follow-up:')
  }

  // Each region carries both statuses: follow-up and data are separate labels (rule 2).
  const cognition = figure.locator('[role="link"][aria-label^="Cognition"]')
  await expect(cognition).toHaveAttribute('aria-label', /Follow-up: Watching\. Data: No reading/)

  // The loaded crew member: Fahim (header and page eyebrow).
  await expect(page.locator('header .crew')).toContainText('Fahim')
  await expect(page.locator('main .eyebrow')).toContainText(/Fahim/i)

  // Let the outbox ticker run a couple of times before checking the console.
  await page.waitForTimeout(1500)
  expect(consoleErrors).toEqual([])
})

test('tapping a region opens its card', async ({ page }) => {
  await open(page, '/')
  await page.locator('svg.bodymap [role="link"][aria-label^="Sleep"]').click()
  await expect(page).toHaveURL(/\/domain\/sleep$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sleep')
})

test('Cognition card: tabs switch, Understand shows the Ask box in cached mode', async ({ page }) => {
  await open(page, '/domain/cognition')
  const tabs = page.getByRole('tablist')
  const now = tabs.getByRole('tab', { name: 'Now' })
  const understand = tabs.getByRole('tab', { name: 'Understand' })
  const act = tabs.getByRole('tab', { name: 'Act' })

  await expect(now).toHaveAttribute('aria-selected', 'true')
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText('Your personal reference')
  // Decode result and self-rating appear side by side, never as one number (rule 3).
  await expect(panel).toContainText('never combined into one number')

  await act.click()
  await expect(act).toHaveAttribute('aria-selected', 'true')
  await expect(now).toHaveAttribute('aria-selected', 'false')

  await understand.click()
  await expect(understand).toHaveAttribute('aria-selected', 'true')
  const box = page.getByRole('tabpanel').getByRole('search')
  await expect(box).toBeVisible()
  await expect(box.getByRole('textbox', { name: 'Ask about an indicator, a measurement or a hazard' })).toBeVisible()
  await expect(box.getByRole('button', { name: 'Ask' })).toBeDisabled()

  // Cached mode: a suggested question is answered from the recorded file, never from a live service.
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  const suggestion = page.getByRole('tabpanel').locator('.ask-pill').first()
  await expect(suggestion).toBeVisible()
  await suggestion.click()
  await expect(page.getByRole('tabpanel').locator('.ask-answer')).toBeVisible()
  expect(requests.some((u) => u.includes(':8008'))).toBe(false)
  expect(requests.some((u) => u.includes('/data/cached_answers.json'))).toBe(true)
})
