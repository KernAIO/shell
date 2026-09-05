import { expect, type Page, test } from '@playwright/test'
import { auditFocusVisibility, auditPage, report, type Violation } from './ux-audit'

/**
 * A sweep of every screen against the rules in `ux-audit.ts`.
 *
 * The feature specs beside this one ask whether a screen works. This one asks whether it is pleasant
 * to use — and it asks the whole app rather than the page somebody happened to be editing, because
 * the defects it looks for arrive one at a time and are only ever noticed all at once, by a customer.
 *
 * Adding a route here is the price of adding a route.
 */

const WS = 'northstar'

/**
 * Every screen reachable in the mock workspace, in the order the navigation offers them.
 *
 * A route that is not here is a route nobody checks, so adding a screen means adding it — and a
 * module's screens join this list in the same change that adds the module, not afterwards.
 */
const ROUTES: { path: string; name: string }[] = [
  { path: `/${WS}`, name: 'my work' },
  { path: `/${WS}/inbox`, name: 'inbox' },
  { path: `/${WS}/chat`, name: 'chat' },
  { path: `/${WS}/tracker`, name: 'tracker' },
  { path: `/${WS}/tracker/reports`, name: 'tracker reports' },
  { path: `/${WS}/quire`, name: 'quire' },
  { path: `/${WS}/quire/handbook`, name: 'quire space' },
  // The largest surface in the module: the title, the byline, the editor and the comment margin.
  { path: `/${WS}/quire/handbook/01920000-0000-7000-8000-000000000101`, name: 'quire page' },
  // The same screen carrying the unpublished-draft banner, which nothing else on this list draws.
  { path: `/${WS}/quire/handbook/01920000-0000-7000-8000-000000000102`, name: 'quire page with a draft' },
  { path: `/${WS}/quire/handbook/01920000-0000-7000-8000-000000000110`, name: 'quire database' },
  /*
   * The published site: the one part of the product a signed-out stranger sees, and the only one
   * that renders on the server with no JavaScript at all. It has its own layout, its own palette
   * decisions and its own writing direction, so nothing else on this list covers it — and because
   * `csr = false` there, what this sweep audits is the HTML itself rather than a hydrated app.
   *
   * Three entries, because the route has three faces: the front page, a nested page (breadcrumbs,
   * an open branch in the contents), and the in-site search. The mock publishes "Working here" with
   * "Your first week" under it and "Time off" opted out, so the tree here is the pruned one.
   */
  { path: `/p/${WS}/working-here`, name: 'published site' },
  { path: `/p/${WS}/working-here/your-first-week`, name: 'published site page' },
  { path: `/p/${WS}/working-here?q=week`, name: 'published site search' },
  { path: `/${WS}/inventory`, name: 'inventory' },
  // The largest surface in the module and the only screen that draws custody, repairs, files and
  // the change history: a 440px sheet over the list, opened by `?asset=<id>`. The id is the first
  // asset the module's own mock seeds — its ids live in the `…-8001-…` namespace so that none of
  // them can collide with a shell mock user id.
  {
    path: `/${WS}/inventory?asset=01920000-0000-7000-8001-000000000001`,
    name: 'inventory asset panel',
  },
  { path: `/${WS}/admin`, name: 'admin' },
  { path: `/${WS}/admin/settings`, name: 'admin settings' },
  { path: `/${WS}/admin/users`, name: 'admin users' },
  { path: `/${WS}/admin/modules`, name: 'admin modules' },
  { path: `/${WS}/admin/updates`, name: 'admin updates' },
  { path: `/${WS}/admin/billing/plans`, name: 'admin billing plans' },
  { path: `/${WS}/admin/billing/subscriptions`, name: 'admin billing subscriptions' },
  { path: `/${WS}/settings`, name: 'settings' },
  { path: `/${WS}/settings/profile`, name: 'settings profile' },
  { path: `/${WS}/settings/appearance`, name: 'settings appearance' },
  { path: `/${WS}/settings/notifications`, name: 'settings notifications' },
  { path: `/${WS}/settings/security`, name: 'settings security' },
  { path: `/${WS}/settings/members`, name: 'settings members' },
  { path: `/${WS}/settings/groups`, name: 'settings groups' },
  { path: `/${WS}/settings/roles`, name: 'settings roles' },
  { path: `/${WS}/settings/modules`, name: 'settings modules' },
  { path: `/${WS}/settings/integrations`, name: 'settings integrations' },
  { path: `/${WS}/settings/mcp`, name: 'settings mcp' },
  { path: `/${WS}/settings/audit`, name: 'settings audit' },
  { path: `/${WS}/settings/dashboard`, name: 'settings dashboard' },
  { path: `/${WS}/settings/billing/plan`, name: 'settings billing plan' },
  { path: `/${WS}/settings/mail`, name: 'settings mail' },
  { path: `/${WS}/settings/tracker/projects`, name: 'settings tracker projects' },
  { path: `/${WS}/settings/tracker/types`, name: 'settings tracker types' },
  { path: `/${WS}/settings/tracker/fields`, name: 'settings tracker fields' },
  { path: `/${WS}/settings/tracker/workflows`, name: 'settings tracker workflows' },
  { path: `/${WS}/settings/tracker/planning`, name: 'settings tracker planning' },
  { path: `/${WS}/settings/tracker/repeating`, name: 'settings tracker repeating' },
  { path: `/${WS}/settings/inventory/general`, name: 'settings inventory general' },
  { path: `/${WS}/settings/inventory/categories`, name: 'settings inventory categories' },
  { path: `/${WS}/hr`, name: 'hr directory' },
  { path: `/${WS}/hr/leave`, name: 'hr leave' },
  { path: `/${WS}/hr/attendance`, name: 'hr attendance' },
  { path: `/${WS}/hr/approvals`, name: 'hr approvals' },
  { path: `/${WS}/hr/offices`, name: 'hr offices' },
  { path: `/${WS}/hr/org`, name: 'hr org chart' },
  { path: `/${WS}/hr/rosters`, name: 'hr rosters' },
  { path: `/${WS}/hr/checklists`, name: 'hr checklists' },
  { path: `/${WS}/hr/reports`, name: 'hr reports' },
  { path: `/${WS}/quire/transfers`, name: 'quire transfers' },
  { path: `/${WS}/quire/handbook/trash`, name: 'quire trash' },
  { path: `/${WS}/settings/tracker/import`, name: 'settings tracker import' },
  { path: `/${WS}/settings/inventory/fields`, name: 'settings inventory fields' },
  { path: `/${WS}/settings/hr/general`, name: 'settings hr general' },
  { path: `/${WS}/settings/hr/capabilities`, name: 'settings hr capabilities' },
  { path: `/${WS}/settings/hr/offices`, name: 'settings hr offices' },
  { path: `/${WS}/settings/hr/entities`, name: 'settings hr entities' },
  { path: `/${WS}/settings/hr/calendars`, name: 'settings hr calendars' },
  { path: `/${WS}/settings/hr/leave`, name: 'settings hr leave' },
  { path: `/${WS}/settings/hr/schedules`, name: 'settings hr schedules' },
  { path: `/${WS}/settings/hr/accrual`, name: 'settings hr accrual' },
  { path: `/${WS}/settings/hr/approvals`, name: 'settings hr approvals' },
  { path: `/${WS}/settings/hr/periods`, name: 'settings hr periods' },
  { path: `/${WS}/settings/hr/fields`, name: 'settings hr fields' },
  { path: `/${WS}/settings/hr/rosters`, name: 'settings hr rosters' },
  { path: `/${WS}/settings/hr/checklists`, name: 'settings hr checklists' },
  { path: `/${WS}/settings/hr/privacy`, name: 'settings hr privacy' },
  { path: `/${WS}/settings/hr/payroll`, name: 'settings hr payroll' },
  { path: '/workspaces', name: 'workspaces' },
  { path: '/authorize?id=mock-auth-request', name: 'authorize' },
  { path: '/sign-in', name: 'sign in' },
  { path: '/sign-up', name: 'sign up' },
  { path: '/forgot', name: 'forgot password' },
  /*
   * The invitation link, in both of the shapes a person actually opens.
   *
   * Every invitation email in the product points here, and it is read by somebody who has never
   * seen Kern — so it is worth sweeping twice: the live invitation, which is a mark, a sentence and
   * a button, and one refusal, which is a tinted seal on a coloured ground and therefore the half
   * with something to say about contrast in dark mode. The mock reads these tokens; any other one
   * is the live invitation.
   */
  { path: '/invite/mock-invite', name: 'invitation' },
  { path: '/invite/mock-invite-expired', name: 'invitation no longer valid' },
  /*
   * The first screen of a self-serve sign-up. Kern Cloud runs `KERN_SIGNUP=open`, so this is where
   * signing up lands you and where the first button press happens — and it is swept in both of its
   * faces, because they share almost no markup: the workspace form, and the confirm-your-address
   * card that every unverified account meets instead of it. The second is reached by
   * `kern.mock.unverified`, below.
   */
  { path: '/onboarding', name: 'onboarding' },
  // Export and erasure: what the terms and the privacy policy promise, and the two screens that
  // keep those promises. Both carry a danger-toned section, which is the strongest colour on any
  // settings page and therefore the one most worth measuring in dark mode.
  { path: `/${WS}/settings/data`, name: 'settings data and privacy' },
  { path: `/${WS}/settings/account`, name: 'settings account' },
  /*
   * The second-factor challenge. Every account with 2FA on meets it on every sign-in, and until
   * 2026-09-05 it was unreachable by construction — the sign-in redirect sat inside `if
   * (res.error)`, which never fires for a pending factor — so nothing had ever looked at it. It is
   * the one auth screen made almost entirely of a single six-digit field, which is exactly the
   * shape that goes wrong in RTL and at a phone width.
   */
  { path: '/two-factor', name: 'two-factor challenge' },
]

/** The scheduled-erasure record `SWITCHED` seeds, so the branch can be swept without driving the flow. */
const SCHEDULED_DELETIONS = JSON.stringify({
  workspaces: {
    // the demo workspace's id in `src/lib/api/mock.ts`
    '01920000-0000-7000-8000-000000000010': {
      id: '01920000-0000-7000-8002-000000000900',
      subjectKind: 'workspace',
      subjectId: '01920000-0000-7000-8000-000000000010',
      status: 'scheduled',
      purgeAfter: '2099-01-01T00:00:00.000Z',
      followUps: ["tracker: no erase procedure — this module's data is not removed by this request."],
      error: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
    },
  },
  account: {
    id: '01920000-0000-7000-8002-000000000901',
    subjectKind: 'account',
    subjectId: 'mock-user',
    status: 'scheduled',
    purgeAfter: '2099-01-01T00:00:00.000Z',
    followUps: [],
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
  },
})

/**
 * Routes that need a mock switch thrown before the app loads.
 *
 * `page.addInitScript` is the only moment early enough — these are read live from `localStorage` by
 * `src/lib/api/mock.ts`, but the first read happens during the first render, so setting them after
 * `goto` sweeps the screen that was already drawn.
 */
const SWITCHED: { path: string; name: string; flags: Record<string, string> }[] = [
  {
    path: '/onboarding',
    name: 'onboarding with an unconfirmed address',
    flags: { 'kern.mock.unverified': '1' },
  },
  {
    path: `/${WS}/settings/data`,
    name: 'settings data with an erasure scheduled',
    flags: { 'kern.mock.deletions': SCHEDULED_DELETIONS },
  },
  {
    path: `/${WS}/settings/account`,
    name: 'settings account with a closure scheduled',
    flags: { 'kern.mock.deletions': SCHEDULED_DELETIONS },
  },
]

/**
 * Waits for the screen to settle before judging it. A skeleton has different colours from the
 * content it stands in for, so auditing mid-load reports the loading state rather than the screen.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  // `.ksk` is the skeleton block from @kernhq/ui; while one is on screen the audit would be
  // judging the loading state's colours rather than the screen's
  await expect(page.locator('.ksk, [aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 })
}

/**
 * Collects anything the page throws while it renders.
 *
 * A Svelte render error is not a console warning — it stops the paint where it happened, so the
 * screen keeps its skeletons and reads as "still loading" rather than "broken". One duplicate key
 * in the mock's module list did exactly that to four admin screens, and no build, type-check or
 * feature test noticed. A page that throws has failed before any of the rules below apply.
 */
function watchForErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

async function visit(page: Page, path: string) {
  await page.goto(path)
  await settle(page)
}

/** Both themes and both writing directions — four renderings of the same markup, all shipped. */
const RENDERINGS = [
  { name: 'light ltr', theme: 'light', locale: 'en' },
  { name: 'dark ltr', theme: 'dark', locale: 'en' },
  { name: 'light rtl', theme: 'light', locale: 'fa' },
  { name: 'dark rtl', theme: 'dark', locale: 'fa' },
] as const

/**
 * A cookie belongs to an origin, and the origin here is whichever one the run is against.
 *
 * It was the literal `http://localhost:4173`, which is right for `pnpm test:e2e` and silently wrong
 * for a run pointed anywhere else: the cookie lands on a origin the page never visits, `kern_locale`
 * is never read, and the two Persian renderings sweep an English left-to-right page while reporting
 * that RTL is clean. `baseURL` is the same value the config already gives `page.goto`.
 */
async function useRendering(page: Page, r: { theme: string; locale: string }, baseURL: string) {
  await page.context().addCookies([{ name: 'kern_locale', value: r.locale, url: baseURL }])
  await page.addInitScript((theme) => {
    localStorage.setItem('kern.theme', theme)
  }, r.theme)
}

for (const rendering of RENDERINGS) {
  test.describe(rendering.name, () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await useRendering(page, rendering, baseURL!)
    })

    for (const route of ROUTES) {
      test(`${route.name} is usable`, async ({ page }) => {
        const errors = watchForErrors(page)
        await visit(page, route.path)
        expect(errors, `${route.path} threw while rendering`).toEqual([])
        const result = await auditPage(page)
        expect(
          result.counted.interactive,
          `${route.path} rendered no interactive elements — it is blank, not clean`,
        ).toBeGreaterThan(0)
        expect(result.violations, report(`${route.path} (${rendering.name})`, result.violations)).toEqual([])
      })
    }

    for (const route of SWITCHED) {
      test(`${route.name} is usable`, async ({ page }) => {
        const errors = watchForErrors(page)
        await page.addInitScript((flags) => {
          for (const [k, v] of Object.entries(flags)) localStorage.setItem(k, v)
        }, route.flags)
        await visit(page, route.path)
        expect(errors, `${route.path} threw while rendering`).toEqual([])
        const result = await auditPage(page)
        expect(
          result.counted.interactive,
          `${route.path} rendered no interactive elements — it is blank, not clean`,
        ).toBeGreaterThan(0)
        expect(result.violations, report(`${route.path} (${rendering.name})`, result.violations)).toEqual([])
      })
    }
  })
}

/**
 * The keyboard route, checked once per theme rather than per page: a focus ring comes from the
 * shared stylesheet, so a page that loses it loses it everywhere.
 */
for (const theme of ['light', 'dark'] as const) {
  test(`every control shows where the keyboard is (${theme})`, async ({ page, baseURL }) => {
    await useRendering(page, { theme, locale: 'en' }, baseURL!)
    await visit(page, `/${WS}/settings/members`)
    const violations: Violation[] = await auditFocusVisibility(page, 30)
    expect(violations, report(`keyboard focus (${theme})`, violations)).toEqual([])
  })
}

/**
 * A narrow viewport is not a separate design, it is the same one at a width people actually hold.
 * Sideways scroll is what breaks first, so it is what is guarded.
 */
test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // A count rather than a named set, so it silently narrows the moment a route is inserted above it
  // — three quire routes did exactly that. Grow it by however many you add.
  // 16 → 17 for the inventory asset panel, which is a 440px sheet and therefore has more to say
  // about a 390px viewport than most of the list above it.
  // 17 → 20 for the three published-site routes, which belong here more than most: a handbook
  // somebody published is read on a phone by people who have never seen the application.
  // 20 → 22 for admin settings and admin users, inserted above this line — exactly the silent
  // narrowing the first sentence warns about: without growing it, `admin modules` and
  // `admin updates` would have dropped out of the phone sweep and nothing would have said so.
  // The invitation routes are named rather than counted because they sit at the end of the list:
  // an invitation arrives by email, and email is read on a phone.
  // The data-and-privacy and account routes are named for the same reason as the invitations: they
  // sit at the end of the list, and a danger zone is worth checking at a width where the button and
  // its explanation have to stack rather than sit side by side.
  // `/two-factor` is named too, and it is the one route here somebody is *most* likely to meet on a
  // phone: the authenticator holding the code is the phone, so the screen asking for it is being
  // read on the same device it is being copied from.
  const PHONE_ROUTES = [
    ...ROUTES.slice(0, 22),
    ...ROUTES.filter(
      (r) =>
        r.path.startsWith('/invite/') ||
        r.path.endsWith('/settings/data') ||
        r.path.endsWith('/settings/account') ||
        r.path === '/two-factor',
    ),
  ]
  for (const route of PHONE_ROUTES) {
    test(`${route.name} does not scroll sideways`, async ({ page, baseURL }) => {
      await useRendering(page, RENDERINGS[0], baseURL!)
      await visit(page, route.path)
      const result = await auditPage(page)
      const overflow = result.violations.filter((v) => v.rule === 'overflow')
      expect(overflow, report(`${route.path} at 390px`, overflow)).toEqual([])
    })
  }
})
