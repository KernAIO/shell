<script lang="ts">
import { Avatar, Button, DropdownMenu, EmptyState, Icon, IconButton, Page, Skeleton } from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page as pageState } from '$app/state'
import { relativeTime } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getQuireApi } from './api'
import { canQuire } from './permissions'
import { quireKeys } from './query'

/**
 * One page (DESIGN.md §3.6): 780px measure, a 30px title, a byline under a hairline.
 *
 * The body is not here yet. The collaborative editor is the next slice, and until it exists this
 * says so rather than drawing an empty box that looks broken — a surface that pretends to be
 * editable and silently drops what you type is worse than one that admits it is not finished.
 */
interface Props {
  spaceKey: string
  pageId: string
}
const { spaceKey, pageId }: Props = $props()

const api = getQuireApi()
const client = useQueryClient()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

const query = createQuery(() => ({
  queryKey: quireKeys.page(workspaceId, pageId),
  enabled: Boolean(workspaceId && pageId),
  queryFn: () => api.pages.get({ workspaceId, pageId }),
}))
const doc = $derived(query.data ?? null)

const editable = $derived(canQuire('pageEdit'))
let title = $state('')
let dirty = $state(false)
let titleEl = $state<HTMLInputElement | null>(null)

/**
 * A page created from the sidebar arrives with no title, and the only thing anybody wants to do next
 * is name it. Without this the page is called "Untitled" and you have to go and find the field.
 * Guarded on the title being empty so opening an existing page never steals the caret.
 */
$effect(() => {
  const el = titleEl
  if (el && doc && doc.title === '' && !dirty) el.focus()
})

/** Reset the field when a different page loads, but never over something being typed. */
$effect(() => {
  const loaded = doc
  if (!loaded) return
  if (!dirty) title = loaded.title
})
$effect(() => {
  void pageId
  dirty = false
})

async function saveTitle() {
  if (!doc || !dirty) return
  const next = title.trim()
  if (next === doc.title) {
    dirty = false
    return
  }
  await api.pages.update({ workspaceId, pageId, title: next })
  dirty = false
  await client.invalidateQueries({ queryKey: quireKeys.page(workspaceId, pageId) })
  await client.invalidateQueries({ queryKey: quireKeys.tree(workspaceId, doc.spaceId) })
}

async function archive(archived: boolean) {
  if (!doc) return
  await api.pages.archive({ workspaceId, pageId, archived })
  await client.invalidateQueries({ queryKey: quireKeys.page(workspaceId, pageId) })
  await client.invalidateQueries({ queryKey: quireKeys.tree(workspaceId, doc.spaceId) })
}

async function trash() {
  if (!doc) return
  await api.pages.trashPage({ workspaceId, pageId })
  await client.invalidateQueries({ queryKey: quireKeys.tree(workspaceId, doc.spaceId) })
  void goto(`/${workspaceSlug}/quire/${encodeURIComponent(spaceKey)}`)
}
</script>

<Page padding="docs" maxWidth="780px">
  {#if query.isLoading}
    <Skeleton height="36px" />
    <div class="gap"></div>
    <Skeleton height="18px" />
  {:else if query.isError}
    <EmptyState icon="triangle-alert" title={m.quire_page_error()} description={m.quire_page_error_desc()}>
      {#snippet actions()}
        <Button variant="secondary" onclick={() => void query.refetch()}>{m.retry()}</Button>
      {/snippet}
    </EmptyState>
  {:else if !doc}
    <EmptyState icon="circle-help" title={m.quire_page_missing()} description={m.quire_page_missing_desc()} />
  {:else}
    <div class="head">
      {#if editable}
        <input
          bind:this={titleEl}
          class="title"
          value={title}
          placeholder={m.quire_untitled()}
          aria-label={m.quire_page_title()}
          oninput={(e) => {
            title = (e.currentTarget as HTMLInputElement).value
            dirty = true
          }}
          onblur={saveTitle}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.currentTarget as HTMLInputElement).blur()
            }
          }}
        />
      {:else}
        <h1 class="title">{doc.title.trim() || m.quire_untitled()}</h1>
      {/if}

      <DropdownMenu
        items={[
          {
            id: 'archive',
            label: doc.archivedAt ? m.quire_unarchive() : m.quire_archive(),
            icon: 'archive',
            disabled: !editable,
            onSelect: () => void archive(!doc.archivedAt),
          },
          {
            id: 'trash',
            label: m.quire_move_to_trash(),
            icon: 'trash-2',
            danger: true,
            disabled: !editable,
            onSelect: () => void trash(),
          },
        ]}
      >
        {#snippet trigger(props: Record<string, unknown>)}
          <IconButton icon="ellipsis" label={m.quire_page_actions()} variant="ghost" {...props} />
        {/snippet}
      </DropdownMenu>
    </div>

    <div class="byline">
      <Avatar id={doc.updatedBy} size={24} />
      <span>{m.quire_edited_ago({ when: relativeTime(doc.updatedAt) })}</span>
      {#if doc.kind === 'live'}
        <span class="chip"><Icon name="square-pen" size={12} /> {m.quire_kind_live()}</span>
      {/if}
      {#if doc.archivedAt}
        <span class="chip"><Icon name="archive" size={12} /> {m.quire_archived()}</span>
      {/if}
    </div>

    <div class="body">
      <EmptyState
        icon="square-pen"
        title={m.quire_editor_pending()}
        description={m.quire_editor_pending_desc()}
      />
    </div>
  {/if}
</Page>

<style>
.gap {
  height: 14px;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.title {
  flex: 1;
  min-width: 0;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--kern-ink-900);
  margin: 0;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
}
.title:focus {
  outline: none;
}
.byline {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-block-start: 14px;
  padding-block-end: 20px;
  border-block-end: 1px solid var(--kern-border);
  font-size: 13px;
  color: var(--kern-ink-400);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.body {
  margin-block-start: 22px;
}
</style>
