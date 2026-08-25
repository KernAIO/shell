<script lang="ts">
import LeavePage from '$lib/modules/hr/LeavePage.svelte'

/**
 * Thin on purpose: it renders the module's own component and nothing else, so the same component is
 * what `ClientModule.routes` points at and nothing has to be rewritten when the shell starts
 * mounting module routes itself.
 */
</script>

<LeavePage />
