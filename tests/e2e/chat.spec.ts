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

test('typing @ offers people, and the sent message carries a real mention', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const composer = page.getByTestId('composer')
  await composer.click()
  await composer.type('hey @da')

  const menu = page.getByTestId('mention-menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByTestId('mention-option')).toHaveCount(1)
  await expect(menu).toContainText('Dan Brekke')

  // Enter picks from the menu instead of sending
  await composer.press('Enter')
  await expect(menu).toBeHidden()
  await expect(composer).toHaveValue('hey @dan ')

  await composer.type('take a look')
  await composer.press('Enter')

  // the mention is a real node carrying the user id, which is what notifies them
  const mention = page.locator('.kern-chat-mention').last()
  await expect(mention).toHaveText('@Dan Brekke')
  await expect(mention).toHaveAttribute('data-kind', 'user')
  await expect(mention).toHaveAttribute('data-id', /^[0-9a-f-]{36}$/)
})

test('the @ menu is keyboard-driven and Escape dismisses it', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const composer = page.getByTestId('composer')
  await composer.click()
  await composer.type('@')

  const options = page.getByTestId('mention-option')
  await expect(options.first()).toBeVisible()
  const count = await options.count()
  expect(count).toBeGreaterThan(1)

  // the first option starts selected, and ArrowDown moves it
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await composer.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')

  await composer.press('Escape')
  await expect(page.getByTestId('mention-menu')).toBeHidden()
  // Escape dismissed the menu without sending or clearing what was typed
  await expect(composer).toHaveValue('@')
})

test('an email address does not open the people list', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const composer = page.getByTestId('composer')
  await composer.click()
  await composer.type('write to dan@example.com')
  await expect(page.getByTestId('mention-menu')).toBeHidden()
})

test('the emoji picker searches and inserts', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  await page.getByTestId('emoji-button').click()
  const picker = page.getByTestId('emoji-picker')
  await expect(picker).toBeVisible()

  await page.getByTestId('emoji-search').fill('rocket')
  await picker.getByRole('button', { name: 'rocket' }).click()

  await expect(picker).toBeHidden()
  await expect(page.getByTestId('composer')).toHaveValue('🚀')
})

test('a message can be edited in place', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const composer = page.getByTestId('composer')
  await composer.click()
  await composer.fill('a message with a typoo')
  await composer.press('Enter')

  const mine = page.getByTestId('message').last()
  await mine.hover()
  await mine.getByRole('button', { name: 'Message actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit message' }).click()

  const editor = page.getByTestId('edit-input')
  await expect(editor).toBeVisible()
  await editor.fill('a message without a typo')
  await editor.press('Enter')

  await expect(editor).toBeHidden()
  await expect(mine).toContainText('a message without a typo')
  await expect(mine).toContainText('edited')
})

test('deleting a message asks first, in a dialog', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const composer = page.getByTestId('composer')
  await composer.click()
  await composer.fill('this one goes away')
  await composer.press('Enter')

  const mine = page.getByTestId('message').last()
  await mine.hover()
  await mine.getByRole('button', { name: 'Message actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete message' }).click()

  // a dialog, not a browser confirm, and it says what happens
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('already read it')

  await page.getByTestId('confirm-delete').click()
  await expect(page.getByTestId('message').last()).toContainText('This message was deleted')
})

test('the pinned panel lists what is pinned', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()

  await page.getByTestId('show-pins').click()
  await expect(page).toHaveURL(/pins=1/)

  const panel = page.getByTestId('pinned-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('release checklist')

  await page.getByTestId('close-pins').click()
  await expect(panel).toBeHidden()
})

test('searching shows results, and following one opens its conversation', async ({ page }) => {
  await openChat(page)

  await page.getByTestId('chat-search').fill('tracker')
  const results = page.getByTestId('search-results')
  await expect(results).toBeVisible()
  await expect(results).toContainText('1 result')

  // the conversation list gives way to the results rather than sitting above them
  await expect(page.getByTestId('conversation-row')).toHaveCount(0)

  await page.getByTestId('search-hit').first().click()
  await expect(page).toHaveURL(/c=/)
  await expect(page.getByTestId('conversation-name')).toHaveText('eng-core')
})

test('an arbitrary reaction can be picked from the message', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const message = page.getByTestId('message').first()
  await message.hover()
  await message.getByTestId('react-more').click()

  await page.getByTestId('emoji-search').fill('fire')
  await page.getByTestId('emoji-picker').getByRole('button', { name: 'fire' }).click()

  await expect(message.locator('.chip', { hasText: '🔥' })).toContainText('1')
})

/**
 * Regressions. Each of these was a real defect found by auditing the built interface rather than
 * the plan: a control that existed but could not be reached, or one that could not be undone.
 */

test('creating a channel is reachable when conversations already exist', async ({ page }) => {
  await openChat(page)
  // the affordance used to live only in the empty state, so it vanished as soon as you had a channel
  expect(await page.getByTestId('conversation-row').count()).toBeGreaterThan(0)

  await page.getByTestId('new-channel').click()
  await expect(page.getByTestId('channel-name')).toBeVisible()

  await page.getByTestId('channel-name').fill('release-notes')
  await page.getByTestId('create-channel').click()

  await expect(page.getByTestId('conversation-name')).toHaveText('release-notes')
})

test('the emoji picker closes from the button that opened it', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const button = page.getByTestId('emoji-button')
  await button.click()
  await expect(page.getByTestId('emoji-picker')).toBeVisible()

  // pointerdown outside used to close it and the click then reopened it
  await button.click()
  await expect(page.getByTestId('emoji-picker')).toBeHidden()
})

test('browse channels can be opened twice', async ({ page }) => {
  await openChat(page)

  await page.getByTestId('browse-channels').click()
  await expect(page.getByTestId('browse-search')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('browse-search')).toBeHidden()

  // the URL kept ?browse=1, so the dialog could never be reopened
  await page.getByTestId('browse-channels').click()
  await expect(page.getByTestId('browse-search')).toBeVisible()
})

test('clearing the search box brings the conversations back', async ({ page }) => {
  await openChat(page)
  const search = page.getByTestId('chat-search')

  await search.fill('tracker')
  await expect(page.getByTestId('search-results')).toBeVisible()
  await expect(page.getByTestId('conversation-row')).toHaveCount(0)

  // SearchBox clears its own value; a one-way binding never heard about it
  await search.press('Escape')
  await expect(page.getByTestId('search-results')).toBeHidden()
  expect(await page.getByTestId('conversation-row').count()).toBeGreaterThan(0)
})

test('leaving a channel asks first and says what happens', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  await page.getByRole('button', { name: 'Chat' }).last().click()
  await page.getByRole('menuitem', { name: 'Leave channel' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('stop receiving its messages')
  await expect(dialog).toContainText('Nothing is deleted')

  await page.getByTestId('confirm-leave').click()
  await expect(page.getByTestId('conversation-row').filter({ hasText: 'design' })).toHaveCount(0)
})

test('an empty conversation says so instead of showing nothing', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('new-channel').click()
  await page.getByTestId('channel-name').fill('brand-new')
  await page.getByTestId('create-channel').click()

  await expect(page.getByTestId('empty-conversation')).toBeVisible()
  await expect(page.getByText('No messages yet')).toBeVisible()
})

/**
 * Attachments, and the voice and video messages built on top of them.
 *
 * The mock keeps uploaded bytes in memory, so these exercise the real three-step upload — ask for a
 * ticket, send the bytes, mark the file ready — and the real recorder against Chrome's fake capture
 * device.
 */

test('a file can be attached and sent, and renders in the message', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const before = await page.getByTestId('message').count()
  await page.getByTestId('file-input').setInputFiles({
    name: 'release-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('what changed in this release'),
  })

  // it uploads immediately, so sending is instant rather than starting a wait
  await expect(page.getByTestId('pending-attachment')).toContainText('release-notes.txt')

  await page.getByTestId('send').click()
  await expect(page.getByTestId('message')).toHaveCount(before + 1)

  const card = page.getByTestId('attachment-file').last()
  await expect(card).toContainText('release-notes.txt')
  await expect(card).toContainText('28 B')
})

test('an attachment can be removed before it is sent', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  await page.getByTestId('file-input').setInputFiles({
    name: 'wrong-file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not this one'),
  })
  const chip = page.getByTestId('pending-attachment')
  await expect(chip).toBeVisible()

  await chip.getByRole('button', { name: 'Remove attachment' }).click()
  await expect(chip).toBeHidden()
  // with nothing attached and nothing typed, there is nothing to send
  await expect(page.getByTestId('send')).toBeDisabled()
})

test('a voice message records, previews and sends', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const before = await page.getByTestId('message').count()
  await page.getByTestId('record-voice').click()

  const bar = page.getByTestId('recorder-bar')
  await expect(bar).toHaveAttribute('data-state', 'recording')
  await page.waitForTimeout(1200)

  await page.getByTestId('stop-recording').click()
  // stopping does not send: you get the recording to listen to first
  await expect(bar).toHaveAttribute('data-state', 'review')
  await expect(page.getByTestId('recording-preview')).toBeVisible()
  await expect(page.getByTestId('message')).toHaveCount(before)

  await page.getByTestId('send-recording').click()
  await expect(page.getByTestId('message')).toHaveCount(before + 1)
  await expect(page.getByTestId('attachment-audio').last()).toBeVisible()
})

test('a recording can be discarded without sending', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const before = await page.getByTestId('message').count()
  await page.getByTestId('record-voice').click()
  await expect(page.getByTestId('recorder-bar')).toHaveAttribute('data-state', 'recording')

  await page.getByTestId('discard-recording').click()
  await expect(page.getByTestId('recorder-bar')).toBeHidden()
  // the composer is back, and nothing was sent
  await expect(page.getByTestId('composer')).toBeVisible()
  await expect(page.getByTestId('message')).toHaveCount(before)
})

test('a video message records and sends', async ({ page }) => {
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'design' }).click()

  const before = await page.getByTestId('message').count()
  await page.getByTestId('record-video').click()
  await expect(page.getByTestId('recorder-bar')).toHaveAttribute('data-state', 'recording')
  await page.waitForTimeout(1200)

  await page.getByTestId('stop-recording').click()
  await page.getByTestId('send-recording').click()

  await expect(page.getByTestId('message')).toHaveCount(before + 1)
  await expect(page.getByTestId('attachment-video').last()).toBeVisible()
})

test('a slash command runs instead of being posted as text', async ({ page }) => {
  // `commands.run` had a server and no caller, so typing /leave posted the word "/leave".
  await openChat(page)
  await page.getByTestId('conversation-row').filter({ hasText: 'eng-core' }).click()
  const composer = page.getByTestId('composer')

  // one that posts: the sender sees their own message straight away, not when realtime catches up
  await composer.fill('/shrug well then')
  await composer.press('Enter')
  await expect(page.getByText('well then ¯\\_(ツ)_/¯')).toBeVisible()

  // one that changes the channel: the header follows, because the store owns what the header reads
  await composer.fill('/topic Kernel, contracts and slash commands')
  await composer.press('Enter')
  await expect(page.getByText('Topic updated.')).toBeVisible()
  await expect(page.getByText('Kernel, contracts and slash commands')).toBeVisible()

  // an unknown one is the client's to explain, and what was typed is not thrown away
  await composer.fill('/nonsense')
  await composer.press('Enter')
  await expect(page.getByText(/There is no \/nonsense command/)).toBeVisible()
  await expect(composer).toHaveValue('/nonsense')

  // a message that merely starts with a slash is a message
  await composer.fill('/etc/hosts is where it lives')
  await composer.press('Enter')
  await expect(page.getByText('/etc/hosts is where it lives')).toBeVisible()
})
