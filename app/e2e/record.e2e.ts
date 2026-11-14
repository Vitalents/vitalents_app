// S1 demo, step 9: Record & trends. Today (mission day 27) has no Decode session, so the chart shows a
// labelled gap, never a 0 (CLAUDE.md rule 10).
import { expect, expectNoForbiddenWording, open, test } from './helpers'

test('/record: Decode chart with "No reading" on day 27, self-rating on its own card', async ({ page, consoleErrors }) => {
  await open(page, '/record')
  await expect(page.getByRole('heading', { level: 1, name: 'Record & trends' })).toBeVisible()

  const decode = page.locator('article.tr-card', { has: page.getByRole('heading', { name: 'Decode correct answers' }) })
  await expect(decode).toBeVisible()
  const figure = decode.getByRole('figure', { name: 'Decode correct answers over time, with your personal reference' })
  await expect(figure).toBeVisible()
  await expect(figure.locator('svg.recharts-surface')).toBeVisible()

  // Day 23 had an interrupted round with no score. Day 27 has no round yet.
  await expect(figure.locator('svg text', { hasText: 'No reading' })).toHaveCount(2)
  await expect(figure).toContainText('No reading (a gap, never 0)')
  await expect(decode.locator('.tr-stats')).toContainText('No reading: 14 Nov (day 27)')
  const today = decode.locator('details.tr-table tbody tr').first()
  await expect(today).toContainText('14 Nov (day 27)')
  await expect(today.locator('td').nth(1)).toHaveText('No reading')
  await expect(today.locator('td').nth(1)).not.toHaveText(/^0/)

  // The latest value is still day 26 and is compared with the personal reference, with a Why? link.
  await expect(decode.locator('.tr-stats')).toContainText('on 13 Nov (day 26)')
  await expect(decode.locator('.tr-stats')).toContainText('Below your personal range')
  await expect(decode.getByText('Why?').first()).toBeVisible()

  // Self-rating has its own card: never one number with Decode (rule 3).
  await expect(page.locator('article.tr-card', { has: page.getByRole('heading', { name: 'Self-rated alertness' }) })).toBeVisible()

  await expectNoForbiddenWording(page, '/record')
  expect(consoleErrors).toEqual([])
})
