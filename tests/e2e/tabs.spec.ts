import { expect, type Page, test } from '@playwright/test'

/**
 * The window tab strip, end to end against the mock backend.
 *
 * What is worth guarding here is the behaviour a strip of tabs promises and a single-page app does
 * not do by default: navigating moves the tab you are on rather than opening another, closing one
 * lands you somewhere sensible, the order you put them in survives, and a device that does not want
 * the strip does not get it.
 */

// by class, not by accessible name: the name is translated, and one of these tests changes language
const strip = (page: Page) => page.locator('nav.ktabbar')
const tabs = (page: Page) => strip(page).getByRole('button').filter({ hasNotText: /^$/ })

/**
 * Every test gets a fresh browser context, so the strip and the preferences start at their defaults
 * with nothing to clear — and a test that reloads is then really testing what was persisted.
 */
async function open(page: Page, path = '/northstar') {
  await page.goto(path)
  await expect(strip(page)).toBeVisible()
}

test('the place you are on is the tab you get', async ({ page }) => {
  await open(page)
  // a navigation landmark of plain buttons, not an ARIA tablist: there is no tabpanel to control
  await expect(page.getByRole('navigation', { name: 'Open tabs' })).toBeVisible()
  await expect(tabs(page)).toHaveCount(1)
  await expect(tabs(page).first()).toHaveText(/My work/)
  await expect(tabs(page).first()).toHaveAttribute('aria-current', 'page')
})

test('navigating moves the tab you are on instead of opening another', async ({ page }) => {
  await open(page)
  await page.getByRole('link', { name: 'Inbox' }).first().click()
  await expect(page).toHaveURL(/\/inbox$/)
  await expect(tabs(page)).toHaveCount(1)
  await expect(tabs(page).first()).toHaveText(/Inbox/)
})

test('"+" opens a second tab and both stay open', async ({ page }) => {
  await open(page)
  await strip(page).getByRole('button', { name: 'New tab' }).click()
  await page.getByRole('menuitem', { name: 'Inbox' }).click()

  await expect(page).toHaveURL(/\/inbox$/)
  await expect(tabs(page)).toHaveCount(2)
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-current', 'page')

  // and switching back is a click, with the address bar following
  await tabs(page).first().click()
  await expect(page).toHaveURL(/\/northstar$/)
})

test('a page names its own tab, and the shell does not take the name back', async ({ page }) => {
  await open(page, '/northstar/chat')
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()
  await expect(tabs(page).first()).toHaveText(/eng-core/)

  // moving around in another tab must not relabel this one back to the href-derived "Chat"
  await strip(page).getByRole('button', { name: 'New tab' }).click()
  await page.getByRole('menuitem', { name: 'Issues' }).click()
  await expect(tabs(page)).toHaveCount(2)
  await page.getByRole('link', { name: 'Inbox' }).first().click()

  await expect(tabs(page).first()).toHaveText(/eng-core/)
  await tabs(page).first().click()
  await expect(page).toHaveURL(/c=/)
})

test('closing the tab you are on moves you to its neighbour', async ({ page }) => {
  await open(page)
  await strip(page).getByRole('button', { name: 'New tab' }).click()
  await page.getByRole('menuitem', { name: 'Inbox' }).click()
  await expect(tabs(page)).toHaveCount(2)

  await tabs(page).first().getByRole('button', { name: 'Close tab' }).click()
  await expect(tabs(page)).toHaveCount(1)
  await expect(page).toHaveURL(/\/inbox$/)
})

test('closing the last tab leaves you at home rather than nowhere', async ({ page }) => {
  await open(page, '/northstar/inbox')
  await tabs(page).first().getByRole('button', { name: 'Close tab' }).click()
  await expect(page).toHaveURL(/\/northstar$/)
  await expect(tabs(page)).toHaveCount(1)
})

test('tabs reorder by dragging, and the order survives a reload', async ({ page }) => {
  await open(page)
  await strip(page).getByRole('button', { name: 'New tab' }).click()
  await page.getByRole('menuitem', { name: 'Inbox' }).click()
  await expect(tabs(page)).toHaveCount(2)
  await expect(tabs(page).first()).toHaveText(/My work/)

  const from = await tabs(page).nth(1).boundingBox()
  const to = await tabs(page).first().boundingBox()
  if (!from || !to) throw new Error('tabs are not on screen')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()

  await expect(tabs(page).first()).toHaveText(/Inbox/)
  await page.reload()
  await expect(tabs(page).first()).toHaveText(/Inbox/)
})

test('turning the tab bar off in preferences removes the strip', async ({ page }) => {
  await open(page, '/northstar/settings/appearance')
  await page.getByLabel('Tab bar').setChecked(false)
  await expect(strip(page)).toHaveCount(0)

  // and nothing else about the shell depends on it
  await page.getByRole('link', { name: 'Inbox' }).first().click()
  await expect(page).toHaveURL(/\/inbox$/)

  await page.goto('/northstar/settings/appearance')
  await expect(strip(page)).toHaveCount(0)
  await page.getByLabel('Tab bar').setChecked(true)
  await expect(strip(page)).toBeVisible()
})

test('changing language relabels every tab the shell named, and none the pages named', async ({
  page,
  context,
}) => {
  await open(page, '/northstar/chat')
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()
  await strip(page).getByRole('button', { name: 'New tab' }).click()
  await page.getByRole('menuitem', { name: 'Inbox' }).click()
  await expect(tabs(page)).toHaveCount(2)

  await context.addCookies([{ name: 'kern_locale', value: 'fa', url: 'http://localhost:4173' }])
  await page.reload()

  // the shell's own name follows the language; the conversation's name is the conversation's
  await expect(tabs(page).filter({ hasText: 'صندوق ورودی' })).toHaveCount(1)
  await expect(tabs(page).filter({ hasText: 'eng-core' })).toHaveCount(1)
  await expect(tabs(page).filter({ hasText: 'Inbox' })).toHaveCount(0)
})

test('a phone gets the bottom bar instead of the strip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/northstar')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(strip(page)).toBeHidden()
})
