<script lang="ts">
import { Button, EmptyState, Skeleton } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { canChat } from '../permissions'
import { getChatStore } from '../store.svelte'
import ConversationList from './ConversationList.svelte'
import NewChannelDialog from './NewChannelDialog.svelte'

/**
 * Chat's conversations, in the application sidebar (DESIGN.md 2.3).
 *
 * The sidebar belongs to whichever module you are in — that is why the design gives Chat a "Search
 * this space" box and CHANNELS / DIRECT MESSAGES groups there rather than a third column. The
 * transcript in the content area reads the same store, so unread counts and the open conversation
 * stay in step between the two.
 */

const workspaceSlug = $derived(page.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const store = $derived(getChatStore(workspace?.id ?? '', session.user?.id ?? ''))

const activeId = $derived(page.url.searchParams.get('c'))
let search = $state('')
let newChannelOpen = $state(false)

$effect(() => {
  if (store && !store.channelsLoaded) void store.loadChannels()
})

function open(channelId: string) {
  void goto(`/${workspaceSlug}/chat?c=${encodeURIComponent(channelId)}`, {
    keepFocus: true,
    noScroll: true,
  })
}
</script>

{#if !store || !store.channelsLoaded}
  <div class="loading">
    {#each [0, 1, 2, 3, 4] as i (i)}<Skeleton width="100%" height="28px" radius="7px" />{/each}
  </div>
{:else if store.channels.length === 0}
  <div class="empty">
    <EmptyState
      icon="message-circle"
      title={m.chat_no_conversations()}
      description={m.chat_no_conversations_hint()}
    />
    {#if canChat('createChannel')}
      <Button size="sm" icon="plus" onclick={() => (newChannelOpen = true)}>{m.chat_new_channel()}</Button>
    {/if}
  </div>
{:else}
  <ConversationList
    {store}
    {activeId}
    query={search}
    onselect={open}
    onquery={(q) => {
      search = q
      void store.search(q)
    }}
  />
{/if}

{#if store}
  <NewChannelDialog bind:open={newChannelOpen} {store} oncreated={open} />
{/if}

<style>
  .loading {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 12px;
  }
</style>
