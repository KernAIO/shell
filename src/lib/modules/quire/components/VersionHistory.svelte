<script lang="ts">
import type { PageVersion } from '@kernhq/module-quire/client'
import { Avatar, Badge, Button, EmptyState, ListRow, Sheet, Skeleton } from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { relativeTime } from '$lib/format'
import * as m from '$msg'
import { getQuireApi } from '../api'
import { canQuire } from '../permissions'
import { quireKeys } from '../query'

/**
 * What a page used to say, and how to put it back.
 *
 * Restoring is offered without a confirmation on purpose: it captures the state it replaces first,
 * so it is undoable by restoring the version it just made. A confirmation dialog on a reversible
 * action trains people to click through the ones that are not.
 */
interface Props {
  open: boolean
  workspaceId: string
  pageId: string
  publishedVersionId: string | null
}
let { open = $bindable(false), workspaceId, pageId, publishedVersionId }: Props = $props()

const api = getQuireApi()
const client = useQueryClient()

const query = createQuery(() => ({
  queryKey: [...quireKeys.page(workspaceId, pageId), 'versions'],
  enabled: open && Boolean(workspaceId && pageId),
  queryFn: () => api.versions.list({ workspaceId, pageId, limit: 50 }),
}))

const versions = $derived(query.data?.items ?? [])

let restoring = $state<string | null>(null)
let error = $state<string | null>(null)

async function restore(version: PageVersion) {
  if (restoring) return
  restoring = version.id
  error = null
  try {
    await api.versions.restore({ workspaceId, versionId: version.id })
    await client.invalidateQueries({ queryKey: quireKeys.page(workspaceId, pageId) })
    await query.refetch()
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  } finally {
    restoring = null
  }
}

const kindLabel = (v: PageVersion) =>
  v.kind === 'publish'
    ? m.quire_version_published()
    : v.kind === 'restore'
      ? m.quire_version_restored()
      : v.kind === 'import'
        ? m.quire_version_imported()
        : m.quire_version_auto()
</script>

<Sheet bind:open title={m.quire_history()} width={420}>
  {#if query.isLoading}
    <div class="rows">
      {#each [1, 2, 3, 4] as n (n)}<Skeleton height="56px" />{/each}
    </div>
  {:else if query.isError}
    <EmptyState icon="triangle-alert" title={m.quire_history_error()} description={m.retry()}>
      {#snippet actions()}
        <Button variant="secondary" onclick={() => void query.refetch()}>{m.retry()}</Button>
      {/snippet}
    </EmptyState>
  {:else if versions.length === 0}
    <EmptyState icon="scroll-text" title={m.quire_history_empty()} description={m.quire_history_empty_desc()} />
  {:else}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="rows">
      {#each versions as version (version.id)}
        <ListRow>
          <div class="row">
            <Avatar id={version.authorId} size={24} />
            <div class="meta">
              <div class="line">
                <span class="when">{relativeTime(version.createdAt)}</span>
                {#if version.id === publishedVersionId}
                  <Badge tone="active">{m.quire_version_live()}</Badge>
                {:else}
                  <span class="kind">{version.label || kindLabel(version)}</span>
                {/if}
              </div>
              {#if version.preview}
                <p class="preview">{version.preview}</p>
              {/if}
            </div>
            {#if canQuire('pageEdit') && version.id !== publishedVersionId}
              <Button
                size="sm"
                variant="secondary"
                disabled={restoring !== null}
                onclick={() => restore(version)}
              >
                {restoring === version.id ? m.quire_restoring() : m.quire_restore()}
              </Button>
            {/if}
          </div>
        </ListRow>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}
.meta {
  flex: 1;
  min-width: 0;
}
.line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.when {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--kern-ink-900);
}
.kind {
  font-size: 12.5px;
  color: var(--kern-ink-400);
}
.preview {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--kern-ink-400);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.error {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--kern-danger);
}
</style>
