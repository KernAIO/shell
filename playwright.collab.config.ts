import { defineConfig, devices } from '@playwright/test'

/**
 * Collaborative editing, in two real browsers, against the real stack.
 *
 * Separate from `playwright.config.ts` because it is the opposite kind of test. That suite runs
 * against the mock API — no database, no services, deterministic, and fast enough that everybody
 * runs it. This one needs Postgres, `core` and `collab`, and it needs the shell *not* in mock mode,
 * because there is no collab service behind the mock and `PageEditor` says so rather than pretending
 * to sync. Keeping them apart is what stops `pnpm test:e2e` growing a dependency on a running stack.
 *
 * How to run it is in the header of `tests/e2e/quire-collab.spec.ts`.
 *
 * The shell is served by `vite dev` on **5173** rather than by `vite preview` on some spare port,
 * and both halves of that matter. Only `vite dev` reads `server.proxy`, which is what puts `/api`
 * on core and `/collab` on the collab service at the app's own origin — `preview` serves the build
 * and proxies nothing, so the WebSocket would have nowhere to go. And 5173 is the one origin
 * `KERN_BASE_URL` declares, so it is the only one Better Auth and core's CORS accept.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'quire-collab.spec.ts',
  /*
   * Its own subdirectory, because Playwright empties its output directory when a run starts. This
   * suite therefore cannot delete the mock suite's traces and screenshots. The reverse still
   * happens — `pnpm test:e2e` owns `test-results/` itself — so when a failure here needs its
   * artefacts, do not start the other suite while reading them.
   */
  outputDir: './test-results/collab',
  /*
   * Multiplayer is timing-sensitive and every test drives two browsers through one collab service,
   * so they run one at a time. Parallelism here buys seconds and costs reproducibility.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  /* Waiting for a document to converge across two browsers is slower than clicking a button. */
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'en-GB',
    timezoneId: 'UTC',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /*
     * No `PUBLIC_API_MOCK` — that is the whole point. `reuseExistingServer` picks up the `pnpm dev`
     * a developer already has running; the spec checks that whatever answers is not the mock, so a
     * stray mock server fails loudly instead of quietly passing nothing.
     */
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
