import { trackerMessageBundles } from '@kernhq/module-tracker/client'
import { loadModuleMessages } from '$lib/modules/messages'

/**
 * Merge the tracker's strings before the form draws, because on this route nothing else will.
 *
 * `$lib/modules/registry` is what normally hands a module's bundles to the framework, and it is
 * imported by `(app)` — which `/request/:token` deliberately is not. So every `t()` inside
 * `IntakePage` fell back to its own key, and the one page in Kern a person with no account ever
 * loads greeted them with `tracker.intake_unavailable` and `tracker.intake_thanks`.
 *
 * Importing the registry here would fix it by dragging all eight module clients into that page, so
 * the bundles are merged directly instead — the same call the registry makes, without the graph.
 *
 * Awaited in `load` rather than called from the component: a late merge re-renders (the runtime's
 * bundles are reactive), but re-rendering means the keys were on screen first, and a stranger
 * reading a form they were sent is exactly who must never see one. The bundles are plain objects
 * already in this chunk, so the wait is a microtask.
 */
export const load = async () => {
  await loadModuleMessages('tracker', trackerMessageBundles)
}
