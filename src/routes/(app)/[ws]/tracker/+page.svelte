<script lang="ts">
import IssuesPage from '$lib/modules/tracker/IssuesPage.svelte'

/**
 * `/:workspace/tracker` — the module's own view, mounted by the shell.
 *
 * The route is deliberately thin: the tracker owns its screens under `$lib/modules/tracker`, and the
 * same component is what `ClientModule.routes` points at, so nothing has to be rewritten when the
 * shell starts mounting module routes itself.
 */
</script>

<IssuesPage />
