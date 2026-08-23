<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'

/** The console has one page so far; land on it rather than showing an empty shell. */
$effect(() => {
  void goto(`/${page.params.ws}/admin/updates`, { replaceState: true })
})
</script>
