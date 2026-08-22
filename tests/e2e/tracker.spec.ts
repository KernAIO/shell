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

test('an issue shows the fields its type lays out', async ({ page }) => {
  // Bug carries a stored layout in the demo data: Severity is promoted above the built-in
  // properties and Cycle is hidden. A type with no layout shows everything, in the default order.
  await page.goto('/northstar/tracker?issue=KRN-7')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  const labels = panel.locator('dl.props dt')
  await expect(labels.first()).toHaveText('Severity')
  await expect(panel.locator('dl.props')).toContainText('Customer')
  await expect(panel.locator('dl.props')).not.toContainText('Cycle')

  // a custom select is editable in place and the choice sticks
  await panel.getByRole('button', { name: 'S3' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'S1' }).click()
  await expect(panel.getByRole('button', { name: 'S1' })).toBeVisible()

  // a type without a stored layout keeps every built-in property, Cycle included
  await page.goto('/northstar/tracker?issue=KRN-6')
  await expect(panel.locator('dl.props')).toContainText('Cycle')
})

test('a comment carries a real mention, and can be edited, replied to and deleted', async ({ page }) => {
  await page.goto('/northstar/tracker?issue=KRN-6')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  const box = panel.getByTestId('comment-input')
  await box.click()
  await box.fill('over to @Dan')
  // the menu offers the workspace's people; picking one inserts a mention, not the characters
  await expect(page.getByRole('option', { name: /Dan/ })).toBeVisible()
  await box.press('Enter')
  await expect(box).toHaveValue('over to @Dan Brekke ')
  await box.press('Enter')

  // Keep a positional locator: once editing starts the text moves into a textarea, and a
  // text filter would stop matching the very comment it is meant to follow.
  const comment = panel.locator('article').first()
  await expect(comment).toBeVisible()
  // a mention is a node the server can turn into a notification, not text that looks like one
  await expect(comment.locator('.kern-mention')).toHaveText('@Dan Brekke')

  // editing keeps the mention rather than deleting whoever was named
  await comment.getByRole('button', { name: 'Comment actions' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Edit' }).click()
  const editBox = comment.getByRole('textbox', { name: 'Edit your comment' })
  await expect(editBox).toHaveValue('over to @Dan Brekke')
  await editBox.fill('over to @Dan Brekke — thanks')
  await comment.getByRole('button', { name: 'Save' }).click()
  await expect(comment).toContainText('thanks')
  await expect(comment.locator('.kern-mention')).toHaveText('@Dan Brekke')

  // a reply belongs to the comment it answers
  await comment.getByRole('button', { name: 'Reply' }).click()
  const replyBox = comment.getByRole('textbox', { name: 'Write a reply…' })
  await replyBox.fill('on it')
  await comment.getByRole('button', { name: 'Reply' }).last().click()
  await expect(comment.locator('li').filter({ hasText: 'on it' })).toBeVisible()

  // deleting says what will happen before it happens
  await comment.getByRole('button', { name: 'Comment actions' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click()
  await expect(comment.getByRole('alertdialog')).toContainText('removed for everyone')
  await comment.getByRole('button', { name: 'Delete' }).click()
  await expect(panel.locator('article')).toHaveCount(0)
})
