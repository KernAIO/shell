import { expect, test } from '@playwright/test'

/**
 * A menu closes when you click away from it.
 *
 * That reads as something the primitive gives you for free, and it is not: bits-ui decides whether a
 * pointer landed on the trigger by comparing `event.target.id` with the trigger's own id, so a
 * trigger rendered without an id matches every element that also has none — every outside click is
 * read as a click on the trigger, and the menu stays open until the page navigates. The workspace
 * switcher shipped that way, because the component took `id` as the avatar's identity and swallowed
 * the id bits-ui had put in the trigger props.
 *
 * Nothing in a build, a type-check or the UX sweep can see it, so it is guarded here: for each menu
 * in the shell's chrome, the trigger must carry an id and an outside click must close it.
 */

const menus = [
  { name: 'the workspace switcher', trigger: 'button.ksw' },
  { name: 'the account menu', trigger: '.ksb-foot button' },
]

for (const { name, trigger } of menus) {
  test(`${name} closes when you click outside it`, async ({ page }) => {
    await page.goto('/northstar')

    const button = page.locator(trigger).first()
    await expect(button).toBeVisible()
    // the id is what bits-ui matches an outside click against; without it every click is "the trigger"
    await expect(button).toHaveAttribute('id', /.+/)

    await button.click()
    const menu = page.locator('.kmenu')
    await expect(menu).toBeVisible()

    // the middle of the page: past the sidebar, on nothing that opens anything of its own
    await page.mouse.click(900, 700)
    await expect(menu).toBeHidden()
  })
}
