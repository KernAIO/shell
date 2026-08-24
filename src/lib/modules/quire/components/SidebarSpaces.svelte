<script lang="ts">
import { buildPageTree, type PageTreeNode } from '@kernhq/module-quire/client'
import { Button, EmptyState, SearchBox, SectionLabel, Select, Skeleton } from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getQuireApi } from '../api'
import { canQuire } from '../permissions'
import { quireKeys } from '../query'
import PageTreeRow from './PageTreeRow.svelte'

/**
 * Quire's spaces and pages, in the application sidebar (DESIGN.md §2.3).
 *
 * The sidebar belongs to whichever module you are in — that is why a wiki gets a space switcher, a
 * "Search this space" box and its page tree here rather than a third column. The tree is the table
 * of contents, so it shows every level at once and comes from one request per space.
 */
const api = getQuireApi()
const client = useQueryClient()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

const spaceKeyInUrl = $derived(pageState.params.space ?? null)
const activePageId = $derived(pageState.params.page ?? null)

const spacesQuery = createQuery(() => ({
  queryKey: quireKeys.spaces(workspaceId),
  enabled: Boolean(workspaceId),
  queryFn: () => api.spaces.list({ workspaceId, includeArchived: false }),
}))

const spaceList = $derived(spacesQuery.data ?? [])
const activeSpace = $derived(spaceList.find((space) => space.key === spaceKeyInUrl) ?? spaceList[0] ?? null)

const treeQuery = createQuery(() => ({
  queryKey: quireKeys.tree(workspaceId, activeSpace?.id ?? ''),
  enabled: Boolean(workspaceId && activeSpace),
  queryFn: () => api.pages.tree({ workspaceId, spaceId: activeSpace?.id ?? '', includeArchived: false }),
}))

let search = $state('')
let expanded = $state(new Set<string>())

const nodes = $derived(treeQuery.data ?? [])
const roots = $derived(buildPageTree(nodes))

/**
 * Searching replaces the tree in the same scroll area rather than appearing under it, so the results
 * are where the list was and never below the fold. It filters what is already loaded — the whole
 * space is in memory — so it costs no request and answers as you type.
 */
const query = $derived(search.trim().toLowerCase())
const matches = $derived(
  query ? nodes.filter((n) => (n.title || m.quire_untitled()).toLowerCase().includes(query)) : [],
)

/** A page opened from a link may be nested; its ancestors have to be open for it to be visible. */
$effect(() => {
  if (!activePageId || nodes.length === 0) return
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const next = new Set(expanded)
  let cursor = byId.get(activePageId)?.parentId ?? null
  let guard = 0
  while (cursor && guard++ < 100) {
    next.add(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }
  if (next.size !== expanded.size) expanded = next
})

function toggle(id: string) {
  const next = new Set(expanded)
  if (!next.delete(id)) next.add(id)
  expanded = next
}

function openPage(id: string) {
  if (!activeSpace) return
  void goto(`/${workspaceSlug}/quire/${encodeURIComponent(activeSpace.key)}/${encodeURIComponent(id)}`)
}

function switchSpace(key: string) {
  void goto(`/${workspaceSlug}/quire/${encodeURIComponent(key)}`)
}

let creating = $state(false)

async function createPage(parentId: string | null) {
  if (!activeSpace || creating) return
  creating = true
  try {
    const created = await api.pages.create({
      workspaceId,
      spaceId: activeSpace.id,
      parentId,
      title: '',
      kind: 'page',
      icon: null,
      afterId: null,
    })
    await client.invalidateQueries({ queryKey: quireKeys.tree(workspaceId, activeSpace.id) })
    if (parentId) expanded = new Set(expanded).add(parentId)
    openPage(created.id)
  } finally {
    creating = false
  }
}
</script>

<div class="wrap">
  {#if spaceList.length > 1}
    <div class="switcher">
      <Select
        value={activeSpace?.key ?? ''}
        options={spaceList.map((space) => ({ value: space.key, label: space.name }))}
        onValueChange={(v: string) => switchSpace(v)}
      />
    </div>
  {/if}

  <div class="strip">
    <SearchBox bind:value={search} placeholder={m.quire_search_space()} />
  </div>

  <div class="scroll">
    {#if spacesQuery.isLoading || treeQuery.isLoading}
      <div class="loading">
        {#each [1, 2, 3, 4, 5] as n (n)}
          <Skeleton height="34px" />
        {/each}
      </div>
    {:else if spacesQuery.isError || treeQuery.isError}
      <EmptyState
        icon="triangle-alert"
        title={m.quire_tree_error()}
        description={m.quire_tree_error_desc()}
      >
        {#snippet actions()}
          <Button
            variant="secondary"
            size="sm"
            onclick={() => {
              void spacesQuery.refetch()
              void treeQuery.refetch()
            }}
          >
            {m.retry()}
          </Button>
        {/snippet}
      </EmptyState>
    {:else if spaceList.length === 0}
      <EmptyState icon="scroll-text" title={m.quire_no_spaces()} description={m.quire_no_spaces_desc()} />
    {:else if query}
      <SectionLabel label={m.quire_search_results()} />
      {#if matches.length === 0}
        <p class="none">{m.quire_search_none()}</p>
      {:else}
        {#each matches as node (node.id)}
          <PageTreeRow
            node={{ ...node, children: [] } as PageTreeNode}
            depth={0}
            activeId={activePageId}
            expanded={new Set()}
            onToggle={() => {}}
            onOpen={openPage}
            onCreateChild={createPage}
            canCreate={false}
          />
        {/each}
      {/if}
    {:else}
      <SectionLabel label={activeSpace?.name ?? m.quire_nav()} />
      {#if roots.length === 0}
        <p class="none">{m.quire_space_empty()}</p>
      {:else}
        {#each roots as node (node.id)}
          <PageTreeRow
            {node}
            depth={0}
            activeId={activePageId}
            {expanded}
            onToggle={toggle}
            onOpen={openPage}
            onCreateChild={createPage}
            canCreate={canQuire('pageCreate')}
          />
        {/each}
      {/if}

      {#if canQuire('pageCreate') && activeSpace}
        <div class="new">
          <Button variant="ghost" size="sm" icon="plus" disabled={creating} onclick={() => createPage(null)}>
            {m.quire_new_page()}
          </Button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
.wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.switcher {
  padding: 10px 12px 0;
}
.strip {
  padding: 12px 12px 4px;
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 14px;
  min-height: 0;
}
.loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-block-start: 8px;
}
.none {
  padding: 10px;
  font-size: 13px;
  color: var(--kern-ink-400);
  margin: 0;
}
.new {
  padding-block-start: 6px;
}
</style>
