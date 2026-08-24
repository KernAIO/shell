<script lang="ts">
import { Icon, Input, Label } from '@kernhq/ui'
import type { Snippet } from 'svelte'
import * as m from '$msg'

/**
 * A password box that can be read back, and — when it is a password being *chosen* — says how good
 * it is while it is typed rather than after the server rejects it.
 */
interface Props {
  id: string
  label: string
  value: string
  autocomplete: 'current-password' | 'new-password'
  /** show the strength meter and the minimum-length hint */
  meter?: boolean
  error?: string | null
  autofocus?: boolean
  /** rendered at the end of the label row — a "Forgot password?" link, typically */
  aside?: Snippet
}
let {
  id,
  label,
  value = $bindable(''),
  autocomplete,
  meter = false,
  error = null,
  autofocus = false,
  aside,
}: Props = $props()

/** The server's floor. Kept in step with `emailAndPassword.minPasswordLength` in core. */
const MIN = 8
let revealed = $state(false)

/**
 * Four things worth doing to a password, scored equally. This is a hint, not a gate: the only rule
 * the server enforces is the length, and saying otherwise on the way in would be a lie.
 */
const score = $derived(
  [
    value.length >= MIN,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z0-9]/.test(value),
    /[^\w]/.test(value),
  ].filter(Boolean).length,
)
const strength = $derived(score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong')
const strengthLabel = $derived(
  {
    weak: m.auth_password_weak(),
    fair: m.auth_password_fair(),
    good: m.auth_password_good(),
    strong: m.auth_password_strong(),
  }[strength],
)
</script>

<div class="kpw">
  <div class="lbl">
    <Label for={id}>{label}</Label>
    {#if aside}{@render aside()}{/if}
  </div>

  <div class="box">
    <Input
      {id}
      type={revealed ? 'text' : 'password'}
      bind:value
      {autocomplete}
      {autofocus}
      required
      minlength={MIN}
      {error}
    />
    <button
      type="button"
      class="peek"
      onclick={() => (revealed = !revealed)}
      aria-label={revealed ? m.auth_password_hide() : m.auth_password_show()}
      aria-pressed={revealed}
    >
      <Icon name={revealed ? 'eye-off' : 'eye'} size={15} strokeWidth={1.6} />
    </button>
  </div>

  {#if meter}
    <div class="meter">
      <div class="bars" aria-hidden="true">
        {#each [1, 2, 3, 4] as step (step)}
          <span class="bar" class:on={value.length > 0 && score >= step} data-s={strength}></span>
        {/each}
      </div>
      <p class="hint">
        {#if value.length === 0}
          {m.auth_password_min({ count: MIN })}
        {:else if value.length < MIN}
          {m.auth_password_too_short({ count: MIN })}
        {:else}
          {strengthLabel}
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .kpw { display: grid; gap: 6px; }
  /* label at the start, an optional link at the end — logical, so it flips in RTL */
  .lbl { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12.5px; }
  .box { position: relative; }
  .box :global(.kin) { padding-inline-end: 38px; }
  .peek {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--kern-ink-350);
    border-radius: var(--kern-r-lg);
  }
  .peek:hover { color: var(--kern-ink-700); }
  .peek:focus-visible { outline: 2px solid var(--kern-accent); outline-offset: -2px; }

  .meter { display: grid; gap: 5px; }
  .bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .bar { height: 3px; border-radius: var(--kern-r-full); background: var(--kern-surface-active); }
  .bar.on[data-s='weak'] { background: var(--kern-danger); }
  .bar.on[data-s='fair'] { background: var(--kern-warning); }
  .bar.on[data-s='good'] { background: var(--kern-accent); }
  .bar.on[data-s='strong'] { background: var(--kern-success-chip); }
  .hint { margin: 0; font-size: 12px; color: var(--kern-ink-350); }
</style>
