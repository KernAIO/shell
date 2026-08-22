<script lang="ts">
import type { ChannelView, ChatStore } from '@kernhq/module-chat/client'
import { AvatarStack, Button, DropdownMenu, Icon, IconButton } from '@kernhq/ui'
import * as m from '$msg'
import { KIND_TILE, kindOf } from '../labels'
import { canChat } from '../permissions'

/**
 * Who you are talking to, and what you can do about it.
 *
 * Every action a conversation supports is reachable from here — starring, muting, pinned messages,
 * leaving — rather than living only in a context menu somebody has to guess at.
 */

interface Props {
  store: ChatStore
  channel: ChannelView
  onshowpins: () => void
}
let { store, channel, onshowpins }: Props = $props()

const kind = $derived(kindOf(channel))
const tile = $derived(KIND_TILE[kind])
const label = $derived(store.channelLabel(channel))
const muted = $derived(channel.membership?.muted ?? false)
const isDm = $derived(kind === 'dm' || kind === 'group')

const members = $derived(
  (channel.dmUserIds.length ? channel.dmUserIds : Object.keys(store.users))
    .slice(0, 4)
    .map((userId) => ({ id: userId, name: store.users[userId]?.name ?? '…' })),
)

const subtitle = $derived(isDm ? (channel.topic ?? '') : m.chat_members_count({ count: channel.memberCount }))
</script>

<header class="head">
  <span class="tile" style="background: {tile.bg}; color: {tile.fg}">
    <Icon name={tile.icon} size={16} strokeWidth={1.7} />
  </span>

  <div class="who">
    <div class="line">
      <h1 class="name" data-testid="conversation-name">{label}</h1>
      {#if subtitle}<span class="kind">{subtitle}</span>{/if}
    </div>
    {#if channel.topic && !isDm}<p class="topic">{channel.topic}</p>{/if}
  </div>

  {#if members.length > 1}
    <AvatarStack people={members} size={24} max={4} />
  {/if}

  <Button variant="secondary" size="sm" icon="video">{m.chat_huddle()}</Button>

  <IconButton
    icon="bookmark"
    label={m.chat_pinned()}
    size={32}
    variant="ghost"
    onclick={onshowpins}
    data-testid="show-pins"
  />

  <DropdownMenu
    items={[
      {
        id: 'favorite',
        label: channel.favorite ? m.chat_unfavorite() : m.chat_favorite(),
        icon: 'star',
        onSelect: () => void store.setFavorite(channel.id, !channel.favorite),
      },
      {
        id: 'mute',
        label: muted ? m.chat_unmute() : m.chat_mute(),
        icon: muted ? 'bell' : 'bell-off',
        onSelect: () => void store.setMuted(channel.id, !muted),
      },
      ...(isDm || !canChat('view')
        ? []
        : [
            {
              id: 'leave',
              label: m.chat_leave(),
              icon: 'log-out',
              danger: true,
              onSelect: () => void store.leaveChannel(channel.id),
            },
          ]),
    ]}
  >
    {#snippet trigger(props)}
      <IconButton icon="ellipsis" label={m.chat_title()} size={32} variant="ghost" {...props} />
    {/snippet}
  </DropdownMenu>
</header>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    height: 56px;
    padding: 0 24px;
    border-bottom: 1px solid var(--kern-border);
    flex: none;
  }
  /* every action keeps its size; only the name and topic give way, and never below a legible width */
  .head > :global(*) {
    align-self: center;
    flex: none;
  }
  .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--kern-r-lg);
    flex: none;
  }
  .who {
    flex: 1 1 auto;
    min-width: 120px;
  }
  .line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .name {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--kern-ink-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    flex: none;
    font-size: 12.5px;
    color: var(--kern-ink-350);
  }
  .topic {
    margin: 1px 0 0;
    font-size: 12.5px;
    color: var(--kern-ink-350);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
