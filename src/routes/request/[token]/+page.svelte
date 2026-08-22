<script lang="ts">
import { page } from '$app/state'
import IntakePage from '$lib/modules/tracker/IntakePage.svelte'

/**
 * `/request/:token` — the public intake form.
 *
 * Outside `(app)` on purpose: there is no session, no workspace and no navigation here. The token
 * in the URL is the only thing that identifies the project, which is exactly what makes the link
 * shareable and what makes withdrawing it enough to close the form.
 */
</script>

<IntakePage token={page.params.token ?? ''} />
