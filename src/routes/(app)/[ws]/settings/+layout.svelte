<script lang="ts">
import { Page, PageHeader, SectionLabel } from '@kernalo/ui'
import { page } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

let { children } = $props()
const slug = $derived(page.params.ws!)
const href = (p: string) => `/${slug}/settings${p}`
const active = (p: string) => page.url.pathname === href(p)

const workspaceLinks = $derived(
  [
    { path: '', label: m.settings_general(), permission: 'core.workspace.manage' },
    { path: '/members', label: m.settings_members(), permission: 'core.members.view' },
    { path: '/modules', label: m.settings_modules(), permission: 'core.modules.manage' },
  ].filter((l) => session.can(l.permission)),
)

const accountLinks = [
  { path: '/profile', label: m.settings_profile() },
  { path: '/appearance', label: m.settings_appearance() },
]
</script>

<Page>
  <PageHeader title={m.settings_title()} crumbs={[{ label: m.nav_workspace(), href: `/${slug}` }]} />

  <div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
    <nav class="border-e border-[var(--kern-border)] p-3">
      {#if workspaceLinks.length}
        <SectionLabel label={m.settings_workspace_section()} />
        <ul class="mb-4 grid gap-0.5">
          {#each workspaceLinks as link (link.path)}
            <li>
              <a
                href={href(link.path)}
                class="block rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors {active(link.path)
                  ? 'bg-[var(--kern-ink-900)] text-[var(--kern-ink-inverse)]'
                  : 'text-[var(--kern-ink-700)] hover:bg-[var(--kern-surface-hover)]'}"
              >
                {link.label}
              </a>
            </li>
          {/each}
        </ul>
      {/if}

      <SectionLabel label={m.settings_account_section()} />
      <ul class="grid gap-0.5">
        {#each accountLinks as link (link.path)}
          <li>
            <a
              href={href(link.path)}
              class="block rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors {active(link.path)
                ? 'bg-[var(--kern-ink-900)] text-[var(--kern-ink-inverse)]'
                : 'text-[var(--kern-ink-700)] hover:bg-[var(--kern-surface-hover)]'}"
            >
              {link.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="min-h-0 overflow-y-auto p-6">
      <div class="mx-auto max-w-[680px]">{@render children()}</div>
    </div>
  </div>
</Page>
