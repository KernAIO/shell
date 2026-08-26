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

/**
 * Locales a gap fails on — every one we ship.
 *
 * This was `[en, fa]` while Arabic and German were a thousand keys short, because a check that is
 * red for three thousand strings teaches people to ignore it. They are complete now, and Turkish
 * arrived complete, so the list is the whole set and a new key has nowhere to hide.
 */
/**
 * Named rather than derived from `LOCALES`, so that scaffolding a sixth language does not turn CI
 * red on the first commit — a contributor translating one screen at a time needs the locale declared
 * and the check quiet until they are done. Add a locale here the day it reaches 100%.
 */
const REQUIRED = new Set(['ar', 'de', 'en', 'fa', 'tr'])

/**
 * Values that are legitimately identical to English: brand names, protocol names, and literals a
 * user types verbatim. Same in every locale, so keyed by message name.
 */
const SAME_AS_ENGLISH_IS_FINE = new Set([
  'app_name',
  'chat_channel_name_placeholder',
  'home_subtitle',
  // Product names an MCP client's own UI shows verbatim — translating them would name a button the
  // app you land in doesn't have.
  'mcp_connect_chatgpt',
  'mcp_connect_claude',
  'mcp_connect_claude_code',
  'mcp_connect_codex',
  'mcp_connect_cursor',
  'mcp_connect_vscode',
  'mcp_connect_vscode_insiders',
  'mail_provider_mailgun',
  'mail_provider_postmark',
  'mail_provider_resend',
  'mail_provider_ses',
  'mail_provider_smtp',
  'tracker_kql_placeholder',
  // `parseDuration` reads `h` and `m` and nothing else, so a translated placeholder would show a
  // shape the field rejects. See src/lib/modules/tracker/time.ts.
  'tracker_time_placeholder',
])

/**
 * Words a locale genuinely shares with English, listed by value rather than by key so that the next
 * message saying "Status" does not have to be allowed again.
 *
 * Keyed by value because the fact being recorded is about the *word*: German writes Status, Name and
 * Dashboard exactly as English does, and forty-two such words accounted for every one of its
 * "still English" reports. Enumerating the keys instead would have meant sixty-eight entries that go
 * stale the moment a screen is added — and a check nobody reads because it always prints sixty-eight
 * warnings is a check that no longer catches the sixty-ninth.
 */
const SHARED_VOCABULARY = {
  de: new Set([
    // Interface nouns German writes the same way.
    'Name',
    'Status',
    'System',
    'Version',
    'Route',
    'Jobs',
    'Person',
    'Text',
    'Filter',
    'Filter \u00b7 {count}',
    'Import',
    'Updates',
    'Navigation',
    'Dashboard',
    'Timer',
    'Logo',
    'Emoji',
    'optional',
    // Link is masculine and takes -s in the plural; lowercase "links" would mean "left".
    'Link',
    'Links',
    'Label',
    'Labels',
    'URL',
    // Agile vocabulary German teams use in English.
    'Backlog',
    'Board',
    'Burndown',
    'Velocity',
    'Epic',
    'Initiative',
    'Workflows',
    // Network and protocol terms.
    'Domain',
    'Host',
    'Port',
    'Region',
    'Push',
    'Passkeys',
    'Webhooks',
    'Online',
    'Offline',
    // Chat vocabulary, borrowed wholesale.
    'Chat',
    'Thread',
    'Huddle',
    // Settled in messages/GLOSSARY.md: German keeps Workspace.
    'Workspace',
    'Workspaces',
  ]),
  tr: new Set(['Backlog', 'Burndown', 'Emoji', 'Logo', 'URL']),
}

const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('$')))
/**
 * A message is either a string or a one-element array carrying `match` — the plugin's variant form.
 * Its placeholders are the union of every branch's, so the comparison with English still works.
 */
const branches = (v) => (Array.isArray(v) ? Object.values(v[0]?.match ?? {}) : [v])
const placeholders = (v) =>
  [
    ...new Set(
      branches(v)
        .filter((b) => typeof b === 'string')
        .flatMap((b) => [...b.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])),
    ),
  ].sort()

/**
 * Which plural categories a variant answers for, against the ones its locale actually uses.
 *
 * This is the one failure worse than falling back to English: when no branch matches, Paraglide
 * returns the message *key*, so the reader sees `tracker_issues_count` on screen. Arabic uses six
 * categories, so a translator who writes the `one`/`other` pair that English and German need breaks
 * every count from two upwards — while 1 still looks correct.
 */
const isPluralVariant = (v) => Array.isArray(v) && Boolean(v[0]?.selectors?.[0]?.endsWith('Plural'))
const coveredCategories = (v) =>
  new Set(
    Object.keys(v[0]?.match ?? {})
      .map((m) => m.split('=')[1]?.trim())
      .filter(Boolean),
  )
const neededCategories = (locale) => new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories)

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
  const shared = SHARED_VOCABULARY[locale] ?? new Set()
  const untranslated = baseKeys.filter(
    (k) =>
      k in other &&
      JSON.stringify(other[k]) === JSON.stringify(base[k]) &&
      !SAME_AS_ENGLISH_IS_FINE.has(k) &&
      !(typeof base[k] === 'string' && shared.has(base[k])),
  )
  const shortPlurals = []
  for (const k of baseKeys) {
    if (!(k in other) || !isPluralVariant(other[k])) continue
    const short = [...neededCategories(locale)].filter((c) => !coveredCategories(other[k]).has(c))
    if (short.length) shortPlurals.push(`${k} — no ${short.join(', ')}`)
  }

  // A placeholder that changed name or vanished is a runtime bug in any locale, shipped or not.
  const fatal =
    mismatched.length > 0 ||
    orphans.length > 0 ||
    shortPlurals.length > 0 ||
    (REQUIRED.has(locale) && missing.length > 0)
  if (fatal) failed = true

  const mark = fatal ? '✗' : REQUIRED.has(locale) ? '✓' : '·'
  const pct = Math.round(((baseKeys.length - missing.length) / baseKeys.length) * 100)
  lines.push(
    `${mark} ${locale.padEnd(3)} ${String(baseKeys.length - missing.length).padStart(4)}/${baseKeys.length} (${String(pct).padStart(3)}%)` +
      (missing.length ? `  ${missing.length} missing` : '') +
      (orphans.length ? `  ${orphans.length} orphaned` : '') +
      (mismatched.length ? `  ${mismatched.length} placeholder mismatch` : '') +
      (untranslated.length ? `  ${untranslated.length} still English` : '') +
      (shortPlurals.length ? `  ${shortPlurals.length} incomplete plural` : '') +
      (REQUIRED.has(locale) ? '' : '  — not required yet'),
  )
  for (const k of orphans) lines.push(`      orphaned: ${k} — not in ${BASE}.json`)
  for (const k of mismatched)
    lines.push(
      `      ${k}: ${BASE} has {${placeholders(base[k])}}, ${locale} has {${placeholders(other[k])}}`,
    )
  for (const pl of shortPlurals)
    lines.push(`      incomplete plural: ${pl} — a ${locale} reader would see the key name`)
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
