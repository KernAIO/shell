<script lang="ts">
import { Badge, Button, Card, Icon, Skeleton, Switch, toast } from '@kernalo/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Modules are the unit Kern is built from. An instance ships them all; a workspace turns on the ones
 * it wants, and the navigation, permissions and APIs of the rest disappear for that workspace.
 */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

const modules = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const toggle = createMutation(() => ({
  mutationFn: ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) =>
    api.workspaces.modules.setEnabled({ workspaceId, moduleId, enabled }),
  onSuccess: (_res, vars) => {
    const name = modules.data?.find((e) => e.manifest.id === vars.moduleId)?.manifest.name ?? vars.moduleId
    toast.success(vars.enabled ? m.modules_enabled_toast({ name }) : m.modules_disabled_toast({ name }))
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))
</script>

<svelte:head><title>{m.modules_title()} · {m.settings_title()}</title></svelte:head>

<div class="grid gap-3">
  {#if modules.isPending}
    {#each [1, 2, 3] as i (i)}<Skeleton class="h-[76px] w-full" />{/each}
  {:else}
    {#each modules.data! as entry (entry.manifest.id)}
      <Card>
        <div class="flex items-start gap-3.5">
        <div
          class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--kern-surface-chip)] text-[var(--kern-ink-700)]"
        >
          <Icon name={entry.manifest.icon ?? 'puzzle'} size={17} />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h3 class="text-[13.5px] font-semibold text-[var(--kern-ink-900)]">{entry.manifest.name}</h3>
            {#if entry.manifest.core}
              <Badge tone="grey">{m.modules_core_badge()}</Badge>
            {/if}
            <span class="font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
              {entry.manifest.version}
            </span>
          </div>
          <p class="mt-0.5 text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">
            {entry.manifest.description}
          </p>
          {#if entry.manifest.dependsOn?.length}
            <p class="mt-1 text-[11.5px] text-[var(--kern-ink-400)]">
              {m.modules_depends_on({ deps: entry.manifest.dependsOn.join(', ') })}
            </p>
          {/if}
        </div>

          <div class="shrink-0 pt-0.5">
            <Switch
              checked={entry.state.enabled}
              disabled={entry.manifest.core || !session.can('core.modules.manage') || toggle.isPending}
              onCheckedChange={(enabled) => toggle.mutate({ moduleId: entry.manifest.id, enabled })}
            />
          </div>
        </div>
      </Card>
    {/each}
  {/if}
</div>
