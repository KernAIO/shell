import { expect, type Page, test } from '@playwright/test'

/**
 * The issues experience, end to end against the mock backend.
 *
 * This is the path that has to keep working: open the list, switch to the board, open an issue,
 * close it. Everything else in the tracker hangs off those four moves, so a break here is a break
 * everywhere.
 */

async function openTracker(page: Page) {
  await page.goto('/northstar/tracker')
  await expect(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible()
  await expect(page.getByTestId('issue-row').first()).toBeVisible()
}

test('list, board, issue panel', async ({ page }) => {
  await openTracker(page)

  // the list groups by status and hides empty groups
  const rows = page.getByTestId('issue-row')
  expect(await rows.count()).toBeGreaterThan(10)
  await expect(page.getByRole('button', { name: /In progress/ }).first()).toBeVisible()

  // switching to the board keeps the same query and puts the cards in columns
  await page.getByRole('radio', { name: 'Board' }).click()
  await expect(page).toHaveURL(/view=board/)
  await expect(page.getByTestId('board')).toBeVisible()
  expect(await page.getByTestId('board-card').count()).toBeGreaterThan(10)

  // back to the list, then open the first issue
  await page.getByRole('radio', { name: 'List' }).click()
  const first = rows.first()
  const key = await first.getAttribute('data-issue-key')
  expect(key).toBeTruthy()
  await first.click()

  await expect(page).toHaveURL(new RegExp(`issue=${key}`))
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await expect(panel.getByText(key as string)).toBeVisible()
  await expect(panel.getByTestId('comment-input')).toBeVisible()

  // Escape closes the panel and leaves the list where it was
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page).not.toHaveURL(/issue=/)
  await expect(rows.first()).toBeVisible()
})

test('keyboard: j/k move, x selects, c creates', async ({ page }) => {
  await openTracker(page)

  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect(page.locator('[data-testid="issue-row"][aria-current="true"]')).toHaveCount(1)

  await page.keyboard.press('x')
  await expect(page.getByRole('status').filter({ hasText: 'selected' })).toBeVisible()

  await page.keyboard.press('c')
  const title = page.getByTestId('new-issue-title')
  await expect(title).toBeFocused()

  // a space belongs in the title. When the close button holds focus instead, it activates it and
  // throws the draft away — which is exactly what used to happen.
  await page.keyboard.type('needs a space')
  await expect(title).toHaveValue('needs a space')
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')
})

test('the query box validates before it filters', async ({ page }) => {
  await openTracker(page)
  const before = await page.getByTestId('issue-row').count()

  const kql = page.getByTestId('kql-input')
  await kql.fill('assigne = currentUser()')
  await expect(page.locator('#kql-error')).toBeVisible()
  await kql.press('Enter')
  // a query that does not parse is never applied, so the list is untouched
  await expect(page.getByTestId('issue-row')).toHaveCount(before)

  await kql.fill('priority = urgent')
  await expect(page.locator('#kql-error')).toBeHidden()
  await kql.press('Enter')
  await expect(page).toHaveURL(/q=priority/)
  await expect(page.getByTestId('issue-row').first()).toBeVisible()
  expect(await page.getByTestId('issue-row').count()).toBeLessThan(before)
})
