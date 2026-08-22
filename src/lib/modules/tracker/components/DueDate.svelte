<script lang="ts">
import { daysUntil, dueTone } from '@kernhq/module-tracker/client'
import { getLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'

/**
 * A due date as the list and the board show it (DESIGN.md 3.0): anything due today, tomorrow or
 * already late is drawn in danger red, everything else stays quiet.
 */
interface Props {
  date: string
  class?: string
}
let { date, class: className = '' }: Props = $props()

const days = $derived(daysUntil(date))
const tone = $derived(dueTone(date))
const text = $derived.by(() => {
  if (days === 0) return m.tracker_due_today()
  if (days === 1) return m.tracker_due_tomorrow()
  const [y, mo, d] = date.split('-').map(Number)
  const local = new Date(y ?? 1970, (mo ?? 1) - 1, d ?? 1)
  const opts: Intl.DateTimeFormatOptions =
    local.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat(getLocale(), opts).format(local)
})
</script>

<time datetime={date} class="kdue {tone} {className}" title={days < 0 ? m.tracker_due_overdue() : undefined}>
  {text}
</time>

<style>
  .kdue {
    font-size: 12.5px;
    white-space: nowrap;
    color: var(--kern-ink-350);
  }
  .kdue.hot {
    color: var(--kern-danger);
  }
</style>
