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
</script>

<SettingsPage title={m.dev_modules_title()} description={m.dev_modules_desc()}>
  {#snippet actions()}
    <SearchBox
      placeholder={m.dev_modules_search()}
      value={filter}
      oninput={(e) => (filter = (e.currentTarget as HTMLInputElement).value)}
    />
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
      <p class="summary">
        <Icon name="circle-alert" size={14} />
        {m.dev_modules_problem_count({ count: formatCount(totalProblems) })}
      </p>
    {/if}

    {#each modules as report (report.id)}
      <SettingsSection>
        <header class="head">
          <span class="name">{report.name}</span>
          <code>{report.id}</code>
          <Badge tone="grey" variant="chip">{report.version}</Badge>
          {#if report.host}<Badge tone="grey" variant="chip">{report.host}</Badge>{/if}
          {#if report.problems.length === 0}
            <Badge tone="done" variant="chip">{m.dev_modules_ok()}</Badge>
          {:else}
            <Badge tone="danger" variant="chip">
              {m.dev_modules_problems({ count: formatCount(report.problems.length) })}
            </Badge>
          {/if}
        </header>

        {#if report.problems.length}
          <ul class="problems">
            {#each report.problems as problem (problem)}
              <li><Icon name="circle-alert" size={13} /> {problem}</li>
            {/each}
          </ul>
        {/if}

        <dl class="counts">
          <div><dt>{m.dev_modules_procedures()}</dt><dd>{formatCount(report.procedures.length)}</dd></div>
          <div><dt>{m.dev_modules_permissions()}</dt><dd>{formatCount(report.permissions.length)}</dd></div>
          <div><dt>{m.dev_modules_events()}</dt><dd>{formatCount(report.events.length)}</dd></div>
          <div><dt>{m.dev_modules_jobs()}</dt><dd>{formatCount(report.jobs.length)}</dd></div>
          <div><dt>{m.dev_modules_subscriptions()}</dt><dd>{formatCount(report.subscriptions.length)}</dd></div>
          <div><dt>{m.dev_modules_callable()}</dt><dd>{formatCount(report.callable.length)}</dd></div>
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
          <summary>{m.dev_modules_show_procedures({ count: formatCount(report.procedures.length) })}</summary>
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
  .summary {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-block-end: 12px;
    font-size: 13px;
    color: var(--kern-danger);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-block-end: 10px;
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
    margin-block-end: 10px;
  }
  .problems li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12.5px;
    color: var(--kern-danger);
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-block-end: 10px;
  }
  .counts div {
    display: grid;
    gap: 2px;
  }
  dt {
    font-size: 11.5px;
    color: var(--kern-ink-450);
  }
  dd {
    font-size: 15px;
    font-weight: 600;
    color: var(--kern-ink-900);
    font-variant-numeric: tabular-nums;
  }
  .public {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-block-end: 10px;
    font-size: 12.5px;
    color: var(--kern-ink-500);
  }
  summary {
    font-size: 12.5px;
    color: var(--kern-accent-text);
    cursor: pointer;
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
