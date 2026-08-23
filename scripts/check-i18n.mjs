/**
 * Every message key must exist in every locale we ship, with the same placeholders.
 *
 * Paraglide compiles a missing key into a silent alias to English — `const ar_x = en_x` — so a
 * locale can be missing 996 of 1163 keys and every build stays green. `svelte-check` only catches a
 * key missing from *English*, because that is the one that produces a call to a function that does
 * not exist. Nothing has ever checked the others.
 *
 *   node scripts/check-i18n.mjs
 *
 * `REQUIRED` is the list of locales a gap actually fails on. It grows as a locale is completed;
 * everything else is reported and does not fail, because a check that is red for three thousand
 * strings teaches people to ignore it.
 */
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const settings = read('project.inlang/settings.json')
const BASE = settings.baseLocale
const LOCALES = settings.locales

/** Locales a gap fails on. Add one the day it reaches parity; see the language skill. */
const REQUIRED = new Set([BASE, 'fa'])

/**
 * Values that are legitimately identical to English: brand names, protocol names, and literals a
 * user types verbatim. Anything else that matches English is a string somebody skipped.
 */
const SAME_AS_ENGLISH_IS_FINE = new Set([
  'app_name',
  'chat_channel_name_placeholder',
  'home_subtitle',
  'mail_provider_mailgun',
  'mail_provider_postmark',
  'mail_provider_resend',
  'mail_provider_ses',
  'mail_provider_smtp',
  'tracker_kql_placeholder',
])

const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('$')))
const placeholders = (v) =>
  typeof v === 'string' ? [...v.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).sort() : []

const base = strip(read(`messages/${BASE}.json`))
const baseKeys = Object.keys(base)

/** Which keys any source file actually calls, so unused ones can be reported (never failed on). */
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'paraglide') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(svelte|ts)$/.test(entry.name)) yield path
  }
}
const referenced = new Set()
for (const dir of ['src', 'tests']) {
  for await (const file of files(join(root, dir)))
    for (const [, key] of readFileSync(file, 'utf8').matchAll(/\bm\.([a-z][a-z0-9_]*)/g)) referenced.add(key)
}

let failed = false
const lines = []

for (const locale of LOCALES) {
  if (locale === BASE) continue
  const other = strip(read(`messages/${locale}.json`))
  const missing = baseKeys.filter((k) => !(k in other))
  const orphans = Object.keys(other).filter((k) => !(k in base))
  const mismatched = baseKeys
    .filter((k) => k in other)
    .filter((k) => String(placeholders(base[k])) !== String(placeholders(other[k])))
  const untranslated = baseKeys.filter(
    (k) => k in other && other[k] === base[k] && !SAME_AS_ENGLISH_IS_FINE.has(k),
  )

  // A placeholder that changed name or vanished is a runtime bug in any locale, shipped or not.
  const fatal = mismatched.length > 0 || orphans.length > 0 || (REQUIRED.has(locale) && missing.length > 0)
  if (fatal) failed = true

  const mark = fatal ? '✗' : REQUIRED.has(locale) ? '✓' : '·'
  const pct = Math.round(((baseKeys.length - missing.length) / baseKeys.length) * 100)
  lines.push(
    `${mark} ${locale.padEnd(3)} ${String(baseKeys.length - missing.length).padStart(4)}/${baseKeys.length} (${String(pct).padStart(3)}%)` +
      (missing.length ? `  ${missing.length} missing` : '') +
      (orphans.length ? `  ${orphans.length} orphaned` : '') +
      (mismatched.length ? `  ${mismatched.length} placeholder mismatch` : '') +
      (untranslated.length ? `  ${untranslated.length} still English` : '') +
      (REQUIRED.has(locale) ? '' : '  — not required yet'),
  )
  for (const k of orphans) lines.push(`      orphaned: ${k} — not in ${BASE}.json`)
  for (const k of mismatched)
    lines.push(
      `      ${k}: ${BASE} has {${placeholders(base[k])}}, ${locale} has {${placeholders(other[k])}}`,
    )
  for (const k of untranslated.slice(0, 12)) lines.push(`      still English: ${k}`)
  if (untranslated.length > 12) lines.push(`      … and ${untranslated.length - 12} more still English`)
}

const unused = baseKeys.filter((k) => !referenced.has(k))

console.log(`${BASE} ${baseKeys.length} keys\n`)
for (const line of lines) console.log(line)
if (unused.length) {
  // Never a failure: a key may legitimately land before the screen that uses it.
  console.log(`\n${unused.length} key(s) nothing references. Delete a key with its last use:`)
  for (const k of unused.slice(0, 20)) console.log(`      ${k}`)
  if (unused.length > 20) console.log(`      … and ${unused.length - 20} more`)
}

if (failed) {
  console.error('\ni18n check failed.')
  process.exit(1)
}
console.log('\n✓ every required locale is complete, with matching placeholders')
