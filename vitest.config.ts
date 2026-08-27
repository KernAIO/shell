import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  /**
   * `$lib` only, and deliberately not `$msg` or `$app`.
   *
   * SvelteKit resolves its own aliases through a Vite plugin vitest does not run, so a `.ts` file
   * under `src/lib` that imports a sibling by `$lib/...` cannot be unit-tested without this — which
   * is why `mock.ts` had no test at all while the numbers it reports drifted three phases behind
   * the modules. The Paraglide and `$app` aliases are a different problem and this does not solve
   * them: a module that imports `$msg` still takes its wording as a parameter instead.
   */
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    // unit tests only; the Playwright suites live in `tests/e2e` and run under `pnpm test:e2e`
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
