<script lang="ts">
import OfficesPage from '$lib/modules/hr/OfficesPage.svelte'

/**
 * Thin on purpose: it renders the module's own component and nothing else, so the same component is
 * what `ClientModule.routes` points at and nothing has to be rewritten when the shell starts
 * mounting module routes itself.
 */
</script>

<OfficesPage />
