<script lang="ts">
import { Spinner } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'

/**
 * A permalink to one issue, e.g. `/northstar/tracker/KRN-12`.
 *
 * Notifications, search results and anything pasted into a chat point here. The issue itself is a
 * panel over the list rather than a page, so this hands the key to the list and lets it open the
 * panel; replacing the history entry keeps the back button pointing where the person came from.
 */
const slug = $derived(page.params.ws ?? '')
const key = $derived(page.params.key ?? '')

$effect(() => {
  void goto(`/${slug}/tracker?issue=${encodeURIComponent(key)}`, { replaceState: true })
})
</script>

<div class="wait"><Spinner /></div>

<style>
  .wait {
    display: grid;
    place-items: center;
    flex: 1;
    min-height: 0;
  }
</style>
