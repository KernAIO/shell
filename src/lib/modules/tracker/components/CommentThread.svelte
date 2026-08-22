<script lang="ts">
import type { Attachment, Comment as IssueComment } from '@kernhq/module-tracker/client'
import { Avatar, DropdownMenu, Icon, IconButton, type MenuItem } from '@kernhq/ui'
import EmojiPicker from '$lib/components/EmojiPicker.svelte'
import { QUICK_REACTIONS } from '$lib/emoji'
import { relativeTime } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getTrackerCatalogue } from '../context.svelte'
import { renderDoc } from '../richtext'
import CommentComposer from './CommentComposer.svelte'

/**
 * One comment and its replies.
 *
 * The server has carried threading, mentions, an internal flag, edit and delete since the model
 * existed; the panel used three of the five procedures. Everything a comment can do is reachable
 * here.
 */
interface Props {
  workspaceId: string
  comment: IssueComment
  replies: IssueComment[]
  attachments: Attachment[]
  canComment: boolean
  onreact: (commentId: string, emoji: string) => void
  onedit: (commentId: string, body: unknown) => void
  ondelete: (commentId: string) => void
  onreply: (parentId: string, body: unknown, fileIds: string[]) => void
  onremoveAttachment: (attachmentId: string) => void
}
let {
  workspaceId,
  comment,
  replies,
  attachments,
  canComment,
  onreact,
  onedit,
  ondelete,
  onreply,
  onremoveAttachment,
}: Props = $props()

const cat = getTrackerCatalogue()

let editing = $state(false)
let replying = $state(false)
let confirmingDelete = $state(false)
let pickerOpen = $state(false)
let pickerTrigger = $state<HTMLElement | null>(null)

const person = $derived(cat.person(comment.authorId))
/** Only the author edits or deletes their own comment; anything else is somebody else's words. */
const mine = $derived(Boolean(session.user && comment.authorId === session.user.id))

const menu = $derived<MenuItem[]>([
  { type: 'item', id: 'edit', label: m.edit(), icon: 'pencil', onSelect: () => (editing = true) },
  {
    type: 'item',
    id: 'delete',
    label: m['delete'](),
    icon: 'trash-2',
    danger: true,
    onSelect: () => (confirmingDelete = true),
  },
])

const reacted = (emoji: string, userIds: readonly string[]) =>
  session.user ? userIds.includes(session.user.id) : false
</script>

<article class="thread" class:internal={comment.internal}>
  <Avatar name={person?.name} src={person?.avatarUrl} id={person?.id} size={28} />
  <div class="tbody">
    <div class="thead">
      <span class="author">{person?.name ?? ''}</span>
      <time datetime={comment.createdAt}>{relativeTime(comment.createdAt)}</time>
      {#if comment.editedAt}
        <span class="tag">{m.tracker_comment_edited()}</span>
      {/if}
      {#if comment.internal}
        <span class="tag internal-tag" title={m.tracker_comment_internal_hint()}>
          <Icon name="lock" size={11} strokeWidth={1.8} />
          {m.tracker_comment_internal()}
        </span>
      {/if}
      {#if mine}
        <span class="spacer"></span>
        <DropdownMenu items={menu} align="end">
          {#snippet trigger(props)}
            <IconButton {...props} icon="ellipsis" size={26} label={m.tracker_comment_actions()} />
          {/snippet}
        </DropdownMenu>
      {/if}
    </div>

    {#if editing}
      <CommentComposer
        {workspaceId}
        initial={comment.body}
        placeholder={m.tracker_comment_edit_placeholder()}
        submitLabel={m.save()}
        allowFiles={false}
        oncancel={() => (editing = false)}
        onsubmit={(body) => {
          onedit(comment.id, body)
          editing = false
        }}
      />
    {:else if confirmingDelete}
      <!-- Inline rather than window.confirm: it says what happens and can be dismissed with Escape. -->
      <div class="confirm" role="alertdialog" aria-label={m.tracker_comment_delete_title()}>
        <p>{m.tracker_comment_delete_body()}</p>
        <div class="row">
          <button type="button" class="danger" onclick={() => ondelete(comment.id)}>
            {m['delete']()}
          </button>
          <button type="button" onclick={() => (confirmingDelete = false)}>{m.cancel()}</button>
        </div>
      </div>
    {:else}
      <div class="tprose">{@html renderDoc(comment.body)}</div>
    {/if}

    {#if attachments.length}
      <ul class="files">
        {#each attachments as file (file.id)}
          <li>
            <Icon name="paperclip" size={12} strokeWidth={1.8} />
            <span class="fname">{file.name}</span>
            {#if mine}
              <IconButton
                icon="x"
                size={22}
                label={m.tracker_attachment_remove()}
                onclick={() => onremoveAttachment(file.id)}
              />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="reactions">
      {#each comment.reactions as reaction (reaction.emoji)}
        <button
          type="button"
          class="reaction"
          class:mine={reacted(reaction.emoji, reaction.userIds)}
          onclick={() => onreact(comment.id, reaction.emoji)}
        >
          {reaction.emoji}
          {reaction.count}
        </button>
      {/each}
      <div class="picker-anchor">
        <button
          type="button"
          class="reaction add"
          aria-label={m.tracker_add_reaction()}
          bind:this={pickerTrigger}
          onclick={() => (pickerOpen = !pickerOpen)}
        >
          <Icon name="smile" size={13} strokeWidth={1.6} />
        </button>
        {#if pickerOpen}
          <EmojiPicker
            trigger={pickerTrigger}
            onclose={() => (pickerOpen = false)}
            onpick={(emoji) => {
              onreact(comment.id, emoji)
              pickerOpen = false
            }}
          />
        {/if}
      </div>
      {#each QUICK_REACTIONS.slice(0, 3) as emoji (emoji)}
        <button
          type="button"
          class="reaction quick"
          onclick={() => onreact(comment.id, emoji)}
          aria-label={emoji}
        >
          {emoji}
        </button>
      {/each}
      {#if canComment}
        <button type="button" class="reply-btn" onclick={() => (replying = !replying)}>
          {m.tracker_comment_reply()}
        </button>
      {/if}
    </div>

    {#if replies.length}
      <ul class="replies">
        {#each replies as reply (reply.id)}
          {@const author = cat.person(reply.authorId)}
          <li>
            <Avatar name={author?.name} src={author?.avatarUrl} id={author?.id} size={22} />
            <div>
              <div class="thead">
                <span class="author">{author?.name ?? ''}</span>
                <time datetime={reply.createdAt}>{relativeTime(reply.createdAt)}</time>
              </div>
              <div class="tprose">{@html renderDoc(reply.body)}</div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if replying}
      <CommentComposer
        {workspaceId}
        placeholder={m.tracker_comment_reply_placeholder()}
        submitLabel={m.tracker_comment_reply()}
        oncancel={() => (replying = false)}
        onsubmit={(body, fileIds) => {
          onreply(comment.id, body, fileIds)
          replying = false
        }}
      />
    {/if}
  </div>
</article>

<style>
.thread {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 10px 0;
}
.thread.internal {
  border-inline-start: 2px solid var(--kern-warning);
  padding-inline-start: 10px;
  margin-inline-start: -12px;
}
.thead {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--kern-ink-350);
}
.author {
  font-weight: 600;
  color: var(--kern-ink);
}
.spacer {
  flex: 1;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
}
.internal-tag {
  color: var(--kern-warning);
}
.tprose {
  font-size: 13px;
  line-height: 1.55;
  margin-top: 3px;
}
/* `renderDoc` emits this; without a rule for it a mention reads as ordinary text. */
.tprose :global(.kern-mention) {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--kern-info-tint);
  color: var(--kern-accent);
  font-weight: 500;
}
.files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.files li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--kern-radius-sm);
  background: var(--kern-surface-active);
  font-size: 12px;
}
.fname {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reactions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.picker-anchor {
  position: relative;
}
.reaction {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border: 1px solid var(--kern-border);
  border-radius: 999px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.reaction.mine {
  border-color: var(--kern-accent);
  background: var(--kern-info-tint);
}
.reaction.quick,
.reaction.add {
  border-color: transparent;
  opacity: 0;
}
.thread:hover .reaction.quick,
.thread:hover .reaction.add,
.reaction.add:focus-visible,
.reaction.quick:focus-visible {
  opacity: 1;
}
.reply-btn {
  border: 0;
  background: none;
  color: var(--kern-ink-350);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 1px 4px;
}
.reply-btn:hover {
  color: var(--kern-ink);
}
.replies {
  list-style: none;
  margin: 8px 0 0;
  padding: 0 0 0 4px;
  border-inline-start: 1px solid var(--kern-border);
}
.replies li {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
  padding: 6px 0 6px 8px;
}
.confirm {
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--kern-border);
  border-radius: var(--kern-radius-sm);
  background: var(--kern-shell);
  font-size: 13px;
}
.confirm p {
  margin: 0 0 8px;
}
.confirm .row {
  display: flex;
  gap: 8px;
}
.confirm button {
  padding: 3px 10px;
  border: 1px solid var(--kern-border);
  border-radius: var(--kern-radius-sm);
  background: var(--kern-surface);
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.confirm .danger {
  border-color: var(--kern-danger);
  color: var(--kern-danger);
}
</style>
