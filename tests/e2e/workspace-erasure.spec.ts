import { expect, test } from '@playwright/test'

/**
 * Scheduling a workspace's erasure, and being able to call it off afterwards.
 *
 * This exists because the undo shipped unreachable. Core archives the workspace in the same call
 * that writes the deletion record; archived workspaces were absent from `users.me()`; and
 * `(app)/[ws]/+layout.svelte` reads a slug it cannot resolve as a workspace that was left or
 * renamed, so it forwarded the owner to `/onboarding`. A sole-workspace owner therefore met
 * **"Create your first workspace"** seconds after being promised thirty days to change their mind,
 * and the "Keep this workspace" panel could not render on any route at all.
 *
 * None of that was visible in `dev:mock`, because the mock wrote the deletion record without
 * performing its side effect — the archive. That is the shape of the bug worth remembering: a mock
 * that models a state transition and not the transition's consequences certifies a screen nobody
 * can reach. `mockWorkspaceArchivedAt` is the fix, and this is the test that holds it.
 *
 * So the assertions below are deliberately about *reachability*, not about the panel's markup:
 * where you are after pressing the button, and whether the way back exists on a different route
 * after a full reload.
 */

const WS = 'northstar'
const WS_NAME = 'Northstar'

/*
 * Nothing clears `kern.mock.deletions` between tests, and nothing should.
 *
 * Each test gets its own browser context, so `localStorage` starts empty — while an
 * `addInitScript` that removes the key runs at the start of **every document**, not once per test,
 * so it deletes the record on the very navigation the second test makes to go looking for it. That
 * cost a run here: the erasure was scheduled, the reload wiped it, and the missing banner read as a
 * broken component rather than a broken fixture.
 */

async function scheduleErasure(page: import('@playwright/test').Page) {
  await page.goto(`/${WS}/settings/data`)
  await page.getByRole('button', { name: 'Delete this workspace' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // typing the workspace's own name is what enables the confirmation
  await dialog.getByRole('textbox').first().fill(WS_NAME)
  await dialog.getByRole('button', { name: 'Delete this workspace' }).click()
  await expect(dialog).toBeHidden()
}

test('scheduling an erasure leaves the workspace open, not the onboarding page', async ({ page }) => {
  await scheduleErasure(page)

  // The defect in one assertion: this used to be `/onboarding`.
  await expect(page).toHaveURL(new RegExp(`/${WS}/settings/data$`))
  await expect(page.getByRole('heading', { name: 'This workspace is scheduled for erasure' })).toBeVisible()
})

test('the way to call it off is on every screen in the workspace, after a reload', async ({ page }) => {
  await scheduleErasure(page)

  // A different route, reached by a full page load — the reload is the part that used to lose the
  // record, and a different route is what proves the notice is not one page's local state.
  await page.goto(`/${WS}/inbox`)
  const banner = page.getByRole('status').filter({ hasText: 'is erased on' })
  await expect(banner).toBeVisible()

  await banner.getByRole('button', { name: 'Keep this workspace' }).click()
  await expect(banner).toBeHidden()

  // and it stays cancelled: the workspace is ordinary again on a fresh load
  await page.goto(`/${WS}/inbox`)
  await expect(page.getByRole('status').filter({ hasText: 'is erased on' })).toBeHidden()
})
