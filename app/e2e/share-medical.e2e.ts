// S1 demo, step 5: share preview -> confirm -> Delivered (no delay, demo speed) -> Medical role reviews it.
import { expect, expectNoForbiddenWording, goSettings, open, openShareFromNav, pickSegment, switchRole, test } from './helpers'

const NOTE = 'e2e private note that must stay on the device'

test('share with the medical team, deliver, review as Medical; private notes never leave', async ({ page, consoleErrors }) => {
  test.setTimeout(90_000)

  // A private note recorded in today's check (it must never appear in the package).
  await open(page, '/check')
  await page.getByRole('radiogroup', { name: 'How alert do you feel right now?' }).getByRole('radio', { name: '7', exact: true }).click()
  await page.getByLabel('Private note (optional)').fill(NOTE)
  await page.getByRole('button', { name: 'Save and continue to Decode' }).click()
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeVisible()

  // Link: no delay, demo speed.
  await goSettings(page)
  await pickSegment(page, 'One-way delay', 'None')
  await page.getByLabel('Speed up the demo (1 minute passes in 1 second)').check()
  await expect(page.getByText('Round trip 0 min, shown in 0 s.')).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Link available' })).toHaveAttribute('aria-checked', 'true')

  // Preview.
  await openShareFromNav(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Share with the medical team' })).toBeVisible()
  const excluded = page.getByRole('region', { name: 'Not included', exact: true })
  await expect(excluded).toContainText('Your private notes')
  await expect(page.locator('main')).toContainText('Nothing in this package goes to the planner.')
  await expect(page.getByRole('region', { name: 'What will be sent', exact: true })).toBeVisible()
  await expect(page.locator('main')).not.toContainText(NOTE)
  await page.getByLabel('Your question for the medical team').fill('Should I change my evening routine?')
  await expectNoForbiddenWording(page, '/share preview')

  // Confirm -> delivered.
  await page.getByRole('button', { name: 'Send to the medical team' }).click()
  const track = page.getByRole('region', { name: 'Delivery', exact: true }).last()
  await expect(track.locator('[aria-current="step"]')).toContainText('Delivered', { timeout: 15_000 })
  await expect(page.getByRole('status').filter({ hasText: 'Delivery: Delivered' })).toBeAttached()
  for (const s of ['Saved on device', 'Waiting to send', 'Sent', 'Delivered']) {
    await expect(track.locator('li', { hasText: s }).locator('time')).toHaveCount(1)
  }
  await expect(track.locator('li', { hasText: 'Reviewed' })).toContainText('Not yet')

  // Medical role.
  await switchRole(page, 'Medical team')
  await page.getByRole('link', { name: 'Medical team view' }).click()
  await expect(page).toHaveURL(/\/medical$/)
  const pkg = page.getByRole('article', { name: 'Crew summary for the medical team' })
  await expect(pkg).toBeVisible()
  await expect(pkg).toContainText('Should I change my evening routine?')
  await expect(pkg).not.toContainText(NOTE)
  await expectNoForbiddenWording(page, '/medical with package')
  await pkg.getByRole('button', { name: 'Mark reviewed' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Marked reviewed.' })).toBeVisible()
  await expect(pkg.locator('.sh-reviewed')).toContainText('Reviewed')
  await expect(pkg.getByRole('button', { name: 'Mark reviewed' })).toHaveCount(0)

  // Back as the astronaut: the delivery track shows Reviewed with its proof time.
  await switchRole(page, 'Astronaut')
  await openShareFromNav(page)
  const back = page.getByRole('region', { name: 'Delivery', exact: true }).last()
  await expect(back.locator('[aria-current="step"]')).toContainText('Reviewed')
  await expect(back.locator('li', { hasText: 'Reviewed' }).locator('time')).toHaveCount(1)

  expect(consoleErrors).toEqual([])
})

test('the planner never sees health records, only the operational request', async ({ page }) => {
  await open(page, '/rest-window')
  await page.getByRole('button', { name: 'Request this change' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Request saved on this device' })).toBeVisible()

  await switchRole(page, 'Planner')
  await page.getByRole('link', { name: 'Mission planner view' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Operational requests' })).toBeVisible()
  const main = page.locator('main')
  await expect(main).toContainText('Planning meeting')
  await expect(main).not.toContainText('No open operational request.')
  for (const health of ['Decode correct answers', 'Lower back pain', 'Resting pulse', 'alertness']) {
    await expect(main).not.toContainText(health)
  }

  // The share screen refuses to build a package for another role.
  await openShareFromNav(page)
  await expect(main).toContainText('Only the astronaut can prepare a share from their record.')
})
