<script lang="ts">
import type { ChatStore, RichDoc } from '@kernhq/module-chat/client'
import { IconButton, toast } from '@kernhq/ui'
import * as m from '$msg'
import { typingLabel } from '../labels'
import { canChat } from '../permissions'

/**
 * Writing a message.
 *
 * Enter sends and Shift+Enter breaks the line, which is what everyone expects from a chat box. The
 * draft survives switching conversation and coming back — losing what you typed because you looked
 * at something else is the kind of small betrayal that makes people distrust an application.
 *
 * A failed send puts the text back in the box rather than swallowing it.
 */

interface Props {
  store: ChatStore
  channelId: string
  /** placeholder target, e.g. "#eng-core" */
  target: string
  threadRootId?: string
  autofocus?: boolean
}
let { store, channelId, target, threadRootId, autofocus = false }: Props = $props()

/** drafts per conversation (and per thread), so switching away does not discard them */
const drafts = new Map<string, string>()
const draftKey = $derived(threadRootId ? `${channelId}:${threadRootId}` : channelId)

let text = $state('')
let sending = $state(false)
let el = $state<HTMLTextAreaElement | null>(null)

const allowed = $derived(canChat('post'))
const typing = $derived(typingLabel(store.typingNames(channelId)))

// restore the draft when the conversation (or thread) changes
$effect(() => {
  text = drafts.get(draftKey) ?? ''
})

$effect(() => {
  drafts.set(draftKey, text)
})

$effect(() => {
  if (autofocus && el) el.focus()
})

const grow = () => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

const asDoc = (value: string): RichDoc => ({
  type: 'doc',
  content: value
    .split('\n')
    .map((line) =>
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    ),
})

async function send() {
  const value = text.trim()
  if (!value || sending || !allowed) return
  sending = true
  const restore = text
  text = ''
  try {
    await store.post(channelId, asDoc(value), { threadRootId })
    drafts.delete(draftKey)
  } catch (error) {
    // never lose what someone wrote
    text = restore
    toast.error(error instanceof Error ? error.message : m.chat_failed())
  } finally {
    sending = false
  }
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
  }
}
</script>

<div class="composer">
  <div class="box" class:disabled={!allowed}>
    <textarea
      bind:this={el}
      bind:value={text}
      rows="1"
      class="input"
      disabled={!allowed}
      placeholder={allowed ? m.chat_message_placeholder({ channel: target }) : m.chat_cannot_post()}
      aria-label={m.chat_message_placeholder({ channel: target })}
      data-testid="composer"
      oninput={() => {
        grow()
        store.sendTyping(channelId, threadRootId)
      }}
      {onkeydown}
    ></textarea>

    <div class="tools">
      <IconButton icon="smile" label={m.chat_emoji()} size={26} variant="ghost" radius={5} disabled={!allowed} />
      <IconButton icon="paperclip" label={m.chat_attach()} size={26} variant="ghost" radius={5} disabled={!allowed} />
      <IconButton icon="at-sign" label={m.chat_mention()} size={26} variant="ghost" radius={5} disabled={!allowed} />
      <IconButton icon="slash" label={m.chat_slash()} size={26} variant="ghost" radius={5} disabled={!allowed} />

      <span class="typing" aria-live="polite">{typing ?? ''}</span>

      <IconButton
        icon="arrow-up"
        label={m.chat_send()}
        size={28}
        radius={6}
        variant="primary"
        strokeWidth={2}
        disabled={!allowed || !text.trim() || sending}
        onclick={send}
        data-testid="send"
      />
    </div>
  </div>
</div>

<style>
  .composer {
    padding: 10px 24px 20px;
    flex: none;
  }
  .box {
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-2xl);
    background: var(--kern-surface-raised);
    padding: 10px 12px 8px;
  }
  .box:focus-within {
    border-color: var(--kern-border-strong);
  }
  .box.disabled {
    background: var(--kern-surface-input);
  }
  .input {
    display: block;
    width: 100%;
    border: 0;
    background: none;
    resize: none;
    font: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: var(--kern-ink-800);
    outline: none;
    max-height: 180px;
  }
  .input::placeholder {
    color: var(--kern-ink-350);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
  }
  .typing {
    flex: 1;
    min-width: 0;
    margin-inline-start: 6px;
    font-size: 12.5px;
    color: var(--kern-ink-350);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
