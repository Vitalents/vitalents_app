// S1 demo, step 3: daily check, then a demo-length Decode round played with the keyboard.
import type { Page } from '@playwright/test'
import { expect, expectNoForbiddenWording, open, test } from './helpers'

/**
 * Answers the round like a careful player: reads the key, finds the digit for the symbol on screen,
 * and presses it on the keyboard about 400 ms after the symbol appears (well above the 250 ms
 * random-pressing limit). Returns when the round screen is gone.
 */
async function playRound(page: Page) {
  const round = page.locator('section.dc-round')
  await expect(round).toBeVisible()
  let presses = 0
  while (await round.isVisible()) {
    const digit = await page.evaluate(() => {
      const current = document.querySelector('.dc-current svg.glyph')
      if (!current) return null
      for (const li of document.querySelectorAll('.dc-key li')) {
        if (li.querySelector('svg')?.innerHTML === current.innerHTML) return li.querySelector('.dc-key-digit')?.textContent ?? null
      }
      return null
    })
    if (digit) {
      await page.waitForTimeout(400)
      if (!(await round.isVisible())) break
      await page.keyboard.press(digit)
      presses += 1
      // wait for the 150 ms acknowledgement gap to pass before reading the next symbol
      await page.waitForTimeout(200)
    } else {
      await page.waitForTimeout(50)
    }
  }
  return presses
}

test('daily check then demo Decode: result beside the self-rating, never combined', async ({ page, consoleErrors }) => {
  test.setTimeout(150_000)
  await open(page, '/check')

  // Daily check: sleep with source, alertness 1-10, mood, private note.
  await expect(page.getByRole('heading', { name: 'Daily check' })).toBeVisible()
  await expect(page.getByText('5.2 h recorded')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'How alert do you feel right now?' }).getByRole('radio', { name: '6', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Mood' }).getByRole('radio', { name: 'Tired' }).click()
  await page.getByLabel('Private note (optional)').fill('e2e private note')
  await page.getByRole('button', { name: 'Save and continue to Decode' }).click()

  // Intro: validation label, demo length toggle.
  await expect(page.getByRole('heading', { name: 'Decode', exact: true })).toBeVisible()
  await expect(page.getByText('Inspired by the DSST. Our version needs independent validation.')).toBeVisible()
  await page.getByLabel('Demo length (30 s)').check()
  await expect(page.getByText('Demo length, not a measurement. It is saved as practice', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Start practice' }).click()

  // Practice (10 s, different key, not recorded).
  await expect(page.getByRole('region', { name: 'Practice, not recorded' })).toBeVisible()
  await playRound(page)
  await expect(page.getByRole('heading', { name: 'Practice done' })).toBeVisible()
  await expect(page.getByText('The round lasts 30 seconds.')).toBeVisible()
  await page.getByRole('button', { name: 'Start the round' }).click()

  // Demo-length round (30 s).
  await expect(page.getByRole('region', { name: 'Demo length, not a measurement' })).toBeVisible()
  const presses = await playRound(page)
  expect(presses).toBeGreaterThan(10)

  await expect(page.getByRole('heading', { name: 'Was there an interruption during the round?' })).toBeVisible()
  await page.getByRole('button', { name: 'No', exact: true }).click()
  await expect(page.getByText('Message from Earth')).toBeVisible()
  await page.getByRole('button', { name: 'See your result' }).click()

  // Result: Decode panel and self-rating panel side by side.
  const result = page.getByRole('region', { name: 'Today’s Decode' })
  await expect(result).toBeVisible()
  const panels = result.locator('.dc-panel')
  await expect(panels).toHaveCount(2)
  const decode = panels.nth(0)
  const self = panels.nth(1)
  await expect(decode.getByRole('heading', { name: 'Decode' })).toBeVisible()
  await expect(decode).toContainText('correct answers')
  await expect(decode).toContainText('Accuracy')
  await expect(decode).toContainText('Demo-length round: saved as practice, never used for your reference.')
  await expect(self.getByRole('heading', { name: 'Your self-rating today' })).toBeVisible()
  await expect(self.locator('.dc-big')).toHaveText('6/10')
  await expect(result).toContainText('Shown side by side: these are different scales and are never combined.')

  // Side by side on a desktop viewport: same row, two columns.
  const a = (await decode.boundingBox())!
  const b = (await self.boundingBox())!
  expect(Math.abs(a.y - b.y)).toBeLessThan(4)
  expect(b.x).toBeGreaterThan(a.x + a.width - 1)

  // The correct count is not merged with the rating anywhere in the result.
  const correct = Number((await decode.locator('.dc-big').innerText()).match(/\d+/)?.[0])
  expect(correct).toBeGreaterThan(0)
  await expect(result).not.toContainText(/score/i)
  await expect(result.locator('.dc-big')).toHaveCount(2)

  await expectNoForbiddenWording(page, '/check result')
  expect(consoleErrors).toEqual([])
})
