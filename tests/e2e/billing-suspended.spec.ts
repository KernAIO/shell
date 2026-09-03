import { expect, type Page, test } from '@playwright/test'

/**
 * A workspace whose subscription has lapsed, and what the app says about it.
 *
 * The kernel's `Entitlements.requireActive` refuses **every** non-GET workspace-scoped procedure
 * while a subscription is not current, so this refusal can arrive from any screen in the product.
 * That is why it is handled once on the mutation cache rather than at call sites — and why this
 * test deliberately picks a screen that wires nothing of its own. Groups knows nothing about
 * billing: if the sentence appears here, it appears everywhere.
 *
 * The seed data cannot express either half of this, so the mock reads two `localStorage` switches:
 * one that refuses writes, one that gives up the owner role. Both are off for every other test.
 */

const WS = 'northstar'

/** The server's own sentence, which is what used to reach the screen instead of a translated one. */
const RAW_SERVER_SENTENCE = 'because its subscription is not current'

async function suspendedAs(page: Page, role: 'owner' | 'member') {
  await page.addInitScript((r) => {
    localStorage.setItem('kern.mock.suspended', '1')
    localStorage.setItem('kern.mock.role', r)
  }, role)
}

/**
 * Attempt a write from a screen that has never heard of billing.
 *
 * Creating a group is an ordinary workspace-scoped mutation with an ordinary error handler — the
 * same shape as the two dozen others this app has.
 */
async function attemptToCreateAGroup(page: Page) {
  await page.goto(`/${WS}/settings/groups`)
  await page.getByRole('button', { name: 'New group' }).click()
  await page.getByLabel('Group name').fill('Design review')
  await page.getByLabel('Handle').fill('design-review')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
}

test('a suspended workspace explains itself from a screen that wires nothing', async ({ page }) => {
  await suspendedAs(page, 'owner')
  await attemptToCreateAGroup(page)

  const toast = page.locator('.ktoast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('This workspace is suspended')
  // What still works is the half that stops this reading as an outage rather than as a bill.
  await expect(toast).toContainText('Reading and exporting still work')
})

test('the server’s English sentence never reaches the screen', async ({ page }) => {
  await suspendedAs(page, 'owner')
  await attemptToCreateAGroup(page)

  await expect(page.locator('.ktoast')).toHaveCount(1)
  await expect(page.locator('.ktoast')).not.toContainText(RAW_SERVER_SENTENCE)
})

test('an owner is offered the way out, and it goes to the plan', async ({ page }) => {
  await suspendedAs(page, 'owner')
  await attemptToCreateAGroup(page)

  const action = page.locator('.ktoast .act')
  await expect(action).toHaveText('Reactivate')
  await action.click()
  await expect(page).toHaveURL(new RegExp(`/${WS}/settings/billing/plan$`))
})

test('a member is told to ask an owner rather than sent to a page they cannot open', async ({ page }) => {
  await suspendedAs(page, 'member')
  await attemptToCreateAGroup(page)

  const toast = page.locator('.ktoast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText('ask an owner to reactivate it')
  // No dead end: the plan page answers 404 without `billing.subscription.view`.
  await expect(page.locator('.ktoast .act')).toHaveCount(0)
})

/**
 * Two refusals, one sentence.
 *
 * Every write is refused while a workspace is suspended, so the failures arrive in bursts — a
 * screen that saves two things, or somebody clicking twice because nothing appeared to happen. A
 * stack of identical toasts to dismiss one at a time would be worse than the generic toast this
 * replaced, so they share an id and the store keeps one.
 */
test('two refusals in a row say it once', async ({ page }) => {
  await suspendedAs(page, 'owner')
  await attemptToCreateAGroup(page)

  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.ktoast')).toHaveCount(1)
})

/** With nothing suspended, none of this appears and the ordinary path is untouched. */
test('a healthy workspace says nothing about billing', async ({ page }) => {
  await page.goto(`/${WS}/settings/groups`)
  await page.getByRole('button', { name: 'New group' }).click()
  await page.getByLabel('Group name').fill('Design review')
  await page.getByLabel('Handle').fill('design-review')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await expect(page.locator('.ktoast')).not.toContainText('This workspace is suspended')
})
