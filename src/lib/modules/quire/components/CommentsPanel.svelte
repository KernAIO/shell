<script lang="ts">
import type { CommentThread } from '@kernhq/module-quire/client'
import { Avatar, Button, EmptyState, Icon, IconButton, Skeleton } from '@kernhq/ui'
import { RichTextEditor } from '@kernhq/ui/editor'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { relativeTime } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getQuireApi } from '../api'
import { canQuire } from '../permissions'
import { quireKeys } from '../query'

/**
 * The margin.
 *
 * Threads rather than a flat list, because a remark and its answers are one conversation — and
 * because resolving is a property of the conversation, not of the last thing said in it.
 *
 * A thread whose anchored text has been deleted still appears, showing what it was about. Hiding it
 * would quietly discard somebody's question the moment the sentence it referred to was rewritten,
 * which is exactly when the question matters most.
 */
interface Props {
  workspaceId: string
  pageId: string
  /** the thread the editor has highlighted, if any */
  activeId: string | null
  /** anchors whose text no longer resolves, so the panel can say so */
  orphaned: Set<string>
  onFocus?: (id: string | null) => void
  /** a selection waiting for its first remark */
  pending: { anchor: { from: string; to: string }; quotedText: string } | null
  onPendingHandled?: () => void
}
const { workspaceId, pageId, activeId, orphaned, onFocus, pending, onPendingHandled }: Props = $props()

const api = getQuireApi()
const client = useQueryClient()

const query = createQuery(() => ({
  queryKey: [...quireKeys.page(workspaceId, pageId), 'comments'],
  enabled: Boolean(workspaceId && pageId),
  queryFn: () => api.comments.list({ workspaceId, pageId, includeResolved: false }),
}))
const threads = $derived(query.data ?? [])

let draft = $state<unknown>(undefined)
let replyTo = $state<string | null>(null)
let replyDraft = $state<unknown>(undefined)
let busy = $state(false)
let error = $state<string | null>(null)

const empty = (doc: unknown) => {
  const text = JSON.stringify(doc ?? {})
  return !text.includes('"text"')
}

async function submit(parentId: string | null, body: unknown) {
  if (busy || empty(body)) return
  busy = true
  error = null
  try {
    await api.comments.create({
      workspaceId,
      pageId,
      body: $state.snapshot(body) as Record<string, unknown>,
      // An empty pair is how the page-level composer says "about the page, not a piece of it".
      anchor: parentId || !pending?.anchor.from ? null : pending.anchor,
      quotedText: parentId ? '' : (pending?.quotedText ?? ''),
      parentId,
    })
    await query.refetch()
    if (parentId) {
      replyDraft = undefined
      replyTo = null
    } else {
      draft = undefined
      onPendingHandled?.()
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  } finally {
    busy = false
  }
}

async function resolve(thread: CommentThread) {
  busy = true
  try {
    await api.comments.resolve({ workspaceId, commentId: thread.id, resolved: true })
    await query.refetch()
    await client.invalidateQueries({ queryKey: quireKeys.page(workspaceId, pageId) })
  } finally {
    busy = false
  }
}

async function remove(commentId: string) {
  busy = true
  try {
    await api.comments.remove({ workspaceId, commentId })
    await query.refetch()
  } finally {
    busy = false
  }
}
</script>

<aside class="panel" aria-label={m.quire_comments()}>
  <h2 class="heading">{m.quire_comments()}</h2>

  {#if pending}
    <div class="composer new">
      {#if pending.quotedText}
        <p class="quoted">“{pending.quotedText}”</p>
      {/if}
      <RichTextEditor bind:value={draft} placeholder={m.quire_comment_placeholder()} minRows={2} />
      <div class="actions">
        <Button size="sm" variant="secondary" onclick={() => onPendingHandled?.()}>{m.cancel()}</Button>
        <Button size="sm" disabled={busy || empty(draft)} onclick={() => submit(null, draft)}>
          {m.quire_comment_post()}
        </Button>
      </div>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if query.isLoading}
    <Skeleton height="72px" />
  {:else if threads.length === 0 && !pending}
    <EmptyState
      bare
      compact
      icon="message-circle"
      title={m.quire_comments_empty()}
      description={m.quire_comments_empty_desc()}
    />
  {:else}
    {#each threads as thread (thread.id)}
      <div
        class="thread"
        class:active={thread.id === activeId}
        role="button"
        tabindex="0"
        onclick={() => onFocus?.(thread.id)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFocus?.(thread.id)
          }
        }}
      >
        {#if thread.root.quotedText}
          <p class="quoted" class:orphan={orphaned.has(thread.id)}>“{thread.root.quotedText}”</p>
          {#if orphaned.has(thread.id)}
            <p class="orphan-note"><Icon name="circle-alert" size={12} /> {m.quire_comment_orphaned()}</p>
          {/if}
        {/if}

        {#each [thread.root, ...thread.replies] as comment (comment.id)}
          <div class="comment">
            <Avatar id={comment.authorId} size={22} />
            <div class="bubble">
              <div class="who">
                <span class="time">{relativeTime(comment.createdAt)}</span>
                {#if comment.editedAt}<span class="edited">{m.quire_comment_edited()}</span>{/if}
                {#if comment.authorId === session.user?.id}
                  <span class="spacer"></span>
                  <IconButton
                    icon="trash-2"
                    size={22}
                    variant="ghost"
                    label={m.delete()}
                    onclick={() => remove(comment.id)}
                  />
                {/if}
              </div>
              <p class="text">{comment.bodyText}</p>
            </div>
          </div>
        {/each}

        <div class="thread-actions">
          {#if replyTo === thread.id}
            <RichTextEditor bind:value={replyDraft} placeholder={m.quire_comment_reply()} minRows={1} />
            <div class="actions">
              <Button size="sm" variant="secondary" onclick={() => (replyTo = null)}>{m.cancel()}</Button>
              <Button
                size="sm"
                disabled={busy || empty(replyDraft)}
                onclick={() => submit(thread.root.id, replyDraft)}
              >
                {m.quire_comment_post()}
              </Button>
            </div>
          {:else if canQuire('pageComment')}
            <Button size="sm" variant="ghost" onclick={() => (replyTo = thread.id)}>
              {m.quire_comment_reply()}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onclick={() => resolve(thread)}>
              {m.quire_comment_resolve()}
            </Button>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</aside>

<style>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 18px;
  border-inline-start: 1px solid var(--kern-border);
  background: var(--kern-surface);
  overflow-y: auto;
  min-height: 0;
}
.heading {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kern-ink-400);
}
.thread {
  border: 1px solid var(--kern-border);
  border-radius: var(--kern-r-card);
  background: var(--kern-surface-raised);
  padding: 12px;
  cursor: pointer;
}
.thread.active {
  border-color: var(--kern-accent);
}
.quoted {
  margin: 0 0 10px;
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--kern-warning);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--kern-ink-400);
}
.quoted.orphan {
  border-inline-start-color: var(--kern-ink-350);
  text-decoration: line-through;
}
.orphan-note {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: -6px 0 10px;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.comment {
  display: flex;
  gap: 8px;
  margin-block-end: 10px;
}
.bubble {
  flex: 1;
  min-width: 0;
}
.who {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.spacer {
  flex: 1;
}
.text {
  margin: 2px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--kern-ink-700);
  white-space: pre-wrap;
}
.composer.new {
  border: 1px solid var(--kern-accent);
  border-radius: var(--kern-r-card);
  padding: 12px;
  background: var(--kern-surface-raised);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-block-start: 8px;
}
.thread-actions {
  display: flex;
  gap: 4px;
}
.error {
  margin: 0;
  font-size: 13px;
  color: var(--kern-danger);
}
</style>
