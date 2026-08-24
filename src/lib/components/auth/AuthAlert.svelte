<script lang="ts">
import { Icon } from '@kernhq/ui'

/** The one place a sign-in page says something went wrong, or that an email is on its way. */
interface Props {
  tone: 'danger' | 'success' | 'info'
  children: import('svelte').Snippet
}
let { tone, children }: Props = $props()

const ICONS = { danger: 'circle-alert', success: 'circle-check', info: 'info' } as const
</script>

<p class="kalert t-{tone}" role={tone === 'danger' ? 'alert' : 'status'}>
  <Icon name={ICONS[tone]} size={15} strokeWidth={1.7} />
  <span>{@render children()}</span>
</p>

<style>
  .kalert {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--kern-r-2xl);
    font-size: 13px;
    line-height: 1.5;
    text-wrap: pretty;
  }
  .kalert :global(svg) { flex: none; margin-top: 1px; }
  .t-danger { background: var(--kern-danger-tint); color: var(--kern-danger); }
  .t-success { background: var(--kern-success-tint); color: var(--kern-success); }
  .t-info { background: var(--kern-accent-tint); color: var(--kern-accent-deep); }
</style>
