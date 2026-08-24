<script lang="ts">
import { instanceName } from '$lib/auth/client'

/**
 * The instance's identity: the Kern logo square and the name the operator chose. Shared by every
 * page a signed-out person sees, so the mark is drawn once rather than pasted into four files.
 */
interface Props {
  size?: 'sm' | 'lg'
  class?: string
}
let { size = 'sm', class: className }: Props = $props()
</script>

<span class="kbrand s-{size} {className ?? ''}">
  <span class="mark" aria-hidden="true">
    <span class="k">K</span>
    <span class="tick"></span>
  </span>
  <span class="name">{instanceName()}</span>
</span>

<style>
  .kbrand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  /* the logo is a drawing, not a sentence: it keeps its own order in an RTL page */
  .mark {
    direction: ltr;
    display: inline-flex; align-items: center; justify-content: center; gap: 3px; flex: none;
    background: var(--kern-ink-900); border-radius: var(--kern-r-2xl);
    width: 36px; height: 36px;
  }
  .k { font-size: 16px; font-weight: 600; line-height: 1; letter-spacing: -0.03em; color: var(--kern-ink-inverse); }
  .tick { width: 2px; height: 14px; border-radius: 1px; background: var(--kern-accent); }
  .name {
    font-size: 15px; font-weight: 600; letter-spacing: -0.015em; color: var(--kern-ink-900);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .s-lg .mark { width: 42px; height: 42px; border-radius: 12px; }
  .s-lg .k { font-size: 19px; }
  .s-lg .tick { height: 17px; }
  .s-lg .name { font-size: 17px; letter-spacing: -0.02em; }
</style>
