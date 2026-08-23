<script lang="ts">
import { Spinner } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { PROJECT_SECTIONS } from '$lib/modules/tracker/nav'

/**
 * `/:workspace/tracker/projects/:key` — a project without a section named.
 *
 * It opens the first one rather than a page of its own: everything a project holds is on the
 * sections, and a landing page that only links to them is a click nobody asked for.
 */
const slug = $derived(page.params.ws ?? '')
const key = $derived(page.params.key ?? '')

$effect(() => {
  void goto(`/${slug}/tracker/projects/${encodeURIComponent(key)}/${PROJECT_SECTIONS[0]}`, {
    replaceState: true,
  })
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
