<script lang="ts">
import { page } from '$app/state'
import SpacePage from '$lib/modules/quire/SpacePage.svelte'

const spaceKey = $derived(page.params.space ?? '')
</script>

<SpacePage {spaceKey} />
