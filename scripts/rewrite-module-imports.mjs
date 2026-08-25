/**
 * Repoint a migrated module's screens from the app's aliases to the host contract.
 *
 *   node scripts/rewrite-module-imports.mjs <moduleId> <dir> [--write]
 *
 * A module package is compiled and type-checked on its own, where `$lib/*` and `$msg` do not exist
 * and `$app/*` resolves only because the *consumer* is a SvelteKit app. So everything a screen used
 * to take from the app either comes from `@kernhq/ui` now or is passed in as a prop.
 *
 * `$app/state` is the one that looks harmless and is not: reading the router inside a module means
 * the package cannot be type-checked alone. Every module page already receives `workspaceId` and
 * `workspaceSlug` from the shell, which is what it wanted the router for.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id, dir] = process.argv.slice(2)
const write = process.argv.includes('--write')
if (!id || !dir) {
  console.error('Usage: node scripts/rewrite-module-imports.mjs <moduleId> <dir> [--write]')
  process.exit(1)
}

/** Named exports that now come from `@kernhq/ui`, by the app path they used to come from. */
const FROM_UI = [
  '$lib/format',
  '$lib/query',
  '$lib/realtime.svelte',
  '$lib/state/session.svelte',
  '$lib/files/upload',
  '$lib/dashboard/settings',
]
/** Default-imported components that became named exports of `@kernhq/ui`. */
const COMPONENTS = {
  '$lib/dashboard/WidgetState.svelte': 'WidgetState',
  '$lib/components/settings/SettingsPage.svelte': 'SettingsPage',
  '$lib/components/settings/SettingsSection.svelte': 'SettingsSection',
}

const files = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const full = join(d, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|svelte)$/.test(e.name)) files.push(full)
  }
}
if (!existsSync(dir)) {
  console.error(`No such directory: ${dir}`)
  process.exit(1)
}
walk(dir)

const stuck = new Map()
let changed = 0
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  let t = before
  const intoUi = new Set()
  let pageAlias = null

  // `import { a, b } from '$lib/format'` -> collect a, b and drop the line
  for (const path of FROM_UI) {
    const re = new RegExp(`import \\{([^}]*)\\} from '${path.replace(/[$.]/g, '\\$&')}'\\n`, 'g')
    t = t.replace(re, (_, names) => {
      for (const n of names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean))
        intoUi.add(n)
      return ''
    })
  }
  // `import Foo from '$lib/.../Foo.svelte'` -> named export of @kernhq/ui
  for (const [path, name] of Object.entries(COMPONENTS)) {
    const re = new RegExp(`import \\w+ from '${path.replace(/[$./]/g, '\\$&')}'\\n`, 'g')
    if (re.test(t)) {
      t = t.replace(re, '')
      intoUi.add(name)
    }
  }
  /**
   * The module's own former app-side files are siblings in the package now — but how many `../` it
   * takes depends on whether the file sits directly in `src/client` or in `widgets/`, `settings/`,
   * `admin/`. Getting that wrong compiles in the app (which resolves through the package's exports)
   * and fails the moment the package is built on its own.
   */
  const depth = file.slice(dir.length + 1).split('/').length - 1
  const up = depth === 0 ? './' : '../'.repeat(depth)
  const outOfClient = depth === 0 ? '../' : '../'.repeat(depth + 1)
  t = t.replace(new RegExp(`'\\$lib/modules/${id}/api'`, 'g'), `'${up}api-instance.js'`)
  t = t.replace(new RegExp(`'\\$lib/modules/${id}/permissions'`, 'g'), `'${up}permissions.js'`)
  t = t.replace(new RegExp(`'\\$lib/modules/${id}/([a-zA-Z0-9_-]+)'`, 'g'), `'${up}$1.js'`)
  t = t.replace(new RegExp(`'@kernhq/module-${id}/client'`, 'g'), `'${up}index.js'`)
  t = t.replace(new RegExp(`'@kernhq/module-${id}/contract'`, 'g'), `'${outOfClient}contract.js'`)
  /**
   * The router. `goto` becomes `navigation.go`, and everything read off the `page` store comes from
   * the same singleton — a module package cannot import either alias and be type-checked alone.
   */
  if (/from '\$app\/(navigation|state)'/.test(t)) {
    t = t.replace(/import \{ goto \} from '\$app\/navigation'\n/g, '')
    t = t.replace(/import \{ page(?: as (\w+))? \} from '\$app\/state'\n/g, (_, alias) => {
      pageAlias = alias ?? 'page'
      return ''
    })
    t = t.replace(/\bgoto\(/g, 'navigation.go(')
    if (pageAlias) {
      const p = pageAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      t = t.replace(new RegExp(`\\b${p}\\.params\\.ws \\?\\? ''`, 'g'), 'navigation.workspaceSlug')
      t = t.replace(new RegExp(`\\b${p}\\.params\\.ws!`, 'g'), 'navigation.workspaceSlug')
      t = t.replace(
        new RegExp(`\\b${p}\\.url\\.searchParams\\.get\\('(\\w+)'\\)`, 'g'),
        'navigation.search.$1',
      )
      t = t.replace(new RegExp(`\\b${p}\\.url\\.pathname`, 'g'), 'navigation.pathname')
      t = t.replace(new RegExp(`\\b${p}\\.params`, 'g'), 'navigation.params')
    }
    if (/\bnavigation\./.test(t)) intoUi.add('navigation')
  }

  // core's API client, and the workspace's resolved capability set, both come from the framework
  if (/from '\$lib\/api\/client'/.test(t)) {
    t = t.replace(/import \{([^}]*)\} from '\$lib\/api\/client'\n/g, (_, names) => {
      for (const n of names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (n === 'getApi') intoUi.add('coreApi')
        if (n === 'isMock') intoUi.add('getHost')
      }
      return ''
    })
    t = t.replace(/\bisMock\(\)/g, 'getHost().isMock')
  }
  if (/from '\$lib\/modules\/registry'/.test(t)) {
    t = t.replace(/import \{[^}]*\} from '\$lib\/modules\/registry'\n/g, '')
    intoUi.add('session')
  }

  /**
   * The API origin. Every module carried its own
   * `env.PUBLIC_API_URL || (browser ? location.origin : 'http://localhost:4200')`, naming the port
   * of whichever service hosts it — nine copies, nine chances for one to be wrong, and the failure
   * is a connection refused with no clue which module owned it. The shell knows the origin; ask it.
   */
  if (/from '\$env\/dynamic\/public'/.test(t) || /from '\$app\/environment'/.test(t)) {
    t = t.replace(/import \{ env \} from '\$env\/dynamic\/public'\n/g, '')
    t = t.replace(/import \{ browser \} from '\$app\/environment'\n/g, '')
    t = t.replace(
      /env\.PUBLIC_API_URL \|\| \(browser \? window\.location\.origin : 'http:\/\/localhost:\d+'\)/g,
      'getHost().apiBaseUrl',
    )
    t = t.replace(
      /env\.PUBLIC_API_URL \|\| \(browser \? location\.origin : 'http:\/\/localhost:\d+'\)/g,
      'getHost().apiBaseUrl',
    )
    if (/getHost\(\)/.test(t)) intoUi.add('getHost')
  }

  // the locale now comes from the framework, not from Paraglide's generated runtime
  if (/getLocale\(\)/.test(t)) {
    t = t.replace(/import \{[^}]*\} from '\$lib\/paraglide\/runtime'\n/g, '')
    t = t.replace(/getLocale\(\)/g, 'messageLocale()')
    intoUi.add('messageLocale')
  }

  if (intoUi.size) {
    const existing = t.match(/import \{([^}]*)\} from '@kernhq\/ui'/)
    const names = new Set(intoUi)
    if (existing)
      for (const n of existing[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean))
        names.add(n)
    const line = `import { ${[...names].sort((a, b) => a.localeCompare(b)).join(', ')} } from '@kernhq/ui'`
    if (existing) {
      t = t.replace(existing[0], line)
    } else if (/<script/.test(t)) {
      t = t.replace(/(<script[^>]*>\n)/, `$1${line}\n`)
    } else {
      /**
       * A plain `.ts` file has no `<script>` to insert after. Dropping the import silently is worse
       * than any wrong placement: the file still parses, and the failure surfaces as "Cannot find
       * name 'session'" in a package nobody was editing.
       */
      const lastImport = [...t.matchAll(/^import .*$/gm)].at(-1)
      t = lastImport
        ? `${t.slice(0, lastImport.index + lastImport[0].length)}\n${line}${t.slice(lastImport.index + lastImport[0].length)}`
        : `${line}\n${t}`
    }
  }

  const left = [...t.matchAll(/from '(\$[^']+)'/g)].map((m) => m[1]).filter((p) => p !== '$msg')
  if (left.length) stuck.set(file, [...new Set(left)])
  if (t !== before) {
    changed++
    if (write) writeFileSync(file, t)
  }
}

console.log(`${changed}/${files.length} files rewritten${write ? '' : ' (dry run)'}`)
for (const [file, paths] of stuck) console.log(`  STILL APP-ONLY  ${file}: ${paths.join(', ')}`)
