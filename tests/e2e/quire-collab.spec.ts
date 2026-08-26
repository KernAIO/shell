/**
 * Two browsers, one document.
 *
 * `collab` has sixty-six unit tests proving that two Yjs clients converge over a real WebSocket, and
 * none of them opens a browser. Everything between the socket and the person typing — the
 * Hocuspocus provider, the Tiptap binding, carets, presence, what a dropped network does, and whose
 * undo stack a ⌘Z reaches into — was unproven until this file. That last one is the one people get
 * wrong: see `docs/adr/0006-collaborative-documents.md`, which says why undo is already per-user on
 * this path and how supplying an undo manager by hand breaks it.
 *
 * One thing here is deliberately *not* claimed. The offline test proves that the editor keeps
 * taking text with no connection and that the provider merges it on reconnect — it does not prove
 * the IndexedDB copy, because the only way to prove that is to reload the page while offline, and
 * in `vite dev` there is no service worker (`devOptions.enabled` is false), so an offline reload
 * has no application to load.
 *
 * ## Running it
 *
 * This suite is **not** part of `pnpm test:e2e`. That suite runs against the mock API and must stay
 * hermetic; there is no collab service behind the mock, and the editor says so rather than
 * pretending to sync, so none of this can be tested there.
 *
 * From the umbrella (`app/`), with Docker running:
 *
 * ```bash
 * pnpm infra                                     # Postgres, NATS, Valkey, MinIO, Mailpit
 * cd repos/core   && pnpm dev                    # :4000
 * cd repos/collab && pnpm dev                    # :4300
 * cd repos/shell  && pnpm exec playwright test -c playwright.collab.config.ts
 * ```
 *
 * `pnpm dev` at the umbrella starts all three at once and is the usual way. Playwright starts the
 * shell itself on :5173 and reuses one that is already running.
 *
 * **Expected result:** five passing tests in about a minute. When core, collab or Mailpit is missing
 * the suite **skips on a laptop and fails under `CI=1`** — skipping a test because its
 * infrastructure is absent is fine locally and dishonest in CI.
 *
 * `chat` is deliberately *not* required. It is not in the path of anything here, and the shell's
 * own connection banner for the chat gateway is why every assertion below is scoped to the editor
 * rather than to the page: `role="status"` matches that banner, the unpublished-changes banner and
 * the editor's own note, and a page-wide `getByRole('status')` reads whichever it likes.
 *
 * ## Signing in without typing a password anywhere
 *
 * A Kern session is an HttpOnly cookie and the collab gateway reads it off the WebSocket upgrade, so
 * these browsers need real sessions. They are made through core's own HTTP API — `sign-up/email`
 * with a password generated per run and never reused, an invitation created by the owner, and the
 * invitation token read out of Mailpit exactly where the recipient would find it, in the email.
 * Nothing here types into a sign-in form, hard-codes a credential or writes to the database.
 *
 * That also produces the three people the tests need: an owner and a member, who may both write, and
 * a **guest**, who by the module's own default roles has `quire.page.view` and not
 * `quire.page.edit`. The read-only participant is therefore a real permission decision made by the
 * server, not a flag set by the test.
 */
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'

const CORE = process.env.KERN_CORE_URL ?? 'http://127.0.0.1:4000'
const COLLAB = process.env.KERN_COLLAB_URL ?? 'http://127.0.0.1:4300'
const MAILPIT = process.env.KERN_MAILPIT_URL ?? 'http://127.0.0.1:8025'
/** The origin the browser runs on, and the one core's CORS and Better Auth accept. */
const ORIGIN = 'http://localhost:5173'

const rand = () => Math.random().toString(36).slice(2, 10)

interface TestUser {
  id: string
  name: string
  email: string
  /** the `kern.session_token` value exactly as core's `Set-Cookie` wrote it, still percent-encoded */
  cookie: string
}

interface Stack {
  workspaceId: string
  workspaceSlug: string
  spaceId: string
  spaceKey: string
  owner: TestUser
  member: TestUser
  guest: TestUser
}

/* ------------------------------------------------------------------ fixture */

async function api(user: TestUser | null, path: string, init: RequestInit = {}) {
  const res = await fetch(`${CORE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      ...(user ? { cookie: `kern.session_token=${user.cookie}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function signUp(name: string): Promise<TestUser> {
  const email = `e2e-collab-${Date.now().toString(36)}-${rand()}@e2e.kern.test`
  // Generated per run and thrown away: nothing about these accounts is reusable, and there is no
  // credential in the repository to leak.
  const password = `${rand()}${rand()}-Aa1!`
  const res = await fetch(`${CORE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`)
  const set = res.headers.getSetCookie().find((c) => c.startsWith('kern.session_token='))
  if (!set) throw new Error('sign-up returned no kern.session_token cookie')
  const cookie = set.split(';')[0]?.slice('kern.session_token='.length) ?? ''
  const body = (await res.json()) as { user: { id: string } }
  return { id: body.user.id, name, email, cookie }
}

/**
 * The invitation token, read where the person invited would read it.
 *
 * It is deliberately absent from the API response — only the email carries it — so a test that
 * wants one has to go to the mailbox rather than to the database.
 */
async function inviteTokenFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const found = (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
      .then((r) => r.json())
      .catch(() => null)) as { messages?: { ID: string; To?: { Address: string }[] }[] } | null
    const hit = found?.messages?.find((m) => m.To?.some((t) => t.Address === email))
    if (hit) {
      const message = (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`).then((r) => r.json())) as {
        Text?: string
      }
      const token = /\/invite\/([A-Za-z0-9_-]+)/.exec(message.Text ?? '')?.[1]
      if (token) return token
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no invitation email for ${email} arrived in Mailpit`)
}

async function join(owner: TestUser, workspaceId: string, user: TestUser, role: 'member' | 'guest') {
  await api(owner, `/api/core/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId, invites: [{ email: user.email, role }] }),
  })
  const token = await inviteTokenFor(user.email)
  await api(user, `/api/core/invitations/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

async function provision(): Promise<Stack> {
  const owner = await signUp('Ada Owner')
  const member = await signUp('Bea Writer')
  const guest = await signUp('Cass Reader')

  const workspace = await api(owner, '/api/core/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `Collab e2e ${rand()}`, slug: `e2e-collab-${rand()}` }),
  })
  await join(owner, workspace.id, member, 'member')
  await join(owner, workspace.id, guest, 'guest')

  const space = await api(owner, '/api/quire/spaces', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: workspace.id,
      key: `e2e-${rand().slice(0, 5)}`,
      name: 'Collab e2e',
    }),
  })

  /*
   * The permissions this suite leans on, asserted once rather than assumed. If `guest` ever gains
   * `quire.page.edit`, the read-only test would still pass — against a participant who was never
   * read-only — and that is exactly the kind of test that is worse than none.
   */
  const guestPermissions = await api(guest, `/api/core/workspaces/${workspace.id}/me/permissions`)
  expect(guestPermissions.role, 'the guest joined as a guest').toBe('guest')
  expect(guestPermissions.permissions, 'a guest may read pages').toContain('quire.page.view')
  expect(guestPermissions.permissions, 'a guest may not write pages').not.toContain('quire.page.edit')
  const memberPermissions = await api(member, `/api/core/workspaces/${workspace.id}/me/permissions`)
  expect(memberPermissions.permissions, 'a member may write pages').toContain('quire.page.edit')

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    spaceId: space.id,
    spaceKey: space.key,
    owner,
    member,
    guest,
  }
}

interface PageUnderTest {
  url: string
  /** what the title should read as, which is how `open` proves it reached the real backend */
  title: string
}

/** A page nobody has typed in, so each test starts from an empty document. */
async function freshPage(stack: Stack, title: string): Promise<PageUnderTest> {
  const page = await api(stack.owner, '/api/quire/pages', {
    method: 'POST',
    body: JSON.stringify({ workspaceId: stack.workspaceId, spaceId: stack.spaceId, title }),
  })
  return { url: `/${stack.workspaceSlug}/quire/${stack.spaceKey}/${page.id}`, title }
}

/* ------------------------------------------------------- browsers and the DOM */

interface Editor {
  context: BrowserContext
  page: Page
  /** the ProseMirror surface — `.kern-prose` is the class the editor and the read view share */
  surface: Locator
  /** the editor's own connection note, not the shell's banner for the chat gateway */
  note: Locator
  text(): Promise<string>
  peers(): Locator
  carets(): Locator
}

/**
 * The prose, without the other people in it.
 *
 * A remote caret is a widget decoration *inside* the content, and its label is the peer's name — so
 * the surface's `textContent` contains "Bea Writer" whenever Bea's cursor is in the paragraph, and
 * every assertion about what the document says would be reading the wrong thing. The clone is
 * detached, so removing the carets from it cannot disturb the editor.
 *
 * Empty rather than throwing when the page is mid-navigation. Every caller is an `expect.poll`, so
 * a read that lands during a reload should be retried rather than ending the test — and one reload
 * is expected: Vite's HMR client reloads the page when its own socket comes back, which is exactly
 * what the offline test does to it. That is a dev-server artefact, so the offline test also asserts
 * the browser is still on the document afterwards, and a real navigation away still fails.
 */
async function surfaceText(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const el = document.querySelector('.kern-prose')
      if (!el) return ''
      const clone = el.cloneNode(true) as HTMLElement
      for (const caret of clone.querySelectorAll('.collaboration-carets__caret')) caret.remove()
      return clone.textContent ?? ''
    })
  } catch {
    return ''
  }
}

async function open(
  browser: import('@playwright/test').Browser,
  user: TestUser,
  doc: PageUnderTest,
): Promise<Editor> {
  const context = await browser.newContext()
  /*
   * The session is installed as the cookie core issued, byte for byte. Anything else would be a
   * different test: the collab gateway parses this cookie off the upgrade request with the same
   * function the chat gateway uses, and a value this test had re-encoded would not be the value a
   * browser sends.
   */
  await context.addCookies([
    {
      name: 'kern.session_token',
      value: user.cookie,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  await page.goto(doc.url)

  /*
   * `.editor` is `CollaborativeEditor`'s own wrapper and there is exactly one on a page. Everything
   * below hangs off it rather than off `page`, because the shell draws a `role="status"` banner for
   * the chat gateway and `PageView` draws another for unpublished changes.
   */
  const root = page.locator('.editor').filter({ has: page.locator('.kern-prose') })
  /*
   * Proof that this browser is talking to the real core rather than to the mock: the page was
   * created over the API a moment ago and exists nowhere else, so nothing in `mock.ts` can serve
   * its title. A mock-mode run fails here rather than testing a fake editor and passing.
   *
   * Read out of the field when there is one and out of the heading when there is not — `PageView`
   * puts an input inside its `<h1>` only for somebody who may edit, and a reader gets plain text.
   * Asking for the field alone made this fail for the guest, on a page that had loaded perfectly.
   */
  await expect
    .poll(
      async () => {
        const field = page.getByRole('textbox', { name: 'Page title' })
        if ((await field.count()) > 0) return await field.inputValue()
        return (await page.locator('h1').first().textContent()) ?? ''
      },
      {
        timeout: 30_000,
        message: 'this page came from somewhere other than core — is the shell in mock mode?',
      },
    )
    .toContain(doc.title)
  await expect(root.locator('.kern-prose'), `${user.name}'s editor did not load`).toBeVisible({
    timeout: 30_000,
  })
  /*
   * An editor still saying "Connecting…" has not authenticated, and a test that types into it would
   * be testing the local Y.Doc and nothing else. `connected` is the one status with no note at all,
   * and `readonly` has its own — so what is waited for is the absence of the two that mean the
   * socket is not up. `allInnerTexts()` gives '' for no note, where `not.toContainText` would want
   * an element to exist.
   */
  await expect
    .poll(async () => (await root.getByRole('status').allInnerTexts()).join(' '), {
      timeout: 30_000,
      message: `${user.name}'s editor never reached the collab service`,
    })
    .not.toMatch(/connecting|reconnect/i)

  return {
    context,
    page,
    surface: root.locator('.kern-prose'),
    note: root.getByRole('status'),
    text: () => surfaceText(page),
    peers: () => root.getByLabel('People in this document').locator('.peer'),
    carets: () => root.locator('.collaboration-carets__label'),
  }
}

/**
 * Puts the caret in the document by clicking, then types.
 *
 * Deliberately no `ControlOrMeta+End` first. On macOS that is not a caret key in a contenteditable,
 * so it did nothing here and would have moved the caret on Linux — a helper that lands somewhere
 * different depending on the runner is worse than one that lands where it was clicked. Nothing
 * below needs a precise offset; where two people must be apart, they click the paragraph they mean.
 */
async function typeSomewhere(editor: Editor, text: string) {
  await editor.surface.click()
  await editor.page.keyboard.type(text)
}

/* ---------------------------------------------------------------------- suite */

let stack: Stack | null = null
let unavailable: string | null = null

/** Narrows the module-scoped fixture, and fails loudly rather than silently passing without one. */
function fixture(): Stack {
  if (!stack) throw new Error('the fixture was not provisioned')
  return stack
}

test.beforeAll(async () => {
  const services: [string, string][] = [
    ['core', `${CORE}/api/health`],
    ['collab', `${COLLAB}/api/health`],
    ['mailpit', `${MAILPIT}/api/v1/info`],
  ]
  const missing: string[] = []
  for (const [name, url] of services) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) missing.push(name)
  }
  if (missing.length > 0) {
    const reason =
      `collaborative editing needs the real stack; ${missing.join(', ')} ` +
      `${missing.length > 1 ? 'are' : 'is'} not answering. ` +
      'Run `pnpm infra && pnpm dev` in the umbrella — see the header of this file.'
    // Skipping because the infrastructure is missing is fine on a laptop and dishonest in CI.
    if (process.env.CI) throw new Error(reason)
    unavailable = reason
    return
  }
  stack = await provision()
})

test.beforeEach(() => {
  test.skip(unavailable !== null, unavailable ?? '')
})

test.describe('a document two people write at once', () => {
  test('keeps both people’s words when they type at the same moment', async ({ browser }) => {
    const doc = await freshPage(fixture(), 'Converge')
    const ada = await open(browser, fixture().owner, doc)
    const bea = await open(browser, fixture().member, doc)

    // Each waits until it can see the other, so both are certainly attached to the same document
    // before anybody types. Without this the test could pass by two browsers never meeting.
    await expect(ada.peers()).toHaveCount(1)
    await expect(bea.peers()).toHaveCount(1)

    /*
     * Two paragraphs, so the two of them have somewhere separate to stand.
     *
     * Positioning is done by clicking the paragraph rather than with Home/End: on macOS those are
     * not caret keys in a contenteditable, so `ControlOrMeta+Home` left Ada at the end of the
     * document beside Bea and the test measured the wrong thing entirely.
     */
    await typeSomewhere(ada, 'the first paragraph')
    await ada.page.keyboard.press('Enter')
    await ada.page.keyboard.type('the second paragraph')
    await expect.poll(() => bea.text(), { timeout: 30_000 }).toContain('the second paragraph')
    await expect(bea.surface.locator('p')).toHaveCount(2)

    /*
     * Two people writing in different places at the same moment. That is the promise multiplayer
     * makes, and it is deliberately not the same as two people writing at the *same* offset — see
     * the second half of this test.
     */
    await ada.surface.locator('p').first().click()
    await bea.surface.locator('p').nth(1).click()
    await Promise.all([ada.page.keyboard.type('alpha-from-ada'), bea.page.keyboard.type('bravo-from-bea')])

    await expect.poll(() => ada.text(), { timeout: 30_000 }).toContain('bravo-from-bea')
    await expect.poll(() => bea.text(), { timeout: 30_000 }).toContain('alpha-from-ada')
    const [adaText, beaText] = [await ada.text(), await bea.text()]
    expect(adaText, 'the two browsers hold the same document').toBe(beaText)
    expect(adaText).toContain('alpha-from-ada')
    expect(adaText).toContain('bravo-from-bea')

    /*
     * And now the case a text CRDT does not promise, pinned down so nobody trades the wrong half
     * away. Two people inserting at one offset interleave character by character —
     * "alpha-from-adaao-baemfro-vbrb" is what this produced before the test asked the right
     * question. Neither word survives as a word, and that is not a defect to fix; what must hold is
     * that both browsers end up with the *same* string and that nobody's keystrokes are dropped. A
     * change that made the words survive by letting the two documents disagree would be far worse
     * than the interleaving.
     */
    // Both in the same paragraph this time.
    await ada.surface.locator('p').first().click()
    await bea.surface.locator('p').first().click()
    await Promise.all([ada.page.keyboard.type('XXXXXXXXXX'), bea.page.keyboard.type('YYYYYYYYYY')])
    await expect.poll(async () => (await ada.text()) === (await bea.text()), { timeout: 30_000 }).toBe(true)
    const settled = await ada.text()
    const occurrences = (haystack: string, ch: string) => [...haystack].filter((c) => c === ch).length
    expect(occurrences(settled, 'X'), 'none of Ada’s keystrokes were dropped').toBe(10)
    expect(occurrences(settled, 'Y'), 'none of Bea’s keystrokes were dropped').toBe(10)

    await ada.context.close()
    await bea.context.close()
  })

  test('shows the other person, and their caret carries their name', async ({ browser }) => {
    const doc = await freshPage(fixture(), 'Carets')
    const ada = await open(browser, fixture().owner, doc)
    const bea = await open(browser, fixture().member, doc)

    // Presence: Ada sees Bea, by name, both beside the editor and in the page's own byline.
    await expect(ada.peers()).toHaveCount(1)
    await expect(ada.peers().first()).toHaveAttribute('title', 'Bea Writer')
    await expect(bea.peers().first()).toHaveAttribute('title', 'Ada Owner')
    /*
     * And in the page's own byline, which reads presence back out of `onpeers`.
     *
     * The count is deliberately not asserted: `PageView` calls `t('people_here', { count })` while
     * the message is written with `{n}`, so the byline currently reads a literal "{n} other person
     * here". Asserting the text as it stands would fix the defect in place.
     */
    await expect(ada.page.locator('.byline')).toContainText('other person here')

    // A caret is only drawn where somebody's cursor is, so Bea has to be in the text.
    await typeSomewhere(bea, 'bea is typing here')
    await expect(ada.carets()).toHaveCount(1)
    await expect(ada.carets().first()).toHaveText('Bea Writer')

    // A coloured line with nobody's name on it is not a caret worth having, and a label painted in
    // the page background is the same thing with extra steps.
    const colour = await ada
      .carets()
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(colour, 'the caret label is painted in the peer colour').not.toBe('rgba(0, 0, 0, 0)')

    // Closing a browser takes the person out of the room. Presence that only ever grows is what
    // makes a document look permanently busy.
    await bea.context.close()
    await expect(ada.peers()).toHaveCount(0)
    await expect(ada.carets()).toHaveCount(0)

    await ada.context.close()
  })

  test('keeps what was written offline and merges it on reconnect', async ({ browser }) => {
    // Longer than the rest, because proving the editor notices the drop means waiting out the
    // provider's own silence timer. See the comment at the end.
    test.setTimeout(180_000)
    const doc = await freshPage(fixture(), 'Offline')
    const ada = await open(browser, fixture().owner, doc)
    const bea = await open(browser, fixture().member, doc)
    await expect(ada.peers()).toHaveCount(1)

    await typeSomewhere(ada, 'before-the-cable-went. ')
    await expect.poll(() => bea.text()).toContain('before-the-cable-went')

    await bea.context.setOffline(true)
    // The shell says so at once — this one is driven by `navigator.onLine`, not by the socket.
    await expect(bea.page.getByRole('status').filter({ hasText: /offline/i })).toBeVisible()

    // The editor still takes text with no connection — that is what the local Y.Doc is for.
    await typeSomewhere(bea, 'written-while-offline. ')
    await expect.poll(() => bea.text()).toContain('written-while-offline')

    // And it really is offline: if Ada could see it, the rest of this test would prove nothing.
    await typeSomewhere(ada, 'typed-by-ada-meanwhile. ')
    await ada.page.waitForTimeout(2000)
    expect(await ada.text(), 'an offline edit must not reach the other browser').not.toContain(
      'written-while-offline',
    )
    expect(await bea.text(), "and nothing of Ada's reaches the offline browser").not.toContain(
      'typed-by-ada-meanwhile',
    )

    /*
     * The editor's own note, which is a slower promise than it looks.
     *
     * A socket that stops carrying traffic does not close, and the Hocuspocus provider does not
     * listen for the window's `offline` event — it notices only through `messageReconnectTimeout`,
     * 30 seconds of silence, after which it closes the socket itself and reports the drop. So there
     * is half a minute in which the editor still reads as connected. This waits it out rather than
     * asserting the gap away: what is under test is that the editor does eventually stop claiming
     * a connection it does not have.
     */
    await expect(bea.note, 'the editor never admitted the connection was gone').toContainText(
      /offline|reconnect|sync/i,
      { timeout: 60_000 },
    )

    await bea.context.setOffline(false)

    // Merged, not lost and not overwritten: both edits survive on both sides.
    await expect.poll(() => ada.text(), { timeout: 60_000 }).toContain('written-while-offline')
    await expect.poll(() => bea.text(), { timeout: 60_000 }).toContain('typed-by-ada-meanwhile')
    await expect.poll(async () => (await ada.text()) === (await bea.text()), { timeout: 30_000 }).toBe(true)
    /*
     * Bea's browser may have reloaded during all that — Vite's HMR client reloads a page when its
     * own socket comes back, and coming back is what this test just did. The text surviving is the
     * point either way, but the browser must still be looking at the same document rather than
     * having been sent to sign-in.
     */
    expect(bea.page.url(), 'the browser left the document').toContain(doc.url)
    // Back to a connection it is willing to claim.
    await expect
      .poll(async () => (await bea.note.allInnerTexts()).join(' '), { timeout: 30_000 })
      .not.toMatch(/offline|reconnect/i)

    await ada.context.close()
    await bea.context.close()
  })

  test('a read-only participant cannot type and broadcasts no caret', async ({ browser }) => {
    const doc = await freshPage(fixture(), 'Read only')
    const ada = await open(browser, fixture().owner, doc)
    const cass = await open(browser, fixture().guest, doc)

    await typeSomewhere(ada, 'only ada may write this. ')
    await expect.poll(() => cass.text()).toContain('only ada may write this')

    // Read-only is decided by the gateway after the socket is open, so the editor starts editable
    // and is locked when the answer arrives.
    await expect(cass.surface).toHaveAttribute('contenteditable', 'false')
    await expect(cass.note).toContainText(/read access/i)

    const before = await cass.text()
    await cass.surface.click()
    await cass.page.keyboard.type('cass should not be able to write this')
    await cass.page.waitForTimeout(1500)
    expect(await cass.text(), 'a reader cannot change the document').toBe(before)
    expect(await ada.text(), "and nothing of a reader's reaches the writer").not.toContain(
      'cass should not be able',
    )

    // Visible as a person, invisible as a cursor. The gateway strips the cursor fields in
    // `beforeHandleAwareness`; this is the browser half of that promise.
    await expect(ada.peers()).toHaveCount(1)
    await expect(ada.peers().first()).toHaveAttribute('title', 'Cass Reader')
    await expect(ada.peers().first()).toHaveClass(/reader/)
    await expect(ada.carets()).toHaveCount(0)

    await ada.context.close()
    await cass.context.close()
  })

  test('undo takes back your own last edit and never your colleague’s', async ({ browser }) => {
    const doc = await freshPage(fixture(), 'Undo')
    const ada = await open(browser, fixture().owner, doc)
    const bea = await open(browser, fixture().member, doc)
    await expect(ada.peers()).toHaveCount(1)

    await typeSomewhere(ada, 'ADAS-SENTENCE')
    await expect.poll(() => bea.text()).toContain('ADAS-SENTENCE')

    await typeSomewhere(bea, 'BEAS-SENTENCE')
    await expect.poll(() => ada.text(), { timeout: 30_000 }).toContain('BEAS-SENTENCE')

    /*
     * The one people get wrong, and the reason this file exists.
     *
     * y-tiptap's undo plugin defaults to `trackedOrigins: new Set([ySyncPluginKey])`, and a remote
     * update arrives carrying the Hocuspocus provider as its origin, so it never enters this
     * client's undo stack. Nothing about that is enforced: `Collaboration.configure` forwards a
     * `yUndoOptions` straight to `yUndoPlugin`, so one extra entry in `trackedOrigins`, or an
     * `undoManager` supplied by hand, is enough to put everybody's edits in everybody's stack.
     *
     * That was verified rather than assumed. Adding `yUndoOptions: { trackedOrigins: [provider] }`
     * in `@kernhq/ui`'s `createCollabSession` turned Ada's first ⌘Z into
     * "ADAS-SENTENCEBEAS-SENTE" — it took the end of Bea's sentence and left Ada's own alone.
     *
     * Pressed repeatedly rather than once, because how many history events a burst of typing
     * becomes is a timing detail. The claim under test is not "one press is enough": it is that no
     * number of presses ever reaches Bea's writing, so Bea's sentence is checked after every one.
     */
    await ada.surface.click()
    let undone = false
    for (let press = 0; press < 8 && !undone; press++) {
      await ada.page.keyboard.press('ControlOrMeta+z')
      await ada.page.waitForTimeout(400)
      const text = await ada.text()
      expect(text, "undo must not reach into a colleague's writing").toContain('BEAS-SENTENCE')
      undone = !text.includes('ADAS-SENTENCE')
    }
    expect(undone, 'undo took back nothing of Ada’s own').toBe(true)

    // And the undo is a document change like any other, so the other browser sees the same thing.
    await expect.poll(() => bea.text(), { timeout: 30_000 }).not.toContain('ADAS-SENTENCE')
    expect(await bea.text()).toContain('BEAS-SENTENCE')

    await ada.context.close()
    await bea.context.close()
  })
})
