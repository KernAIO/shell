/**
 * Lift a module's strings out of the app's catalogues and into the module package.
 *
 * A module ships separately, so Paraglide — which compiles only this repository's
 * `messages/*.json` — cannot see it. As each module's UI moves into its own package, its strings
 * have to move with it, in every locale, or the migration silently ships an English-only module.
 *
 *   node scripts/extract-module-messages.mjs <moduleId> [--write]
 *
 * Prints what it would move; `--write` writes `src/client/i18n.ts` in the module package and
 * removes the keys from this repository's catalogues.
 *
 * Keys are matched by prefix (`mail_`, `widget_mail_`) and re-namespaced to the module
 * (`mail.settings_nav`), because the framework's `t()` merges one map per locale and namespacing is
 * what keeps two modules from colliding.
 *
 * Anything a module uses that is *not* its own — `save`, `cancel` — is reported rather than moved:
 * those are the shell's words, and a module that copies them ends up with six translations of
 * "Save" that drift apart. They belong in the framework's common bundle.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const id = process.argv[2]
const write = process.argv.includes('--write')
if (!id) {
  console.error('Usage: node scripts/extract-module-messages.mjs <moduleId> [--write]')
  process.exit(1)
}

const LOCALES = readdirSync('messages')
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
const pkg = join('..', 'modules', 'packages', id)
if (!existsSync(pkg)) {
  console.error(`No module package at ${pkg}`)
  process.exit(1)
}

/** Keys this module's own screens reference, wherever they still live. */
const sources = [
  `src/lib/modules/${id}`,
  `src/routes/(app)/[ws]/${id}`,
  `src/routes/(app)/[ws]/settings/${id}`,
]
const used = new Set()
const walk = (dir) => {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|svelte)$/.test(entry.name)) {
      for (const m of readFileSync(full, 'utf8').matchAll(/\bm\.([a-z0-9_]+)/g)) used.add(m[1])
    }
  }
}
for (const s of sources) walk(s)

/**
 * `m.` is also a common callback parameter, so `messages.map((m) => m.body)` looks exactly like a
 * message reference. Keeping only names the English catalogue actually defines removes every one of
 * those without needing to parse the file properly.
 */
const catalogueKeys = new Set(Object.keys(JSON.parse(readFileSync(join('messages', 'en.json'), 'utf8'))))
for (const k of [...used]) if (!catalogueKeys.has(k)) used.delete(k)

/** Extra prefixes a module owns despite not being named for it (`widget_velocity_`, `intake_`). */
const extra = (process.argv.find((a) => a.startsWith('--also=')) ?? '').slice('--also='.length)
const alsoOwns = extra ? extra.split(',').filter(Boolean) : []
const ownsKey = (k) =>
  k.startsWith(`${id}_`) || k.startsWith(`widget_${id}_`) || alsoOwns.some((p) => k.startsWith(p))
const owned = [...used].filter(ownsKey).sort()
const borrowed = [...used].filter((k) => !ownsKey(k)).sort()

/** `mail_settings_nav` → `mail.settings_nav`; `widget_mail_title` → `mail.widget_title`. */
const rename = (k) =>
  k.startsWith(`widget_${id}_`)
    ? `${id}.widget_${k.slice(`widget_${id}_`.length)}`
    : k.startsWith(`${id}_`)
      ? `${id}.${k.slice(id.length + 1)}`
      : `${id}.${k}`

const catalogues = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(join('messages', `${l}.json`), 'utf8'))]),
)

/**
 * `[{ selectors: ['countPlural'], match: { 'countPlural=one': '…' } }]` -> `{ one: '…' }`.
 * Returns null for any variant this shape cannot carry, so the caller reports it rather than
 * silently dropping a form.
 */
function pluralForms(value) {
  if (!Array.isArray(value) || value.length !== 1) return null
  const [variant] = value
  if (!variant?.match || variant.selectors?.length !== 1) return null
  const selector = variant.selectors[0]
  if (!/Plural$/.test(selector)) return null
  const forms = {}
  for (const [k, v] of Object.entries(variant.match)) {
    const category = k.startsWith(`${selector}=`) ? k.slice(selector.length + 1) : null
    if (!category || typeof v !== 'string') return null
    forms[category] = v
  }
  return Object.keys(forms).length ? forms : null
}

const bundles = {}
const variants = []
for (const locale of LOCALES) {
  const out = {}
  for (const key of owned) {
    const value = catalogues[locale][key]
    if (value === undefined) continue
    /**
     * A counted message is an array carrying Paraglide's `declarations` / `selectors` / `match`.
     * The framework stores the same thing as a plain map of CLDR plural category to string, which
     * is all `Intl.PluralRules` needs — so convert rather than skip. Anything selecting on
     * something other than a plural is genuinely beyond `t()` and is reported instead.
     */
    if (typeof value !== 'string') {
      const forms = pluralForms(value)
      if (!forms) {
        if (locale === 'en') variants.push(key)
        continue
      }
      out[rename(key)] = forms
      continue
    }
    out[rename(key)] = value
  }
  bundles[locale] = out
}

console.log(`module ${id}: ${owned.length} own keys × ${LOCALES.length} locales`)
if (borrowed.length) console.log(`  borrowed from the shell (NOT moved): ${borrowed.join(', ')}`)
if (variants.length) console.log(`  PLURAL messages, need hand-porting: ${variants.join(', ')}`)

if (!write) {
  console.log('\n(dry run — pass --write to apply)')
  process.exit(0)
}

const lines = [
  `/**`,
  ` * ${id[0].toUpperCase()}${id.slice(1)}'s own strings, in every locale the platform ships.`,
  ` *`,
  ` * A module ships separately from the app, so Paraglide cannot compile these — the shell merges`,
  ` * them into the framework's message runtime when it registers this module, and \`t()\` resolves`,
  ` * against the merged map. Keys are namespaced by module id, which is what keeps two modules from`,
  ` * colliding in that one map.`,
  ` *`,
  ` * Bundles are thunks so a locale is only fetched when it is the one in use; English is the`,
  ` * fallback and is therefore always loaded.`,
  ` */`,
  `import { type Message, scopedT } from '@kernhq/ui'`,
  ``,
  `export const en: Record<string, Message> = ${JSON.stringify(bundles.en, null, 2)}`,
  ``,
  `export type ${id[0].toUpperCase()}${id.slice(1)}MessageKey = keyof typeof en`,
  ``,
]
for (const locale of LOCALES.filter((l) => l !== 'en')) {
  lines.push(`const ${locale}: Record<string, Message> = ${JSON.stringify(bundles[locale], null, 2)}`, ``)
}
lines.push(
  `/** In the shape \`defineClientModule().messages\` expects. */`,
  `export const ${id}MessageBundles = {`,
  ...LOCALES.map((l) => `  ${l}: async () => ${l},`),
  `}`,
  ``,
  `/** \`t('settings_nav')\` — the module id is implied. */`,
  `export const t = scopedT('${id}')`,
  ``,
)
writeFileSync(join(pkg, 'src', 'client', 'i18n.ts'), lines.join('\n'))

for (const locale of LOCALES) {
  const cat = catalogues[locale]
  for (const key of owned) if (typeof cat[key] === 'string') delete cat[key]
  writeFileSync(join('messages', `${locale}.json`), `${JSON.stringify(cat, null, 2)}\n`)
}
/**
 * Biome collapses short arrays onto one line and `JSON.stringify` does not, so a catalogue written
 * by a script passes every i18n check and fails `pnpm lint` on formatting alone — with a diff
 * touching messages nobody edited. Format them here rather than leaving it to be remembered.
 */
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', 'messages/'], { stdio: 'ignore' })

console.log(`\nwrote ${pkg}/src/client/i18n.ts and removed ${owned.length} keys from messages/*.json`)
