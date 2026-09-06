<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { isCloudHosted } from '$lib/instance'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Settings that belong to the whole installation rather than to one workspace.
 *
 * On a self-hosted instance the instance admin is the customer, so these sit here beside their
 * workspace and account settings — one Settings section, one sidebar, no second console to know
 * about. On Kern Cloud the instance admin is us and the same pages are an operator's console at
 * `/admin`, so this subtree forwards there instead. See `$lib/instance.ts`.
 *
 * The `instanceAdmin` gate is the one that matters, and it is repeated on the server: every
 * procedure these pages call runs `requireInstanceAdmin`. Nothing here is load-bearing for access —
 * `SettingsNav` already hides the rows, so somebody without the flag reaching this by URL is either
 * typing it or following a stale link, and gets a sentence rather than a broken page.
 */
let { children } = $props()

const slug = $derived(page.params.ws!)

$effect(() => {
  if (!isCloudHosted()) return
  const rest = page.url.pathname.slice(`/${slug}/settings/instance`.length)
  void goto(`/${slug}/admin${rest}${page.url.search}`, { replaceState: true })
})
</script>

{#if isCloudHosted()}
  <div class="flex-1"></div>
{:else if session.user?.instanceAdmin}
  {@render children()}
{:else}
  <p class="text-[13px] text-[var(--kern-ink-500)]">{m.admin_forbidden()}</p>
{/if}
