/**
 * Translator tooling: see what a locale is missing, fill it in, or start a new one.
 *
 * Written for somebody who wants to improve one language and nothing else. Every command touches
 * `messages/<locale>.json` and, for `new`, the four other places a locale has to be declared —
 * which is why adding one by hand goes wrong.
 *
 *   node scripts/i18n.mjs missing fa      # what is left, with the English beside it
 *   node scripts/i18n.mjs fill fa         # write the gaps into fa.json as TODO, ready to edit
 *   node scripts/i18n.mjs new tr          # start Turkish
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const path = (p) => join(root, p)
const readJson = (p) => JSON.parse(readFileSync(path(p), 'utf8'))
const writeJson = (p, value) => writeFileSync(path(p), `${JSON.stringify(value, null, 2)}\n`)

const settings = readJson('project.inlang/settings.json')
const BASE = settings.baseLocale
const [command, locale] = process.argv.slice(2)

const usage = () => {
  console.error('usage: node scripts/i18n.mjs <missing|fill|new> <locale>')
  process.exit(1)
}
if (!command) usage()

/** Sorted the way the catalogues are, with `$schema` kept first. */
const sorted = (obj) => {
  const { $schema, ...rest } = obj
  const out = $schema ? { $schema } : {}
  for (const key of Object.keys(rest).sort()) out[key] = rest[key]
  return out
}

/** A variant message keeps its shape; only the English text is carried across as a starting point. */
const TODO = 'TODO'
const stub = (englishValue) => {
  if (!Array.isArray(englishValue)) return TODO
  const [{ declarations, selectors, match }] = englishValue
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
  const selector = selectors?.[0] ?? 'countPlural'
  return [
    {
      declarations,
      selectors,
      // Every category this locale uses, because a branch that is missing at runtime renders the
      // message key rather than a sentence.
      match: Object.fromEntries(
        categories.map((c) => [`${selector}=${c}`, match[`${selector}=${c}`] ?? TODO]),
      ),
    },
  ]
}

if (command === 'missing') {
  if (!locale) usage()
  const base = readJson(`messages/${BASE}.json`)
  const target = readJson(`messages/${locale}.json`)
  const gaps = Object.keys(base).filter((k) => !k.startsWith('$') && !(k in target))
  const todo = Object.keys(target).filter((k) => JSON.stringify(target[k]).includes(`"${TODO}"`))
  console.log(`${locale}: ${gaps.length} missing, ${todo.length} left as ${TODO}\n`)
  for (const key of gaps) console.log(`${key}\n    ${JSON.stringify(base[key])}`)
  for (const key of todo) console.log(`${key} (${TODO})\n    ${JSON.stringify(base[key])}`)
  process.exit(0)
}

if (command === 'fill') {
  if (!locale) usage()
  const base = readJson(`messages/${BASE}.json`)
  const target = readJson(`messages/${locale}.json`)
  let added = 0
  for (const [key, value] of Object.entries(base)) {
    if (key.startsWith('$') || key in target) continue
    target[key] = stub(value)
    added += 1
  }
  writeJson(`messages/${locale}.json`, sorted(target))
  console.log(`${locale}: ${added} key(s) written as ${TODO}.`)
  console.log(`Edit messages/${locale}.json, then: pnpm exec biome format --write messages/`)
  process.exit(0)
}

if (command === 'new') {
  if (!locale) usage()
  if (settings.locales.includes(locale)) {
    console.error(`${locale} is already declared in project.inlang/settings.json`)
    process.exit(1)
  }
  settings.locales = [...settings.locales, locale].sort()
  writeJson('project.inlang/settings.json', settings)
  writeJson(`messages/${locale}.json`, { $schema: readJson(`messages/${BASE}.json`).$schema })
  const rtl = ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ckb'].includes(locale)
  console.log(`Declared ${locale}. Still to do, by hand:

  1. messages/${locale}.json — run: node scripts/i18n.mjs fill ${locale}
  2. src/routes/(app)/[ws]/settings/appearance/+page.svelte — add ${locale} to localeNames,
     or the language picker shows the bare code
  3. ${rtl ? `src/routes/+layout.svelte — add '${locale}' to RTL, it is a right-to-left language` : `src/routes/+layout.svelte — nothing to do, ${locale} is left-to-right`}
  4. node scripts/gen-timezone-cities.mjs — writes src/lib/i18n/timezone-cities/${locale}.json
     from CLDR. Needs the network. Never translate those by hand.
  5. scripts/check-i18n.mjs — add ${locale} to REQUIRED once it is complete, so CI keeps it that way`)
  process.exit(0)
}

usage()
