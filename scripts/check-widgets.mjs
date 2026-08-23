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

/** `id: 'tracker.issues',` inside a `widgets:` array. */
const DECLARED = /^\s*id: '([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)',$/gm
/** `{ widget: 'tracker.issues', size: 'l' }` in a preset entry. */
const REFERENCED = /widget: '([^']+)'/g

const declared = new Map()
for (const mod of readdirSync(modulesDir, { withFileTypes: true })) {
  if (!mod.isDirectory()) continue
  const client = join(modulesDir, mod.name, 'client.ts')
  let source
  try {
    source = readFileSync(client, 'utf8')
  } catch {
    continue
  }
  // Only the ids inside the `widgets:` block. A module's settings pages, nav items and slots all
  // use `id:` too, so the block has to end where the array does — at the first `  ],` in column two.
  const start = source.indexOf('  widgets: [')
  if (start === -1) continue
  const rest = source.slice(start)
  const end = rest.indexOf('\n  ],')
  const block = end === -1 ? rest : rest.slice(0, end)
  for (const [, id] of block.matchAll(DECLARED)) declared.set(id, mod.name)
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

console.log(`✓ ${declared.size} widgets declared, every preset reference resolves`)
