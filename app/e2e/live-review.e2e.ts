import { expect, open, test } from './helpers'

// The S1 reference sessions used a tablet with touch input; preserve the same measurement conditions.
test.use({ serviceWorkers: 'block', hasTouch: true, viewport: { width: 768, height: 1024 }, screen: { width: 768, height: 1024 } })

test('a completed standard round updates the current review with traceable personal comparison', async ({ page, consoleErrors }) => {
  test.setTimeout(150_000)
  await page.clock.install({ time: new Date('2026-11-14T13:00:00Z') })
  await open(page, '/check')
  await page.clock.pauseAt(new Date('2026-11-14T13:00:10Z'))
  await page.getByRole('button', { name: 'Go to Decode', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await page.clock.runFor(10_500)
  await page.getByRole('button', { name: 'Start the round', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Measured round, 90 seconds' })).toBeVisible()

  // Read the visible key and answer 43 symbols at a steady, non-random cadence.
  for (let i = 0; i < 43; i++) {
    await page.clock.fastForward(1800)
    const digit = await page.evaluate(() => {
      const current = document.querySelector('.dc-current svg.glyph')
      for (const li of document.querySelectorAll('.dc-key li')) {
        if (current && li.querySelector('svg')?.innerHTML === current.innerHTML) return li.querySelector('.dc-key-digit')?.textContent
      }
      return null
    })
    expect(digit).toMatch(/^[1-9]$/)
    await page.getByRole('button', { name: `Digit ${digit}`, exact: true }).tap()
    await page.clock.runFor(150)
  }
  await page.clock.fastForward(7000)
  await page.clock.runFor(500)
  await expect(page.getByRole('heading', { name: 'Was there an interruption during the round?' })).toBeVisible()
  await page.clock.runFor(10)
  await page.getByRole('button', { name: 'No', exact: true }).click()
  await page.getByRole('button', { name: 'See your result', exact: true }).click()
  const result = page.getByRole('region', { name: 'Today’s Decode' })
  await expect(result).toContainText(/43\s*correct answers/)
  await expect(result).toContainText('Within your personal range (41–44)')

  const saved = await page.evaluate(async () => {
    const request = indexedDB.open('vitalents')
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result) })
    const read = (table: string) => new Promise<Record<string, unknown>[]>((resolve) => {
      const query = db.transaction(table).objectStore(table).getAll()
      query.onsuccess = () => resolve(query.result)
    })
    const [sessions, qualities, reviews, findings, events, actions] = await Promise.all(
      ['decode_session', 'information_status', 'daily_review', 'finding', 'decode_response_event', 'action'].map(read))
    db.close()
    const session = sessions.find((s) => s.data_origin === 'live_decode')!
    const quality = qualities.find((s) => s.record_ref === session.decode_session_id)!
    const review = reviews.filter((r) => r.decode_session_id === session.decode_session_id)
      .sort((a, b) => String(a.created_at_utc).localeCompare(String(b.created_at_utc))).at(-1)!
    const comparison = findings.find((f) => f.review_id === review.daily_review_id && f.rule_id === 'rule:R-OBS-02')!
    return { session, quality, review, comparison, action: actions.find((a) => a.action_id === review.selected_action_id),
      events: events.filter((e) => e.decode_session_id === session.decode_session_id) }
  })
  expect(saved.session).toMatchObject({ session_state: 'completed', planned_duration_ms: 90000, is_practice: false, correct_count: 43 })
  expect(saved.quality).toMatchObject({ status: 'valid', reference_eligible: true })
  expect(saved.comparison.supporting_record_ids).toContain(saved.session.decode_session_id)
  expect(saved.comparison.supporting_record_ids).toContain('sim:personal_reference:decode-d25')
  expect(saved.action?.finding_id).toBe(saved.comparison.finding_id)
  expect(saved.events.filter((e) => e.is_accepted)).toHaveLength(43)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: "Today's review", exact: true }).click()
  await expect(page.locator('main')).toContainText('43 correct answers; your personal range is 41–44 (within your range).')
  expect(consoleErrors).toEqual([])
})
