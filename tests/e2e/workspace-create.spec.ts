import { expect, test } from '@playwright/test'

/**
 * Creating a workspace, and arriving in the one you created.
 *
 * This exists because the create flow shipped landing people somewhere else. `users.me()` answers
 * with the workspace list the whole app resolves a slug against, the client holds a query fresh for
 * 30 seconds, and `/onboarding` had just fetched that list — so the layout at `/<new-slug>` read a
 * list taken *before* the workspace existed, found no match, and forwarded to the first workspace
 * the person already had. The switcher reads the same list, so the new workspace was missing from
 * the menu as well, and only a reload produced either of them.
 *
 * Measured on 2026-09-06 in `dev:mock`: creating "Aurora Labs" left the browser on `/northstar`
 * with a switcher offering Northstar and Atlas Studio. The fix is a refetch before the navigation
 * in `/onboarding`, plus one re-read in `(app)/[ws]/+layout.svelte` before it gives up on a slug —
 * the redirect is one-way, and a cached list is an answer about the past.
 *
 * Both assertions are about reachability rather than markup: which workspace you are in, and what
 * the switcher offers without a reload.
 */

const NAME = 'Aurora Labs'
const SLUG = 'aurora-labs'

async function createWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/onboarding')
  await page.getByLabel('Workspace name').fill(NAME)
  // `Button` renders type="button", so this is the click the form actually depends on
  await page.getByRole('button', { name: 'Create workspace' }).click()
}

test('creating a workspace opens that workspace', async ({ page }) => {
  await createWorkspace(page)

  // The defect in one assertion: this used to be the person's first workspace.
  await expect(page).toHaveURL(new RegExp(`/${SLUG}$`))
})

test('the new workspace is in the switcher without a reload', async ({ page }) => {
  await createWorkspace(page)
  await expect(page).toHaveURL(new RegExp(`/${SLUG}$`))

  await page.locator('button.ksw').first().click()
  const menu = page.locator('.kmenu')
  await expect(menu).toBeVisible()
  await expect(menu.getByText(NAME, { exact: true })).toBeVisible()
})
