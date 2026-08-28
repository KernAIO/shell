import { type Message, registerMessages } from '@kernhq/ui'

/**
 * A module's own strings, keyed by locale — the shape `ClientModule.messages` declares.
 *
 * Named here, in a file that imports no module client, so a route may register one module's bundle
 * without importing `registry.ts` and dragging every module in the product along with it.
 */
export type MessageBundles = Record<string, () => Promise<Record<string, Message>>>

/**
 * Merge one module's strings into the framework's message runtime.
 *
 * The app's catalogues are compiled by Paraglide from `messages/*.json` and cannot see a module that
 * ships separately, so a module carries its bundles and this hands them over. Keys are namespaced by
 * the module that owns them (`tracker.intake_thanks`), so one merged map per locale is
 * collision-free.
 *
 * Every locale the module ships is registered rather than only the one on screen: the bundles are
 * already in the bundle that imported them, and a reader who switches language must not be left on
 * the previous one until something else happens to load it.
 *
 * A bundle that fails to load is logged rather than thrown — the module still works in English,
 * which is a much better outcome than a locale gap taking the app down.
 *
 * Nothing inside `(app)` awaits the result: blocking module registration on a bundle would stall the
 * whole shell for one module's translations, and `registerMessages` writes reactive state, so a
 * screen that has already drawn re-renders when its strings arrive. The promise is returned for the
 * one case that cannot tolerate even that — a route outside the app where a module component *is*
 * the whole page, and the key would be the only thing a stranger sees.
 */
export function loadModuleMessages(id: string, bundles: MessageBundles | undefined) {
  return Promise.all(
    Object.entries(bundles ?? {}).map(([locale, load]) =>
      load()
        .then((messages) => registerMessages(locale, messages))
        .catch((err) => console.error(`[${id}] could not load ${locale} messages`, err)),
    ),
  )
}
