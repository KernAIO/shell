<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { isCloudHosted } from '$lib/instance'

/**
 * The console has no page of its own; land on its first row rather than showing an empty shell.
 *
 * Guarded on the hosting because the layout above forwards this whole subtree to
 * `/settings/instance` on a self-hosted instance — two `goto`s racing from one navigation is a
 * coin toss over which URL the person ends on.
 */
$effect(() => {
  if (!isCloudHosted()) return
  void goto(`/${page.params.ws}/admin/settings`, { replaceState: true })
})
</script>
