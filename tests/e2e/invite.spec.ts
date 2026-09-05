import { expect, type Page, test } from '@playwright/test'

/**
 * `/invite/:token` — the page every invitation email in the product points at.
 *
 * It had no route at all until now, so `/invite/<token>` fell into `(app)/[ws]` with ws="invite",
 * the layout failed to find a workspace by that name and quietly forwarded the person to somebody
 * else's workspace or to onboarding. Every invitation Kern has ever sent died there, on both
 * distributions, without an error anywhere.
 *
 * The states below are the ones a real person meets, and none of them can be reached from the seed
 * data: the mock chooses what to answer from the token in the URL, and `kern.mock.signedout` is
 * what makes the signed-out half — which is most invitations — reachable at all.
 */

const WORKSPACE = 'Meridian Labs'

async function signedOut(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('kern.mock.signedout', '1')
  })
}

const sheet = (page: Page) => page.locator('.sheet')

test('a signed-out visitor is shown who invited them before being asked to sign in', async ({ page }) => {
  await signedOut(page)
  await page.goto('/invite/mock-invite')

  // The whole point of an unauthenticated preview: the workspace and the person, before the wall.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Join ${WORKSPACE}`)
  await expect(sheet(page)).toContainText('Dan Brekke')
  await expect(sheet(page)).toContainText('maya@northstar.dev')

  // Both ways in, each carrying the way back.
  const back = encodeURIComponent('/invite/mock-invite')
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/sign-in?next=${back}`)
  await expect(page.getByRole('link', { name: 'Create account' })).toHaveAttribute(
    'href',
    `/sign-up?next=${back}`,
  )
})

test('sign-in returns the visitor to the invitation rather than to a workspace', async ({ page }) => {
  await signedOut(page)
  await page.goto('/invite/mock-invite')
  await page.getByRole('link', { name: 'Sign in' }).click()

  // `landingFor` sends a deep link straight back; only an empty `next` goes to the chooser.
  await expect(page).toHaveURL(/\/sign-in\?next=%2Finvite%2Fmock-invite$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in')
})

test('accepting lands the person inside the workspace', async ({ page }) => {
  await page.goto('/invite/mock-invite')
  await page.getByRole('button', { name: 'Accept invitation' }).click()

  await expect(page).toHaveURL(/\/meridian$/)
  await expect(page.locator('.ktoast')).toContainText(`Welcome to ${WORKSPACE}`)
})

test('a spent link says so instead of showing a button that cannot work', async ({ page }) => {
  await page.goto('/invite/mock-invite-expired')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This invitation is no longer valid')
  await expect(page.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0)
})

test('an unknown token is a sentence, not a raw error', async ({ page }) => {
  await page.goto('/invite/mock-invite-missing')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This invitation does not exist')
  await expect(sheet(page)).not.toContainText('NOT_FOUND')
  await expect(sheet(page)).not.toContainText('not found')
})

test('an invitation addressed to somebody else offers the account switch', async ({ page }) => {
  await page.goto('/invite/mock-invite-wrong-email')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'This invitation is for a different account',
  )
  // Both addresses, so the person can see which mailbox the link belongs in.
  await expect(sheet(page)).toContainText('maya@northstar.dev')
  await expect(sheet(page)).toContainText('dan@northstar.dev')
  await expect(page.getByRole('button', { name: 'Use a different account' })).toBeVisible()
})

/**
 * Core's preview cannot tell an accepted invitation from a withdrawn one — both report `expired` —
 * so somebody who simply opened the same link twice would be told their invitation had run out
 * while they were already a member. Membership is checked first for exactly that reason.
 */
test('somebody who is already in is sent in, not told the link is spent', async ({ page }) => {
  await page.goto('/invite/mock-invite-member')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are already in Northstar')
  await expect(page.getByRole('link', { name: 'Open Northstar' })).toHaveAttribute('href', '/northstar')
})

/**
 * The refusals that only exist after the button is pressed. Each arrives as a reason code and
 * has to become a sentence — the server's own English message must never reach the screen, because
 * it is the one thing on this page a translation cannot reach.
 */
const AFTER_ACCEPT = [
  { token: 'mock-invite-lapsed', heading: 'This invitation has expired', raw: 'Invitation has expired' },
  {
    token: 'mock-invite-revoked',
    heading: 'This invitation is no longer valid',
    raw: 'Invitation is no longer valid',
  },
  {
    token: 'mock-invite-archived',
    heading: `${WORKSPACE} has been archived`,
    raw: 'Workspace is archived',
  },
  {
    token: 'mock-invite-full',
    heading: 'Every seat in this plan is taken',
    raw: 'Seat limit reached',
  },
  {
    token: 'mock-invite-forbidden',
    heading: 'This invitation is for a different account',
    raw: 'Forbidden',
  },
] as const

for (const refusal of AFTER_ACCEPT) {
  test(`accepting explains "${refusal.heading}" in its own words`, async ({ page }) => {
    await page.goto(`/invite/${refusal.token}`)
    await page.getByRole('button', { name: 'Accept invitation' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(refusal.heading)
    await expect(sheet(page)).not.toContainText(refusal.raw)
  })
}

/**
 * `disabled={mutation.isPending}` reaches the button on the next render, and two quick clicks are
 * one render apart — so a double-click used to file two acceptances. The guard is a plain flag set
 * in the same tick as the click; this is what proves it holds.
 */
test('a double-click accepts once', async ({ page }) => {
  await page.goto('/invite/mock-invite')
  await page.getByRole('button', { name: 'Accept invitation' }).dblclick()

  await expect(page).toHaveURL(/\/meridian$/)
  // `toast.success` carries no id here, so a second acceptance would stack a second message.
  await expect(page.locator('.ktoast')).toHaveCount(1)
})
