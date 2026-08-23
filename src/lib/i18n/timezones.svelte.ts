import { getLocale } from '$lib/paraglide/runtime'

/**
 * Time zones, named the way the reader names them.
 *
 * `Intl` localises a zone's *name* — "Nordamerikanische Ostküsten-Sommerzeit" — but never its city,
 * and a name that long is not what a clock in the tab strip shows. The cities come from CLDR instead,
 * generated per locale by `scripts/gen-timezone-cities.mjs`; a file only carries the zones whose city
 * differs from the zone id, which is why English is a few dozen entries and Persian is every one.
 *
 * The map arrives asynchronously and is read synchronously, so it is `$state`: the clock renders the
 * zone id's own city first and settles on the translation as soon as the file lands. Changing the
 * locale reloads the page (Paraglide's cookie strategy), so there is only ever one to load.
 */

const FILES = import.meta.glob<Record<string, string>>('./timezone-cities/*.json', {
  import: 'default',
})

const store = $state<{ cities: Record<string, string> }>({ cities: {} })
let started = false

/** Starts loading the current locale's cities. Idempotent; call it once as the app boots. */
export function loadTimezoneCities(): void {
  if (started) return
  started = true
  const load = FILES[`./timezone-cities/${getLocale()}.json`]
  if (!load) return
  load()
    .then((cities) => {
      store.cities = cities
    })
    // a missing chunk costs the reader nothing: every lookup already falls back to the zone id
    .catch(() => {})
}

/** The city inside a zone id — "Asia/Tehran" → "Tehran". Zones without one ("UTC") have no city. */
export function zoneIdCity(zone: string): string | null {
  if (!zone.includes('/')) return null
  return (zone.split('/').pop() ?? '').replace(/_/g, ' ') || null
}

/**
 * The zone's city in the interface language — "تهران", "Nuuk", "Kalkutta".
 *
 * `null` for a zone that names no place ("UTC", "Etc/GMT+3"), so a caller can drop the label rather
 * than print an offset twice.
 */
export function timezoneCity(zone: string): string | null {
  return store.cities[zone] ?? zoneIdCity(zone)
}

/** The region a zone is filed under — "Asia", "America". Untranslated: the caller has the messages. */
export function timezoneRegion(zone: string): string | null {
  const [region] = zone.split('/')
  return zone.includes('/') && region ? region : null
}

/** The zone's current offset, as a label — "GMT+3:30". */
export function timezoneOffset(zone: string, at: Date = new Date()): string {
  try {
    return (
      new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    )
  } catch {
    return ''
  }
}

/** Every zone this browser knows, `preferred` first so the reader's own is not buried. */
export function timezoneList(preferred: string[] = []): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']
  return [...new Set([...preferred.filter(Boolean), ...all])]
}
