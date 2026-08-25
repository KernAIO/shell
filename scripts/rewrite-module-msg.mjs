/**
 * Rewrite a migrated module's `$msg` calls to the framework's `t()`.
 *
 * Paraglide compiles the app's catalogues into functions (`m.mail_settings_nav()`); a module that
 * ships separately cannot use them, so its screens call `t('settings_nav')` against the bundle the
 * shell merged for it. This does that conversion over a directory.
 *
 *   node scripts/rewrite-module-msg.mjs <moduleId> <dir> [--write]
 *
 * Three shapes, matching how `extract-module-messages.mjs` renamed the keys:
 *   m.mail_settings_nav()        -> t('settings_nav')
 *   m.widget_mail_title()        -> t('widget_title')
 *   m.save()                     -> t('common.save')          (a shell word, from the common bundle)
 *   m.mail_x({ n: 1 })           -> t('x', { n: 1 })
 *
 * A key that is neither the module's nor in the common bundle is left alone and reported: it is
 * either a plural (which `t()` cannot express and needs porting by hand) or a string that has not
 * been decided about yet. Silently rewriting those to a key nothing defines would put the key
 * itself on screen.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id, dir] = process.argv.slice(2)
const write = process.argv.includes('--write')
if (!id || !dir) {
  console.error('Usage: node scripts/rewrite-module-msg.mjs <moduleId> <dir> [--write]')
  process.exit(1)
}

// The common bundle is TypeScript, so its keys are read out of the source rather than parsed.
const commonSrc = readFileSync(
  join('..', 'kernel', 'packages', 'ui', 'src', 'lib', 'common-messages.ts'),
  'utf8',
)
const COMMON = new Set()
for (const m of commonSrc.matchAll(/['"]common\.([a-z0-9_]+)['"]\s*:/g)) COMMON.add(m[1])

/** `mail_settings_nav` -> `settings_nav`; `widget_mail_title` -> `widget_title`. */
function scoped(key) {
  if (key.startsWith(`widget_${id}_`)) return `widget_${key.slice(`widget_${id}_`.length)}`
  if (key.startsWith(`${id}_`)) return key.slice(id.length + 1)
  return null
}
/** Where a key ends up, or null when nothing defines it and it must be left alone. */
function target(key) {
  const own = scoped(key)
  if (own) return own
  const common = RENAME[key] ?? key
  if (COMMON.has(common)) return `common.${common}`
  unresolved.add(key)
  return null
}

const RENAME = {
  dash_any: 'any',
  error_generic: 'error',
  settings_title: 'settings',
  audit_actor_system: 'system',
  chart_empty: 'no_data',
  widget_setting_rows: 'setting_rows',
  widget_setting_status: 'setting_status',
  widget_setting_show: 'setting_show',
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

const unresolved = new Set()
let changed = 0
for (const file of files) {
  const before = readFileSync(file, 'utf8')
  /**
   * Two shapes, and the no-argument one has to go first: rewriting `m.key(` before `m.key()` would
   * leave a dangling separator on every call that takes none.
   */
  const swap = (src) =>
    src
      .replace(/\bm\.([a-z0-9_]+)\(\s*\)/g, (whole, key) => {
        const to = target(key)
        return to ? `t('${to}')` : whole
      })
      .replace(/\bm\.([a-z0-9_]+)\(/g, (whole, key) => {
        const to = target(key)
        return to ? `t('${to}', ` : whole
      })
      /**
       * A bare `m.key` with no call is a *reference*, passed where a label is wanted lazily
       * (`{ label: m.mail_field_host }`). It has to stay lazy — evaluating it here would freeze the
       * string in whatever language was loaded first — so it becomes a thunk, not a call.
       */
      .replace(/\bm\.([a-z0-9_]+)\b(?!\s*\()/g, (whole, key) => {
        const to = target(key)
        return to ? `() => t('${to}')` : whole
      })
  const after = swap(before)
  if (after !== before) {
    changed++
    if (write) writeFileSync(file, after)
  }
}

// the import line itself
for (const file of files) {
  let t = readFileSync(file, 'utf8')
  if (!/\bt\(/.test(t) || !/from '\$msg'/.test(t)) continue
  t = t.replace(
    /import \* as m from '\$msg'\n/,
    `import { t } from '${file.includes('/widgets/') || file.includes('/settings/') ? '../i18n.js' : './i18n.js'}'\n`,
  )
  if (write) writeFileSync(file, t)
}

console.log(`${changed}/${files.length} files rewritten${write ? '' : ' (dry run)'}`)
if (unresolved.size) console.log(`  UNRESOLVED (left as-is): ${[...unresolved].sort().join(', ')}`)
