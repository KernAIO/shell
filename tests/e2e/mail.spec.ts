import { expect, test } from '@playwright/test'

/**
 * Mail was a complete module nobody could reach: settings, a test send and a delivery log all had
 * a server and nothing registered in the app to call them.
 */

test('a workspace chooses where its email comes from', async ({ page }) => {
  await page.goto('/northstar/settings/mail')
  await expect(page.getByRole('heading', { name: 'Email', exact: true })).toBeVisible()

  // reachable from the settings navigation, and the link has to *arrive* — asserting it was
  // visible is what let it ship pointing at /settings/mail/mail, which 404s
  await page.goto('/northstar/settings')
  await page.getByRole('link', { name: 'Email' }).click()
  await expect(page).toHaveURL(/\/settings\/mail$/)
  await expect(page.getByRole('heading', { name: 'Email', exact: true })).toBeVisible()

  // a stored secret is never sent back to the browser, and the screen says the field is not empty
  await expect(page.getByTestId('mail-pass')).toHaveValue('__kern_secret__')
  await expect(page.getByText(/leave this as it is to keep it/)).toBeVisible()

  // each provider asks for what it actually needs
  await page.getByTestId('mail-provider').click()
  await page.getByRole('option', { name: 'Postmark' }).click()
  await expect(page.getByTestId('mail-serverToken')).toBeVisible()
  await expect(page.getByTestId('mail-host')).toHaveCount(0)

  await page.getByTestId('mail-save').click()
  await expect(page.getByText('Email settings saved')).toBeVisible()
})

test('a test message says what the provider said', async ({ page }) => {
  await page.goto('/northstar/settings/mail')

  // nothing to send to, nothing to send
  await expect(page.getByTestId('mail-test-send')).toBeDisabled()

  // a refusal is an answer, not a failed request, so it comes back in the provider's words
  await page.getByTestId('mail-test-to').fill('nobody@elsewhere.test')
  await page.getByTestId('mail-test-send').click()
  await expect(page.getByText('The provider refused the recipient')).toBeVisible()

  await page.getByTestId('mail-test-to').fill('maya@northstar.example')
  await page.getByTestId('mail-test-send').click()
  await expect(page.getByText(/Test message queued for maya@northstar.example/)).toBeVisible()
})

test('the delivery log says why a message did not arrive', async ({ page }) => {
  await page.goto('/northstar/settings/mail')
  const log = page.getByTestId('mail-log')

  await expect(log).toContainText('You were mentioned in KRN-6')
  // the bounce carries the provider's own text — the only part anybody can act on
  await expect(log).toContainText('550 5.1.1')

  // and the log narrows to the failures, which is the reason to open it
  await page.getByTestId('mail-log-filter').click()
  await page.getByRole('option', { name: 'Bounced' }).click()
  await expect(log).toContainText('You have been invited to Northstar')
  await expect(log).not.toContainText('Your weekly digest')
})
