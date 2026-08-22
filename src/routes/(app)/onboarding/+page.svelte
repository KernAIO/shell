<script lang="ts">
import { Button, Card, Field, Input } from '@kernaio/ui'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import * as m from '$msg'

let name = $state('')
let slug = $state('')
let slugTouched = $state(false)
let busy = $state(false)
let error = $state<string | null>(null)

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

// the URL follows the name until someone edits it by hand
$effect(() => {
  if (!slugTouched) slug = slugify(name)
})

async function submit(e: SubmitEvent) {
  e.preventDefault()
  busy = true
  error = null
  try {
    const ws = await getApi().workspaces.create({ name, slug })
    localStorage.setItem('kern.workspace', ws.slug)
    await goto(`/${ws.slug}`)
  } catch (err) {
    error = err instanceof Error ? err.message : m.error_generic()
  } finally {
    busy = false
  }
}
</script>

<svelte:head><title>{m.onboarding_title()} · Kern</title></svelte:head>

<div class="grid min-h-dvh place-items-center bg-[var(--kern-canvas)] p-6">
  <Card class="w-full max-w-[440px] p-6">
    <h1 class="text-[19px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">{m.onboarding_title()}</h1>
    <p class="mt-1.5 text-[13px] leading-relaxed text-[var(--kern-ink-500)]">{m.onboarding_subtitle()}</p>

    <form class="mt-6 grid gap-4" onsubmit={submit}>
      <Field label={m.onboarding_ws_name()} id="ws-name">
        <Input id="ws-name" bind:value={name} required placeholder="Northstar" autofocus />
      </Field>
      <Field label={m.onboarding_ws_slug()} id="ws-slug">
        <Input
          id="ws-slug"
          bind:value={slug}
          oninput={() => (slugTouched = true)}
          required
          pattern="[a-z0-9][a-z0-9\-]*"
          class="font-[var(--kern-font-mono)]"
        />
      </Field>

      {#if error}<p role="alert" class="text-[12.5px] text-[var(--kern-danger)]">{error}</p>{/if}

      <Button type="submit" loading={busy} disabled={!name || !slug} class="mt-1 w-full">
        {m.onboarding_create()}
      </Button>
    </form>
  </Card>
</div>
