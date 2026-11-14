// Shared helpers for the e2e suite. Every test gets a fresh browser context, so IndexedDB and
// localStorage start empty and the app loads scenario S1 on first start.
import { expect, test as base, type Page } from '@playwright/test'

export const ROUTES = [
  '/',
  '/check',
  '/review',
  '/record',
  '/plan',
  '/rest-window',
  '/share',
  '/medical',
  '/planner',
  '/settings',
  '/ask',
  '/profile',
  '/domain/cognition',
  '/domain/sleep',
  '/domain/heart',
  '/domain/symptoms',
  '/domain/nutrition',
  '/domain/movement',
  '/domain/radiation',
]

/** Console errors and uncaught page errors seen during a test. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, runTest) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await runTest(errors)
  },
})
export { expect }

/** Open a route and wait until the shell has loaded the mission record. */
export async function open(page: Page, path: string) {
  await page.goto(path)
  await waitReady(page)
}

export async function waitReady(page: Page) {
  await expect(page.locator('main .loading-state')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText('Loading the mission record')
  await expect(page.locator('main [role="status"]', { hasText: 'Loading' })).toHaveCount(0)
}

/** Navigate inside the app (no reload) through the Settings icon. */
export async function goSettings(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
}

/** Main navigation entry for /share ("Review & sharing"), without a reload. */
export async function openShareFromNav(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Review & sharing' }).click()
  await expect(page).toHaveURL(/\/share$/)
}

/** Segmented control: the radio input sits under its label, so click the label like a user does. */
export async function pickSegment(page: Page, group: string, option: string) {
  const g = page.getByRole('group', { name: group })
  await g.locator('label').filter({ hasText: new RegExp(`^${option}$`) }).click()
  await expect(g.getByRole('radio', { name: option, exact: true })).toBeChecked()
}

/** Demo role switch in Settings (in-app navigation, no reload). */
export async function switchRole(page: Page, role: 'Astronaut' | 'Medical team' | 'Planner') {
  await goSettings(page)
  await pickSegment(page, 'Demo role', role)
}

/** Settings: pick a scenario and confirm the reload. */
export async function loadScenario(page: Page, code: string) {
  await open(page, '/settings')
  await page.getByLabel('Choose a scenario').selectOption(code)
  await page.getByRole('button', { name: `Load ${code}`, exact: true }).click()
  await page.getByRole('button', { name: `Confirm: replace local data with ${code}` }).click()
  await expect(page.getByRole('status').filter({ hasText: `Scenario ${code} loaded.` })).toBeVisible()
  await expect(page.getByText(`Loaded: ${code} (simulated)`)).toBeVisible()
}

// Forbidden wording (CLAUDE.md "Wording", scripts/check_language.py). Same rule as the source check:
// a word is allowed only when negated just before it ("not a diagnosis", "does not prove").
const FORBIDDEN: [RegExp, string][] = [
  [/\bhealthy\b/i, 'healthy'],
  [/\ball clear\b/i, 'all clear'],
  [/\bnormal\b/i, 'normal'],
  [/\bdiagnos\w*/i, 'diagnosis'],
  [/\breadiness\b/i, 'readiness'],
  [/\b\d+\s*%\s*ready\b/i, 'readiness %'],
  [/\bnot ready\b/i, 'not ready'],
  [/\bready\b/i, 'ready'],
  [/\bfit for duty\b/i, 'fit for duty'],
  [/\bfatigue detected\b/i, 'fatigue detected'],
  [/\bcaused by\b/i, 'caused by'],
  [/\bworked\b/i, 'worked'],
  [/\bproves?\b/i, 'proves'],
  [/\bbest treatment\b/i, 'best treatment'],
]
const NEGATION = /\b(no|not|never|cannot|without|n't)\b[\w\s,]{0,30}$/i

export function forbiddenHits(text: string): string[] {
  const hits: string[] = []
  for (const line of text.split(/\n+/)) {
    for (const [rx, label] of FORBIDDEN) {
      const g = new RegExp(rx.source, 'gi')
      for (const m of line.matchAll(g)) {
        if (!NEGATION.test(line.slice(0, m.index))) {
          hits.push(`${label}: "${line.trim().slice(0, 120)}"`)
          break
        }
      }
    }
  }
  return hits
}

/** Visible text plus accessible names (aria-label, title), which screen readers announce too. */
export async function renderedText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.body.innerText]
    document.querySelectorAll('[aria-label],[title]').forEach((el) => {
      const a = el.getAttribute('aria-label')
      const t = el.getAttribute('title')
      if (a) parts.push(a)
      if (t) parts.push(t)
    })
    return parts.join('\n')
  })
}

export async function expectNoForbiddenWording(page: Page, where: string) {
  const hits = forbiddenHits(await renderedText(page))
  expect(hits, `forbidden wording on ${where}`).toEqual([])
}
