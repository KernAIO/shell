import { expect, type Page, test } from '@playwright/test'

/**
 * Chat, end to end against the mock backend.
 *
 * These are the moves a conversation is made of: find it, read it, say something, reply in a thread,
 * react. If any of them breaks, chat is broken, however well the rest of it renders.
 */

async function openChat(page: Page) {
  await page.goto('/northstar/chat')
  await expect(page.getByTestId('conversation-row').first()).toBeVisible()
}

test('the conversation list lives in the sidebar and opens a conversation', async ({ page }) => {
  await openChat(page)

  // the list is the application sidebar, not a column of its own (DESIGN.md 2.3)
  const rows = page.getByTestId('conversation-row')
  expect(await rows.count()).toBeGreaterThan(3)

  // nothing is open yet, so the content area says so rather than showing an empty transcript
  await expect(page.getByText('Pick a conversation')).toBeVisible()

  await rows.filter({ hasText: 'eng-core' }).click()
  await expect(page).toHaveURL(/c=/)
  await expect(page.getByTestId('conversation-name')).toHaveText('eng-core')
  await expect(page.getByTestId('message').first()).toBeVisible()
})

test('sends a message, and it appears in the transcript', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()
  await expect(page.getByTestId('composer')).toBeVisible()

  const before = await page.getByTestId('message').count()
  const text = `Verified by the end-to-end suite ${Date.now()}`
  await page.getByTestId('composer').fill(text)
  await page.getByTestId('composer').press('Enter')

  await expect(page.getByTestId('message')).toHaveCount(before + 1)
  await expect(page.getByText(text)).toBeVisible()
  // the box is empty again, ready for the next one
  await expect(page.getByTestId('composer')).toHaveValue('')
})

test('shift+enter writes a second line instead of sending', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const before = await page.getByTestId('message').count()
  const composer = page.getByTestId('composer')
  await composer.fill('first line')
  await composer.press('Shift+Enter')
  await composer.type('second line')

  await expect(page.getByTestId('message')).toHaveCount(before)
  await expect(composer).toHaveValue('first line\nsecond line')
})

test('opens a thread beside the conversation, and closes it', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()

  await page.getByTestId('open-thread').first().click()
  await expect(page).toHaveURL(/t=/)

  const panel = page.getByTestId('thread-panel')
  await expect(panel).toBeVisible()
  // the root is repeated in the panel, and the replies are actually there
  await expect(panel.getByTestId('message')).toHaveCount(3)

  await page.getByTestId('close-thread').click()
  await expect(panel).toBeHidden()
  await expect(page).not.toHaveURL(/t=/)
})

test('a reaction counts up and down', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()

  const message = page.getByTestId('message').first()
  await message.hover()
  const thumbsUp = message.getByRole('button', { name: /Add reaction 👍/ })
  await thumbsUp.click()

  const chip = message.locator('.chip', { hasText: '👍' })
  await expect(chip).toContainText('1')

  await chip.click()
  await expect(chip).toBeHidden()
})

test('the draft survives leaving the conversation and coming back', async ({ page }) => {
  await openChat(page)
  const rows = page.getByTestId('conversation-row')
  await rows.filter({ hasText: 'design' }).click()

  const draft = 'half-written thought'
  await page.getByTestId('composer').fill(draft)

  await rows.filter({ hasText: 'launch-room' }).click()
  await expect(page.getByTestId('composer')).toHaveValue('')

  await rows.filter({ hasText: 'design' }).click()
  await expect(page.getByTestId('composer')).toHaveValue(draft)
})
