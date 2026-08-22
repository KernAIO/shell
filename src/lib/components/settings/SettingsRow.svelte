<script lang="ts">
import type { Snippet } from 'svelte'

/**
 * One setting: what it is on the start side, the control on the end side. Stacks on narrow screens so
 * the control never gets squeezed. Rows sit directly on top of each other and draw their own divider.
 */
interface Props {
  label: string
  hint?: string
  /** the control fills the row instead of sitting on the end (long inputs, textareas) */
  wide?: boolean
  for?: string
  first?: boolean
  children: Snippet
}
let { label, hint, wide = false, for: htmlFor, first = false, children }: Props = $props()
</script>

<div
  class="grid gap-x-6 gap-y-2 py-3.5 {first
    ? ''
    : 'border-t border-[var(--kern-border-hairline)]'} {wide
    ? ''
    : 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'}"
>
  <div class="min-w-0">
    <label class="block text-[13px] font-medium text-[var(--kern-ink-800)]" for={htmlFor}>{label}</label>
    {#if hint}
      <p class="mt-0.5 text-[12px] leading-relaxed text-[var(--kern-ink-450)]">{hint}</p>
    {/if}
  </div>
  <div class={wide ? '' : 'sm:justify-self-end'}>{@render children()}</div>
</div>
