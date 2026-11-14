import { expect, open, switchRole, test } from './helpers'

test.use({ serviceWorkers: 'block' })

for (const exit of ['navigation', 'reload'] as const) {
  test(`an unfinished measured round survives ${exit} with its event ledger`, async ({ page }) => {
    await page.clock.install()
    await open(page, '/check')
    await page.getByRole('button', { name: 'Go to Decode', exact: true }).click()
    await page.getByRole('button', { name: 'Start practice', exact: true }).click()
    await page.clock.runFor(10_100)
    await page.getByRole('button', { name: 'Start the round', exact: true }).click()
    await page.clock.runFor(600)
    await page.keyboard.press('1')
    await expect.poll(() => page.evaluate(async () => {
      const request = indexedDB.open('vitalents')
      const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
      const transaction = db.transaction('decode_response_event')
      const query = transaction.objectStore('decode_response_event').getAll()
      const rows = await new Promise<Record<string, unknown>[]>((resolve) => { query.onsuccess = () => resolve(query.result) })
      db.close()
      return rows.filter((r) => r.data_origin === 'live_decode').length
    })).toBeGreaterThan(0)
    if (exit === 'reload') await page.reload()
    else await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Record & trends', exact: true }).click()
    await expect.poll(() => page.evaluate(async () => {
      const request = indexedDB.open('vitalents')
      const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
      const query = db.transaction('decode_session').objectStore('decode_session').getAll()
      const rows = await new Promise<Record<string, unknown>[]>((resolve) => { query.onsuccess = () => resolve(query.result) })
      db.close()
      return rows.filter((r) => r.data_origin === 'live_decode').map((r) => r.session_state)
    })).toEqual(['aborted'])
  })
}

test('Planner cannot open health routes or mutate the astronaut plan', async ({ page, consoleErrors }) => {
  await open(page, '/settings')
  await switchRole(page, 'Planner')
  for (const path of ['/plan', '/check', '/record', '/review', '/domain/cognition', '/profile', '/ask', '/research']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'This view belongs to another role' })).toBeVisible()
    await expect(page.locator('main')).not.toContainText('37 vs 41-44')
    await expect(page.getByRole('button', { name: 'Mark done', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Report something', exact: true })).toHaveCount(0)
  }
  await page.getByRole('link', { name: 'Open my role’s view' }).click()
  await expect(page.getByRole('heading', { name: 'Operational requests', exact: true })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('a newly reported symptom opens a medical review and becomes part of the current review', async ({ page, consoleErrors }) => {
  await open(page, '/review')
  await page.getByRole('button', { name: 'Report something', exact: true }).click()
  await page.getByLabel('What did you notice?').fill('Test report: headache today')
  await page.locator('label').filter({ hasText: /^Severe$/ }).click()
  await page.getByRole('button', { name: 'Save report', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Saved.')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.locator('main')).toContainText('You reported a symptom today.')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plan & follow-ups', exact: true }).click()
  const card = page.getByRole('article', { name: 'Medical team reviews your report', exact: true })
  await expect(card).toContainText('Medical team')
  await expect(card).toContainText('Review requested')
  await expect(card.getByRole('button', { name: 'Mark done', exact: true })).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})

test('a deployment fixture change keeps a locally saved report', async ({ page }) => {
  await open(page, '/review')
  await page.getByRole('button', { name: 'Report something', exact: true }).click()
  await page.getByLabel('What did you notice?').fill('Preserve this local observation')
  await page.getByRole('button', { name: 'Save report', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Saved.')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await page.route('**/data/fixtures/S1.json', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, body: `${await response.text()}\n` })
  })
  await page.goto('/settings')
  await expect(page.getByRole('status').filter({ hasText: 'Your saved record has been kept' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plan & follow-ups', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Medical team reviews your report', exact: true })).toBeVisible()
  expect(await page.evaluate(async () => {
    const request = indexedDB.open('vitalents')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const query = db.transaction('self_report').objectStore('self_report').getAll()
    const rows = await new Promise<{ symptom_text?: string }[]>((resolve) => { query.onsuccess = () => resolve(query.result) })
    db.close()
    return rows.some((r) => r.symptom_text?.includes('Preserve this local observation'))
  })).toBe(true)
})
