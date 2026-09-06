<script lang="ts">
import { Badge, EmptyState, Icon, SearchBox, Skeleton } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { formatCount } from '$lib/format'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * What each module actually registered.
 *
 * The modules screen in workspace settings answers "is this on". This answers the question somebody
 * *building* a module asks every few minutes and nothing could answer before: is it wired up, is
 * every procedure it promised implemented, what stands in front of each one, and what does it own.
 *
 * Everything here is checked rather than declared — the contract and the router are walked and
 * compared on the server — so a procedure that was promised and never implemented shows up here
 * instead of as a 404 somebody hits weeks later.
 */
const api = getApi()

const reports = createQuery(() => ({
  queryKey: keys.adminDiagnostics(),
  queryFn: () => api.admin.diagnostics(),
}))

let filter = $state('')

const modules = $derived.by(() => {
  const all = reports.data ?? []
  const q = filter.trim().toLowerCase()
  if (!q) return all
  return all.filter(
    (r) =>
      r.id.includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.procedures.some((p) => p.name.toLowerCase().includes(q)),
  )
})

const totalProblems = $derived((reports.data ?? []).reduce((n, r) => n + r.problems.length, 0))

/**
 * The six words the card counts, each with the sentence that says what it is.
 *
 * They are jargon on their own — "callable" and "subscriptions" in particular say nothing about
 * which direction the traffic goes — so the same list draws the legend at the top of the page and
 * the row on every card, and neither can drift from the other.
 */
type ModuleReport = NonNullable<typeof reports.data>[number]
const STATS: { label: () => string; hint: () => string; of: (r: ModuleReport) => number }[] = [
  { label: m.dev_modules_procedures, hint: m.dev_modules_procedures_hint, of: (r) => r.procedures.length },
  { label: m.dev_modules_permissions, hint: m.dev_modules_permissions_hint, of: (r) => r.permissions.length },
  { label: m.dev_modules_events, hint: m.dev_modules_events_hint, of: (r) => r.events.length },
  { label: m.dev_modules_jobs, hint: m.dev_modules_jobs_hint, of: (r) => r.jobs.length },
  {
    label: m.dev_modules_subscriptions,
    hint: m.dev_modules_subscriptions_hint,
    of: (r) => r.subscriptions.length,
  },
  { label: m.dev_modules_callable, hint: m.dev_modules_callable_hint, of: (r) => r.callable.length },
]
</script>

<SettingsPage title={m.dev_modules_title()} description={m.dev_modules_desc()} section={m.nav_admin()}>
  {#snippet actions()}
    <!-- Wide enough for the longest translation of the placeholder; it says it searches procedures
         too, and a clipped placeholder would hide exactly that half. -->
    <SearchBox bind:value={filter} placeholder={m.dev_modules_search()} width="280px" />
  {/snippet}

  {#if reports.isPending}
    <SettingsSection>
      <div class="loading">
        {#each [1, 2, 3] as i (i)}<Skeleton height="72px" radius="10px" />{/each}
      </div>
    </SettingsSection>
  {:else if reports.error}
    <SettingsSection>
      <p class="failed">{reports.error instanceof Error ? reports.error.message : m.error_generic()}</p>
    </SettingsSection>
  {:else if modules.length === 0}
    <SettingsSection>
      <EmptyState icon="puzzle" title={m.dev_modules_none()} compact />
    </SettingsSection>
  {:else}
    {#if totalProblems > 0}
      <!-- Said once at the top, because the point of this screen is that you do not have to hunt. -->
      <p class="problem-count">
        <Icon name="circle-alert" size={14} />
        {m.dev_modules_problem_count({ count: formatCount(totalProblems) })}
      </p>
    {/if}

    <!--
      Said once for the page rather than as six tooltips per card: it is reference material somebody
      reads on their first visit and never again, and one control is one tab stop instead of sixty.
    -->
    <details class="legend">
      <summary>
        <svg class="caret" width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5l9 7-9 7z" fill="currentColor" />
        </svg>
        {m.dev_modules_legend()}
      </summary>
      <dl>
        {#each STATS as stat (stat.label)}
          <div><dt>{stat.label()}</dt><dd>{stat.hint()}</dd></div>
        {/each}
      </dl>
    </details>

    {#each modules as report (report.id)}
      <SettingsSection>
        <!-- One flow with one gap, so the rhythm inside a card cannot drift as blocks are added. -->
        <div class="card">
          <header class="head">
          <span class="name">{report.name}</span>
          <code>{report.id}</code>
          <Badge tone="grey" variant="chip">{report.version}</Badge>
          {#if report.host}<Badge tone="grey" variant="chip">{report.host}</Badge>{/if}
          <!-- The one thing somebody scans a column of cards for, so it sits at the same edge on
               every one rather than wherever the chips before it happen to end. -->
          <span class="verdict">
            {#if report.problems.length === 0}
              <Badge tone="done" variant="chip">{m.dev_modules_ok()}</Badge>
            {:else}
              <Badge tone="danger" variant="chip">
                {m.dev_modules_problems({ count: formatCount(report.problems.length) })}
              </Badge>
            {/if}
          </span>
        </header>

        {#if report.problems.length}
          <ul class="problems">
            {#each report.problems as problem (problem)}
              <li><Icon name="circle-alert" size={13} /> {problem}</li>
            {/each}
          </ul>
        {/if}

        <dl class="counts">
          {#each STATS as stat (stat.label)}
            {@const value = stat.of(report)}
            <div class:zero={value === 0}>
              <dt>{stat.label()}</dt>
              <dd>{formatCount(value)}</dd>
            </div>
          {/each}
        </dl>

        {#if report.public.length}
          <!--
            Not a fault — a health check and an intake form are meant to be reachable — but the list
            nobody otherwise keeps, and the one worth glancing at after every change.
          -->
          <p class="public">
            <Icon name="globe" size={13} />
            {m.dev_modules_public()}
            {#each report.public as name (name)}<code>{name}</code>{/each}
          </p>
        {/if}

        <details>
          <summary>
            <svg class="caret" width="9" height="9" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5l9 7-9 7z" fill="currentColor" />
            </svg>
            {m.dev_modules_show_procedures({ count: formatCount(report.procedures.length) })}
          </summary>
          <table>
            <thead>
              <tr>
                <th>{m.dev_modules_procedure()}</th>
                <th>{m.dev_modules_route()}</th>
                <th>{m.dev_modules_gates()}</th>
              </tr>
            </thead>
            <tbody>
              {#each report.procedures as procedure (procedure.name)}
                <tr>
                  <td><code>{procedure.name}</code></td>
                  <td class="route">
                    {#if procedure.method}<span class="method">{procedure.method}</span>{/if}
                    {procedure.path ?? '—'}
                  </td>
                  <td>
                    {#if procedure.gated}
                      {formatCount(procedure.middlewares)}
                    {:else}
                      <Badge tone="grey" variant="chip">{m.dev_modules_open()}</Badge>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          </details>
        </div>
      </SettingsSection>
    {/each}
  {/if}
</SettingsPage>

<style>
  .loading {
    display: grid;
    gap: 10px;
  }
  .failed {
    font-size: 13px;
    color: var(--kern-danger);
  }
  .problem-count {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--kern-danger);
  }
  .legend dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 5px 14px;
    margin-block-start: 10px;
    padding-inline-start: 15px;
  }
  .legend div {
    display: contents;
  }
  .legend dt {
    font-size: 12px;
    font-weight: 500;
    color: var(--kern-ink-700);
  }
  .legend dd {
    font-size: 12px;
    line-height: 1.5;
    color: var(--kern-ink-500);
  }
  .card {
    display: grid;
    gap: 13px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .verdict {
    margin-inline-start: auto;
  }
  .name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--kern-ink-900);
  }
  code {
    font-family: var(--kern-font-mono);
    font-size: 11.5px;
    color: var(--kern-ink-500);
  }
  .problems {
    display: grid;
    gap: 4px;
  }
  .problems li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12.5px;
    color: var(--kern-danger);
  }
  /*
    Six equal columns rather than a flex row: packed left, the widths came from how long each label
    happened to be, so no two cards lined up and the far half of every card was empty. It folds to
    fewer columns below roughly 640px of card.
  */
  .counts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(94px, 1fr));
    gap: 12px 10px;
  }
  .counts div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .counts dt {
    font-size: 11.5px;
    color: var(--kern-ink-450);
  }
  .counts dd {
    font-size: 15px;
    font-weight: 600;
    color: var(--kern-ink-900);
    font-variant-numeric: tabular-nums;
  }
  /* A row of zeros should not compete with the counts that carry something. */
  .counts .zero dd {
    color: var(--kern-ink-330);
    font-weight: 500;
  }
  .public {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12.5px;
    color: var(--kern-ink-500);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    font-size: 12.5px;
    color: var(--kern-accent-text);
    cursor: pointer;
  }
  /* The browser's own marker is a different shape in every engine; the product's disclosure
     triangle is the one in group headers. */
  summary::marker,
  summary::-webkit-details-marker {
    content: '';
    display: none;
  }
  .caret {
    flex: none;
    color: var(--kern-ink-350);
    transition: transform var(--kern-dur-fast);
  }
  details[open] .caret {
    transform: rotate(90deg);
  }
  :global([dir='rtl']) .caret {
    transform: rotate(180deg);
  }
  :global([dir='rtl']) details[open] .caret {
    transform: rotate(90deg);
  }
  table {
    width: 100%;
    margin-block-start: 8px;
    border-collapse: collapse;
  }
  th {
    text-align: start;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--kern-ink-450);
    padding-block: 6px;
    border-block-end: 1px solid var(--kern-border-hairline);
  }
  td {
    padding-block: 6px;
    border-block-end: 1px solid var(--kern-border-hairline);
    font-size: 12.5px;
    color: var(--kern-ink-700);
    vertical-align: top;
  }
  tr:last-child td {
    border-block-end: 0;
  }
  .route {
    font-family: var(--kern-font-mono);
    font-size: 11.5px;
    color: var(--kern-ink-500);
  }
  .method {
    color: var(--kern-accent-text);
  }
</style>
