<script lang="ts">
import { Button, EmptyState, SearchBox, Skeleton } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { canChat } from '../permissions'
import { getChatStore } from '../store.svelte'
import ConversationList from './ConversationList.svelte'
import NewChannelDialog from './NewChannelDialog.svelte'
import SearchResults from './SearchResults.svelte'

/**
 * Chat's conversations, in the application sidebar (DESIGN.md 2.3).
 *
 * The sidebar belongs to whichever module you are in — that is why the design gives Chat a "Search
 * this space" box and CHANNELS / DIRECT MESSAGES groups there rather than a third column. The
 * transcript in the content area reads the same store, so unread counts and the open conversation
 * stay in step between the two.
 *
 * Searching replaces the conversation list in the same scroll area rather than appearing under it,
 * so the results are where the list was and never below the fold.
 */

const workspaceSlug = $derived(page.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const store = $derived(getChatStore(workspace?.id ?? '', session.user?.id ?? ''))

const activeId = $derived(page.url.searchParams.get('c'))
let search = $state('')
let newChannelOpen = $state(false)

const searching = $derived(search.trim().length > 0)

$effect(() => {
  if (store && !store.channelsLoaded) void store.loadChannels()
})

function open(channelId: string) {
  void goto(`/${workspaceSlug}/chat?c=${encodeURIComponent(channelId)}`, {
    keepFocus: true,
    noScroll: true,
  })
}

/** Following a search result opens its conversation and points at the message. */
function openHit(channelId: string, messageId: string) {
  void goto(
    `/${workspaceSlug}/chat?c=${encodeURIComponent(channelId)}&msg=${encodeURIComponent(messageId)}`,
    { keepFocus: true, noScroll: true },
  )
}

function runSearch(value: string) {
  search = value
  void store?.search(value)
}

function clearSearch() {
  runSearch('')
}
</script>

<div class="chat-sidebar">
  <div class="search">
    <SearchBox
      value={search}
      placeholder={m.chat_search_placeholder()}
      oninput={(e) => runSearch((e.currentTarget as HTMLInputElement).value)}
      data-testid="chat-search"
    />
  </div>

  <div class="scroll">
    {#if !store || !store.channelsLoaded}
      <div class="loading">
        {#each [0, 1, 2, 3, 4] as i (i)}<Skeleton width="100%" height="28px" radius="7px" />{/each}
      </div>
    {:else if searching}
      <SearchResults {store} query={search} onopen={openHit} onclear={clearSearch} />
    {:else if store.channels.length === 0}
      <div class="empty">
        <EmptyState
          icon="message-circle"
          title={m.chat_no_conversations()}
          description={m.chat_no_conversations_hint()}
        />
        {#if canChat('createChannel')}
          <Button size="sm" icon="plus" onclick={() => (newChannelOpen = true)}>
            {m.chat_new_channel()}
          </Button>
        {/if}
      </div>
    {:else}
      <ConversationList {store} {activeId} onselect={open} />
    {/if}
  </div>
</div>

{#if store}
  <NewChannelDialog bind:open={newChannelOpen} {store} oncreated={open} />
{/if}

<style>
  .chat-sidebar {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .search {
    padding: 8px 12px 6px;
    flex: none;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
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
