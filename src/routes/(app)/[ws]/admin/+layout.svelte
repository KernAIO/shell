<script lang="ts">
import { Icon, SectionLabel } from '@kernhq/ui'
import { page } from '$app/state'
import { instanceLinksFor } from '$lib/modules/registry'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The instance console: settings that belong to the whole installation rather than to one
 * workspace. Everything here is limited to instance admins, and the entry point in the account
 * menu is only rendered for them — so somebody without the flag never arrives at a locked page.
 */
let { children } = $props()

const slug = $derived(page.params.ws!)
const href = (p: string) => `/${slug}/admin${p}`
const isActive = (p: string) => page.url.pathname === href(p)

/**
 * The console's own pages, plus whatever the modules contribute.
 *
 * Module pages are not filtered by what this workspace has enabled: the console is about the
 * instance, and an operator checking what every workspace is billed must still find the screen when
 * the workspace they happen to be standing in has that module switched off. The `instanceAdmin`
 * check around this whole layout is the gate that matters.
 */
const links = $derived([
  { path: '/updates', label: m.admin_updates_title(), icon: 'refresh-cw' },
  { path: '/modules', label: m.dev_modules_nav(), icon: 'puzzle' },
  ...instanceLinksFor({ can: (permission: string) => session.can(permission) }).map((link) => ({
    path: `/${link.moduleId}/${link.id}`,
    label: link.label,
    icon: link.icon ?? 'puzzle',
  })),
])
</script>

{#if session.user?.instanceAdmin}
  <div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
    <nav
      class="border-b border-[var(--kern-border)] px-3 py-4 md:border-b-0 md:border-e"
      aria-label={m.nav_admin()}
    >
      <div class="mb-4 flex items-center gap-2.5 px-1.5">
        <div
          class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]"
        >
          <Icon name="shield" size={15} />
        </div>
        <div class="min-w-0">
          <div class="truncate text-[13px] font-medium text-[var(--kern-ink-900)]">{m.nav_admin()}</div>
          <div class="truncate font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
            {m.admin_scope_hint()}
          </div>
        </div>
      </div>

      <SectionLabel label={m.admin_section_instance()} />
      <ul class="mt-1 grid gap-0.5">
        {#each links as link (link.path)}
          <li>
            <a
              href={href(link.path)}
              aria-current={isActive(link.path) ? 'page' : undefined}
              class="flex h-[34px] items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] transition-colors {isActive(
                link.path,
              )
                ? 'bg-[var(--kern-ink-900)] font-medium text-[var(--kern-ink-inverse)]'
                : 'text-[var(--kern-ink-700)] hover:bg-[var(--kern-surface-hover)]'}"
            >
              <Icon name={link.icon} size={15} class="shrink-0 opacity-90" />
              <span class="truncate">{link.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="min-h-0 overflow-y-auto px-6 py-6 pb-16">{@render children()}</div>
  </div>
{:else}
  <div class="grid flex-1 place-items-center px-6 py-16">
    <p class="text-[13px] text-[var(--kern-ink-500)]">{m.admin_forbidden()}</p>
  </div>
{/if}
