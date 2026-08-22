<script lang="ts">
import type { ChatStore, Message } from '@kernhq/module-chat/client'
import { renderDocToHtml, timeOf } from '@kernhq/module-chat/client'
import { Avatar, DropdownMenu, Icon, IconButton, type MenuItem } from '@kernhq/ui'
import { getLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'
import { canChat } from '../permissions'

/**
 * One message.
 *
 * Consecutive messages from the same person within a few minutes are grouped: the avatar and the
 * name appear once and the rest of the run is just text, which is how a conversation reads. The
 * actions (react, reply, pin, edit, delete) appear on hover but are always in the DOM and reachable
 * by keyboard — a hover-only action does not exist for someone who cannot hover.
 */

interface Props {
  store: ChatStore
  message: Message
  /** true when this message continues a run from the same author */
  grouped: boolean
  onreply: (messageId: string) => void
  onedit: (message: Message) => void
}
let { store, message, grouped, onreply, onedit }: Props = $props()

const author = $derived(message.authorId ? store.users[message.authorId] : undefined)
const mine = $derived(message.authorId === store.userId)
const html = $derived(renderDocToHtml(message.body))
const time = $derived(timeOf(message.createdAt, getLocale()))

const canEdit = $derived(mine || canChat('editAny'))
const canDelete = $derived(mine || canChat('deleteAny'))

const QUICK = ['👍', '🎉', '👀', '✅']

/** `userIds` is a branded `UserId[]`; the store holds the plain string, so compare as strings. */
const reactedByMe = (userIds: readonly string[]) => userIds.includes(store.userId)

const actions = $derived<MenuItem[]>([
  { id: 'reply', label: m.chat_reply(), icon: 'message-square-text', onSelect: () => onreply(message.id) },
  {
    id: 'pin',
    label: message.pinned ? m.chat_unpin() : m.chat_pin(),
    icon: 'bookmark',
    disabled: !canChat('pin'),
    onSelect: () => void store.togglePin(message.id, message.channelId, !message.pinned),
  },
  ...(canEdit
    ? [{ id: 'edit', label: m.chat_edit(), icon: 'pencil', onSelect: () => onedit(message) } as MenuItem]
    : []),
  ...(canDelete
    ? [
        { type: 'separator' } as MenuItem,
        {
          id: 'delete',
          label: m.chat_delete(),
          icon: 'trash-2',
          danger: true,
          onSelect: () => {
            if (confirm(m.chat_delete_confirm())) void store.deleteMessage(message.channelId, message.id)
          },
        } as MenuItem,
      ]
    : []),
])
</script>

<article class="msg" class:grouped data-testid="message" data-message-id={message.id}>
  <div class="gutter">
    {#if !grouped}
      <Avatar name={author?.name ?? '?'} id={author?.id} src={author?.avatarUrl} size={36} />
    {:else}
      <span class="hovertime">{time}</span>
    {/if}
  </div>

  <div class="body">
    {#if !grouped}
      <div class="meta">
        <span class="author">{author?.name ?? '…'}</span>
        <time datetime={message.createdAt}>{time}</time>
        {#if message.editedAt}<span class="edited">({m.chat_edited()})</span>{/if}
        {#if message.pinned}
          <span class="pinned"><Icon name="bookmark" size={12} strokeWidth={1.7} /> {m.chat_pinned()}</span>
        {/if}
      </div>
    {/if}

    {#if message.deletedAt}
      <p class="deleted">{m.chat_deleted()}</p>
    {:else}
      <!-- the store renders the document to sanitised HTML; it never interpolates raw input -->
      <div class="text">{@html html}</div>
    {/if}

    {#if message.reactions.length}
      <div class="reactions">
        {#each message.reactions as r (r.emoji)}
          <button
            type="button"
            class="chip"
            class:mine={reactedByMe(r.userIds)}
            onclick={() => void store.toggleReaction(message.id, message.channelId, r.emoji)}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span class="count">{r.count}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if message.replyCount > 0}
      <button type="button" class="thread" onclick={() => onreply(message.id)} data-testid="open-thread">
        <Icon name="message-square-text" size={13} strokeWidth={1.7} />
        {message.replyCount === 1 ? m.chat_one_reply() : m.chat_replies({ count: message.replyCount })}
      </button>
    {/if}
  </div>

  {#if !message.deletedAt}
    <div class="actions">
      {#each QUICK as emoji (emoji)}
        <button
          type="button"
          class="quick"
          title={m.chat_react()}
          aria-label={`${m.chat_react()} ${emoji}`}
          onclick={() => void store.toggleReaction(message.id, message.channelId, emoji)}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      {/each}
      <IconButton
        icon="message-square-text"
        label={m.chat_reply()}
        size={26}
        variant="ghost"
        onclick={() => onreply(message.id)}
      />
      <DropdownMenu items={actions}>
        {#snippet trigger(props)}
          <IconButton icon="ellipsis" label={m.chat_title()} size={26} variant="ghost" {...props} />
        {/snippet}
      </DropdownMenu>
    </div>
  {/if}
</article>

<style>
  .msg {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 12px;
    padding: 0 24px;
    position: relative;
  }
  .msg {
    margin-top: 18px;
  }
  /* a message continuing a run sits close to the one above it */
  .msg.grouped {
    margin-top: 4px;
  }
  .gutter {
    display: flex;
    justify-content: center;
  }
  .hovertime {
    font-size: 11px;
    color: var(--kern-ink-350);
    opacity: 0;
    line-height: 1.55;
  }
  .msg:hover .hovertime {
    opacity: 1;
  }
  .meta {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }
  .author {
    font-size: 14px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  time {
    font-size: 12px;
    color: var(--kern-ink-350);
  }
  .edited {
    font-size: 11.5px;
    color: var(--kern-ink-350);
  }
  .pinned {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11.5px;
    color: var(--kern-accent-text);
  }
  .text {
    margin-top: 3px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--kern-ink-700);
    overflow-wrap: anywhere;
  }
  .deleted {
    margin: 3px 0 0;
    font-size: 13.5px;
    font-style: italic;
    color: var(--kern-ink-350);
  }
  .reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 7px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-full);
    background: var(--kern-surface-raised);
    font-size: 12px;
    color: var(--kern-ink-600);
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--kern-border-hover);
  }
  .chip.mine {
    border-color: var(--kern-accent);
    background: var(--kern-accent-tint);
    color: var(--kern-accent-text);
  }
  .count {
    font-weight: 500;
  }
  .thread {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
    padding: 0;
    border: 0;
    background: none;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--kern-accent-text);
    cursor: pointer;
  }
  .thread:hover {
    text-decoration: underline;
  }
  .actions {
    position: absolute;
    inset-inline-end: 24px;
    top: -10px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
    background: var(--kern-surface-raised);
    box-shadow: var(--kern-shadow-popover);
    opacity: 0;
    pointer-events: none;
  }
  .msg:hover .actions,
  .actions:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
  .quick {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--kern-r-sm);
    background: none;
    font-size: 14px;
    cursor: pointer;
  }
  .quick:hover {
    background: var(--kern-surface-hover);
  }
</style>
