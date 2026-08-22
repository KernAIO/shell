<script lang="ts">
import type { ChatStore, Message } from '@kernhq/module-chat/client'
import { renderDocToHtml, timeOf } from '@kernhq/module-chat/client'
import { Avatar, EmptyState, IconButton, Skeleton } from '@kernhq/ui'
import { getLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'
import { getChatApi } from '../api'
import { canChat } from '../permissions'

/**
 * What has been pinned in this conversation.
 *
 * Pinning is how a channel keeps the thing everybody needs — the release checklist, the standing
 * agenda — from scrolling away. A pin nobody can find again is not a pin, which is what the header's
 * bookmark button is for.
 */

interface Props {
  store: ChatStore
  channelId: string
  workspaceId: string
  onclose: () => void
}
let { store, channelId, workspaceId, onclose }: Props = $props()

let items = $state<Message[] | null>(null)
let failed = $state(false)

async function load() {
  failed = false
  items = null
  try {
    items = await getChatApi().messages.pins({
      workspaceId: workspaceId as never,
      channelId: channelId as never,
    })
  } catch {
    failed = true
  }
}

$effect(() => {
  channelId
  void load()
})
</script>

<aside class="panel" data-testid="pinned-panel">
  <header>
    <h2>{m.chat_pinned_messages()}</h2>
    <IconButton
      icon="x"
      label={m.chat_close()}
      size={28}
      variant="ghost"
      strokeWidth={1.8}
      onclick={onclose}
      data-testid="close-pins"
    />
  </header>

  <div class="scroll">
    {#if failed}
      <div class="state">
        <EmptyState icon="triangle-alert" title={m.chat_pins_failed()} />
        <button type="button" class="retry" onclick={load}>{m.chat_retry()}</button>
      </div>
    {:else if items === null}
      <div class="loading">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="70%" height="14px" />
      </div>
    {:else if items.length === 0}
      <div class="state">
        <EmptyState
          icon="bookmark"
          title={m.chat_no_pins()}
          description={m.chat_no_pins_hint()}
        />
      </div>
    {:else}
      {#each items as msg (msg.id)}
        {@const author = msg.authorId ? store.users[msg.authorId] : undefined}
        <article class="pin">
          <div class="who">
            <Avatar name={author?.name ?? '?'} id={author?.id} src={author?.avatarUrl} size={22} />
            <span class="name">{author?.name ?? '…'}</span>
            <time datetime={msg.createdAt}>{timeOf(msg.createdAt, getLocale())}</time>
            {#if canChat('pin')}
              <IconButton
                icon="x"
                label={m.chat_unpin()}
                size={22}
                variant="ghost"
                onclick={async () => {
                  await store.togglePin(msg.id, channelId, false)
                  await load()
                }}
              />
            {/if}
          </div>
          <div class="text">{@html renderDocToHtml(msg.body)}</div>
        </article>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--kern-detail-w, 380px);
    min-width: 0;
    height: 100%;
    border-inline-start: 1px solid var(--kern-border);
    background: var(--kern-surface);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 12px 0 24px;
    border-bottom: 1px solid var(--kern-border);
    flex: none;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 0;
  }
  .loading {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 24px;
  }
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
  }
  .retry {
    border: 0;
    background: none;
    font-size: 13px;
    color: var(--kern-accent-text);
    cursor: pointer;
  }
  .pin {
    padding: 10px 24px;
  }
  .pin + .pin {
    border-top: 1px solid var(--kern-border-hairline);
  }
  .who {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name {
    font-size: 13px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  time {
    flex: 1;
    font-size: 11.5px;
    color: var(--kern-ink-350);
  }
  .text {
    margin-top: 4px;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--kern-ink-700);
    overflow-wrap: anywhere;
  }
  .text :global(.kern-chat-mention) {
    color: var(--kern-accent-text);
    font-weight: 500;
  }
  .text :global(p) {
    margin: 0;
  }
</style>
