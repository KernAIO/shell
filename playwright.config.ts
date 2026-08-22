import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the mock API (`PUBLIC_API_MOCK=1`), so they need no database, no
 * services and no fixtures: the same in-memory backend the interface is developed against is the one
 * under test, and it is deterministic between runs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    locale: 'en-GB',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Recording a voice or video message needs a capture device and a granted permission.
        // Chrome's fake device produces a silent tone and a test pattern, so the recorder can be
        // exercised for real rather than mocked away.
        permissions: ['microphone', 'camera'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'PUBLIC_API_MOCK=1 npm run build && PUBLIC_API_MOCK=1 npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
