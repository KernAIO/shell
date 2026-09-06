import { expect, type Page, test } from '@playwright/test'

/**
 * Settings → Modules, from an administrator's side of it.
 *
 * The screen is a switchboard, so the only question worth asking is whether a person can reach a
 * module and change it. Chat could not be reached: `workspaces.modules.list` answers with the
 * manifests of the modules the **core process** hosts, chat and mail run as their own services, and
 * the screen built its cards from that list alone — so both were in the rail with no card, and no
 * way to switch either of them off, on every instance including Kern Cloud.
 *
 * `src/lib/modules/cards.test.ts` pins the selection. This asks the other half: that the card is on
 * the page, that its switch performs the write, and that the rail agrees afterwards. A unit test
 * cannot see any of that, and neither can `ux.spec.ts`, which renders every route and clicks
 * nothing.
 */

const WS = 'northstar'

/** The card for a module, found by the name in its heading. */
const card = (page: Page, name: string) => page.locator(`article:has(h3:text-is("${name}"))`)

/**
 * The rail item for a module.
 *
 * Scoped to the rail rather than asked for as a link by name: Settings offers a "Chat" link of its
 * own, and an unscoped `getByRole('link')` would match both and fail strict mode for a reason that
 * has nothing to do with what is being tested.
 */
const railItem = (page: Page, name: string) => page.locator(`.krail-items a[aria-label="${name}"]`)

/** Press the switch on a card and confirm, which is what turning a module off asks of a person. */
async function disable(page: Page, name: string) {
  await card(page, name).getByRole('switch').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: `Turn off ${name}?` })).toBeVisible()
  await dialog.getByRole('button', { name: 'Disable' }).click()
  await expect(dialog).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await page.goto(`/${WS}/settings/modules`)
  await expect(page.getByRole('heading', { name: 'Modules', level: 1 })).toBeVisible()
})

test('offers a card for a module core does not host', async ({ page }) => {
  for (const name of ['Chat', 'Mail']) {
    await expect(
      card(page, name),
      `no card for ${name} — the module is in the rail and cannot be switched off`,
    ).toHaveCount(1)
    await expect(card(page, name).getByRole('switch')).toBeChecked()
  }
})

test('switches one off, and the rail stops offering it', async ({ page }) => {
  await expect(railItem(page, 'Chat')).toHaveCount(1)

  await disable(page, 'Chat')

  // The card is the half that has to survive the write: core answers for a module it does not host
  // with a placeholder named after the id, so reading that answer straight renames this to "chat".
  await expect(card(page, 'Chat')).toHaveCount(1)
  await expect(card(page, 'Chat').getByRole('switch')).not.toBeChecked()
  // And the switch has to have meant something outside the screen it was pressed on.
  await expect(railItem(page, 'Chat')).toHaveCount(0)
})

test('switches it back on again', async ({ page }) => {
  await disable(page, 'Chat')
  await expect(card(page, 'Chat').getByRole('switch')).not.toBeChecked()

  await card(page, 'Chat').getByRole('switch').click()

  await expect(card(page, 'Chat').getByRole('switch')).toBeChecked()
  await expect(railItem(page, 'Chat')).toHaveCount(1)
})

test('still switches off a module core does host', async ({ page }) => {
  await expect(card(page, 'Issues').getByRole('switch')).toBeChecked()

  await disable(page, 'Issues')

  await expect(card(page, 'Issues').getByRole('switch')).not.toBeChecked()
  await expect(railItem(page, 'Issues')).toHaveCount(0)
})
