<script lang="ts">
import type { Snippet } from 'svelte'

/**
 * Frame for a settings page: title, one line of context, and the accent measure rule that marks the
 * start of content elsewhere in the product (DESIGN.md §2.4). Pages compose `SettingsSection`s below.
 */
interface Props {
  title: string
  description?: string
  actions?: Snippet
  children: Snippet
}
let { title, description, actions, children }: Props = $props()
</script>

<div class="mx-auto grid w-full max-w-[760px] gap-5">
  <header class="grid gap-3">
    <div class="flex items-start gap-4">
      <div class="min-w-0 flex-1">
        <h1 class="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-[var(--kern-ink-900)]">
          {title}
        </h1>
        {#if description}
          <p class="mt-1 text-[13px] leading-relaxed text-[var(--kern-ink-500)]">{description}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex shrink-0 items-center gap-2 pt-0.5">{@render actions()}</div>
      {/if}
    </div>
    <div class="h-[3px] w-[34px] rounded-[2px] bg-[var(--kern-accent)]"></div>
  </header>

  {@render children()}
</div>
