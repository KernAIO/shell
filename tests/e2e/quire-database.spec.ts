import { expect, type Page, test } from '@playwright/test'

/**
 * Quire's database interface, end to end against the mock.
 *
 * These assert **behaviour**, not presence: editing a cell has to change the row, choosing a status
 * has to move a card on the board, adding a column has to appear in every row, a filter has to
 * shrink the list and clearing it has to restore it. A test that only checks a heading is on screen
 * passes just as happily when every control is inert, which is the failure this file exists for.
 */

/** The database seeded in the mock's Handbook space. */
const DATABASE = '/northstar/quire/handbook/01920000-0000-7000-8000-000000000110'

async function openDatabase(page: Page) {
  await page.goto(DATABASE)
  await expect(page.getByTestId('database-table')).toBeVisible()
  await expect(page.getByTestId('database-row').first()).toBeVisible()
}

test('the table draws the seeded columns in position order', async ({ page }) => {
  await openDatabase(page)

  const headers = page.getByRole('columnheader')
  // `innerText` reflects `text-transform`, and a table head is uppercase by design.
  const names = (await headers.allInnerTexts()).map((n) => n.trim().toLowerCase()).filter(Boolean)
  expect(names.slice(0, 7)).toEqual(['title', 'owner', 'status', 'due', 'days', 'signed off', 'notes'])

  // one row per seeded task, and the one with every cell empty is among them
  const rows = page.getByTestId('database-row')
  expect(await rows.count()).toBe(8)
  // scoped to the table: `name` matches a substring, so an unscoped 'Title' also finds the page's own
  await expect(rows.nth(7).getByRole('textbox', { name: 'Title' })).toHaveValue('Anything else?')
  await expect(rows.nth(7).getByRole('button', { name: 'Status' })).toContainText('Empty')
})

test('editing a title cell changes the row', async ({ page }) => {
  await openDatabase(page)

  const first = page.getByTestId('database-row').first()
  const title = first.getByRole('textbox', { name: 'Title' })
  await title.fill('Read the handbook twice')
  await title.blur()

  await expect(page.getByTestId('database-row').first().getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Read the handbook twice',
  )
})

test('choosing a status shows its chip, and the board puts the card in that lane', async ({ page }) => {
  await openDatabase(page)

  // the last row has no status at all
  const row = page.getByTestId('database-row').nth(7)
  await row.getByRole('button', { name: 'Status' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Blocked' }).click()

  await expect(row.getByText('Blocked')).toBeVisible()

  // the same row is now a card in the Blocked lane on the board
  await page.getByRole('tab', { name: 'By status' }).click()
  await expect(page.getByTestId('database-board')).toBeVisible()
  const blocked = page.locator('[data-lane="blocked"]')
  await expect(blocked.getByTestId('board-card').filter({ hasText: 'Anything else?' })).toBeVisible()
})

test('a card moves between lanes from its menu, with no drag at all', async ({ page }) => {
  await page.goto(DATABASE)
  await page.getByRole('tab', { name: 'By status' }).click()
  await expect(page.getByTestId('database-board')).toBeVisible()

  const card = page.locator('[data-lane="todo"]').getByTestId('board-card').filter({ hasText: 'Book a 1:1' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /Actions for Book a 1:1/ }).click()
  await page.getByRole('menuitem', { name: 'Done', exact: true }).click()

  await expect(
    page.locator('[data-lane="done"]').getByTestId('board-card').filter({ hasText: 'Book a 1:1' }),
  ).toBeVisible()
  await expect(
    page.locator('[data-lane="todo"]').getByTestId('board-card').filter({ hasText: 'Book a 1:1' }),
  ).toHaveCount(0)
})

test('adding a column puts a header and a cell in every row', async ({ page }) => {
  await openDatabase(page)

  const before = await page.getByRole('columnheader').count()
  await page.getByRole('button', { name: 'New column' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Reviewer')
  await dialog.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByRole('columnheader', { name: /Reviewer/ })).toBeVisible()
  expect(await page.getByRole('columnheader').count()).toBe(before + 1)
  // every row gained the cell, not just the first
  await expect(page.getByTestId('database-row').getByRole('textbox', { name: 'Reviewer' })).toHaveCount(8)
})

test('a filter shrinks the list, and clearing it restores it', async ({ page }) => {
  await openDatabase(page)
  expect(await page.getByTestId('database-row').count()).toBe(8)

  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Add a filter' }).click()

  // the first column is Owner; switch to Status and pick one value
  await page.getByRole('combobox', { name: 'Column to filter' }).selectOption({ label: 'Status' })
  await page.getByRole('combobox', { name: 'Comparison' }).selectOption({ label: 'is any of' })
  await page.getByRole('checkbox', { name: 'Done' }).check()

  await expect(page.getByTestId('database-row')).toHaveCount(2)

  await page.getByRole('button', { name: 'Clear all' }).first().click()
  await expect(page.getByTestId('database-row')).toHaveCount(8)
})

test('the last view cannot be deleted, and deleting another leaves one selected', async ({ page }) => {
  await openDatabase(page)

  // three seeded views; delete two and the third refuses
  for (const name of ['Schedule', 'By status']) {
    await page.getByRole('tab', { name }).click()
    await page.getByRole('button', { name: 'View options' }).click()
    await page.getByRole('menuitem', { name: 'Delete this view' }).click()
    const confirm = page.getByRole('dialog')
    // The confirmation says what happens, not "are you sure".
    await expect(confirm).toContainText('Not a single row is touched')
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('tab', { name })).toHaveCount(0)
  }

  await expect(page.getByRole('tab', { name: 'All tasks' })).toBeVisible()
  await page.getByRole('button', { name: 'View options' }).click()
  // the item is disabled rather than absent, and says why
  await expect(page.getByRole('menuitem', { name: 'Delete this view' })).toBeDisabled()
})
