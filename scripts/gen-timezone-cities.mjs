#!/usr/bin/env node
/**
 * Generates the translated city name for every IANA time zone, one file per locale.
 *
 * `Intl` can localise a zone's *name* ("Nordamerikanische Ostküsten-Sommerzeit") but not its city,
 * and a name that long is not what a clock in the tab strip shows. CLDR carries the city — the
 * "exemplar city" — for every zone in every locale, so we take it from there at build time and ship
 * a small map rather than a dependency.
 *
 *   node scripts/gen-timezone-cities.mjs
 *
 * Re-run it when a locale is added to project.inlang, or when a new CLDR release renames a city.
 * It needs the network; the output is committed so nobody else does.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLDR = '46'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/lib/i18n/timezone-cities')

const settings = JSON.parse(await readFile(join(root, 'project.inlang/settings.json'), 'utf8'))
const locales = settings.locales

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

/** Every IANA id that names the same place, so a browser's spelling of a zone still resolves. */
async function zoneAliases() {
  const bcp47 = await fetchJson(`https://cdn.jsdelivr.net/npm/cldr-bcp47@${CLDR}/bcp47/timezone.json`)
  const keys = bcp47.keyword.u.tz
  const byPrimary = new Map()
  for (const [key, entry] of Object.entries(keys)) {
    if (key.startsWith('_') || typeof entry?._alias !== 'string') continue
    const ids = entry._alias.split(/\s+/).filter(Boolean)
    if (ids.length) byPrimary.set(ids[0], ids)
  }
  return byPrimary
}

/** Flattens CLDR's nested zone tree ({ Asia: { Tehran: { exemplarCity } } }) into ids. */
function flatten(node, prefix, out) {
  for (const [part, value] of Object.entries(node)) {
    if (typeof value !== 'object' || value === null) continue
    const id = prefix ? `${prefix}/${part}` : part
    if (typeof value.exemplarCity === 'string') out.set(id, value.exemplarCity)
    else flatten(value, id, out)
  }
}

/** What the app falls back to with no entry — so an entry that agrees with it need not ship. */
function mechanical(zone) {
  if (!zone.includes('/')) return null
  return (zone.split('/').pop() ?? '').replace(/_/g, ' ') || null
}

const aliases = await zoneAliases()
await mkdir(outDir, { recursive: true })

for (const locale of locales) {
  const data = await fetchJson(
    `https://cdn.jsdelivr.net/npm/cldr-dates-full@${CLDR}/main/${locale}/timeZoneNames.json`,
  )
  const zones = data.main[locale]?.dates?.timeZoneNames?.zone
  if (!zones) throw new Error(`no zone data for ${locale}`)

  const cities = new Map()
  flatten(zones, '', cities)

  const out = {}
  for (const [id, city] of cities) {
    for (const alias of aliases.get(id) ?? [id]) {
      // Etc/* zones are offsets, not places; a clock showing "GMT+3" has no city to name
      if (alias.startsWith('Etc/') || !alias.includes('/')) continue
      if (city === mechanical(alias)) continue
      out[alias] = city
    }
  }

  const sorted = Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((k) => [k, out[k]]),
  )
  const file = join(outDir, `${locale}.json`)
  await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`${locale}: ${Object.keys(sorted).length} cities → ${file.slice(root.length + 1)}`)
}
