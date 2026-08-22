<script lang="ts">
import type { ChatStore } from '@kernhq/module-chat/client'
import { IconButton, toast } from '@kernhq/ui'
import * as m from '$msg'
import { typingLabel } from '../labels'
import {
  literalFor,
  type MentionCandidate,
  mentionQueryAt,
  type PickedMention,
  rankCandidates,
  textToDoc,
} from '../mentions'
import { workspacePeople } from '../people.svelte'
import { canChat } from '../permissions'
import EmojiPicker from './EmojiPicker.svelte'
import MentionMenu from './MentionMenu.svelte'

/**
 * Writing a message.
 *
 * Enter sends and Shift+Enter breaks the line, which is what everyone expects from a chat box. The
 * draft survives switching conversation and coming back — losing what you typed because you looked
 * at something else is the kind of small betrayal that makes people distrust an application.
 *
 * A failed send puts the text back in the box rather than swallowing it.
 *
 * Typing `@` opens the people list. Picking somebody inserts their handle *and records who they
 * are*, so the message carries a real mention and their inbox lights up — see `../mentions.ts`.
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
const drafts = new Map<string, { text: string; picked: PickedMention[] }>()
const draftKey = $derived(threadRootId ? `${channelId}:${threadRootId}` : channelId)

let text = $state('')
let picked = $state<PickedMention[]>([])
let sending = $state(false)
let el = $state<HTMLTextAreaElement | null>(null)
let emojiOpen = $state(false)
let emojiTrigger = $state<HTMLButtonElement | null>(null)

// the open @ menu, if any
let mentionStart = $state<number | null>(null)
let mentionQuery = $state('')
let mentionActive = $state(0)

const allowed = $derived(canChat('post'))

/**
 * Typing indicators expire on a timer rather than an event — the store filters by how long ago the
 * signal arrived. Nothing re-renders when time passes, so without this tick "Ines is typing…" stays
 * on screen forever after she stops.
 */
let clock = $state(0)
$effect(() => {
  const id = setInterval(() => (clock = Date.now()), 1000)
  return () => clearInterval(id)
})
const typing = $derived.by(() => {
  clock
  return typingLabel(store.typingNames(channelId))
})
const people = workspacePeople()

const candidates = $derived(mentionStart === null ? [] : rankCandidates(people.list, mentionQuery))
const mentionOpen = $derived(mentionStart !== null && (people.loading || candidates.length > 0))

// restore the draft when the conversation (or thread) changes
$effect(() => {
  const draft = drafts.get(draftKey)
  text = draft?.text ?? ''
  picked = draft?.picked ?? []
})

$effect(() => {
  drafts.set(draftKey, { text, picked })
})

$effect(() => {
  if (autofocus && el) el.focus()
})

const grow = () => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

/** Look at where the caret is and decide whether the people list should be open. */
function syncMentionMenu() {
  if (!el) return
  const found = mentionQueryAt(text, el.selectionStart ?? 0)
  if (!found) {
    mentionStart = null
    return
  }
  if (found.start !== mentionStart) mentionActive = 0
  mentionStart = found.start
  mentionQuery = found.query
  void people.load()
}

function closeMentionMenu() {
  mentionStart = null
  mentionQuery = ''
  mentionActive = 0
}

/** Replace the `@…` being typed with this person's handle, and remember who they are. */
function pick(person: MentionCandidate) {
  if (!el || mentionStart === null) return
  const literal = literalFor(person)
  const caret = el.selectionStart ?? text.length
  const before = text.slice(0, mentionStart)
  const after = text.slice(caret)
  text = `${before}${literal} ${after}`
  if (!picked.some((p) => p.userId === person.id && p.literal === literal))
    picked = [...picked, { literal, userId: person.id, label: person.name }]

  const caretAfter = before.length + literal.length + 1
  closeMentionMenu()
  queueMicrotask(() => {
    el?.focus()
    el?.setSelectionRange(caretAfter, caretAfter)
    grow()
  })
}

/** Put something at the caret: an emoji, or the `/` that opens the command list. */
function insertAtCaret(fragment: string, opts: { trailingSpace?: boolean } = {}) {
  if (!el) return
  const start = el.selectionStart ?? text.length
  const end = el.selectionEnd ?? start
  const addition = opts.trailingSpace ? `${fragment} ` : fragment
  text = text.slice(0, start) + addition + text.slice(end)
  const caret = start + addition.length
  queueMicrotask(() => {
    el?.focus()
    el?.setSelectionRange(caret, caret)
    grow()
    syncMentionMenu()
  })
}

async function send() {
  const value = text.trim()
  if (!value || sending || !allowed) return
  sending = true
  const restoreText = text
  const restorePicked = picked
  text = ''
  picked = []
  closeMentionMenu()
  try {
    await store.post(channelId, textToDoc(value, restorePicked), { threadRootId })
    drafts.delete(draftKey)
    queueMicrotask(grow)
  } catch (error) {
    // never lose what someone wrote
    text = restoreText
    picked = restorePicked
    toast.error(error instanceof Error ? error.message : m.chat_failed())
  } finally {
    sending = false
  }
}

function onkeydown(event: KeyboardEvent) {
  if (mentionOpen) {
    // while the people list is open it owns these keys, so Enter picks instead of sending
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      mentionActive = (mentionActive + 1) % Math.max(1, candidates.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      mentionActive = (mentionActive - 1 + candidates.length) % Math.max(1, candidates.length)
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      const person = candidates[mentionActive]
      if (person) {
        event.preventDefault()
        pick(person)
        return
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMentionMenu()
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
  }
}
</script>

<div class="composer">
  <div class="box" class:disabled={!allowed}>
    {#if mentionOpen}
      <MentionMenu
        {candidates}
        active={mentionActive}
        loading={people.loading && candidates.length === 0}
        onpick={pick}
        onhover={(i) => (mentionActive = i)}
      />
    {/if}

    <textarea
      bind:this={el}
      bind:value={text}
      rows="1"
      class="input"
      disabled={!allowed}
      placeholder={allowed ? m.chat_message_placeholder({ channel: target }) : m.chat_cannot_post()}
      aria-label={m.chat_message_placeholder({ channel: target })}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={mentionOpen}
      aria-controls="chat-mention-menu"
      aria-activedescendant={mentionOpen ? `chat-mention-${mentionActive}` : undefined}
      data-testid="composer"
      oninput={() => {
        grow()
        syncMentionMenu()
        store.sendTyping(channelId, threadRootId)
      }}
      onclick={syncMentionMenu}
      onkeyup={(e) => {
        // arrow keys and Home/End move the caret without changing the text
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) syncMentionMenu()
      }}
      onblur={closeMentionMenu}
      {onkeydown}
    ></textarea>

    <div class="tools">
      <div class="emoji-anchor">
        <IconButton
          bind:ref={emojiTrigger}
          icon="smile"
          label={m.chat_emoji()}
          size={26}
          variant="ghost"
          radius={5}
          disabled={!allowed}
          active={emojiOpen}
          onclick={() => (emojiOpen = !emojiOpen)}
          data-testid="emoji-button"
        />
        {#if emojiOpen}
          <EmojiPicker
            trigger={emojiTrigger}
            onpick={(emoji) => {
              emojiOpen = false
              insertAtCaret(emoji)
            }}
            onclose={() => (emojiOpen = false)}
          />
        {/if}
      </div>

      <IconButton
        icon="paperclip"
        label={m.chat_attach()}
        size={26}
        variant="ghost"
        radius={5}
        disabled={!allowed}
        onclick={() => toast.info(m.chat_attach_soon())}
      />

      <IconButton
        icon="at-sign"
        label={m.chat_mention()}
        size={26}
        variant="ghost"
        radius={5}
        disabled={!allowed}
        onclick={() => insertAtCaret('@')}
        data-testid="mention-button"
      />

      <IconButton
        icon="slash"
        label={m.chat_slash()}
        size={26}
        variant="ghost"
        radius={5}
        disabled={!allowed}
        onclick={() => insertAtCaret('/')}
      />

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
    position: relative;
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
  .emoji-anchor {
    position: relative;
    display: flex;
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
