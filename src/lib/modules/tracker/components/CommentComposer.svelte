<script lang="ts">
import type { RichDoc } from '@kernhq/module-tracker/client'
import { Button, Icon, IconButton, Spinner, toast } from '@kernhq/ui'
import MentionMenu from '$lib/components/MentionMenu.svelte'
import { uploadFile } from '$lib/files/upload'
import {
  literalFor,
  type MentionCandidate,
  mentionQueryAt,
  mentionsIn,
  type PickedMention,
  rankCandidates,
  textToDoc,
} from '$lib/mentions'
import * as m from '$msg'
import { getTrackerCatalogue } from '../context.svelte'
import { textFromDoc } from '../richtext'

/**
 * Writing a comment: text, `@` mentions, and files.
 *
 * The same `@` machinery chat uses (`$lib/mentions`), so a mention here is a real mention node the
 * server turns into a notification, not the characters `@Ada` sitting in a sentence.
 *
 * Files upload as you pick them and are attached to the comment once it exists — a comment id has
 * to exist before an attachment can point at it, so the parent posts the comment and then hands
 * the ids over.
 */
interface Props {
  initial?: RichDoc | null
  placeholder?: string
  submitLabel?: string
  /** editing an existing comment cannot add files: they attach at creation */
  allowFiles?: boolean
  busy?: boolean
  /** the workspace the files belong to */
  workspaceId: string
  oncancel?: () => void
  onsubmit: (body: RichDoc, fileIds: string[], internal: boolean) => void
}
let {
  initial = null,
  placeholder = m.tracker_comment_placeholder(),
  submitLabel = m.tracker_comment_send(),
  allowFiles = true,
  busy = false,
  workspaceId,
  oncancel,
  onsubmit,
}: Props = $props()

const cat = getTrackerCatalogue()

let text = $state(initial ? textFromDoc(initial) : '')
let internal = $state(false)
let caret = $state(0)
let active = $state(0)
let box = $state<HTMLTextAreaElement | null>(null)
let fileInput = $state<HTMLInputElement | null>(null)

/**
 * Mentions the writer actually chose, so a name typed by hand is not silently turned into one.
 * When editing, it starts with the mentions the comment already carries — otherwise saving an edit
 * would demote every one of them to plain text.
 */
let picked = $state<PickedMention[]>(initial ? mentionsIn(initial) : [])
let uploads = $state<Array<{ id: string; name: string; ratio: number | null; fileId: string | null }>>([])

const people = $derived<MentionCandidate[]>(
  cat.people.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null })),
)
const query = $derived(mentionQueryAt(text, caret))
const candidates = $derived(query ? rankCandidates(people, query.query) : [])
const ready = $derived(uploads.every((u) => u.fileId !== null))

function insertMention(person: MentionCandidate) {
  const q = query
  if (!q) return
  const literal = literalFor(person)
  text = `${text.slice(0, q.start)}${literal} ${text.slice(q.end)}`
  picked = [...picked, { userId: person.id, label: person.name, literal }]
  active = 0
  queueMicrotask(() => {
    box?.focus()
    const at = q.start + literal.length + 1
    box?.setSelectionRange(at, at)
    caret = at
  })
}

function onkeydown(event: KeyboardEvent) {
  if (query && candidates.length) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      active = (active + 1) % candidates.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      active = (active - 1 + candidates.length) % candidates.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      insertMention(candidates[active]!)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      caret = -1
      return
    }
  }
  // Enter sends, Shift+Enter starts a line — the same contract as the chat composer.
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
  if (event.key === 'Escape' && oncancel) oncancel()
}

async function addFiles(list: FileList | null) {
  if (!list?.length) return
  for (const file of Array.from(list)) {
    const id = crypto.randomUUID()
    uploads = [...uploads, { id, name: file.name, ratio: 0, fileId: null }]
    try {
      const uploaded = await uploadFile({
        workspaceId,
        file,
        name: file.name,
        mimeType: file.type || undefined,
        onProgress: ({ ratio }) => {
          uploads = uploads.map((u) => (u.id === id ? { ...u, ratio } : u))
        },
      })
      uploads = uploads.map((u) => (u.id === id ? { ...u, ratio: 1, fileId: uploaded.id } : u))
    } catch (err) {
      // Drop the row rather than leave a file that looks attached and is not.
      uploads = uploads.filter((u) => u.id !== id)
      toast.error(err instanceof Error ? err.message : m.tracker_attachment_failed())
    }
  }
}

function submit() {
  const trimmed = text.trim()
  if (!trimmed || busy || !ready) return
  onsubmit(
    textToDoc(trimmed, picked) as RichDoc,
    uploads.map((u) => u.fileId).filter((id): id is string => Boolean(id)),
    internal,
  )
  text = ''
  picked = []
  uploads = []
  internal = false
}
</script>

<div class="composer">
  {#if query && candidates.length}
    <MentionMenu {candidates} {active} onpick={insertMention} onhover={(i) => (active = i)} />
  {/if}

  <textarea
    bind:this={box}
    bind:value={text}
    rows="2"
    {placeholder}
    aria-label={placeholder}
    data-testid="comment-input"
    oninput={(e) => (caret = e.currentTarget.selectionStart ?? 0)}
    onkeyup={(e) => (caret = e.currentTarget.selectionStart ?? 0)}
    onclick={(e) => (caret = e.currentTarget.selectionStart ?? 0)}
    {onkeydown}
  ></textarea>

  {#if uploads.length}
    <ul class="uploads">
      {#each uploads as file (file.id)}
        <li>
          {#if file.fileId}
            <Icon name="paperclip" size={12} strokeWidth={1.8} />
          {:else}
            <Spinner size={12} />
          {/if}
          <span class="uname">{file.name}</span>
          <IconButton
            icon="x"
            size={22}
            label={m.tracker_attachment_remove()}
            onclick={() => (uploads = uploads.filter((u) => u.id !== file.id))}
          />
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    {#if allowFiles}
      <input
        bind:this={fileInput}
        type="file"
        multiple
        hidden
        onchange={(e) => {
          void addFiles(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      <IconButton
        icon="paperclip"
        size={26}
        label={m.tracker_attach_file()}
        onclick={() => fileInput?.click()}
      />
      <label class="internal">
        <input type="checkbox" bind:checked={internal} />
        <span title={m.tracker_comment_internal_hint()}>{m.tracker_comment_internal()}</span>
      </label>
    {/if}
    <span class="hint">{m.tracker_comment_hint()}</span>
    {#if oncancel}
      <Button size="sm" variant="ghost" onclick={oncancel}>{m.cancel()}</Button>
    {/if}
    <Button size="sm" disabled={!text.trim() || busy || !ready} onclick={submit}>{submitLabel}</Button>
  </div>
</div>

<style>
.composer {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
textarea {
  width: 100%;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--kern-border);
  border-radius: var(--kern-radius-sm);
  background: var(--kern-surface);
  color: inherit;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}
textarea:focus-visible {
  outline: none;
  border-color: var(--kern-accent);
  box-shadow: none;
}
.uploads {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.uploads li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--kern-radius-sm);
  background: var(--kern-surface-active);
  font-size: 12px;
}
.uname {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.internal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--kern-ink-350);
  cursor: pointer;
}
.hint {
  flex: 1;
  font-size: 11px;
  color: var(--kern-ink-350);
}
</style>
