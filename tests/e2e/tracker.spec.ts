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

  // deleting asks first, like every other irreversible thing in the tracker
  await page.getByRole('button', { name: 'Actions for Open by priority' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByText('Delete Open by priority?')).toBeVisible()
  await page.getByTestId('view-delete-confirm').click()
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
  await expect(page.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible()

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

test('an import that has already run can still be looked at', async ({ page }) => {
  // `imports.list` answered this from the start and nothing asked it, so leaving the page lost
  // the outcome of an import for good.
  await page.goto('/northstar/settings/tracker/import')
  const history = page.getByTestId('import-history')
  await expect(history).toContainText('Finished')
  await expect(history).toContainText('211 created')

  // opening one shows the rows it could not bring in, which is the only actionable part
  await history.getByTestId('import-history-row').first().click()
  await expect(page.getByTestId('import-job')).toBeVisible()
  await expect(page.getByText(/Priority "Blocker" is not one of/)).toBeVisible()
  await expect(page.getByText('row 42')).toBeVisible()
})

test('flow over time stacks each status into a band', async ({ page }) => {
  // `reports.cfd` was the one report with a server and no tab.
  await page.goto('/northstar/tracker/reports')
  await page.getByRole('radio', { name: 'Flow over time' }).click()
  const panel = page.getByTestId('report-cfd')
  await expect(panel.getByRole('img', { name: 'Flow over time' })).toBeVisible()

  // the numbers are there for anyone the picture does not reach
  await expect(panel.getByRole('table')).toContainText('Backlog')
  await expect(panel.getByRole('table')).toContainText('Done')
})

test('what was made in a hurry can be corrected afterwards', async ({ page }) => {
  // `views.update`, `worklogs.update` and `fields.archive` all had a server and no control, so a
  // view named badly kept its name, a mistyped hour stayed mistyped, and a field nobody used any
  // more could only be deleted — which strips its value off every work item.
  await page.goto('/northstar/tracker')

  // refining a saved view offers to change it, not only to make a second copy
  await page.getByTestId('save-view').click()
  await page.getByTestId('view-name').fill('My open bugs')
  await page.getByTestId('view-save').click()
  await page.getByTestId('saved-view').filter({ hasText: 'My open bugs' }).click()
  await expect(page.getByTestId('save-view')).toBeVisible()
  await page.getByTestId('save-view').click()
  await expect(page.getByTestId('view-update')).toBeVisible()
  await page.getByTestId('view-update').click()

  // and it can be renamed rather than deleted and made again
  const row = page
    .locator('li')
    .filter({ has: page.getByTestId('saved-view') })
    .first()
  await row.getByRole('button', { name: /My open bugs/ }).click()
  await page.getByRole('menuitem', { name: 'Rename and share' }).click()
  await page.getByTestId('view-rename-name').fill('Open bugs')
  await page.getByTestId('view-rename-save').click()
  await expect(page.locator('[data-view-name="Open bugs"]')).toBeVisible()
})

test('a logged hour can be corrected, and a field retired without losing its values', async ({ page }) => {
  await page.goto('/northstar/tracker?issue=KRN-6')
  const time = page.getByRole('dialog').getByTestId('issue-time')
  await time.getByRole('button', { name: 'Log time' }).click()
  await time.getByTestId('time-amount').fill('2h')
  await time.getByTestId('time-log').click()

  // the entry is corrected in place, which keeps the day it was worked
  await time.getByTestId('worklog-duration').first().click()
  await time.getByTestId('worklog-edit').fill('20m')
  await time.getByTestId('worklog-edit').press('Enter')
  await expect(time.getByTestId('worklog-duration').first()).toHaveText('20m')

  // a field is archived rather than deleted: it leaves the forms, its values stay recorded
  await page.goto('/northstar/settings/tracker/fields')
  const field = page.locator('li').filter({ has: page.locator('[data-field-key="severity"]') })
  await field.getByTestId('field-archive').click()
  await expect(page.locator('[data-field-key="severity"]')).toHaveCount(0)
  await page.getByLabel('Show archived').check()
  await expect(page.locator('[data-field-key="severity"]')).toBeVisible()
})

test('a workflow can be created, given a status, and pointed at a type', async ({ page }) => {
  // The page could rename and reorder statuses and nothing else: create, archive, validate and
  // the type-to-workflow link all had a server and no control.
  await page.goto('/northstar/settings/tracker/workflows')

  await page.getByTestId('workflow-new').click()
  await page.getByTestId('workflow-name').fill('Support')
  await page.getByTestId('workflow-create').click()
  await expect(page.locator('[data-workflow="Support"]')).toBeVisible()

  // a new status is wired in on both sides, because validation does not catch one nothing can
  // reach — the page says so rather than leaving it to be discovered
  await page.getByTestId('status-add').fill('Waiting on customer')
  await page.getByTestId('status-add-go').click()
  // the names live in inputs, so the row is checked by its value rather than the list's text
  await expect(page.getByTestId('workflow-statuses').locator('input').last()).toHaveValue(
    'Waiting on customer',
  )
  await expect(page.getByText(/reached from any other/)).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // and a workflow nobody runs on does nothing, so the types that use it are set here
  await expect(page.getByText(/Nothing uses this workflow yet/)).toBeVisible()
  await page.getByLabel('Bug').check()
  await expect(page.getByText(/Nothing uses this workflow yet/)).toHaveCount(0)
})

test('a work item can be moved to another project, archived or deleted', async ({ page }) => {
  // `issues.move`, `archive` and `delete` had a server and no control, so an item raised in the
  // wrong project stayed there and a mistake could never be taken back.
  await page.goto('/northstar/tracker?issue=KRN-6')
  const panel = page.getByRole('dialog')
  await panel.getByTestId('issue-actions').click()

  // moving re-keys the item, because the key belongs to the project
  await page.getByRole('menuitem', { name: 'Move to project' }).click()
  await page.getByRole('menuitem', { name: /RTM/ }).click()
  await expect(panel.getByText(/^RTM-/)).toBeVisible()

  // deleting says what goes with it, and offers archiving as the reversible thing to do instead
  await panel.getByTestId('issue-actions').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByText(/archiving keeps all of it/)).toBeVisible()
  await panel.getByTestId('issue-delete-confirm').click()
  await expect(panel).toBeHidden()
})

test('a project can be renamed, archived and deleted', async ({ page }) => {
  // A project could be created and never touched again: update, archive and delete all had a
  // server and nothing that called it, so a typo in a name outlived the project.
  await page.goto('/northstar/settings/tracker/projects')
  await expect(page.getByTestId('project-name')).toHaveValue('Kern Platform')

  // saving is off until something changes, and on once it does
  await expect(page.getByTestId('project-save')).toBeDisabled()
  await page.getByTestId('project-name').fill('Kern Core')
  await page.getByTestId('project-save').click()
  await expect(page.locator('[data-testid="project-row"][data-project-key="KRN"]')).toContainText('Kern Core')

  // archiving takes it off the list without taking anything away
  await page.getByTestId('project-archive').click()
  await expect(page.locator('[data-testid="project-row"][data-project-key="KRN"]')).toHaveCount(0)
  await page.getByLabel('Show archived').check()
  await expect(page.locator('[data-testid="project-row"][data-project-key="KRN"]')).toBeVisible()

  // deleting asks for the key itself, because it takes every issue with it and cannot be undone
  await page.locator('[data-testid="project-row"][data-project-key="RTM"]').click()
  await page.getByTestId('project-delete').click()
  await expect(page.getByText(/cannot be undone/)).toBeVisible()
  await expect(page.getByTestId('project-delete-confirm')).toBeDisabled()
  await page.getByTestId('project-delete-key').fill('RTM')
  await page.getByTestId('project-delete-confirm').click()
  await expect(page.locator('[data-testid="project-row"][data-project-key="RTM"]')).toHaveCount(0)
})

test('a workspace can add a work item type of its own, and retire one', async ({ page }) => {
  // The per-type customisation this page exists for could only ever reach the types a template
  // seeded: `types.create` and `types.archive` had a server and no control anywhere.
  await page.goto('/northstar/settings/tracker/types')
  await page.getByTestId('type-new').click()

  // the key follows the name until it is touched, because it is a machine name and not a sentence
  await page.getByTestId('type-name').fill('Incident')
  await expect(page.getByTestId('type-key')).toHaveValue('incident')
  await page.getByTestId('type-save').click()

  const incident = page.locator('[data-testid="type-row"][data-type-key="incident"]')
  await expect(incident).toBeVisible()

  // archiving says what it does — the type leaves the menus, the work keeps it
  const row = page.locator('li').filter({ has: incident })
  await row.getByTestId('type-archive').click()
  await expect(page.getByText(/comes off every menu/)).toBeVisible()
  await page.getByTestId('type-archive-confirm').click()
  await expect(incident).toHaveCount(0)

  // and it is still there to be found, rather than gone
  await page.getByLabel('Show archived').check()
  await expect(incident).toBeVisible()

  // the default type is the one thing that cannot be archived: something has to catch new work
  const task = page.locator('li').filter({
    has: page.locator('[data-testid="type-row"][data-type-key="task"]'),
  })
  await expect(task.getByTestId('type-archive')).toBeDisabled()
})

test('a cycle runs, and closing it says where unfinished work goes', async ({ page }) => {
  // Cycles had a full server — create, start, complete, roll over — and no screen anywhere, so the
  // sprint progress bar in the issue header had nothing to measure.
  await page.goto('/northstar/settings/tracker/planning')
  const cycles = page.getByTestId('planning-cycles')

  // a cycle is a name and a window; the form refuses a window that runs backwards
  await cycles.getByTestId('cycle-name').fill('Hardening week')
  await cycles.getByTestId('cycle-start-date').fill('2026-09-01')
  await cycles.getByTestId('cycle-end-date').fill('2026-08-01')
  await expect(page.getByTestId('cycle-range-error')).toBeVisible()
  await expect(cycles.getByTestId('cycle-add')).toBeDisabled()

  await cycles.getByTestId('cycle-end-date').fill('2026-09-14')
  await expect(page.getByTestId('cycle-range-error')).toHaveCount(0)
  await cycles.getByTestId('cycle-add').click()
  const row = cycles.locator('[data-testid="cycle-row"]').filter({ hasText: 'Hardening week' })
  await expect(row).toContainText('Upcoming')

  // one cycle at a time: the demo's Sprint 24 is already running, so this one cannot start
  await row.getByTestId('cycle-start').click()
  await expect(page.getByText(/already active/)).toBeVisible()

  // closing the active cycle asks where the leftovers go rather than deciding quietly
  const active = cycles.locator('[data-testid="cycle-row"]').filter({ hasText: 'Sprint 24' })
  await active.getByTestId('cycle-complete').click()
  const panel = page.getByTestId('cycle-complete-panel')
  await expect(panel).toContainText('Sprint 24')
  await panel.getByTestId('cycle-roll').click()
  // the demo already has an upcoming Sprint 25, which is what the server would have chosen on
  // its own — naming a different one proves the choice on screen is the one that is obeyed
  await page.getByRole('option', { name: 'Hardening week' }).click()
  await panel.getByTestId('cycle-complete-confirm').click()
  await expect(active).toContainText('Completed')

  // and the work that was not finished landed in the cycle that was named, not the backlog and
  // not the one the server would have picked
  await expect(row).toContainText('carried over')
})

test('a project can be given milestones', async ({ page }) => {
  await page.goto('/northstar/settings/tracker/planning')
  const milestones = page.getByTestId('planning-milestones')
  await milestones.getByTestId('planning-add').fill('Public beta')
  await milestones.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(milestones.locator('[data-item="Public beta"]')).toBeVisible()

  // a milestone is reached rather than deleted, and can be reopened when it was not
  const row = milestones.locator('li').filter({ hasText: 'Public beta' })
  await row.getByRole('button', { name: 'Mark reached' }).click()
  await expect(row.getByText('Reached', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Reopen' }).click()
  await expect(row.getByRole('button', { name: 'Mark reached' })).toBeVisible()
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

test('reports answer how the work is going', async ({ page }) => {
  // Five reports had a server and no screen, so "are we going to make it" lived in the database.
  await page.goto('/northstar/tracker/reports')
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()

  // burndown shows what is left against what would be left if it went evenly
  const burndown = page.getByTestId('report-burndown')
  await expect(burndown).toBeVisible()
  await expect(burndown.getByRole('img', { name: 'Burndown' })).toBeVisible()
  await expect(burndown).toContainText('If it went evenly')

  // each report is its own tab, because each answers a different question
  await page.getByRole('radio', { name: 'Velocity' }).click()
  const velocity = page.getByTestId('report-velocity')
  await expect(velocity.getByRole('img', { name: 'Velocity' })).toBeVisible()
  await expect(velocity).toContainText('On average')

  await page.getByRole('radio', { name: 'Created and resolved' }).click()
  await expect(page.getByTestId('report-flow')).toContainText('Still open')

  // the numbers are given as a table too, for anyone the picture does not reach
  await expect(page.getByRole('table', { name: /Created and resolved/ })).toBeAttached()
})

test('a stranger can send a request, with no account and no navigation', async ({ page }) => {
  // Public: outside the app, no session, no workspace. The token is the only thing identifying
  // the project, which is what makes the link shareable and withdrawing it enough to close the form.
  await page.goto('/request/demo-intake-token')
  await expect(page.getByRole('heading', { name: /Contact/ })).toBeVisible()

  // there is nothing to sign in to and nowhere else to go
  await expect(page.getByRole('navigation')).toHaveCount(0)

  // the questions come from the project's layout, not from a hardcoded list
  await expect(page.getByText('Severity')).toBeVisible()

  // required questions gate the send
  const send = page.getByTestId('intake-submit')
  await expect(send).toBeDisabled()
  await page.getByTestId('intake-email').fill('someone@example.test')
  await page.getByTestId('intake-title').fill('The export is broken')
  await expect(send).toBeEnabled()

  await send.click()
  // and it comes back with something to quote, rather than just disappearing
  const done = page.getByTestId('intake-done')
  await expect(done).toBeVisible()
  await expect(done).toContainText(/KRN-\d+/)
})

test('a bad intake link says so rather than asking anyone to sign in', async ({ page }) => {
  await page.goto('/request/not-a-real-token')
  await expect(page.getByText('This form is not available')).toBeVisible()
  await expect(page).not.toHaveURL(/login|signin/)
})

test('a team can open a request link, and closing it closes the form', async ({ page }) => {
  // `setIntake` existed and nothing called it, so the form had no link anyone could hand out.
  await page.goto('/northstar/settings/tracker/planning')
  await page.getByTestId('intake-open').click()

  const link = page.getByTestId('intake-link')
  await expect(link).toBeVisible()
  await expect(link).toContainText('/request/')

  // the link it hands out is the one the public form answers to
  const href = (await link.textContent()) ?? ''
  await page.goto(href.trim())
  await expect(page.getByRole('heading', { name: /Contact/ })).toBeVisible()
})

test('a workflow says what each move requires, in words', async ({ page }) => {
  // A workflow's rules decided who could close an issue and nobody could read them.
  await page.goto('/northstar/settings/tracker/workflows')
  await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()

  const moves = page.getByTestId('workflow-transitions')
  await expect(moves).toBeVisible()
  // conditions, validators and post-functions as sentences rather than as JSON
  await expect(moves).toContainText('Only when every sub-issue is done')
  await expect(moves).toContainText('A comment is required')
  await expect(moves).toContainText('Assigns it to whoever moved it')
  await expect(moves).toContainText('Sets the resolution to “done”')

  // a status can be renamed, and the rename reaches everywhere the status is shown
  const statuses = page.getByTestId('workflow-statuses')
  await statuses.locator('[data-status="in_review"]').fill('Reviewing')
  await page.getByTestId('save-workflow').click()
  await expect(page.getByText('Workflow saved')).toBeVisible()
  await expect(moves).toContainText('Reviewing')
})

test('an issue can be set to repeat, and the schedule says what it will do', async ({ page }) => {
  // Recurring issues had a server and no screen: nothing could be set to repeat at all.
  await page.goto('/northstar/settings/tracker/repeating')
  await expect(page.getByRole('heading', { name: 'Work that repeats' })).toBeVisible()

  await page.getByTestId('recurring-name').fill('Weekly review')
  await page.getByTestId('recurring-add').click()

  const list = page.getByTestId('recurring-list')
  await expect(list).toContainText('Weekly review')
  // the rule reads as a sentence, because a schedule you cannot read is one you cannot check
  await expect(list).toContainText('Every week at 09:00')
  await expect(list).toContainText('0 made so far')

  // pausing says what it will do rather than asking which way the switch means on
  await page.getByTestId('recurring-toggle').click()
  await expect(list).toContainText('Paused')
  await expect(page.getByTestId('recurring-toggle')).toContainText('Resume')
})

test('a spreadsheet is mapped column by column before anything is imported', async ({ page }) => {
  await page.goto('/northstar/settings/tracker/import')
  await expect(page.getByRole('heading', { name: 'Import', exact: true })).toBeVisible()

  // the file is read in the browser, so the mapping offers its real columns and real values
  await page.getByTestId('import-file').setInputFiles({
    name: 'issues.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Summary,Importance\n"Crash, then burn",high\nSlow search,low\n'),
  })

  const mapping = page.getByTestId('import-mapping')
  await expect(mapping).toContainText('Summary')
  await expect(mapping).toContainText('Importance')
  // a quoted comma is one field, not two — the row keeps its shape
  await expect(mapping).toContainText('Crash, then burn')

  // nothing is mapped to begin with, and a title is required before anything can run
  await expect(page.getByTestId('needs-title')).toBeVisible()
  await expect(page.getByTestId('import-start')).toBeDisabled()

  await mapping
    .getByRole('row', { name: /Summary/ })
    .getByRole('button')
    .click()
  await page.getByRole('option', { name: 'Title', exact: true }).click()
  await expect(page.getByTestId('needs-title')).toHaveCount(0)

  await page.getByTestId('import-start').click()
  const job = page.getByTestId('import-job')
  await expect(job).toBeVisible()
  // a failing row is shown rather than buried in a count
  await expect(page.getByText('Row 3 has no title')).toBeVisible()
})
