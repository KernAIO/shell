<script lang="ts">
import SpacesPage from '$lib/modules/quire/SpacesPage.svelte'

/**
 * The route is deliberately thin: it renders the module's own component and nothing else, so the
 * same component is what `ClientModule.routes` points at and nothing has to be rewritten when the
 * shell starts mounting module routes itself.
 */
</script>

<SpacesPage />
