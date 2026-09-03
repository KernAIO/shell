# CLAUDE.md — Kern project rules

Rules for anyone (human or AI agent) working on Kern repositories. These apply to every repo in the KernAIO org.

## We build in the open
The repositories are **public**, so every commit is visible the moment it is pushed:
- Never commit secrets, tokens, personal data, or machine-specific paths. Use `.env` (gitignored) + `.env.example`.
- Write READMEs, docs, and issue/PR text for external contributors, not for ourselves.
- Keep commit history clean and meaningful — it is part of what people judge the project by.
- Every repo carries LICENSE, CLA.md, CODE_OF_CONDUCT.md, SECURITY.md, CONTRIBUTING.md.
- **Two licences, split at the framework boundary.** The `kernel` repo and `modules`'
  `_template` + `workflow` are **Apache-2.0** so anyone can write a closed module; the product —
  `shell`, `core`, `chat`, `mail`, `collab`, `docs`, this umbrella, the first-party modules — is
  **AGPL-3.0-only**. A new package inherits its repo's licence unless it is something a third-party
  module must import, and then it is Apache-2.0 with its own LICENSE file. Apache-2.0 packages take
  only permissive dependencies. If a module author has to import an AGPL package to get something
  done, move the API — never the licence. See `LICENSING.md` and
  `docs/adr/0005-licensing-and-the-module-boundary.md`.

## Git
- Author identity: `Navid Mirzaaghazadeh <mirzaaghazadeh@icloud.com>` (already set in each repo's local git config — plain `git commit` is correct; do not override with `-c`).
- **Do not add `Claude-Session:`, `Co-Authored-By: Claude`, "Generated with", or any AI trailer/branding to commit messages, PRs, or code comments.**
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with optional scope). Imperative mood, ≤ 72-char subject.
- Push to `origin main`. Never force-push. If `git pull --rebase` complains about unstaged files that aren't yours (parallel agents share worktrees), use `git -c rebase.autoStash=true pull --rebase`.
- **Never `git add -A` or `git add .`. Stage the paths you changed, by name.** Several agents share
  these checkouts, and another one is very often part-way through a new package in the same repo.
  `git add -A` sweeps their half-finished files into your commit and pushes them — under your commit
  message, without their lockfile entry, so CI fails at install for everyone. It happened on
  2026-08-24: a contact-address fix carried two unfinished modules into `main`. Run
  `git status --porcelain` first and stage from it; if you cannot name every path you are about to
  commit, you are not ready to commit. When it does happen, do not revert the other agent's files —
  they are still working on them; tell them instead, and repair what you broke.

## Layout & workflow
- Umbrella dev workspace: `app/` with sibling repos cloned under `app/repos/<name>` (gitignored there). pnpm links all `@kernhq/*` packages via the umbrella workspace.
- Install dependencies ONLY via `app/scripts/pnpm-install-locked.sh` (serialises pnpm at the umbrella root).
- Node 24 (`nvm use 24`), pnpm 10, TypeScript ~5.9, ESM/NodeNext, Biome for lint+format (run `pnpm exec biome check --write <paths>` before committing), Vitest.
- Contracts first: changes to `@kernhq/contracts` / module contracts land (and build) before their consumers.
- Modules own their data: Postgres schema `mod_<id>`, `workspace_id` + RLS on every tenant table, cross-module access only via `kernel.call()` and events. See `modules` repo `packages/_template`.
- Ports: shell 5173 · core 4000 · chat 4100 · mail 4200 · collab 4300 · docs 4400.
- Dev DB on this machine: Homebrew Postgres 18 at `localhost:5432` (`kern`/`kern`); the compose Postgres listens on `${KERN_PG_PORT:-5432}` (5433 here).

## CI
Every service repository's CI runs the real suites, so the workflow starts the infrastructure they
need as service containers: Postgres (`pgvector/pgvector:pg18`) everywhere, Valkey for `chat`,
Mailpit for `mail`. Things learned the hard way:
- Address a service container as **127.0.0.1**, never `localhost` — a runner resolves `localhost` to
  `::1` first, where the published port is not listening, and `fetch` does not retry over IPv4.
- Do not set `registry-url` on `actions/setup-node` in an install job. It writes an `.npmrc` with a
  placeholder token, and npm answers a bad token with **404**, so public packages appear to vanish.
- A repository is built **standalone** in CI. `workspace:*` only resolves inside the umbrella
  workspace; depend on the published version instead.
- **Each repository's own `pnpm-lock.yaml` is what CI installs from, and you cannot refresh it from
  inside the umbrella.** Add a dependency to a package and the umbrella install updates the *umbrella*
  lockfile, leaving the repo's committed one stale — CI then fails every job at
  `ERR_PNPM_OUTDATED_LOCKFILE`, install-time, before a single test runs. Plain `pnpm install` in
  `repos/<name>` walks up and attaches to the umbrella; `--ignore-workspace` skips `packages/*` and
  cheerfully reports nothing to do. Clone the repo somewhere outside the workspace and run
  `pnpm install --lockfile-only` there, then copy the lockfile back.
- Skipping a test because its infrastructure is missing is fine on a laptop and dishonest in CI.
  Fail when `process.env.CI` is set.

## Writing
Documentation — READMEs, guides, runbooks, `docs/`, and any procedure someone follows — uses the
`adhd-friendly-ste-technical-writer` skill in `.claude/skills/`: goal first, one action per step,
short sentences, conditions before commands, an observable result after every important action.
It is a house style inspired by ASD-STE100, not certified compliance — do not claim otherwise.
It governs documents for readers. Code comments and commit messages keep the voice they have.

## Quality bar
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass before pushing.
- UI follows `shell/DESIGN.md` (Ink/paper design system) and must work in RTL (fa/ar) and dark mode.
- All user-facing strings go through i18n (Paraglide) — no hardcoded English in components.

## Keeping this file current
This file is how the next person — or the next agent — avoids repeating what we already worked out.
When you learn something durable, add it here **in the same commit as the change that taught you**:
- a trap that cost you time (a silent failure, a misleading error, a tool that lies about success)
- a convention you had to infer from reading several files
- a decision and the reason behind it, especially where the obvious choice is wrong
Keep it specific and short. Delete anything that stops being true — a stale note is worse than none.

---

# This repository: shell (the web client)

The SvelteKit PWA every module renders into. `pnpm dev:mock` runs the whole interface against an
in-memory API with demo data — no backend, no database.

**This repository holds the shell, not the modules.** As of 2026-08-25 every module's screens,
strings and manifest live in its own package (`repos/modules/packages/<id>/src/client`) and the app
mounts whatever they declare — `src/lib/modules/` is a registry, a router and `core`, which *is* the
shell. Editing a module's interface means editing that package, and `readlink node_modules/@kernhq/module-<id>`
tells you whether this checkout is even reading your copy. See `docs/adr/0008-a-module-ships-its-own-screens.md`.

**Things worth knowing**
- **`DESIGN.md` is the authority.** It is derived from the product's own design file: exact tokens,
  sizes and per-view anatomy. Match it rather than inventing.
- Use the tokens that exist. `--kern-paper`, `--kern-hover` and friends were invented once and silently
  resolved to nothing; the real names are in `@kernhq/ui/styles/tokens.css`.
- The design system's base styles sit in `@layer base` so a Tailwind utility can override them.
  Unlayered CSS beats layered CSS, so an unlayered `a { color }` silently wins over `class="text-…"`.
- Check a component's actual props before using it — several differ from the obvious guess (`Field`
  takes `id` and passes it to its children snippet; `Tabs` items use `value`, not `id`; `Card` is a
  block, so wrap flex layouts in your own element).
- **Uploads go through `$lib/files/upload.ts` — there is exactly one uploader.** Ask core for a
  ticket, PUT the bytes straight to storage, then tell core the file is `ready`. Skipping the third
  step leaves the file `pending` and invisible for ever. In mock mode the ticket URL is
  `mock-upload://` and the bytes live in memory; that branch is the only thing in the app that knows
  the mock exists.
- **Kill stale dev servers before debugging.** A second process on :5173 served old code twice in one
  day and made correct fixes look broken. `lsof -ti:5173` should print exactly one pid.
- **Using a module API you just added means bumping the dependency in the same change.** The
  workspace links `@kernhq/module-*` from `repos/`, so a new store method works locally and the app's
  CI — which installs the published version — fails on it. Publish the module, then raise the range
  here. This is the "contracts first" rule, and it bites in exactly this order.
- **An `$effect` that calls something which writes state it also reads re-runs itself.** Chat's page
  effect called `openChannel`, which writes the transcript window; reading that window made the
  effect its own trigger. It was not just wasteful — leaving a channel deleted the window, the effect
  fired again with the old id still in the URL, and the channel you had just left came back. Wrap the
  call in `untrack`, and let the effect depend only on what genuinely selects it.
- **A control with no handler is a bug, not a placeholder.** Chat shipped with four composer buttons,
  a pin button and a search box that all did nothing. Before calling a screen done, grep it for
  `IconButton`/`Button` without an `onclick`, and for `() => {}` callbacks. If something genuinely is
  not built, say so in the interface — disable it with a reason — rather than leaving it inert.
- **`icon="…"` is not checked by the compiler.** An unregistered name renders a blank square and
  fails silently, and lucide renames icons between releases (`alert-triangle` became
  `triangle-alert`). `pnpm lint` now runs `scripts/check-icons.mjs` over every `icon=`/`<Icon name=`
  in `src`, so this class of bug cannot come back.
- **`svelte-dnd-action` tracks items by an `id` property and nothing else.** A list keyed by
  anything else (`fieldId`, `key`) renders fine and refuses to move — by mouse and by keyboard, with
  no error. Map to `{...item, id: item.whatever}` before handing it to the zone. And offer a
  non-drag route to the same result: a drag is unreachable by keyboard.
- **An effect that reads a flag it also clears re-runs when the flag clears.** The layout editor's
  seeding effect read `dragging`; setting `dragging = false` at the end of a drop re-ran it and
  re-seeded the zones from the server, undoing the move on screen while the change was still
  pending. Read the guard through `untrack`.
- **A `$state` array is a deep proxy, and a proxy cannot be `structuredClone`d.** Passing one
  straight into a mutation fails in `dev:mock` (and posts a proxy anywhere else). Send
  `$state.snapshot(value)`.
- **`pnpm build` compiles the messages first, and it did not always.** A key added to
  `messages/*.json` reached a build only if somebody happened to run `typecheck` (which runs
  `i18n`); otherwise the built app called a message function that did not exist — a runtime failure
  with a green build. `build` now runs `i18n` itself.
- **`scripts/check-icons.mjs` only sees this repository.** A module's server picks icon names too —
  work item types, built-in views — and those reach `<Icon>` through data rather than through source
  the check can read. `bug` and `git-branch` were named by the tracker's templates and missing from
  the registry for exactly that reason.
- **`Button` renders `type="button"`.** A `<form>`'s submit therefore depends on how its props
  happen to spread; give the button its own `onclick` rather than relying on that.
- **A `<T,>` generic does not survive the Svelte formatter.** Biome rewrites it and then disagrees
  with itself, so `pnpm lint` never settles. Use a `function` declaration, whose generic is
  unambiguous, or move the helper to a `.ts` file.
- **A `.ts` module that imports `$msg` cannot be unit-tested.** SvelteKit applies the aliases from
  `svelte.config.js` through its own plugin, which vitest does not run, so the import fails before
  a single assertion. Declaring the alias under `test.alias` or `resolve.alias` did not fix it.
  Where the logic is worth testing — a sentence built from a rule, a duration parsed from what
  somebody typed — take the wording as a parameter and let the component pass `m.*` in.
- **The message renderer's classes need styling by the consumer.** `renderDocToHtml` emits
  `.kern-chat-mention`, `.kern-chat-link`, `.kern-chat-code` and `.kern-chat-pre`; without CSS for
  them a mention reads as plain text.
- **The sidebar belongs to the module you are in** (DESIGN.md 2.3). A module fills it by contributing
  a `sidebar.widget` slot, which the shell renders under the nav groups — that is how chat puts its
  conversations there instead of adding a third column. Slots are the only way a module reaches into
  a part of the shell it does not own.
- A module whose state is shared between the sidebar and the content area holds it in one place keyed
  by workspace (chat's `store-instance.svelte.ts`), never a module-level singleton: a transcript must not
  survive into another workspace.
- Query keys are `[module, entity, …scope]` so a realtime `change` event invalidates precisely what it
  touched. Keep new queries in that shape.
- **A module settings page's `id` is its URL, and declaring it is the whole wiring.** The shell
  mounts a workspace-scope page at `/<ws>/settings/<moduleId>/<pageId>`, and one whose `id` equals
  the module id at `/<ws>/settings/<moduleId>`; instance pages mount under `/<ws>/admin/`. There is
  no route file to keep in step — that mismatch used to render a nav entry that 404s, which is what
  `mail` shipped with for months.
- **Settings is a section, so its list is the shell's sidebar — not a column inside the page.**
  `SettingsNav` renders where a module's sidebar would (`(app)/[ws]/+layout.svelte`), and
  `settings/+layout.svelte` is only the scroll container for the page. It used to be a second
  navigation column beside the workspace one: two sets of rows at once, the page starting 268px in,
  and a sidebar whose search box and inbox row all lead *out* of settings. Anything that wants a
  list beside the content belongs in the sidebar for its segment.
- **A module's screens are only reachable if the module is in the mock too.** `dev:mock` decides the
  nav from `enabledFor()` and `moduleManifests` in `src/lib/api/mock.ts`; a module missing from
  either has a working page and no way to reach it, in exactly the environment used for demos.
- Every user-facing string goes through Paraglide (`messages/*.json`), and the layout must survive
  `dir="rtl"` — use logical properties, never `left`/`right`.
- **The module clients ship Svelte source, so they must be in `optimizeDeps.exclude`.**
  `@kernhq/module-*`'s `./client` export points at `src/client/index.ts`. Vite's pre-bundler hands
  `store.svelte.ts` to Svelte's *module* compiler, which does not strip TypeScript, and the whole
  optimise step dies on the first `import type` — leaving a 500 that looks nothing like its cause.
  A warm `node_modules/.vite` hides it, so it only appears on a cold start or after a forced
  re-optimisation.
- **Two Vite servers on one checkout share `node_modules/.vite` and corrupt each other's cache.**
  One dead server therefore breaks the live one. `lsof -ti:5173` should print exactly one pid; if you
  need a second server, expect to `rm -rf node_modules/.vite` afterwards.
- **A shell-derived name and a page-set one will fight unless you record which is which.** The tab
  strip derives a tab's label from its href, and a page refines it (`Chat` → `eng-core`). Reapplying
  the derived name on every navigation silently undid the page's — hence `WorkTab.named`. Any label
  with two sources needs the same flag.
- Tab-strip shortcuts are ⌥-based (⌥T, ⌥W, ⌥1-9, ⌥[ / ⌥]). ⌘T/⌘W/⌘1 are reserved by the browser and
  never reach the page. Match on `e.code`, not `e.key`: ⌥T on a Mac keyboard types `†`.
- **A Latin-only font in an RTL screen is not a fallback, it is a bug.** DM Mono has no Arabic glyphs,
  so every timestamp, count and section label fell through to a system monospace — which draws
  Persian in isolated forms, and "فضای کاری" rendered as unjoined letters spaced like code. Under
  `[dir="rtl"]` the mono token now resolves to the sans stack. Before reaching for a Persian
  monospace: there is no good one, and the metadata voice is size, weight and colour, not the face.
- **A token override must sit where the token was defined.** `:root` in `tokens.css` is unlayered, and
  an unlayered normal declaration beats one inside `@layer base` regardless of specificity — an
  override written in the base layer looks right and does nothing.
- **Numbers shown to people go through `Intl`, counts included.** `formatCount` in `$lib/format.ts`
  gives a badge Persian digits and caps it at "99+"; interpolating a raw number leaves the one
  untranslated thing on a Persian screen.
- **A toggle that changes what a query asks for must be in the query key.** `includeArchived` on the
  fields and types settings pages is the case: with the key unchanged TanStack serves the cached
  list, so the switch does nothing until something else happens to invalidate it — which is
  indistinguishable from the toggle being broken, and only ever reproduces on a warm cache.
- **Before adding a handler to a module's `mock.ts`, grep it.** Whether the *app* calls a
  procedure and whether the *mock* implements one are different questions; answering the first and
  acting on the second produces a duplicate object key, which svelte-check catches but only after
  the work is done.
- **`Select`, `Checkbox` and the other `@kernhq/ui` inputs take no `data-testid`** — their props are
  a closed list, not a spread. Wrap them in a `<span data-testid=…>` when a test needs a handle.
- **`Badge` takes `tone`, not `variant`.** `variant` is its shape (`chip`/`count`/`dot`); the colour
  is `tone`, and the set includes `active`, `done` and `upcoming`, which is exactly a cycle's status.
- **A date range is `Intl.DateTimeFormat.formatRange`, not two dates and a dash.** A hand-built range
  reads backwards under `dir="rtl"` — the earliest date ends up on the right of the latest — and
  `formatRange` collapses the parts the two dates share for free.
- **`@kernhq/ui` is consumed from `dist`, so editing its `src` changes nothing here** until
  `pnpm --filter @kernhq/ui build` runs — the opposite of a module's `./client`, which ships source
  and is live once linked. A browser stack trace names the file it actually loaded; read that path
  before concluding the fix did not work.
- **Time-zone cities are translated, and `Intl` cannot do it.** `Intl` localises a zone's *name*
  ("Nordamerikanische Ostküsten-Sommerzeit") but never its city, so the cities come from CLDR,
  generated per locale into `src/lib/i18n/timezone-cities/` by `scripts/gen-timezone-cities.mjs`.
  A file only carries the zones whose city differs from the zone id — `timezoneCity()` falls back to
  the id's own last segment — which is why English is fifty entries and Persian is every one.
  Re-run the script when a locale is added.
- **The app's own icons come from `pnpm icons` (`scripts/gen-icons.mjs`), not from a design export.**
  Output lands in `static/` and is committed, so no build needs sharp. The "K" is a path taken from
  Instrument Sans, never a `<text>` element: a rasteriser without the font falls back to Helvetica
  and draws a different letter, silently. The maskable and apple-touch variants are full-bleed —
  iOS and Android apply their own mask, and transparent corners under it show as a pale halo.
- **`<link rel="manifest">` belongs in `app.html` with `%sveltekit.assets%`, not in a layout.**
  `+layout.ts` sets `ssr = false`, so anything in `<svelte:head>` only appears after hydration; and
  `pwaInfo.webManifest.linkTag` from vite-plugin-pwa carries a `./manifest.webmanifest` href, which
  resolves against the current directory and 404s on every route deeper than one segment.
  `%sveltekit.assets%` is recomputed per request, so it is right at any depth. vite-plugin-pwa only
  writes that file in a build, so `vite.config.ts` serves the same manifest object in dev.
- **`scripts/check-icons.mjs` reads `icon="…"`, `icon: '…'` and any `const *ICONS = [...]`.** A name
  reaching `<Icon>` through some other variable is unchecked, and an unregistered name renders as a
  blank square and throws nothing. If you build a picker, name its list `…ICONS`.
- **Never `git checkout` a file in this worktree.** Parallel agents share it, and `git checkout
  <file>` overwrites the working copy from the index — which for a file somebody else is editing
  discards work that was never committed and cannot be got back. Undoing a deliberate edit of your
  own means `cp` from a copy you made first. One `git checkout messages/fa.json`, to revert a
  two-line test edit, destroyed 212 uncommitted Persian translations; 72 came back out of dangling
  objects (`git fsck --unreachable`) and the other 140 had to be written again.
- **`vite preview` serves the build it started with.** After a rebuild the old process keeps
  answering from the output it loaded, so a fix that is in `build/` looks like it did nothing —
  and `pkill -f "vite preview --port 4173"` does not match, because the process name is
  `vite.js preview`. Kill it by port (`kill $(lsof -ti:4173)`) and start it again.
- **A name a test types must not exist in the mock's seed data.** Seeding a component called
  "Realtime gateway" — which `tracker.spec.ts` creates by hand — turned one assertion into a strict
  mode violation with two matches. Grep `tests/e2e` for a name before seeding it.
- **`node scripts/check-i18n.mjs` before saying a screen is done.** It is in `pnpm lint`, and it is
  the only thing that sees a locale gap: Paraglide compiles a missing key to a silent English alias,
  so nothing else — not the compiler, not the build, not a test — ever notices.
- **`session.can()` answers `true` for an owner and for an instance admin before it looks at the
  permission at all**, and the mock's signed-in user is both. So a permission-gated branch cannot be
  reached in `dev:mock` by editing the permission list — removing the key from `myPermissions`
  changes nothing, twice over. **Both have to go together**: `me` must return
  `instanceAdmin: false` *and* `myPermissions` a role other than `owner`, or `can()` short-circuits
  before the permission set is read and you are still looking at the owner's screen. That is what
  `localStorage['kern.mock.role'] = 'member'` does — set it (with
  `page.addInitScript`, before the app loads) and the mock gives up both.
  `localStorage['kern.mock.suspended'] = '1'` is its neighbour: it makes every mock write fail the
  way a lapsed subscription does. `tests/e2e/billing-suspended.spec.ts` uses both.
  Worth knowing before concluding that a gate does not work — the likelier reading is that you have
  never rendered the branch you are looking for, and **every** permission-gated branch in this app
  has that problem until somebody flips both switches.
- **A refusal that can arrive from any mutation belongs on the mutation cache, not at call sites.**
  The kernel refuses *every* non-GET workspace-scoped procedure while a subscription is not current,
  so wiring `billing.subscription.inactive` per screen would mean remembering it at each of two
  dozen mutations and every one added later — and the forgotten ones are the ones a customer meets.
  `installSuspensionToast` sets `queryClient.getMutationCache().config.onError`, which is public,
  writable, and runs **before** the mutation's own `onError`; every other handler then calls
  `toastMutationError`, which stands down for that one reason. Both halves are needed: the global
  hook alone double-toasts with the per-site handler that follows it. A plan limit is the opposite
  case and stays at its call site — a ceiling belongs to the screen that reached it.
- **A module component mounted outside `(app)` has no strings, for ever.** `$lib/modules/registry`
  is the only thing that calls `registerMessages`, and it is imported by the app routes — so
  `/request/:token`, which mounts tracker's `IntakePage` with no session, rendered
  `tracker.intake_unavailable` and `tracker.intake_thanks` as raw keys on the one screen a stranger
  ever sees. Nothing arrives later to fix it. Such a route merges the bundle itself, in `+page.ts`
  via `loadModuleMessages` — importing the registry instead would drag all eight module clients into
  a page loaded by people with no account.
- **A green `check-ranges` on a warm npm cache is not evidence.** It asks the registry what is
  published, and `npm view` will happily serve metadata hours old: on 2026-08-28 it reported only
  one stale range and passed the rest, three hours after `@kernhq/kernel@0.8.0` and
  `@kernhq/ui@0.13.0` were published. CI runs cold and saw all three. Re-run it before believing it,
  and expect the answer to move under you while you work — the framework is published from these
  same repositories all day.
- **A counted message is a variant message, not a string with `{count}` in it.** The plugin's shape
  is a one-element array carrying `declarations`, `selectors` and `match`; `local n = count: number`
  is what puts the number through `Intl`, which is the only reason a Persian screen reads «۱۱ کار»
  and not "11 کار". When no branch matches the count, Paraglide returns **the message key**, so a
  short variant map puts `tracker_issues_count` on the screen — worse than falling back to English,
  and invisible at n=1. `check-i18n.mjs` compares each variant against
  `Intl.PluralRules(locale).pluralCategories`; Persian needs `one` *and* `other` even though both
  read the same, and Arabic needs all six.
- **Message JSON written by a script must be biome-formatted before it is committed.** Biome
  collapses short arrays onto one line and `json.dumps` does not, so a catalogue edited by a script
  passes every i18n check and fails `pnpm lint` on formatting alone. Run
  `pnpm exec biome format --write messages/` after any script that writes them.
- **`{#await load()}` in a template makes a new promise on every render.** The dashboard called
  `entry.component()` inside its await block, so every state change — focusing a grip was enough —
  unmounted and remounted every widget body on the board, blanking their data while each one
  refetched. Memoise the promise per key (`bodyOf` in `Dashboard.svelte`). Nothing catches this: it
  type-checks, builds, and only shows as a flicker you have to be looking for.
- **A key handler inside the page must claim the keys it uses.** The shell binds shortcuts on
  `window`, so any key a component does not `stopPropagation` reaches them — pressing `]` over the
  dashboard navigated to the issues list mid-edit. `preventDefault` alone is not enough, and it is
  worth checking that a chosen key is free before binding it at all.
- **The dashboard grid compacts upward, which makes "move down" a trick question.** Nudging a card
  into the empty space below it is undone the moment the layout settles, so ArrowDown appeared to do
  nothing. Vertically, the move somebody means is "put me after the next one" — the handler falls
  back to a reorder, and the same rule applies to any gravity layout added later.
- **Rewriting `messages/*.json` from a script reformats the plural entries.** A message with
  variants is an array of objects, and `json.dump(indent=2)` expands the `declarations` and
  `selectors` arrays that Biome keeps inline — so a script that only added a key leaves a diff
  touching messages nobody edited, and `pnpm lint` fails on formatting. Run
  `pnpm exec biome check --write messages/` immediately after any scripted edit to them.
- **SvelteKit's CSP does not nonce the inline script in `app.html`.** It nonces the scripts it emits
  itself, and nothing else — so the no-flash theme script needs `nonce="%sveltekit.nonce%"` written
  on it by hand. Without it the script is blocked, every dark-mode load flashes light before
  hydration, and the page reports nothing: a blocked inline script is silent unless you are watching
  the console. `frame-ancestors` is not in `svelte.config.js` on purpose — it is ignored in a
  `<meta>` tag, so it is a real header in `selfhost/Caddyfile` instead.
- **The sidebar belongs to the module whose section you are in, and it says so in types now.** A
  module declares `sidebar: [{ match, controls?, component }]`; `match` names path *segments*, not a
  substring, because gating on `pathname.includes('/chat')` also fires for a workspace whose slug is
  `chat`. The shell renders whoever claims the segment and nothing of its own — the inbox rows are
  core's, the "my work" presets are the tracker's. `segmentOf` lives in its own file with no imports
  precisely so a test can load it; `registry.ts` reaches the module clients, which import `$msg`.
- **Filter a stored dashboard layout, then compact it.** Dropping the widgets of a module that was
  switched off is right, but dropping them *in place* leaves holes where the cards were and the
  board reads as broken rather than tidy. The stored layout is left untouched, so turning the module
  back on restores the arrangement it had.
- **`tests/e2e/ux.spec.ts` is what stops the interface looking like a prototype.** It sweeps every
  route in light/dark and LTR/RTL against `ux-audit.ts`: contrast, accessible names, WCAG 2.5.8
  target size, pointer affordance, a level-1 heading, sideways scroll, keyboard focus rings, and
  anything the page throws while rendering. It found 408 contrast failures, 146 undersized targets
  and 85 unnamed controls the first time it ran, none of which failed a build. Add a route to
  `ROUTES` when you add a route, and read a failure as a defect rather than as a strict test.
- **`tests/e2e/quire-collab.spec.ts` opens two browsers on one document, and is deliberately not in
  `pnpm test:e2e`.** Multiplayer cannot be tested against the mock — there is no collab service
  behind it — so it needs Postgres, `core` on :4000 and `collab` on :4300, with the shell *not* in
  mock mode. It has its own config: `pnpm exec playwright test -c playwright.collab.config.ts`. It
  skips when a service is missing and fails under `CI=1`. Its sessions are real: core's
  `sign-up/email` with a password generated per run, an invitation, and the token read out of
  Mailpit where the recipient would read it — never a hard-coded credential, never a sign-in form.
  Five things it cost time to learn, all of which apply to any browser test of the editor:
  - `getByRole('status')` matches the chat gateway's connection banner, `PageView`'s
    unpublished-changes banner **and** the editor's own note. Scope it to `.editor`, which is
    `CollaborativeEditor`'s wrapper and the only element wearing that class.
  - `ControlOrMeta+Home`/`End` are not caret keys in a contenteditable on macOS. Put a caret
    somewhere by clicking the paragraph you mean.
  - Two people typing at one offset **interleave character by character** —
    `alpha-from-adaao-baemfro-vbrb`. That is Yjs working, not a defect. Assert that both browsers
    converge and that no keystroke was dropped; assert each other's words only when the two are
    typing in different blocks.
  - The editor notices a dropped network only after the Hocuspocus provider's
    `messageReconnectTimeout` — 30 seconds of silence. A socket that stops carrying traffic does not
    close, and the provider ignores the window's `offline` event, so for half a minute the editor
    still reads as connected while the shell's own banner (driven by `navigator.onLine`) already
    says otherwise.
  - **`context.setOffline(false)` makes Vite reload the page.** The HMR client reloads when its own
    socket comes back, so any `page.evaluate` in flight dies with "Execution context was destroyed"
    — a dev-server artefact that looks exactly like the app navigating away. Read the DOM through a
    helper that returns empty on that error and let the surrounding `expect.poll` retry, then assert
    separately that the browser is still on the URL it was on.
- **Playwright empties its `outputDir` when a run starts.** Two suites sharing `test-results/` means
  whichever starts second deletes the other's traces — which is how a failure gets investigated with
  no artefacts at all. The collab config writes to `test-results/collab`; `pnpm test:e2e` owns the
  parent and will still clear it, so do not start that suite while reading a collab failure.
- **`tests/e2e/quire-a11y.spec.ts` asks whether Quire can be *operated*, which `ux.spec.ts` cannot.**
  It drives the keyboard and reads the accessibility tree: every control named, no control nested
  inside another, the page tree expanded/collapsed/opened/grown by Tab and Enter, a database row
  traversed and a cell committed, a focus ring on every stop, a modal that gives focus back, the
  Persian tree indenting from the right, and no text muted with `opacity`. Three traps it cost time
  to learn, and all three make a browser test lie rather than fail:
  - **`blur()` does not send Tab back to the top of the document.** The browser keeps a *sequential
    focus navigation starting point* at the last focused element and clearing focus does not clear
    it, so a second walk carries on from where the first stopped and finds the *next* control with
    the name it wanted — silently a row lower down the table. Focus `document.documentElement` (with
    a temporary `tabindex="-1"`) to reset it.
  - **An uncontrolled input proves nothing about persistence.** `<input value={text}>` keeps
    whatever the keyboard typed, so asserting on it straight after typing passes even when the
    commit is a no-op. Leave the view and come back — the component remounts from the store.
  - **A rule that judged nothing reports nothing.** Both sweeps here passed a blank page until they
    counted the elements they had looked at and asserted a floor. Every audit-shaped test needs one.
- **`node build/index.js` needs `PUBLIC_API_MOCK=1` at *runtime*, not only at build time.** It is a
  dynamic public env var, so serving `build/` without it renders every page blank — and a blank page
  is how an audit-shaped suite goes green having checked nothing. Worth knowing because copying
  `build/` somewhere private and serving that is the only way to hold a stable server while another
  agent rebuilds: a parallel `npm run build` deletes `.svelte-kit/output` under a running
  `vite preview`, which then dies with ENOENT on a CSS chunk mid-run.
- **The identity colours were defined twice, and the copy nobody read was the one in CSS.**
  `IDENTITY_COLORS` in `@kernhq/ui/utils.ts` held literal hexes while `--kern-av-*` held the same
  palette in `tokens.css`; every avatar took its ground from the array, so darkening the tokens so
  white initials clear 4.5:1 changed nothing on screen. The array now names the tokens
  (`var(--kern-av-3)`) — a colour in a `style` attribute can be a `var()`, so there is no reason for
  a second copy. Look for this shape before tuning any token: **change it, then confirm on the
  running page that the pixel moved.**
- **`node scripts/check-tokens.mjs` (in `pnpm lint`) is what catches a token that does not exist.**
  A wrong `var(--kern-…)` name is dropped silently: a gap becomes 0, a font-size inherits, muted
  text renders in the default ink. The whole HR module was written against a `--kern-space-*` /
  `--kern-text-*` vocabulary that was never defined — there is no spacing or type token scale, the
  design system uses literal px on the 2px grid in DESIGN.md §1.4. A fallback
  (`var(--kern-text-faint, #9a9285)`) hides the same mistake behind a value that looks deliberate,
  so the check reports those too.
- **A component you forgot to import renders as a silent unknown element.** `<SettingsPage>` without
  its import compiled, built and shipped — as a literal `<settingspage>` tag with no styles, no
  heading and no `<title>`. Nothing failed. If a wrapper appears to have no effect, check the import
  before the component.
- **A duplicate key in an `{#each}` is a *render* error, and it looks like loading.** `moduleManifests`
  in `src/lib/api/mock.ts` carried `id: 'hr'` twice, so every list keyed by module id threw
  `each_key_duplicate`, Svelte stopped mid-paint, and four admin screens sat on their skeletons for
  ever. `ux.spec.ts` now fails on anything the page throws, which is how this class gets caught.
- **A counter declared in a component's `<script>` is per instance, not per page.** `let nextId = 0`
  for generating label ids restarted at 0 in every `Checkbox`, so three of them shared `kcb-l0` and
  `getByLabel('Show archived')` matched all three. Use `$props.id()` — and it must be the entire
  initialiser of its own `const`, because the compiler rejects it inside a template literal.
  `svelte-package` does not compile, so that error only appears in the *consumer's* build.
- **`<svelte:head>` cannot sit inside an `{#if}`.** Put the block inside the head instead. And a page
  that renders `SettingsPage` or `PageHeader` must not add a second `<svelte:head><title>` — both
  reach the document, the browser keeps the first, and the page's own would look right in the source
  and never appear.
- **A top-level route shadows a workspace of the same name.** A workspace lives at `/<slug>` and the
  app's own pages — `/sign-in`, `/workspaces`, `/onboarding` — sit at that same level, where
  SvelteKit prefers the static route. A workspace called "workspaces" would then exist and never
  open, with nothing failing anywhere. Adding a directory to `src/routes` therefore means adding its
  name to `RESERVED_SLUGS` in core (`src/modules/core/services/workspaces.ts`) in the same change.
