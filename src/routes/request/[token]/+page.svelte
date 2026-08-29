<script lang="ts">
import { IntakePage, trackerClientModule } from '@kernhq/module-tracker/client'
import { registerMessages } from '@kernhq/ui'
import { page } from '$app/state'

/**
 * `/request/:token` — the public intake form.
 *
 * Outside `(app)` on purpose: there is no session, no workspace and no navigation here. The token
 * in the URL is the only thing that identifies the project, which is exactly what makes the link
 * shareable and what makes withdrawing it enough to close the form.
 *
 * It is also outside the app shell, where the module registry registers every module and loads its
 * message bundles — so on this route no bundle ever arrives, and the page renders raw keys. It is a
 * public page, so importing the whole registry (and every module's client with it) just for strings
 * would bloat what a stranger downloads. Load this one module's bundles the way the registry does,
 * scoped to the module this page actually mounts.
 */
for (const [locale, load] of Object.entries(trackerClientModule.messages ?? {})) {
  void load()
    .then((messages) => registerMessages(locale, messages))
    .catch((err) => console.error(`[tracker] could not load ${locale} messages`, err))
}
</script>

<IntakePage token={page.params.token ?? ''} />
