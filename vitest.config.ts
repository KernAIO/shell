import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // unit tests only; the Playwright suites live in `tests/e2e` and run under `pnpm test:e2e`
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
