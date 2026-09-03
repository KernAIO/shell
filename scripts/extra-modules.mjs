#!/usr/bin/env node
/**
 * Wire extra modules into this image.
 *
 *   KERN_EXTRA_MODULES="@acme/module-crm@1.2.0 @acme/module-timesheets@0.4.1" node scripts/extra-modules.mjs
 *
 * A third-party module used to need a line in `src/lib/modules/registry.ts`, which meant forking
 * this repository to show one. Now the Dockerfile takes the same string as a build argument,
 * installs the packages, and runs this — which rewrites `src/lib/modules/extra.ts` to import each
 * package's `./client` default export. The registry registers that list after the first-party
 * modules, so the module's navigation, routes, widgets, settings pages and strings appear exactly as
 * theirs do. The same string builds the `core` image, so the server half is there to answer.
 *
 * The packages must already be installed: this checks that each `<name>/client` resolves and stops
 * with the package's name when one does not. With the variable empty the committed file is written
 * back unchanged.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/modules/extra.ts')

const specs = (process.env.KERN_EXTRA_MODULES ?? process.argv.slice(2).join(' '))
  .split(/[\s,]+/)
  .filter(Boolean)

/** `@scope/name@1.2.0` → `@scope/name`; `name@^1` → `name`; a bare name stays as it is. */
const packageName = (spec) => {
  const at = spec.lastIndexOf('@')
  return at > 0 ? spec.slice(0, at) : spec
}

const names = [...new Set(specs.map(packageName))]
const missing = names.filter((name) => {
  try {
    // `./client` ships as TypeScript source and resolves only through the package's exports map,
    // which is what this checks — a package with no client entry is a server-only module and has
    // nothing to register here.
    import.meta.resolve(`${name}/client`)
    return false
  } catch {
    return true
  }
})
if (missing.length) {
  console.error(`extra-modules: not installed, or no "./client" entry point: ${missing.join(', ')}`)
  console.error('  pnpm add the package first — the Dockerfile does this from KERN_EXTRA_MODULES.')
  process.exit(1)
}

const imports = names.map((name, i) => `import extra${i} from '${name}/client'`)
const list = names.map((_, i) => `extra${i}`).join(', ')
const header = [
  '// Rewritten at image build by `scripts/extra-modules.mjs` from KERN_EXTRA_MODULES. Do not edit:',
  '// with the variable empty the script writes this exact file back, so a normal build changes nothing.',
  "import type { SvelteClientModule } from '@kernhq/ui'",
]
const body = names.length
  ? [
      ...imports,
      '',
      `/** Modules a self-hoster built into this image beside the first-party set: ${names.join(', ')}. */`,
      `export const extraModules: SvelteClientModule[] = [${list}]`,
    ]
  : [
      '',
      '/** Modules a self-hoster built into this image beside the first-party set. Empty in the published images. */',
      'export const extraModules: SvelteClientModule[] = []',
    ]
writeFileSync(OUT, `${[...header, ...body].join('\n')}\n`)
console.log(names.length ? `extra-modules: ${names.join(', ')}` : 'extra-modules: none')
