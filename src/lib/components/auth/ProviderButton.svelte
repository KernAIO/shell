<script lang="ts">
import * as m from '$msg'

/**
 * "Continue with Google" and friends. The brand marks are drawn inline rather than pulled from the
 * icon registry: they are trademarks in their own colours, not part of the ink/paper icon set, and
 * a signed-out page has to work with no network beyond this instance.
 */
export type Provider = 'google' | 'github' | 'microsoft'

interface Props {
  provider: Provider
  disabled?: boolean
  onclick: () => void
}
let { provider, disabled = false, onclick }: Props = $props()

const NAMES: Record<Provider, string> = { google: 'Google', github: 'GitHub', microsoft: 'Microsoft' }
</script>

<button type="button" class="kprov" {disabled} {onclick}>
  <span class="glyph" aria-hidden="true">
    {#if provider === 'google'}
      <svg viewBox="0 0 18 18" width="16" height="16">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
    {:else if provider === 'github'}
      <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z" />
      </svg>
    {:else}
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path fill="#F25022" d="M0 0h7.6v7.6H0z" />
        <path fill="#7FBA00" d="M8.4 0H16v7.6H8.4z" />
        <path fill="#00A4EF" d="M0 8.4h7.6V16H0z" />
        <path fill="#FFB900" d="M8.4 8.4H16V16H8.4z" />
      </svg>
    {/if}
  </span>
  {m.auth_continue_with({ provider: NAMES[provider] })}
</button>

<style>
  .kprov {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    color: var(--kern-ink-650);
    font-size: 13.5px;
    font-weight: 500;
    transition: background-color var(--kern-dur-fast);
  }
  .kprov:hover:not(:disabled) { background: var(--kern-surface-hover); }
  .kprov:disabled { opacity: 0.5; cursor: not-allowed; }
  .kprov:focus-visible { outline: none; border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  .glyph { display: inline-grid; place-items: center; flex: none; }
</style>
