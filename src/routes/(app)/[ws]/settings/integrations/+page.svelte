<script lang="ts">
import { Badge, Button, Icon } from '@kernaio/ui'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Integrations a workspace can configure. Each one is owned by the module that implements it, so the
 * list reflects which modules are switched on rather than a fixed catalogue.
 */
const slug = $derived(page.params.ws!)

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  href?: string
  module?: string
}

const integrations: Integration[] = [
  {
    id: 'mail',
    name: m.integrations_mail(),
    description: m.integrations_mail_desc(),
    icon: 'mail',
    module: 'mail',
  },
  {
    id: 'webhooks',
    name: m.integrations_webhooks(),
    description: m.integrations_webhooks_desc(),
    icon: 'plug',
  },
  {
    id: 'api',
    name: m.integrations_api(),
    description: m.integrations_api_desc(),
    icon: 'key-round',
  },
]
</script>

<svelte:head><title>{m.integrations_title()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.integrations_title()} description={m.integrations_body()}>
  <SettingsSection flush>
    {#each integrations as item (item.id)}
      <div
        class="flex items-center gap-3.5 border-b border-[var(--kern-border-hairline)] px-[18px] py-3.5 last:border-0"
      >
        <div
          class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--kern-surface-chip)] text-[var(--kern-ink-550)]"
        >
          <Icon name={item.icon} size={16} />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-[13.5px] font-medium text-[var(--kern-ink-900)]">{item.name}</span>
            {#if item.module}
              <Badge tone="grey">{item.module}</Badge>
            {/if}
          </div>
          <p class="mt-0.5 text-[12.5px] text-[var(--kern-ink-500)]">{item.description}</p>
        </div>

        {#if item.href}
          <Button variant="secondary" size="sm" href={item.href}>{m.settings_title()}</Button>
        {:else}
          <span class="shrink-0 text-[12px] text-[var(--kern-ink-400)]">{m.integrations_soon()}</span>
        {/if}
      </div>
    {/each}
  </SettingsSection>
</SettingsPage>
