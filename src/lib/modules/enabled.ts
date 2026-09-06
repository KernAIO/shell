/** The two fields of a `workspaces.modules.list` entry this needs. */
export type ModuleListEntry = { manifest: { id: string }; state: { enabled: boolean } }

/**
 * Which of the modules this shell ships are on for a workspace.
 *
 * In its own file for the same reason `overlays.ts` is: nothing can import `registry.ts` from a
 * test, because it pulls in every module's client and vitest fails transforming those before an
 * assertion runs. `registry.ts` wraps this with the ids it has registered.
 *
 * **`core` cannot answer this question alone, and reading its answer as complete hid two shipped
 * modules from every instance.** `workspaces.modules.list` returns the manifests of the modules the
 * *core process* hosts — `kernel.manifests()`, which is core, tracker, quire, hr, billing and
 * inventory — plus any module that already has a `workspace_modules` row. `chat`, `mail` and
 * `collab` run in their own services, so core holds no manifest for them, and the only thing that
 * ever writes a row is an administrator toggling the module in Settings → Modules, a screen fed by
 * this same list. They were therefore absent from the list, absent from the rail, and absent from
 * the one screen that could have switched them on: a module nobody could reach and nobody could
 * enable, on every instance including Kern Cloud.
 *
 * Nothing caught it, because the mock's `moduleManifests` *does* include `chat` — so `pnpm dev` and
 * `ux.spec.ts` both rendered a Chat rail item that no real instance has ever shown. That is the trap
 * the umbrella's CLAUDE.md already records: a mock modelling something the server cannot produce
 * certifies a screen nobody can reach.
 *
 * The rule below is core's own default, applied to the modules core does not host: **an absent row
 * means enabled.** `list()` computes `enabled: s?.enabled ?? true` for its own manifests, and a
 * module an administrator has actually switched off *does* have a row — which `list()` returns even
 * for a module it cannot see. So "not mentioned at all" can only mean "nobody has ever expressed an
 * opinion about this", and the honest answer to that is the one every other module already gets.
 */
export function selectEnabled(
  moduleIds: readonly string[],
  entries: readonly ModuleListEntry[] | undefined,
): Set<string> {
  const reported = new Map((entries ?? []).map((e) => [e.manifest.id, e.state.enabled]))
  return new Set(moduleIds.filter((id) => reported.get(id) ?? true))
}
