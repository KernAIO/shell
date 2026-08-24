<script lang="ts">
import { page } from '$app/state'
import PageView from '$lib/modules/quire/PageView.svelte'

const spaceKey = $derived(page.params.space ?? '')
const pageId = $derived(page.params.page ?? '')
</script>

{#key pageId}
  <PageView {spaceKey} {pageId} />
{/key}
