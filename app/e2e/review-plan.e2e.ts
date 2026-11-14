// S1 demo, step 4: Today's review -> Plan & follow-ups -> accept the step -> rest window.
import { expect, expectNoForbiddenWording, open, test } from './helpers'

const STEP = "Review tonight's rest window"

test("Today's review shows the next step with its source and Why?", async ({ page }) => {
  await open(page, '/review')
  await expect(page.getByRole('heading', { level: 1, name: "Today's review" })).toBeVisible()
  for (const h of ['Recorded', 'Changed', 'Missing', 'Next step']) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible()
  }
  const main = page.locator('main')
  await expect(main).toContainText(STEP)
  await expect(main).toContainText('Risk from Inadequate Sleep and Irregular Schedules')
  // Two observations together, never a cause (rule 4).
  await expect(main).toContainText('this does not show that one caused the other')
  await expect(main.getByText('Why?').first()).toBeVisible()
})

test('plan: accept the rest-window step, then open the rest window (6 h -> 7 h) and request the change', async ({ page }) => {
  await open(page, '/plan')
  await expect(page.getByRole('heading', { level: 1, name: 'Plan & follow-ups' })).toBeVisible()

  // Follow-ups from S1: the rest-window step, the open review request, and the watching follow-up.
  const step = page.getByRole('article', { name: STEP })
  await expect(step).toBeVisible()
  await expect(page.getByRole('article', { name: 'Request a review by the medical team' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Keep the daily check and watch the next sessions' })).toBeVisible()

  await expect(step).toContainText('Proposed')
  await step.getByRole('button', { name: 'Accept' }).click()
  await expect(step.getByRole('button', { name: 'Accept' })).toHaveCount(0)
  await expect(step).toContainText(/Accepted|In progress/)

  // The accepted state is stored locally and survives a reload.
  await page.reload()
  await expect(page.getByRole('article', { name: STEP })).toContainText(/Accepted|In progress/)

  await page.getByRole('article', { name: STEP }).getByRole('link', { name: 'Compare schedule options' }).click()
  await expect(page).toHaveURL(/\/rest-window$/)
  await expect(page.getByRole('heading', { level: 1, name: "Tonight's rest window" })).toBeVisible()

  const pair = page.getByRole('group', { name: 'Rest opportunity, now and with the change' })
  await expect(pair).toContainText('Now')
  await expect(pair).toContainText('6 h')
  await expect(pair).toContainText('With the change')
  await expect(pair).toContainText('7 h')
  await expect(page.locator('main')).toContainText('Move "Planning meeting" from 23:00–00:00 to 22:00–23:00 UTC.')

  await page.getByRole('button', { name: 'Request this change' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Request saved on this device' })).toBeVisible()
  await expect(page.locator('main')).toContainText('The planner sees only this:')
  await expectNoForbiddenWording(page, '/rest-window after request')
})
