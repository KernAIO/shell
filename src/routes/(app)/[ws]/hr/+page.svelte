<script lang="ts">
import DirectoryPage from '$lib/modules/hr/DirectoryPage.svelte'

/**
 * Thin on purpose: it renders the module's own component and nothing else, so the same component is
 * what `ClientModule.routes` points at and nothing has to be rewritten when the shell starts
 * mounting module routes itself.
 */
</script>

<DirectoryPage />
