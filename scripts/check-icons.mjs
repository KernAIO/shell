/**
 * Every `icon="…"` name must exist in the design system's registry.
 *
 * An unregistered name renders a blank square and fails silently — nothing type-checks it, and
 * nothing throws. Lucide also renames icons between versions (`alert-triangle` became
 * `triangle-alert`), so a name that was right once quietly stops being right.
 *
 *   node scripts/check-icons.mjs
 */
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const registryPath = join(root, 'node_modules/@kernhq/ui/src/lib/icons/registry.ts')

let registrySource
try {
  registrySource = readFileSync(registryPath, 'utf8')
} catch {
  console.error(`Cannot read the icon registry at ${registryPath}. Is @kernhq/ui installed?`)
  process.exit(1)
}

const known = new Set([...registrySource.matchAll(/^\s{2}'?([a-z0-9-]+)'?:/gm)].map((match) => match[1]))
if (known.size < 20) {
  console.error(`Only ${known.size} icons found in the registry — the format has probably changed.`)
  process.exit(1)
}

/** `icon="x"` and `icon: 'x'` are the two ways a name reaches `<Icon>`; `name=` is too generic. */
const USES = [/icon="([a-z0-9-]+)"/g, /icon:\s*'([a-z0-9-]+)'/g, /<Icon\s+name="([a-z0-9-]+)"/g]

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(svelte|ts)$/.test(entry.name)) yield path
  }
}

const problems = []
for await (const file of files(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8')
  for (const pattern of USES)
    for (const [, name] of source.matchAll(pattern))
      if (!known.has(name)) problems.push(`${file.slice(root.length + 1)}: ${name}`)
}

if (problems.length) {
  console.error('Icon names that are not in the registry (they render as a blank square):\n')
  for (const problem of [...new Set(problems)].sort()) console.error(`  ${problem}`)
  console.error(`\n${problems.length} use(s). Pick a name from @kernhq/ui's icons/registry.ts.`)
  process.exit(1)
}
console.log(`✓ every icon name resolves (${known.size} in the registry)`)
