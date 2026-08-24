<script lang="ts">
import { Button, EmptyState, Skeleton } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getQuireApi } from './api'
import PageView from './PageView.svelte'
import { canQuire } from './permissions'
import { quireKeys } from './query'

/**
 * A space with no page chosen.
 *
 * If the space has a home page, that is what opening it means; otherwise this is the first thing
 * somebody sees, so it has to offer the one action that gets them out of it.
 */
interface Props {
  spaceKey: string
}
const { spaceKey }: Props = $props()

const api = getQuireApi()
const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === workspaceSlug)?.id ?? '')

const spacesQuery = createQuery(() => ({
  queryKey: quireKeys.spaces(workspaceId),
  enabled: Boolean(workspaceId),
  queryFn: () => api.spaces.list({ workspaceId, includeArchived: false }),
}))
const space = $derived((spacesQuery.data ?? []).find((s) => s.key === spaceKey) ?? null)

let creating = $state(false)
async function createFirst() {
  if (!space || creating) return
  creating = true
  try {
    const created = await api.pages.create({
      workspaceId,
      spaceId: space.id,
      parentId: null,
      title: '',
      kind: 'page',
      icon: null,
      afterId: null,
    })
    void goto(`/${workspaceSlug}/quire/${encodeURIComponent(spaceKey)}/${encodeURIComponent(created.id)}`)
  } finally {
    creating = false
  }
}
</script>

{#if spacesQuery.isLoading}
  <div class="pad"><Skeleton height="36px" /></div>
{:else if !space}
  <div class="pad">
    <EmptyState icon="scroll-text" title={m.quire_space_missing()} description={m.quire_space_missing_desc()} />
  </div>
{:else if space.homepageId}
  <PageView {spaceKey} pageId={space.homepageId} />
{:else}
  <div class="pad">
    <EmptyState icon="file-text" title={m.quire_space_empty()} description={m.quire_space_empty_desc()}>
      {#snippet actions()}
        {#if canQuire('pageCreate')}
          <Button disabled={creating} onclick={createFirst}>{m.quire_new_page()}</Button>
        {/if}
      {/snippet}
    </EmptyState>
  </div>
{/if}

<style>
.pad {
  padding: 28px 32px 48px;
}
</style>
