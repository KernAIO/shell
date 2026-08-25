/**
 * Every widget a preset names must be one a module actually declares.
 *
 * A preset stores widget ids as strings, and `expandPreset` drops any it does not recognise — which
 * is right at runtime, because a workspace with a module switched off should get a shorter board
 * rather than a broken one. The cost is that a typo, or a widget that was planned and never built,
 * produces a preset that quietly lands half empty. Two of those shipped in the first draft of
 * `presets.ts` and nothing caught them: it type-checks, it builds, and the board just has fewer
 * cards than intended.
 *
 * A unit test cannot do this. `registry.ts` reaches the module clients, which import `$msg`, and a
 * `.ts` module that imports the message catalogue cannot run under vitest — so this reads the
 * source, the way `check-icons.mjs` does for icon names.
 *
 *   node scripts/check-widgets.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = join(root, 'src/lib/modules')
/**
 * Module clients live in two places while the UI migration is in flight: still in the app for
 * modules not yet moved, and in `repos/modules/packages/<id>/src/client` for the ones that have.
 *
 * Looking in only one of them is how this check quietly stopped seeing half the product — the
 * widget count simply got smaller and nothing said why. It reports where it looked, so a drop is
 * visible rather than silent.
 */
const packagesDir = join(root, '..', 'modules', 'packages')

/** `id: 'tracker.issues',` inside a `widgets:` array. */
const DECLARED = /^\s*id: '([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)',$/gm
/** `{ widget: 'tracker.issues', size: 'l' }` in a preset entry. */
const REFERENCED = /widget: '([^']+)'/g

const declared = new Map()

/** Pull the ids out of the `widgets:` array of one client-module source file. */
function collect(source, owner) {
  // Only the ids inside the `widgets:` block. A module's settings pages, nav items and slots all
  // use `id:` too, so the block has to end where the array does — at the first `  ],` in column two.
  const start = source.indexOf('  widgets: [')
  if (start === -1) return
  const rest = source.slice(start)
  const end = rest.indexOf('\n  ],')
  const block = end === -1 ? rest : rest.slice(0, end)
  for (const [, id] of block.matchAll(DECLARED)) declared.set(id, owner)
}

const read = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

let inApp = 0
for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
  if (!mod.isDirectory()) continue
  const source = read(join(modulesDir, mod.name, 'client.ts'))
  if (source) {
    collect(source, mod.name)
    inApp++
  }
}

let inPackages = 0
for (const mod of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!mod.isDirectory() || mod.name.startsWith('_')) continue
  const dir = join(packagesDir, mod.name, 'src', 'client')
  // a migrated module declares its client module in `module.ts`; `index.ts` only re-exports it
  const source = read(join(dir, 'module.ts')) ?? read(join(dir, 'index.ts'))
  if (source) {
    collect(source, mod.name)
    inPackages++
  }
}

const presets = readFileSync(join(root, 'src/lib/dashboard/presets.ts'), 'utf8')
const problems = []

for (const [, id] of presets.matchAll(REFERENCED)) {
  if (!declared.has(id)) problems.push(`presets.ts names "${id}", which no module declares`)
}

for (const [id, mod] of declared) {
  const [prefix] = id.split('.')
  // The prefix is what a saved layout stores, and what `widgetsFor` groups by. A mismatch means a
  // widget that survives its own module being switched off.
  if (prefix !== mod) problems.push(`${mod}/client.ts declares "${id}", which is not prefixed "${mod}."`)
}

if (declared.size === 0) {
  problems.push('no widgets found at all — has the declaration shape changed?')
}

if (problems.length) {
  console.error('widget check failed:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

console.log(
  `✓ ${declared.size} widgets declared across ${inApp + inPackages} module clients ` +
    `(${inApp} in the app, ${inPackages} in packages), every preset reference resolves`,
)
