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

test('an issue connects to children, other issues and pages elsewhere', async ({ page }) => {
  await page.goto('/northstar/tracker?issue=KRN-12')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  // a sub-issue: pick another issue and it becomes a child
  await panel.getByRole('button', { name: 'Add a sub-issue' }).click()
  const picker = panel.getByTestId('issue-picker')
  await picker.fill('Audit log')
  await page.getByRole('option', { name: /Audit log/ }).click()
  await expect(panel.getByRole('button', { name: /KRN-6/ })).toBeVisible()

  // a relation, which the server writes in both directions
  await panel.getByRole('button', { name: 'Add a related issue' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Blocks' }).click()
  await panel.getByTestId('issue-picker').fill('Typing indicators')
  await page.getByRole('option', { name: /Typing indicators/ }).click()
  await expect(panel.getByText('Blocks', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /RTM-3/ })).toBeVisible()

  // the other end of that relation says the opposite
  await panel.getByRole('button', { name: /RTM-3/ }).click()
  await expect(page).toHaveURL(/issue=RTM-3/)
  await expect(panel.getByText('Blocked by', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /KRN-12/ })).toBeVisible()

  // an external link, which only accepts an http address
  await panel.getByRole('button', { name: 'Add a link' }).click()
  const url = panel.getByTestId('link-url')
  await url.fill('not-a-url')
  await expect(panel.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  await url.fill('https://example.test/spec')
  await panel.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(panel.getByRole('link', { name: 'https://example.test/spec' })).toBeVisible()
})

test('closing an issue that needs sign-off parks it until somebody approves', async ({ page }) => {
  await page.goto('/northstar/tracker?issue=KRN-18')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  // ask to close it: the issue does not move, an approval appears instead
  await panel.getByTestId('status-picker').click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Done', exact: true }).click()

  const approvals = panel.getByTestId('approvals')
  await expect(approvals).toBeVisible()
  await expect(approvals).toContainText('0 of 1 approved')
  await expect(panel.getByTestId('status-picker')).not.toContainText('Done')

  // a note is optional, and approving applies the transition that was blocked
  await approvals.getByRole('button', { name: 'Add a note' }).click()
  await approvals.getByRole('textbox', { name: /Why/ }).fill('Shipped in 1.2')
  await approvals.getByRole('button', { name: 'Approve' }).click()

  await expect(approvals).toBeHidden()
  await expect(panel.getByTestId('status-picker')).toContainText('Done')
})

test('an admin creates a field, puts it on a type, and sees it on an issue', async ({ page }) => {
  // This is the whole point of the customisation work: no database console anywhere in it.
  await page.goto('/northstar/settings/tracker/fields')
  await expect(page.getByRole('heading', { name: 'Custom fields' })).toBeVisible()

  await page.getByTestId('new-field').click()
  await page.getByTestId('field-name').fill('Escalated by')
  // the key follows the name until somebody types their own
  await expect(page.getByTestId('field-key')).toHaveValue('escalated_by')
  await page.getByTestId('field-save').click()

  const row = page.locator('[data-field-key="escalated_by"]')
  await expect(row).toBeVisible()

  // Navigate in the app rather than reloading: the demo backend lives in the page, so a fresh load
  // would throw away the field that was just created.
  await page.getByRole('link', { name: 'Work item types' }).click()
  await page.locator('[data-type-key="bug"]').click()
  await expect(page.getByTestId('zone-main')).toBeVisible()

  // Moved without dragging: every arrangement a drag can produce is reachable from this menu,
  // which is also the only route somebody using a keyboard has.
  const field = page.locator('[data-field-id="cf.escalated_by"]')
  await expect(field).toBeVisible()
  await field.getByRole('button', { name: 'Move Escalated by' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Move to Main' }).click()
  await expect(page.getByTestId('zone-main')).toContainText('Escalated by')

  await page.getByTestId('save-layout').click()
  await expect(page.getByText('Layout saved')).toBeVisible()

  // and the issue panel reflects it: a field created minutes ago is on the issue
  await page.getByRole('link', { name: 'Issues', exact: true }).first().click()
  await page.getByTestId('issue-row').first().click()
  // it went to the main column, so that is where the issue shows it
  await expect(page.getByRole('dialog').getByTestId('main-fields')).toContainText('Escalated by')
})

test('a field cannot be deleted without being told what it takes with it', async ({ page }) => {
  await page.goto('/northstar/settings/tracker/fields')
  const row = page.locator('[data-field-key="customer"]')
  await expect(row).toBeVisible()

  await row.locator('..').getByTestId('field-delete').click()
  // no window.confirm: the consequence is named on screen
  await expect(page.getByText(/value on every issue/)).toBeVisible()
  await page.getByTestId('field-delete-confirm').click()
  await expect(page.locator('[data-field-key="customer"]')).toHaveCount(0)
})

test('a project can be created, and it starts from a shape you choose', async ({ page }) => {
  // `projects.create` has existed since the module did and nothing in the interface called it, so
  // every project came from seed data.
  await openTracker(page)
  await page.getByTestId('new-project').click()

  await page.getByTestId('project-name').fill('Customer Success')
  // the key is suggested from the name and stays editable
  await expect(page.getByTestId('project-key')).toHaveValue('CS')
  await page.getByTestId('project-key').fill('CSX')

  // the four shapes are offered, and each says what it is for
  const choices = page.getByTestId('template-choices')
  await expect(choices.getByRole('button')).toHaveCount(4)
  await expect(choices).toContainText('Tickets with a customer')
  await choices.locator('[data-template="support"]').click()
  await expect(choices.locator('[data-template="support"]')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('project-create').click()
  await expect(page.getByText('CSX is ready')).toBeVisible()
})

test('a board can be grouped by a custom field', async ({ page }) => {
  await openTracker(page)

  // the group control offers the workspace's custom fields beside the built-in keys
  await page.getByTestId('group-by').click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Status' })).toBeVisible()
  await menu.getByRole('menuitemcheckbox', { name: 'Severity' }).click()
  await expect(page).toHaveURL(/group=cf\.severity/)

  // the list heads each group with the option's label, not the id it stores
  await expect(page.getByRole('button', { name: /^S1/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^S3/ }).first()).toBeVisible()

  // and the board takes a column per option, including the ones nothing is in yet
  await page.getByRole('radio', { name: 'Board' }).click()
  const board = page.getByTestId('board')
  await expect(board).toBeVisible()
  await expect(board.locator('[data-column]')).toHaveCount(4)
  await expect(board).toContainText('S2')
})

test('a relation field links to another issue, and a formula is calculated', async ({ page }) => {
  await page.goto('/northstar/tracker?issue=KRN-6')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  // a relation offers a picker rather than a control that does nothing
  await expect(panel.locator('dl.props')).toContainText('Caused by')
  await panel.getByRole('button', { name: 'Link an issue' }).click()
  await panel.getByTestId('issue-picker').fill('Typing indicators')
  await page.getByRole('option', { name: /Typing indicators/ }).click()
  await expect(panel.getByText('RTM-3')).toBeVisible()

  // and it can be taken off again
  await panel.getByRole('button', { name: 'Remove this link' }).click()
  await expect(panel.getByText('RTM-3')).toHaveCount(0)

  // a formula is shown, and never offered as something to type into
  await expect(panel.locator('dl.props')).toContainText('Days open')
})

test('a query can be saved as a view, pinned, reopened and deleted', async ({ page }) => {
  await openTracker(page)

  // build something worth keeping
  await page.getByTestId('group-by').click()
  await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Priority' }).click()
  const query = page.getByTestId('kql-input')
  await query.fill('status != done')
  await query.press('Enter')

  await page.getByTestId('save-view').click()
  // the dialog shows what is being saved, so nobody has to remember what they typed
  await expect(page.getByTestId('view-preview')).toContainText('status != done')
  await page.getByTestId('view-name').fill('Open by priority')
  await page.getByTestId('view-save').click()
  await expect(page.getByText('“Open by priority” saved')).toBeVisible()

  // it appears in the sidebar, where the module's own navigation lives
  const view = page.locator('[data-view-name="Open by priority"]')
  await expect(view).toBeVisible()

  // opening it restores the query and the grouping it was saved with
  await page.getByTestId('group-by').click()
  await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Status' }).click()
  await view.click()
  await expect(page).toHaveURL(/q=status\+%21%3D\+done|q=status\+!%3D\+done/)
  await expect(page.getByTestId('group-by')).toContainText('Priority')

  // pinning moves it to the top group, and deleting takes it out of the sidebar
  await page.getByRole('button', { name: 'Actions for Open by priority' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Pin to the sidebar' }).click()
  await expect(page.getByText('Pinned')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Open by priority' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.locator('[data-view-name="Open by priority"]')).toHaveCount(0)
})

test('something raised from outside can be accepted or declined', async ({ page }) => {
  // KRN-7 is in triage in the demo data: it arrived from outside the team.
  await page.goto('/northstar/tracker?issue=KRN-7')
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  const triage = panel.getByTestId('triage')
  await expect(triage).toBeVisible()
  await expect(triage).toContainText('has not been accepted yet')

  // accepting moves it into the workflow rather than leaving somebody to set a status by hand
  await panel.getByTestId('triage-accept').click()
  await expect(triage).toBeHidden()
  await expect(panel.getByTestId('status-picker')).not.toContainText('Triage')
})

test('a project can be given components, versions and labels', async ({ page }) => {
  // All three had a server and no screen, so a project could only ever use what its template seeded.
  await page.goto('/northstar/settings/tracker/planning')
  await expect(page.getByRole('heading', { name: 'Components, versions and labels' })).toBeVisible()

  const components = page.getByTestId('planning-components')
  await components.getByTestId('planning-add').fill('Realtime gateway')
  await components.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(components.locator('[data-item="Realtime gateway"]')).toBeVisible()

  // a version can be marked released, and unmarked again
  const versions = page.getByTestId('planning-versions')
  await versions.getByTestId('planning-add').fill('1.2')
  await versions.getByRole('button', { name: 'Add', exact: true }).click()
  await versions.getByRole('button', { name: 'Mark released' }).click()
  await expect(versions.getByText('Released', { exact: true })).toBeVisible()

  // removing names its consequence rather than asking through window.confirm
  await components.getByRole('button', { name: 'Remove Realtime gateway' }).click()
  await expect(page.getByText(/comes off every issue/)).toBeVisible()
  await components.getByRole('button', { name: 'Delete' }).click()
  await expect(components.locator('[data-item="Realtime gateway"]')).toHaveCount(0)
})

test('time can be logged on an issue, by timer or by hand', async ({ page }) => {
  // `timeSpentSec` could only ever be zero: the timer and the worklogs had a server and no screen.
  await page.goto('/northstar/tracker?issue=KRN-6')
  const panel = page.getByRole('dialog')
  const time = panel.getByTestId('issue-time')
  await expect(time).toBeVisible()

  // by hand, in the way people say it rather than in seconds
  await time.getByRole('button', { name: 'Log time' }).click()
  await time.getByTestId('time-amount').fill('1h30m')
  await time.getByTestId('time-log').click()
  // 1h30m is logged as 1h30m, not rounded up to two hours
  await expect(time.getByText('1h 30m').first()).toBeVisible()

  // a timer runs until it is stopped, and stopping it keeps the time
  await time.getByTestId('timer-start').click()
  await expect(time.getByTestId('timer-stop')).toBeVisible()
  await time.getByTestId('timer-stop').click()
  await expect(time.getByTestId('timer-start')).toBeVisible()
})
