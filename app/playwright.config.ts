// End-to-end tests (WP-09): the S1 demo path against the production build served by `vite preview`.
// Test files are named *.e2e.ts so Vitest (which picks up *.test.* / *.spec.*) never runs them.
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4317)
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // The public build: cached assistant answers, never the local service.
    command: `${process.env.E2E_SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_ASSISTANT_MODE: 'cached' },
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
})
