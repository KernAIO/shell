<script lang="ts">
import type { ChannelView, ChatStore } from '@kernhq/module-chat/client'
import { Avatar, Icon, SearchBox, SectionLabel } from '@kernhq/ui'
import * as m from '$msg'
import { kindOf } from '../labels'

/**
 * The conversations rail: starred first, then channels, then direct messages.
 *
 * Unread state is the only thing that changes weight here — an unread conversation is bolder and
 * carries its count, a muted one stays quiet even when it has unread messages, because that is what
 * muting means. Everything else is deliberately flat so the eye goes to what is new.
 */

interface Props {
  store: ChatStore
  activeId: string | null
  query: string
  onselect: (channelId: string) => void
  onquery: (q: string) => void
}
let { store, activeId, query, onselect, onquery }: Props = $props()

const sorted = $derived.by(() => {
  const list = [...store.channels]
  return list.sort((a, b) => {
    const at = a.lastMessageAt ?? a.createdAt
    const bt = b.lastMessageAt ?? b.createdAt
    return bt.localeCompare(at)
  })
})

const starred = $derived(sorted.filter((c) => c.favorite))
const channels = $derived(
  sorted.filter((c) => !c.favorite && (c.type === 'public' || c.type === 'private' || c.type === 'object')),
)
const dms = $derived(sorted.filter((c) => !c.favorite && (c.type === 'dm' || c.type === 'group_dm')))

const unreadOf = (c: ChannelView) => c.membership?.unreadCount ?? 0
const mentionsOf = (c: ChannelView) => c.membership?.mentionCount ?? 0
const isMuted = (c: ChannelView) => c.membership?.muted ?? false

/** The other person in a direct message, so the row can show their avatar and presence. */
const otherUser = (c: ChannelView) => {
  const other = c.dmUserIds.find((u) => u !== store.userId) ?? c.dmUserIds[0]
  return other ? store.users[other] : undefined
}
</script>

<div class="list">
  <div class="search">
    <SearchBox
      value={query}
      placeholder={m.chat_search_placeholder()}
      oninput={(e) => onquery((e.currentTarget as HTMLInputElement).value)}
      data-testid="chat-search"
    />
  </div>

  <div class="scroll">
    {#snippet group(label: string, items: ChannelView[])}
      {#if items.length}
        <div class="group">
          <SectionLabel {label} />
          {#each items as c (c.id)}
            {@const unread = unreadOf(c)}
            {@const mentions = mentionsOf(c)}
            {@const muted = isMuted(c)}
            {@const dm = c.type === 'dm' || c.type === 'group_dm'}
            <button
              type="button"
              class="row"
              class:active={c.id === activeId}
              class:unread={unread > 0 && !muted}
              class:muted
              data-testid="conversation-row"
              data-channel-id={c.id}
              onclick={() => onselect(c.id)}
            >
              {#if dm}
                {@const other = otherUser(c)}
                <Avatar
                  name={other?.name ?? '?'}
                  id={other?.id}
                  src={other?.avatarUrl}
                  size={18}
                  presence={other ? (store.presence[other.id] ?? 'offline') : null}
                />
              {:else}
                <Icon name={kindOf(c) === 'private' ? 'lock' : 'hash'} size={15} strokeWidth={1.7} />
              {/if}
              <span class="name">{store.channelLabel(c)}</span>
              {#if mentions > 0 && !muted}
                <span class="badge mention">{mentions}</span>
              {:else if unread > 0 && !muted}
                <span class="badge">{unread > 99 ? '99+' : unread}</span>
              {:else if muted}
                <Icon name="bell-off" size={13} strokeWidth={1.6} class="mute-mark" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {/snippet}

    {@render group(m.chat_starred(), starred)}
    {@render group(m.chat_channels(), channels)}
    {@render group(m.chat_direct_messages(), dms)}
  </div>
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border-inline-end: 1px solid var(--kern-border);
    background: var(--kern-shell);
  }
  .search {
    padding: 10px 10px 6px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 8px 12px;
  }
  .group + .group {
    margin-top: 14px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--kern-ink-500);
    font-size: 13.5px;
    text-align: start;
    cursor: pointer;
  }
  .row:hover {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-700);
  }
  .row.active {
    background: var(--kern-surface-active);
    color: var(--kern-ink-900);
  }
  .row.unread {
    color: var(--kern-ink-900);
    font-weight: 500;
  }
  .row.muted {
    opacity: 0.62;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    flex: none;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--kern-ink-900);
    color: var(--kern-ink-inverse);
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
  }
  .badge.mention {
    background: var(--kern-accent);
  }
  .row :global(.mute-mark) {
    flex: none;
    color: var(--kern-ink-350);
  }
</style>
