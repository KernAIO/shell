<script lang="ts">
import { Badge, Card, EmptyState, Page, PageHeader, Skeleton } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getHrApi } from './api'
import { hrKeys } from './query'

/**
 * Where the company works.
 *
 * Each card shows the office's **current local time** alongside its country, because that is what an
 * office list is for once there is more than one — knowing whether Amsterdam is awake. The default
 * office is marked, since it is where somebody with no assignment lands and where the resolution
 * ladder bottoms out.
 */
const api = getHrApi()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

const officesQuery = createQuery(() => ({
  queryKey: hrKeys.offices(workspaceId),
  enabled: Boolean(workspaceId),
  queryFn: () => api.offices.list({ workspaceId, includeArchived: false }),
}))
const offices = $derived(officesQuery.data ?? [])

let tick = $state(0)
$effect(() => {
  const handle = setInterval(() => {
    tick++
  }, 60_000)
  return () => clearInterval(handle)
})

function localTime(timezone: string, _tick: number): string {
  void _tick
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    return ''
  }
}

/** The country's own name for itself, rather than a two-letter code nobody reads. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
</script>

<PageHeader
  crumbs={[{ label: workspace?.name ?? '' }, { label: m.hr_offices_title() }]}
  title={m.hr_offices_title()}
/>

<Page>
  {#if officesQuery.isLoading}
    <div class="grid">{#each [1, 2, 3] as n (n)}<Skeleton height="96px" />{/each}</div>
  {:else if offices.length === 0}
    <EmptyState icon="building" title={m.hr_offices_none()} description={m.hr_offices_none_desc()} />
  {:else}
    <div class="grid">
      {#each offices as office (office.id)}
        <Card>
          <div class="head">
            <span class="name">{office.name}</span>
            {#if office.isDefault}<Badge tone="accent">{m.hr_office_default()}</Badge>{/if}
          </div>
          <p class="meta">{countryName(office.country)}</p>
          <div class="foot">
            <span class="time">{localTime(office.timezone, tick)}</span>
            <span class="meta">{m.hr_headcount({ count: String(office.headcount) })}</span>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</Page>

<style>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.name {
  font-weight: 500;
}
.meta {
  color: var(--kern-ink-500);
  font-size: 12px;
  margin: 4px 0 0;
}
.foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-block-start: 12px;
}
.time {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
</style>
