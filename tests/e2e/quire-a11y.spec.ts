import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * Quire under a screen reader, a keyboard, Persian and the dark theme.
 *
 * `ux.spec.ts` asks whether a screen is *pleasant* — colours, hit targets, sideways scroll. It
 * cannot ask whether the screen can be **operated**, and Quire is where that question bites: a page
 * tree, a disclosure that is not the same target as the row it belongs to, a comment margin beside
 * the prose, and a table of inline editors. Every one of those is trivial with a pointer and a
 * design decision away from being impossible without one.
 *
 * So this file drives the keyboard and reads the accessibility tree, and never a CSS selector where
 * a role will do — an assertion about `.ksi` proves a class exists; an assertion about
 * `getByRole('button', { name: 'Expand Working here' })` proves a person can find it.
 *
 * The screens swept here are the four Quire has: the spaces list, a space, an ordinary page and a
 * database page. The ordinary page is the one worth naming — it is the editor, the byline, the
 * comment margin and the version history, so it is the largest surface in the module.
 *
 * Everything runs against the mock, which bounds what can honestly be asserted here: there is no
 * collab service, so `PageEditor` draws "Not connected to the collaboration service" where the
 * prose would be and the editor itself cannot be driven. Nothing below leans on what the mock
 * *seeds*, either — the margin's threads and the version list are being filled in as this is
 * written, and a keyboard test that passes only against today's fixtures is a keyboard test that
 * fails on Thursday.
 */

const WS = 'northstar'
/** The seeded Handbook space: `Welcome` is its home page, `Onboarding tasks` its database. */
const SPACES = `/${WS}/quire`
const SPACE = `/${WS}/quire/engineering`
const WELCOME = `/${WS}/quire/handbook/01920000-0000-7000-8000-000000000101`
const WORKING_HERE = '01920000-0000-7000-8000-000000000102'
const DATABASE = `/${WS}/quire/handbook/01920000-0000-7000-8000-000000000110`

const SCREENS = [
  { name: 'the spaces list', path: SPACES },
  { name: 'a space', path: SPACE },
  { name: 'a page', path: WELCOME },
  { name: 'a database page', path: DATABASE },
] as const

/**
 * The shell's slot for whichever module fills the sidebar — here, Quire's space switcher, search and
 * page tree. Named by class because it is a layout slot with no role of its own; if it stops
 * existing every sweep below fails loudly, which is the right answer.
 */
const SIDEBAR = '.ksb-nav'

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.locator('.ksk, [aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 })
}

async function visit(page: Page, path: string) {
  await page.goto(path)
  await settle(page)
}

async function useRendering(page: Page, theme: 'light' | 'dark', locale: 'en' | 'fa') {
  await page.context().addCookies([{ name: 'kern_locale', value: locale, url: 'http://localhost:4173' }])
  await page.addInitScript((t) => localStorage.setItem('kern.theme', t), theme)
}

/* ------------------------------------------------------------------ the keyboard */

/** What a screen reader would call the element the keyboard is on, plus enough to find it again. */
async function focused(page: Page): Promise<{ name: string; role: string; where: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return { name: '', role: '', where: '(nothing focused)' }
    const named = (n: Element): string => {
      const by = n.getAttribute('aria-labelledby')
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        if (text) return text
      }
      const label = n.getAttribute('aria-label')?.trim()
      if (label) return label
      if (
        n instanceof HTMLInputElement ||
        n instanceof HTMLSelectElement ||
        n instanceof HTMLTextAreaElement
      ) {
        const from = Array.from(n.labels ?? [])
          .map((l) => l.textContent ?? '')
          .join(' ')
          .trim()
        if (from) return from
      }
      const title = n.getAttribute('title')?.trim()
      if (title) return title
      return (n.textContent ?? '').replace(/\s+/g, ' ').trim()
    }
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    return {
      name: named(el),
      role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
      where: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`,
    }
  })
}

/**
 * Puts the keyboard back at the very beginning of the document.
 *
 * **`blur()` does not do this, and the difference is silent.** Chrome keeps a *sequential focus
 * navigation starting point* at the element that was last focused, and clearing focus does not
 * clear it — so the next Tab carries on from where the previous walk stopped rather than starting
 * over. A second walk down the database table therefore found a row named exactly like the first
 * one, typed into it, and the assertion about row 1 failed with row 2 holding the text. Focusing
 * the root element is what moves that starting point; the attribute is put back so nothing else on
 * the page can see it.
 */
async function toTheTop(page: Page) {
  await page.evaluate(() => {
    const root = document.documentElement
    root.setAttribute('tabindex', '-1')
    root.focus()
    root.removeAttribute('tabindex')
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
}

/**
 * Tabs from the top of the document until the keyboard lands on the control asked for.
 *
 * From the *top*, deliberately: "reachable" means reachable by somebody who just loaded the page,
 * not by somebody handed a `focus()` call. Failing prints every stop it passed, so a broken tab
 * order reads as a route rather than as a timeout.
 */
async function tabTo(page: Page, want: (name: string) => boolean, limit = 70): Promise<void> {
  await toTheTop(page)
  const trail: string[] = []
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    const stop = await focused(page)
    trail.push(`${i}: ${stop.role} “${stop.name}” (${stop.where})`)
    if (want(stop.name)) return
  }
  throw new Error(`the keyboard never reached it in ${limit} stops. It passed:\n  ${trail.join('\n  ')}`)
}

/** Keeps tabbing from wherever the keyboard already is — for a second control on the same screen. */
async function tabOn(page: Page, want: (name: string) => boolean, limit = 70): Promise<void> {
  const trail: string[] = []
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    const stop = await focused(page)
    trail.push(`${i}: ${stop.role} “${stop.name}”`)
    if (want(stop.name)) return
  }
  throw new Error(`the keyboard never reached it in ${limit} more stops. It passed:\n  ${trail.join('\n  ')}`)
}

/* ------------------------------------------------------------- reading the a11y tree */

type Finding = { rule: string; detail: string; where: string }

/**
 * Every control Quire draws, as the accessibility tree sees it.
 *
 * Two rules, run over the same list because they need the same list:
 *
 * - a control with no accessible name is announced as "button", and there are five of those in a
 *   page tree;
 * - a control **inside** another control is invalid HTML and worse than it sounds: the name of a
 *   button is its contents, so a row that contains a "New page inside Welcome" button is announced
 *   as "Welcome New page inside Welcome".
 *
 * Scoped to `main` and the module sidebar, which is all of Quire. The shell's own chrome — the tab
 * strip, the rail, the workspace switcher — belongs to `ux.spec.ts`.
 */
async function sweepControls(page: Page, sidebar: string) {
  return page.evaluate((sidebarSelector: string) => {
    const SELECTOR = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[role="combobox"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="tab"]',
      '[role="option"]',
      '[role="textbox"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    /** Names nothing: what a control is called when nobody named it. */
    const MEANINGLESS = ['', '…', '...', 'select…', 'select...', 'button', 'choose…']

    const roots: [string, Element][] = []
    const main = document.querySelector('main')
    if (main) roots.push(['main', main])
    const side = document.querySelector(sidebarSelector)
    if (side) roots.push(['sidebar', side])

    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      if (typeof el.checkVisibility === 'function') {
        // `checkOpacity: false` on purpose — a hover-revealed action group sits at opacity 0 and is
        // still focusable, so it is still a control a screen reader reaches and must still be named.
        return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
      }
      return true
    }
    const hiddenFromAT = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (n.getAttribute('aria-hidden') === 'true') return true
      }
      return false
    }
    const name = (el: Element): string => {
      const by = el.getAttribute('aria-labelledby')
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        if (text) return text
      }
      const label = el.getAttribute('aria-label')?.trim()
      if (label) return label
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        const from = Array.from(el.labels ?? [])
          .map((l) => l.textContent ?? '')
          .join(' ')
          .trim()
        if (from) return from
      }
      const title = el.getAttribute('title')?.trim()
      if (title) return title
      const clone = el.cloneNode(true) as Element
      for (const h of Array.from(clone.querySelectorAll('[aria-hidden="true"]'))) h.remove()
      const text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text) return text
      const alt = el.querySelector('img[alt]')?.getAttribute('alt')?.trim()
      return alt ?? ''
    }
    const describe = (el: Element) => {
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3)
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
      return `${el.tagName.toLowerCase()}${cls.map((c) => `.${c}`).join('')}${text ? ` “${text}”` : ''}`
    }

    const findings: Finding[] = []
    let counted = 0
    for (const [region, root] of roots) {
      const controls = Array.from(root.querySelectorAll(SELECTOR)).filter(
        (el) => visible(el) && !hiddenFromAT(el),
      )
      counted += controls.length
      for (const el of controls) {
        const n = name(el)
        if (MEANINGLESS.includes(n.toLowerCase())) {
          findings.push({
            rule: 'name',
            detail: n ? `announced only as “${n}”` : 'no accessible name at all',
            where: `${region}: ${describe(el)}`,
          })
        }
        const inside = Array.from(el.querySelectorAll(SELECTOR)).filter((c) => visible(c))
        if (inside.length > 0) {
          findings.push({
            rule: 'nested',
            detail: `contains ${inside.length} more control(s): ${inside.map(describe).join(' | ')}`,
            where: `${region}: ${describe(el)}`,
          })
        }
      }
    }
    return { findings, counted, regions: roots.map(([r]) => r) }
  }, sidebar)
}

const say = (findings: Finding[]) =>
  findings.map((f) => `  · [${f.rule}] ${f.detail}\n      ${f.where}`).join('\n')

/* ================================================================ screen reader */

test.describe('what a screen reader is told', () => {
  for (const screen of SCREENS) {
    test(`${screen.name}: every control has an accessible name`, async ({ page }) => {
      await visit(page, screen.path)
      const { findings, counted, regions } = await sweepControls(page, SIDEBAR)
      expect(regions, 'main and the module sidebar both have to be on screen').toEqual(['main', 'sidebar'])
      expect(counted, `${screen.path} drew no controls — it is blank, not clean`).toBeGreaterThan(5)
      const named = findings.filter((f) => f.rule === 'name')
      expect(named, `${screen.path}\n${say(named)}`).toEqual([])
    })

    test(`${screen.name}: no control contains another control`, async ({ page }) => {
      await visit(page, screen.path)
      const { findings } = await sweepControls(page, SIDEBAR)
      const nested = findings.filter((f) => f.rule === 'nested')
      expect(nested, `${screen.path}\n${say(nested)}`).toEqual([])
    })
  }
})

/* ================================================================ the keyboard */

test.describe('what the keyboard can do', () => {
  test('the page tree expands, collapses, opens a page and grows a child', async ({ page }) => {
    await visit(page, WELCOME)

    // A page with children is the only one with a disclosure, and it names the page it belongs to —
    // five buttons all called "Expand" are five buttons nobody can tell apart.
    // `exact`, because "Your first week" is also a substring of "New page inside Your first week".
    const child = page.getByRole('button', { name: 'Your first week', exact: true })
    await tabTo(page, (n) => n === 'Expand Working here')
    await expect(child).toHaveCount(0)

    await page.keyboard.press('Enter')
    await expect(child).toBeVisible()
    await expect(page.getByRole('button', { name: 'Time off', exact: true })).toBeVisible()
    // the same button, still under the keyboard, now says the opposite thing
    expect((await focused(page)).name).toBe('Collapse Working here')
    await expect(page.getByRole('button', { expanded: true })).toHaveCount(1)

    await page.keyboard.press('Enter')
    await expect(child).toHaveCount(0)
    expect((await focused(page)).name).toBe('Expand Working here')

    // Opening is a different target from expanding, and it is the next stop.
    await tabOn(page, (n) => n === 'Working here', 4)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/quire/handbook/${WORKING_HERE}$`))

    // And a child page, from the control that only appears on hover — `:focus-within` is what keeps
    // it reachable, so a keyboard arriving at it is the whole test.
    await tabTo(page, (n) => n === 'New page inside Working here')
    await page.keyboard.press('Enter')
    await expect(page).not.toHaveURL(new RegExp(`/quire/handbook/${WORKING_HERE}$`))
    // a page created with no title puts the caret in the title, which is the only thing to do next
    await expect(page.getByRole('textbox', { name: 'Page title' })).toBeFocused()
    // the new page is in the tree, under the parent it was created in
    await expect(page.getByRole('button', { name: 'Untitled', exact: true })).toBeVisible()
  })

  /**
   * The margin, opened and filled with nothing but the keyboard.
   *
   * It stops short of pressing Comment on purpose. Asserting that the typed words are on screen
   * afterwards passes whether or not anything was posted — they are still sitting in the composer,
   * inside the margin, matching the same locator — and `api.comments.create` is not in every
   * version of the mock this suite runs against. What *is* proof is the Comment button coming
   * alive: it is bound to the draft document rather than to the DOM the keyboard typed into, so it
   * only enables if the keystrokes reached the editor. Whether a posted remark then appears in the
   * margin is a question for a feature spec with a mock that can answer it.
   */
  test('the comment margin is reached and its composer filled without a mouse', async ({ page }) => {
    await visit(page, WELCOME)
    const margin = page.getByRole('complementary', { name: 'Comments' })
    const composer = margin.getByRole('textbox', { name: 'Your comment' })
    // Whether the margin is already on screen depends on what the mock seeds, so nothing here
    // asserts on its absence — only on what the keyboard can make happen.

    // The margin is opened from the page's own menu: with no collab service there is no selection
    // to comment on, so "about the page" is the path that exists here.
    await tabTo(page, (n) => n === 'Page actions')
    await page.keyboard.press('Enter')
    const comments = page.getByRole('menuitem', { name: 'Comments' })
    await expect(comments, 'the menu opens with its first item under the keyboard').toBeFocused()
    await page.keyboard.press('Enter')

    // A region a screen reader can find and announce, not an unnamed column of boxes.
    await expect(margin).toBeVisible()
    await expect(margin.getByRole('heading', { name: 'Comments' })).toBeVisible()

    // Focus went back to the trigger when the menu closed, so the composer is reached by tabbing
    // on — through the formatting toolbar, which is why the budget is generous.
    const post = margin.getByRole('button', { name: 'Comment', exact: true })
    await expect(composer).toBeVisible()
    await expect(post, 'nothing to post yet').toBeDisabled()

    await tabOn(page, (n) => n === 'Your comment', 25)
    await page.keyboard.type('Does this cover the on-call rota?')

    // The button coming alive is the proof that the keystrokes landed in the editor: it is bound to
    // the draft document, not to the DOM the keyboard happened to type into.
    await expect(post, 'the composer took what was typed').toBeEnabled()

    // And the way out is a control too, in the same tab order.
    await tabOn(page, (n) => n === 'Cancel', 6)
    await page.keyboard.press('Enter')
    await expect(composer, 'cancelling puts the composer away').toHaveCount(0)
  })

  test('a database row is traversed and a cell edited without a mouse', async ({ page }) => {
    await visit(page, DATABASE)
    const firstRow = page.getByTestId('database-row').first()
    await expect(firstRow.getByRole('textbox', { name: 'Notes' })).toHaveValue('Start here')

    /*
     * Into the first row and along it, by name.
     *
     * Anchored on the row's Title box rather than tabbed to "Notes" from the top of the document:
     * the column header is a button called "Notes" too, and it comes first — a walk that stops at
     * the first match types into the header menu and reports nothing.
     */
    const intoTheRow = async () => {
      await tabTo(page, (n) => n === 'Title')
      const seen = ['Title']
      for (let i = 0; i < 14 && !seen.includes('Notes'); i++) {
        await page.keyboard.press('Tab')
        const stop = (await focused(page)).name
        if (stop !== seen[seen.length - 1]) seen.push(stop)
      }
      return seen
    }

    // Every column of the first row, in column order. A `<input type="date">` spends several stops
    // inside itself, so the assertion is about the order the names appear in.
    expect(await intoTheRow()).toEqual(['Title', 'Owner', 'Status', 'Due', 'Days', 'Signed off', 'Notes'])

    // and the row's actions are the next stops, not something only a hover reveals
    await tabOn(page, (n) => n === 'Open Read the handbook', 4)
    await tabOn(page, (n) => n === 'Actions for Read the handbook', 2)

    // Tabbing into a text field selects it, so typing replaces; Enter commits, as the cell's own
    // contract says (never per keystroke).
    await intoTheRow()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Read it twice')
    await page.keyboard.press('Enter')

    /*
     * Read back from a *fresh* table, not from the box that was typed into.
     *
     * The input is uncontrolled — it holds whatever the keyboard put in it — so asserting on it
     * straight after typing passes whether or not the edit was ever committed. This test did
     * exactly that: stubbing `commit` out to a no-op left it green. Leaving the view and coming
     * back unmounts the table and rebuilds every cell from the store.
     */
    await page.getByRole('tab', { name: 'By status' }).click()
    await expect(page.getByTestId('database-board')).toBeVisible()
    await page.getByRole('tab', { name: 'All tasks' }).click()
    await expect(page.getByTestId('database-table')).toBeVisible()
    await expect(
      page.getByTestId('database-row').first().getByRole('textbox', { name: 'Notes' }),
    ).toHaveValue('Read it twice')
  })

  test('focus is visible on every stop through a page and a database', async ({ page }) => {
    // A floor per screen, because a rule that judged nothing reports nothing: this test passed a
    // blank page until it counted what it had looked at.
    for (const [path, atLeast] of [
      [WELCOME, 4],
      [DATABASE, 20],
    ] as const) {
      await visit(page, path)
      const { findings, judged } = await walkForFocusRings(page, SIDEBAR, 60)
      expect(judged, `${path} put the keyboard on almost nothing`).toBeGreaterThanOrEqual(atLeast)
      expect(findings, `${path}\n${say(findings)}`).toEqual([])
    }
  })

  test('nothing on a page traps the keyboard', async ({ page }) => {
    await visit(page, WELCOME)
    await toTheTop(page)

    const stops: string[] = []
    let escaped = false
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Tab')
      const stop = await focused(page)
      const signature = `${stop.role}|${stop.name}|${stop.where}`
      if (signature === '||(nothing focused)') {
        escaped = true // the keyboard left the document for the browser's own chrome
        break
      }
      if (stops.length > 0 && signature === stops[0]) {
        escaped = true // it came all the way round, which is the other honest answer
        break
      }
      stops.push(signature)
    }
    expect(stops.length, 'the page has to have controls for this to mean anything').toBeGreaterThan(10)
    expect(
      escaped,
      `Tab never left or completed the page — it is stuck among:\n  ${stops.slice(-8).join('\n  ')}`,
    ).toBe(true)
  })

  test('the new-space dialog takes focus, holds it, and gives it back', async ({ page }) => {
    await visit(page, SPACES)
    await tabTo(page, (n) => n === 'New space')
    const trigger = await focused(page)
    expect(trigger.name).toBe('New space')

    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // A modal is the one place a focus loop is correct: everything the keyboard reaches is inside it.
    const inside: string[] = []
    for (let i = 0; i < 12; i++) {
      const within = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
      expect(within, `the keyboard left the dialog after ${i} stops: ${inside.join(' → ')}`).toBe(true)
      inside.push((await focused(page)).name)
      await page.keyboard.press('Tab')
    }
    expect(new Set(inside).size, 'a dialog with one stop is not a form').toBeGreaterThan(3)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect((await focused(page)).name, 'closing a dialog puts the keyboard back where it was').toBe(
      'New space',
    )
  })

  test('the version history sheet gives focus back', async ({ page }) => {
    await visit(page, WELCOME)
    await tabTo(page, (n) => n === 'Page actions')
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Version history' }).press('Enter')

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(
      page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
    ).resolves.toBe(true)

    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    expect((await focused(page)).name).toBe('Page actions')
  })
})

/**
 * Tabs through the screen and reports any control that looks exactly the same focused as it does at
 * rest.
 *
 * Stricter than reading the focused element alone: a text field inside a bordered box turns its own
 * outline off and lets the box light up, so the comparison is over the element **and three
 * ancestors**, and over everything a ring can be drawn with — outline, shadow, border, background,
 * colour. Each stop is marked as it is visited and measured again once nothing is focused, which is
 * the only way to know a style belongs to `:focus-visible` rather than to the control.
 */
async function walkForFocusRings(
  page: Page,
  sidebar: string,
  stops: number,
): Promise<{ findings: Finding[]; judged: number }> {
  await toTheTop(page)
  const focusedLooks: Record<string, string> = {}

  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    const measured = await page.evaluate(
      ([index, sidebarSelector]: [number, string]) => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        // only what the browser itself marks as keyboard focus; a control focused by a click owes
        // nothing, and Chrome is the authority on which is which
        if (!el.matches(':focus-visible')) return null
        const main = document.querySelector('main')
        const side = document.querySelector(sidebarSelector)
        if (!(main?.contains(el) || side?.contains(el))) return null // the shell's chrome, not Quire's
        el.setAttribute('data-focus-probe', String(index))
        const look = (n: Element | null): string => {
          if (!n) return '-'
          const s = getComputedStyle(n)
          return [
            s.outlineStyle,
            s.outlineWidth,
            s.outlineColor,
            s.boxShadow,
            s.borderColor,
            s.borderWidth,
            s.backgroundColor,
            s.color,
            s.textDecorationLine,
          ].join('~')
        }
        let n: Element | null = el
        const chain: string[] = []
        for (let up = 0; up < 4 && n; up++, n = n.parentElement) chain.push(look(n))
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
        return {
          key: String(index),
          look: chain.join('||'),
          where: `${el.tagName.toLowerCase()}${cls.map((c) => `.${c}`).join('')} “${(
            el.getAttribute('aria-label') ??
            el.textContent ??
            ''
          )
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40)}”`,
        }
      },
      [i, sidebar] as [number, string],
    )
    if (measured) focusedLooks[measured.key] = `${measured.look} ${measured.where}`
  }

  const findings = await page.evaluate((visited: Record<string, string>) => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    const findings: Finding[] = []
    for (const [key, packed] of Object.entries(visited)) {
      const [focusedLook, where] = packed.split(' ')
      const el = document.querySelector(`[data-focus-probe="${key}"]`)
      if (!el) continue
      const look = (n: Element | null): string => {
        if (!n) return '-'
        const s = getComputedStyle(n)
        return [
          s.outlineStyle,
          s.outlineWidth,
          s.outlineColor,
          s.boxShadow,
          s.borderColor,
          s.borderWidth,
          s.backgroundColor,
          s.color,
          s.textDecorationLine,
        ].join('~')
      }
      let n: Element | null = el
      const chain: string[] = []
      for (let up = 0; up < 4 && n; up++, n = n.parentElement) chain.push(look(n))
      if (chain.join('||') === focusedLook) {
        findings.push({
          rule: 'focus',
          detail: 'looks identical focused and at rest — the keyboard is invisible on it',
          where: where ?? '(unknown)',
        })
      }
    }
    return findings
  }, focusedLooks)
  return { findings, judged: Object.keys(focusedLooks).length }
}

/* ================================================================ Persian */

test.describe('in Persian', () => {
  test.beforeEach(async ({ page }) => {
    await useRendering(page, 'light', 'fa')
  })

  test('the page tree indents from the right and the chevrons mirror', async ({ page }) => {
    await visit(page, WELCOME)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    // A closed chevron points the way the language reads, so in Persian it is mirrored…
    //
    // A *disclosure*, which is `aria-expanded` without `aria-haspopup` — the space switcher beside
    // it is expandable too, and it is a listbox trigger rather than a twisty. Naming the button
    // instead would only work in English, which is the language this test is not written for.
    const disclosure = (open: boolean) =>
      page.locator(`${SIDEBAR} button[aria-expanded="${open}"]:not([aria-haspopup])`)
    const closed = disclosure(false)
    await expect(closed).toHaveCount(1)
    expect(await transformOf(closed)).toBe('matrix(-1, 0, 0, 1, 0, 0)')

    await closed.click()
    const open = disclosure(true)
    // …and an open one points *down*, at the children it revealed, which is the same direction in
    // both. Mirroring that turns it upside down, which is what it used to do.
    //
    // Polled, because the chevron animates: reading the matrix on the next tick catches it a third
    // of the way round and the assertion fails on a number that is on its way to being right.
    await expect.poll(() => transformOf(open)).toBe('matrix(0, 1, -1, 0, 0, 0)')

    const parent = page.getByRole('button', { name: 'Working here', exact: true })
    const child = page.getByRole('button', { name: 'Your first week', exact: true })
    const [outer, inner] = [await padding(parent), await padding(child)]
    expect(inner.right, 'a child steps in from the right in Persian').toBeGreaterThan(outer.right)
    expect(inner.left, 'and not from the left').toBe(outer.left)
  })

  test('a count on a board is written in Persian digits', async ({ page }) => {
    await visit(page, DATABASE)
    // The toolbar is drawn from the row query, so it does not exist until the rows do — and a
    // skeleton is gone from the page before the count that replaces it has a number in it.
    await expect(page.getByTestId('database-row').first()).toBeVisible()

    // the toolbar already had this right; the board is the one that did not
    await expect(page.getByRole('toolbar').first()).toContainText('۸')
    await expect(page.getByRole('toolbar').first()).not.toContainText(/[0-9]/)

    await page.getByRole('tab').nth(1).click()
    await expect(page.getByTestId('database-board')).toBeVisible()
    const lanes = page.locator('[data-lane] > .head')
    expect(await lanes.count()).toBeGreaterThan(1)
    for (const head of await lanes.all()) {
      const text = await head.innerText()
      expect(text, 'a lane count in Persian may not be written in ASCII digits').not.toMatch(/[0-9]/)
      expect(text).toMatch(/[۰-۹]/)
    }
  })
})

const transformOf = (button: Locator) =>
  button
    .locator('span')
    .first()
    .evaluate((el) => getComputedStyle(el).transform)

const padding = async (row: Locator) =>
  row.evaluate((el) => {
    const s = getComputedStyle(el)
    return { left: Number.parseFloat(s.paddingLeft), right: Number.parseFloat(s.paddingRight) }
  })

/* ================================================================ dark, and the whole route */

test.describe('in the dark', () => {
  test.beforeEach(async ({ page }) => {
    await useRendering(page, 'dark', 'en')
  })

  test('nothing in Quire is muted with opacity', async ({ page }) => {
    for (const screen of SCREENS) {
      await visit(page, screen.path)
      const { findings: faded, examined } = await page.evaluate((sidebarSelector: string) => {
        const roots = [document.querySelector('main'), document.querySelector(sidebarSelector)]
        const findings: Finding[] = []
        let examined = 0
        const decorative = (el: Element) => {
          for (let n: Element | null = el; n; n = n.parentElement) {
            if (n.getAttribute('aria-hidden') === 'true') return true
          }
          return false
        }
        for (const root of roots) {
          if (!root) continue
          for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
            // An ornament nobody is asked to read — a breadcrumb's "/" — is not text that has to
            // survive the theme; it is already invisible to a screen reader by design.
            if (decorative(el)) continue
            const own = Array.from(el.childNodes).some(
              (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
            )
            if (!own) continue
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            examined++
            /*
             * The *effective* opacity, multiplied up the tree.
             *
             * `opacity` is not inherited, so the faded thing is almost never the element holding
             * the words — it is the row, the byline, the card around them. Reading the text
             * element's own `opacity` finds 1 every time, which is how this rule sat green while
             * a byline was fading at 0.5.
             */
            let effective = 1
            let culprit: Element | null = null
            for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
              const o = Number.parseFloat(getComputedStyle(n).opacity)
              if (Number.isNaN(o) || o >= 0.98) continue
              effective *= o
              culprit ??= n
            }
            // 0 is hidden, not faded — a hover-revealed action group. Anything between is text
            // dimmed against the page, which is what `app/CLAUDE.md` says to do with a colour.
            if (!(effective > 0.02 && effective < 0.98) || !culprit) continue
            const name = (n: Element) => `${n.tagName.toLowerCase()}.${n.className}`
            findings.push({
              rule: 'opacity',
              detail: `text drawn at ${effective.toFixed(2)} opacity by ${name(culprit)} — mute with a colour, not by fading it`,
              where: `${name(el)} “${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}”`,
            })
          }
        }
        return { findings, examined }
      }, SIDEBAR)
      // Same floor as above: a sweep of an empty screen is not a clean screen.
      expect(examined, `${screen.path} rendered almost no text to judge`).toBeGreaterThan(8)
      expect(faded, `${screen.path}\n${say(faded)}`).toEqual([])
    }
  })
})

/*
 * Contrast, hit targets and sideways scroll on these routes are `ux.spec.ts`'s job, and it now
 * sweeps the page view, the page with a draft and the space in all four renderings. A copy of that
 * sweep lived here while its ROUTES list was missing them; two tests asking one question is not
 * twice the safety, so this file keeps only the questions that file cannot ask.
 */
