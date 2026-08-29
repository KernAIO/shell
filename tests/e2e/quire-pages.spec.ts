import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * Quire's page view, in a real browser, against the mock.
 *
 * The database interface has `quire-database.spec.ts` and the collaborative editor has
 * `quire-collab.spec.ts`, which needs a real stack. The largest surface in the module had neither:
 * the sidebar tree, the title, the byline, the page menu, version history, the comment margin and
 * everything reached from them. This is that file.
 *
 * It asserts **behaviour**. Creating a page has to put a node in the tree *and* leave the caret in
 * the title; renaming has to move the tree without a reload; expanding has to reveal children and
 * the chevron has to turn the right way — measured, in both writing directions, rather than assumed
 * from the stylesheet. A test that only checks a heading is on screen passes just as happily when
 * every control is inert.
 *
 * **The body is not tested as an editor, because behind the mock it is not one.** There is no collab
 * service here, so `PageEditor` draws "Not connected to the collaboration service" instead of a
 * writing surface — and that is what is asserted, including the absence of anything typeable.
 * Typing into a document that two people share is `quire-collab.spec.ts`'s job, against a real
 * `collab`.
 */

const WS = 'northstar'
const SPACE = `/${WS}/quire/handbook`

/** The Handbook space seeded in `module-quire`'s mock — see its `src/client/mock.ts`. */
const PAGES = {
  /** a published page, with a comment thread on it */
  welcome: `${SPACE}/01920000-0000-7000-8000-000000000101`,
  /** a published page with two children and an unpublished draft; no comments */
  workingHere: `${SPACE}/01920000-0000-7000-8000-000000000102`,
  /** a child of "Working here", reachable only once the tree is expanded */
  firstWeek: `${SPACE}/01920000-0000-7000-8000-000000000103`,
  /** a live doc rather than a page — no published face, no draft */
  expenses: `${SPACE}/01920000-0000-7000-8000-000000000105`,
}

/* ------------------------------------------------------------------ handles */

/**
 * The page tree, and not the other two lists beside it.
 *
 * The sidebar grew Favourites and Recent, and both draw the same pages the tree does — so
 * `getByRole('button', { name: 'Welcome' })` inside the navigation landmark began resolving to
 * three elements and every test that opens a page failed on strict mode. That is the features
 * working, not a defect: the same page legitimately appears three times.
 *
 * A tree row is a direct child of the scroll container; a Favourites or Recent row is nested inside
 * that group's own `.group > .stack`. Scoping by the child combinator is what separates them
 * without naming any of the three.
 *
 * It would be better if the tree said what it was — an `aria-label` on it, or the `role="tree"` the
 * accessibility sweep already wants — and then this would be `getByRole('tree')`. Worth doing in
 * the module; this is the shell-side half.
 */
const tree = (page: Page) => page.getByRole('complementary', { name: 'Navigation' }).getByRole('navigation')

/** Just the tree's own rows — see the note above. Controls like "New page" live outside them. */
const treeRows = (page: Page) =>
  tree(page).locator(
    // A row of the tree at any depth — a child page's row is nested inside its parent's — but not
    // one belonging to the Favourites or Recent groups, which wrap theirs in a `.group`.
    'xpath=.//div[contains(@class,"row")][not(ancestor::div[contains(@class,"group")])]',
  )

/**
 * One row of the page tree.
 *
 * Exact, because the row's own name has to be its own title and nothing else. The "+" beside it is
 * labelled "New page inside <title>", so a substring match would claim two elements — and a row
 * whose name has picked up the label of a control drawn inside it is precisely the defect that
 * makes a screen reader read the tree wrong.
 */
const row = (page: Page, title: string) => treeRows(page).getByRole('button', { name: title, exact: true })

/**
 * The disclosure twisty of a row with children.
 *
 * `aria-expanded` alone also matches the space switcher, which is a popup trigger rather than a
 * disclosure; `aria-haspopup` is what separates the two.
 */
const twisty = (page: Page) => treeRows(page).locator('button[aria-expanded]:not([aria-haspopup])')

const titleField = (page: Page) => page.getByRole('textbox', { name: 'Page title' })
const byline = (page: Page) => page.locator('.byline')
const margin = (page: Page) => page.getByRole('complementary', { name: 'Comments' })

/**
 * A control inside the margin, matched exactly.
 *
 * A thread is currently a `role="button"` wrapping its own delete, reply and resolve controls, so
 * its accessible name is the whole conversation *including the words on those buttons* — and a
 * substring match for "Resolve" claims the thread as well as the button. Exact matching is right
 * either way, and stops passing by luck the day the thread stops being a button.
 */
const inMargin = (page: Page, name: string) => margin(page).getByRole('button', { name, exact: true })

async function openMenu(page: Page, item: string) {
  await page.getByRole('button', { name: 'Page actions' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}

/** Opens a page and waits for the screen it is about, not merely for the network. */
async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(titleField(page)).toBeVisible()
  await expect(row(page, 'Welcome')).toBeVisible()
}

/**
 * Which way the chevron actually points, measured from the transform the browser resolved.
 *
 * The icon is `chevron-right`, so its tip points along the element's own +x axis; pushing that axis
 * through the computed matrix says where it ends up on screen. Reading the CSS instead would prove
 * only that a rule exists — `scaleX(-1)` and `rotate(180deg)` are the same string-wise different
 * things, and a rule that never applies looks identical to one that does.
 */
async function chevronPoints(button: Locator): Promise<'right' | 'left' | 'down' | 'up' | 'other'> {
  const { dx, dy } = await button.evaluate((el) => {
    const span = el.querySelector('span')
    if (!span) return { dx: 0, dy: 0 }
    const t = getComputedStyle(span).transform
    const m = t === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(t)
    const tip = m.transformPoint(new DOMPoint(1, 0))
    const origin = m.transformPoint(new DOMPoint(0, 0))
    return { dx: tip.x - origin.x, dy: tip.y - origin.y }
  })
  // Screen axes, deliberately: which of them counts as the reading direction is the question the
  // caller is asking, so it is answered there rather than smuggled in here.
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 'down' : 'up'
  return 'other'
}

/* -------------------------------------------------------------------- tests */

test('the sidebar draws the space as a tree, with children hidden until they are asked for', async ({
  page,
}) => {
  await open(page, PAGES.welcome)

  // every root page of the Handbook space, in the order the mock ranks them
  for (const title of ['Welcome', 'Working here', 'Expenses', 'Onboarding tasks']) {
    await expect(row(page, title)).toBeVisible()
  }
  // a database is a node in the tree; its rows are not
  await expect(row(page, 'Read the handbook')).toHaveCount(0)
  // children of a collapsed node are not rendered at all
  await expect(row(page, 'Your first week')).toHaveCount(0)
  await expect(row(page, 'Time off')).toHaveCount(0)

  // exactly one node has children, so exactly one row gets a twisty
  await expect(twisty(page)).toHaveCount(1)
})

test('a node expands and collapses, and opening a child is one click', async ({ page }) => {
  await open(page, PAGES.welcome)

  const chevron = twisty(page)
  await expect(chevron).toHaveAttribute('aria-expanded', 'false')

  await chevron.click()
  await expect(chevron).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Your first week')).toBeVisible()
  await expect(row(page, 'Time off')).toBeVisible()

  await chevron.click()
  await expect(chevron).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'Your first week')).toHaveCount(0)

  // and the children are reachable, not merely drawn
  await chevron.click()
  await row(page, 'Your first week').click()
  await expect(page).toHaveURL(new RegExp(`${PAGES.firstWeek}$`))
  await expect(titleField(page)).toHaveValue('Your first week')
})

/*
 * The sidebar knows which space and which page the URL names.
 *
 * It did not, and the cause was one line outside this module: `+layout.svelte` publishes
 * SvelteKit's `page.params` — `{ ws, module }`, where `module` is the whole unparsed rest of the
 * path — through `setNavigation`, while a module route's own `:space`/`:page` are matched by
 * `resolveModuleRoute` and handed to the page component as props and nowhere else. `SidebarSpaces`
 * is not the page component, so it read `undefined` and `activeSpace` fell back to `spaceList[0]`.
 *
 * Three separate things were wrong at once and they are three tests, not one. A single `test.fail()`
 * over all three passes when *any* assertion fails, so while one was fixed and two were not it
 * would have stayed green and said nothing about which — and when the last one was fixed it turned
 * red with "expected to fail, but passed" rather than reporting the good news.
 */
test('a link to a nested page opens its ancestors', async ({ page }) => {
  // straight to a child by URL, exactly as a shared link arrives
  await page.goto(PAGES.firstWeek)
  await expect(titleField(page)).toHaveValue('Your first week')
  await expect(twisty(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Your first week')).toBeVisible()
})

test('the open page is the one marked aria-current', async ({ page }) => {
  await page.goto(PAGES.firstWeek)
  await expect(row(page, 'Your first week')).toHaveAttribute('aria-current', 'page')
  await expect(row(page, 'Welcome')).not.toHaveAttribute('aria-current', 'page')
})

test("a second space draws its own tree, not the first space's", async ({ page }) => {
  await page.goto(`/${WS}/quire/engineering`)
  await expect(row(page, 'Architecture')).toBeVisible()
  // The whole defect in one assertion: Welcome belongs to Handbook, and used to be drawn here.
  await expect(row(page, 'Welcome')).toHaveCount(0)
})

/*
 * And a disclosure the auto-expand opened can still be closed.
 *
 * The effect that opens an open page's ancestors both reads and writes `expanded`, so once
 * `params.page` started arriving it became its own trigger: collapsing an ancestor removed it from
 * the set, the effect put it straight back, and the disclosure was inert to click and to Enter
 * alike. The fix that made the three tests above pass is exactly what made this reachable, which is
 * why it is asserted here rather than assumed.
 */
test('an ancestor opened automatically can still be collapsed', async ({ page }) => {
  await page.goto(PAGES.firstWeek)
  const chevron = twisty(page)
  await expect(chevron).toHaveAttribute('aria-expanded', 'true')
  await chevron.click()
  await expect(chevron).toHaveAttribute('aria-expanded', 'false')
  await expect(row(page, 'Your first week')).toHaveCount(0)
})

/**
 * The chevron mirrors with the document, and the open one does not.
 *
 * A closed disclosure points along the reading direction — right in English, **left** in Persian.
 * An open one points down at the children it revealed, which is the same direction in both: mirror
 * that too and it ends up upside down.
 */
for (const { locale, dir, readingWay } of [
  { locale: 'en', dir: 'ltr', readingWay: 'right' },
  { locale: 'fa', dir: 'rtl', readingWay: 'left' },
] as const) {
  test(`the tree chevron points along the reading direction in ${dir} (${locale})`, async ({ page }) => {
    await page.context().addCookies([{ name: 'kern_locale', value: locale, url: 'http://localhost:4173' }])
    await page.goto(PAGES.welcome)
    // waited on by page title rather than by a label: every label on this screen is translated,
    // and the titles are data
    await expect(row(page, 'Welcome')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', dir)

    const chevron = twisty(page)
    await expect(chevron).toHaveAttribute('aria-expanded', 'false')
    // Polled, not read once: the chevron turns through a transition, and `getComputedStyle` during
    // one answers with the interpolated value. Reading it straight after the click passed by a
    // margin of milliseconds and failed the moment anything else on the page was slower.
    await expect
      .poll(() => chevronPoints(chevron), {
        message: `a closed chevron must point ${readingWay} in ${dir}, along the reading direction`,
      })
      .toBe(readingWay)

    await chevron.click()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
    // down in both: an open chevron points at the children it revealed, and mirroring that turns
    // it upside down rather than reversing it
    await expect
      .poll(() => chevronPoints(chevron), { message: `an open chevron must point down in ${dir}` })
      .toBe('down')
  })
}

test('creating a page from the sidebar puts it in the tree and leaves the caret in the title', async ({
  page,
}) => {
  await open(page, PAGES.welcome)
  await expect(row(page, 'Untitled')).toHaveCount(0)

  await tree(page).getByRole('button', { name: 'New page', exact: true }).click()
  // the template chooser stands between the request and the page; the blank one is "nothing at all"
  await page.getByRole('button', { name: /Blank page/ }).click()

  // it is a real page with its own address, not a row in a list
  await expect(page).toHaveURL(new RegExp(`^.*${SPACE}/[0-9a-f-]{36}$`))
  await expect(row(page, 'Untitled')).toBeVisible()

  // the whole point: the next keystroke names it, with nothing else clicked in between
  await expect(titleField(page)).toBeFocused()
  await page.keyboard.type('Fire drill')
  await expect(titleField(page)).toHaveValue('Fire drill')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Fire drill')).toBeVisible()
})

test('renaming from the title moves the tree, with no reload', async ({ page }) => {
  await open(page, PAGES.welcome)
  // a value on `window` survives a client-side rerender and nothing else; if the app reloaded to
  // pick the new title up, this is gone
  await page.evaluate(() => {
    ;(window as unknown as { __kernSameDocument?: true }).__kernSameDocument = true
  })

  // a new title that is not a superset of the old one, so "the tree still says Welcome" is a
  // question the locator can actually answer
  await titleField(page).fill('Start here')
  await titleField(page).press('Enter')

  await expect(row(page, 'Start here')).toBeVisible()
  await expect(row(page, 'Welcome')).toHaveCount(0)
  expect(
    await page.evaluate(() => (window as unknown as { __kernSameDocument?: true }).__kernSameDocument),
    'the tree updated by reloading the document rather than from the cache',
  ).toBe(true)
})

test('a page carries a byline, and a live doc says it is one', async ({ page }) => {
  await open(page, PAGES.welcome)
  await expect(byline(page)).toContainText(/Edited/)
  await expect(byline(page)).not.toContainText('Live doc')
  await expect(byline(page)).not.toContainText('Archived')

  // the same byline on a live doc carries the chip that separates the two kinds
  await open(page, PAGES.expenses)
  await expect(byline(page)).toContainText(/Edited/)
  await expect(byline(page)).toContainText('Live doc')
  // …and a live doc has no published face, so it is offered no way to publish one
  await page.getByRole('button', { name: 'Page actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Publish' })).toHaveCount(0)
})

test('a page with a draft says so above the body, and can publish or discard it', async ({ page }) => {
  await open(page, PAGES.workingHere)

  // scoped to the page rather than the document: a toast is a `status` too
  const banner = page.locator('.kpage').getByRole('status')
  await expect(banner).toContainText('This draft has changes readers cannot see yet')
  await expect(banner.getByRole('button', { name: 'Discard the draft' })).toBeVisible()

  await banner.getByRole('button', { name: 'Publish' }).click()
  // publishing is what the banner is about, so publishing is what takes it away
  await expect(banner).toHaveCount(0)
})

test('the body admits it is not connected instead of pretending to be an editor', async ({ page }) => {
  await open(page, PAGES.welcome)

  const body = page.locator('.kpage')
  await expect(body.getByText('Not connected to the collaboration service')).toBeVisible()
  await expect(body.getByText('This is the demo interface, which has no server behind it.')).toBeVisible()
  // nothing in the page body accepts a keystroke, which is the honest half of saying so
  await expect(body.locator('[contenteditable="true"]')).toHaveCount(0)
})

test('version history opens from the page menu and lists what the page used to say', async ({ page }) => {
  await open(page, PAGES.welcome)
  await openMenu(page, 'Version history')

  const sheet = page.getByRole('dialog', { name: 'Version history' })
  await expect(sheet).toBeVisible()

  // three seeded versions, newest first
  await expect(sheet.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(3)
  await expect(sheet).toContainText('What readers see')
  await expect(sheet).toContainText('While writing')
  await expect(sheet).toContainText('The first handbook')
  // the version readers are served is not offered as something to restore — you are already on it
  await expect(sheet.getByRole('button', { name: 'Restore' })).toHaveCount(2)

  // a row is 160 characters of flattened text; opening one fetches the document
  const preview = sheet.getByRole('button', { name: 'Preview', exact: true }).first()
  await preview.click()
  await expect(sheet.getByRole('button', { name: 'Hide preview' })).toBeVisible()
  await expect(sheet.locator('.kern-prose')).toContainText('Welcome to Northstar.')

  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
})

test('restoring a version writes a new one rather than losing the old', async ({ page }) => {
  await open(page, PAGES.welcome)
  await openMenu(page, 'Version history')

  const sheet = page.getByRole('dialog', { name: 'Version history' })
  const before = await sheet.getByRole('button', { name: 'Preview', exact: true }).count()

  // the newest restorable one, which carries no label of its own — a labelled version keeps its
  // label on the row the restore writes, so restoring that one would say "The first handbook"
  await sheet.getByRole('button', { name: 'Restore' }).first().click()

  // two new rows: what the page said a moment ago, captured first so that restoring is itself
  // undoable, and the restore. Nothing in the list is removed.
  await expect(sheet.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(before + 2)
  await expect(sheet).toContainText('Restored')
  await expect(sheet).toContainText('The first handbook')
})

test('the comment margin is absent until there is something in it', async ({ page }) => {
  // a page nobody has asked anything about
  await open(page, PAGES.workingHere)
  await expect(margin(page)).toHaveCount(0)

  // a page with a seeded thread draws the margin on load, replies and all
  await open(page, PAGES.welcome)
  await expect(margin(page)).toBeVisible()
  await expect(margin(page)).toContainText('Should this mention the on-call rota?')
  await expect(margin(page)).toContainText('Good point — I will link to it from here.')
  await expect(inMargin(page, 'Resolve')).toBeVisible()
})

test('asking about the page opens the margin, and the remark lands in it', async ({ page }) => {
  await open(page, PAGES.workingHere)
  await expect(margin(page)).toHaveCount(0)

  await openMenu(page, 'Comments')
  await expect(margin(page)).toBeVisible()

  const composer = margin(page).locator('[contenteditable="true"]').first()
  await expect(inMargin(page, 'Comment')).toBeDisabled()

  await composer.click()
  await page.keyboard.type('Does the rota belong here?')
  await inMargin(page, 'Comment').click()

  await expect(margin(page).getByText('Does the rota belong here?')).toBeVisible()
  // the composer closed and the thread took its place
  await expect(inMargin(page, 'Cancel')).toHaveCount(0)
  await expect(inMargin(page, 'Resolve')).toBeVisible()
})

test('resolving a thread takes it out of the margin', async ({ page }) => {
  await open(page, PAGES.welcome)
  await expect(margin(page)).toBeVisible()

  await inMargin(page, 'Resolve').click()
  // the only thread was resolved, so there is nothing left to draw a margin for
  await expect(margin(page)).toHaveCount(0)
})

test('archiving marks the page, and taking it back out restores it to the tree', async ({ page }) => {
  await open(page, PAGES.welcome)
  await expect(byline(page)).not.toContainText('Archived')

  await openMenu(page, 'Archive')
  await expect(byline(page)).toContainText('Archived')
  // the menu now offers the way back, on the page you are still standing on
  await page.getByRole('button', { name: 'Page actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Take out of the archive' })).toBeVisible()
  await page.keyboard.press('Escape')

  // NOTE: while it is archived the row also leaves the sidebar entirely — the tree is fetched with
  // `includeArchived: false` and Quire has no other list — so navigating away loses the only route
  // back. That is not asserted here, because it is a gap to be closed rather than behaviour to hold.
  await openMenu(page, 'Take out of the archive')
  await expect(byline(page)).not.toContainText('Archived')
  await expect(row(page, 'Welcome')).toBeVisible()
})

test('moving a page to the trash takes it out of the tree and hands you back the space', async ({ page }) => {
  await open(page, PAGES.welcome)

  // a page of this test's own, so nothing seeded is destroyed and no other assertion depends on it
  await tree(page).getByRole('button', { name: 'New page', exact: true }).click()
  // the template chooser stands between the request and the page; the blank one is "nothing at all"
  await page.getByRole('button', { name: /Blank page/ }).click()
  await expect(titleField(page)).toBeFocused()
  await page.keyboard.type('Fire drill')
  await page.keyboard.press('Enter')
  await expect(row(page, 'Fire drill')).toBeVisible()

  await openMenu(page, 'Move to trash')
  /*
   * Trashing is confirmed now, and the confirmation says how many pages go with it — a page used to
   * disappear, subtree and all, on one click of a menu item. So the menu item opens a dialog and the
   * dialog does the deed.
   */
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`${SPACE}$`))
  await expect(row(page, 'Fire drill')).toHaveCount(0)
  // the space still opens on its home page rather than on nothing
  await expect(titleField(page)).toHaveValue('Welcome')
})

test('a space opens on its home page', async ({ page }) => {
  await page.goto(SPACE)
  await expect(titleField(page)).toHaveValue('Welcome')
  await expect(byline(page)).toContainText(/Edited/)
})

/**
 * Everything the pointer can do in the tree, without a pointer.
 *
 * A page tree is the one place a wiki is navigated from, so a keyboard route through it is the
 * specification rather than an afterthought — and a twisty drawn as an absolutely positioned overlay
 * is exactly the shape that ends up unfocusable.
 */
test('the tree is worked entirely from the keyboard', async ({ page }) => {
  await open(page, PAGES.welcome)

  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement
      if (!el) return { label: '', expanded: null as string | null }
      return {
        label: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '',
        expanded: el.getAttribute('aria-expanded'),
      }
    })

  /** Tabs forward until `hit` says the focused element is the one wanted, or gives up. */
  const tabUntil = async (what: string, hit: (at: { label: string; expanded: string | null }) => boolean) => {
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      if (hit(await focused())) return
    }
    throw new Error(`${what} is not reachable with the Tab key`)
  }

  await page.getByRole('searchbox', { name: 'Search this space' }).focus()

  /*
   * The first page is a short walk from the search box, not buried behind the tree.
   *
   * It used to be exactly one Tab; the sidebar has since grown a label filter, which belongs beside
   * the search rather than after the pages. Counting keystrokes tests the furniture; what matters is
   * that the tree is near the top of the walk and reachable without passing every page in it.
   */
  await tabUntil('the first page of the space', (at) => at.label === 'Welcome')

  /*
   * The twisty is drawn as an overlay rather than laid out in the row, which is exactly the shape
   * that ends up unfocusable — so reaching it at all is the assertion.
   *
   * Matched on its name rather than on `aria-expanded` alone. The sidebar now has Favourites and
   * Recent groups that are collapsible too, so "the first thing with aria-expanded=false" stopped
   * meaning "a page's disclosure" — it found a group header and Enter collapsed the group. A tree
   * disclosure is the one that names the page it would expand.
   */
  await tabUntil('the tree disclosure', (at) => at.expanded === 'false' && /^Expand /.test(at.label ?? ''))

  // expanding is a keystroke, and focus stays on the control that did it
  await page.keyboard.press('Enter')
  // Polled, like every other assertion here. A one-shot `page.evaluate` compare reads whatever the
  // DOM holds at that instant, so it reports a state Svelte has not flushed yet as a wrong state —
  // the one shape in this file that can fail for a reason that is not the product's.
  await expect
    .poll(async () => (await focused()).expanded, { message: 'focus stays on the control that expanded' })
    .toBe('true')
  await expect(row(page, 'Your first week')).toBeVisible()

  // and the child it revealed is reachable and opens on Enter, with no pointer anywhere
  await tabUntil('a revealed child page', (at) => at.label === 'Your first week')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${PAGES.firstWeek}$`))
  await expect(titleField(page)).toHaveValue('Your first week')

  // collapsing again is the same keystroke on the same control
  await twisty(page).focus()
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await focused()).expanded, { message: 'the disclosure closes from the keyboard' })
    .toBe('false')
  await expect(row(page, 'Time off')).toHaveCount(0)
})

test('the page menu and the version sheet are reachable from the keyboard', async ({ page }) => {
  await open(page, PAGES.welcome)

  await titleField(page).focus()
  /*
   * Tabbed to rather than asserted as the very next stop. The header grew a favourites star between
   * the title and the menu, and a test that pins an exact ordinal breaks every time a control is
   * added beside it — which says nothing about whether the menu is reachable, which is the claim.
   */
  let landed: string | null = null
  for (let i = 0; i < 8 && landed !== 'Page actions'; i++) {
    await page.keyboard.press('Tab')
    landed = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null)
  }
  expect(landed, 'the page menu is not reachable by Tab from the title').toBe('Page actions')

  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'Version history' }).press('Enter')

  const sheet = page.getByRole('dialog', { name: 'Version history' })
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
})
