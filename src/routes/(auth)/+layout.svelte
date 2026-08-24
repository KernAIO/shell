<script lang="ts">
import { Icon } from '@kernhq/ui'
import BrandMark from '$lib/components/auth/BrandMark.svelte'
import PrefsControls from '$lib/components/auth/PrefsControls.svelte'
import * as m from '$msg'

let { children } = $props()

const POINTS = $derived([
  { icon: 'layout-grid', label: m.auth_brand_point_modules() },
  { icon: 'shield-check', label: m.auth_brand_point_selfhost() },
  { icon: 'code', label: m.auth_brand_point_open() },
])
</script>

<div class="auth">
  <aside class="brand">
    <BrandMark size="lg" />

    <div class="pitch">
      <h2>{m.auth_brand_headline()}</h2>
      <p>{m.auth_brand_body()}</p>
      <ul>
        {#each POINTS as point (point.icon)}
          <li>
            <span class="tick"><Icon name={point.icon} size={14} strokeWidth={1.7} /></span>
            {point.label}
          </li>
        {/each}
      </ul>
    </div>

    <PrefsControls />
  </aside>

  <main class="pane">
    <div class="form">
      <div class="form-brand"><BrandMark /></div>
      {@render children()}
    </div>
    <div class="pane-prefs"><PrefsControls /></div>
  </main>
</div>

<style>
  .auth { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100dvh; background: var(--kern-surface); }

  /* ---- brand panel ---- */
  .brand {
    display: none;
    flex-direction: column;
    justify-content: space-between;
    gap: 40px;
    padding: 40px;
    background: var(--kern-shell);
    border-inline-end: 1px solid var(--kern-border);
    position: relative;
    overflow: hidden;
  }
  /* paper grain: a dot grid at the border colour, plus one soft accent wash behind the headline */
  .brand::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(60% 45% at 12% 30%, var(--kern-accent-tint) 0%, transparent 70%),
      radial-gradient(var(--kern-border) 1px, transparent 0) 0 0 / 22px 22px;
    opacity: 0.6;
    pointer-events: none;
  }
  .brand > :global(*) { position: relative; }

  .pitch { max-width: 34ch; }
  .pitch h2 {
    margin: 0;
    font-size: 25px;
    font-weight: 600;
    line-height: 1.18;
    letter-spacing: -0.025em;
    color: var(--kern-ink-900);
    text-wrap: pretty;
  }
  .pitch p {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--kern-ink-500);
    text-wrap: pretty;
  }
  .pitch ul { list-style: none; margin: 24px 0 0; padding: 0; display: grid; gap: 11px; }
  .pitch li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    color: var(--kern-ink-600);
  }
  .tick {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    border: 1px solid var(--kern-border);
    color: var(--kern-accent);
  }

  /* ---- form panel ---- */
  .pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 32px 24px 24px;
  }
  .form { width: 100%; max-width: 400px; }
  .form-brand { display: flex; justify-content: center; margin-bottom: 26px; }
  .pane-prefs { display: flex; justify-content: center; }

  @media (min-width: 940px) {
    .auth { grid-template-columns: minmax(360px, 44%) minmax(0, 1fr); }
    .brand { display: flex; }
    .form-brand,
    .pane-prefs { display: none; }
    .pane { padding: 48px; justify-content: center; }
  }
</style>
