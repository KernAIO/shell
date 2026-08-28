<script lang="ts">
import { IntakePage } from '@kernhq/module-tracker/client'
import { page } from '$app/state'

/**
 * `/request/:token` — the public intake form.
 *
 * Outside `(app)` on purpose: there is no session, no workspace and no navigation here. The token
 * in the URL is the only thing that identifies the project, which is exactly what makes the link
 * shareable and what makes withdrawing it enough to close the form.
 *
 * Being outside `(app)` is also why `+page.ts` registers the tracker's strings by hand — see the
 * note there.
 */
</script>

<IntakePage token={page.params.token ?? ''} />
