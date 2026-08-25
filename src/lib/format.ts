import {
  formatCount,
  formatDate,
  formatDateRange,
  formatDateTime,
  localTime,
  relativeTime,
  today,
} from '@kernhq/ui'
import { timezoneCity } from '$lib/i18n/timezones.svelte'

/**
 * Locale-aware formatting.
 *
 * Everything except `localPlace` moved into `@kernhq/ui`, because a module's screens are full of
 * dates and counts and a module cannot import the app. They read the locale from the framework's
 * message runtime, which `setLocale` in `$lib/i18n/locale.ts` keeps in step with Paraglide's.
 *
 * `localPlace` stays here: it translates an IANA zone to a city name from CLDR data generated into
 * this repository, and nothing in a module needs it.
 */
export { formatCount, formatDate, formatDateRange, formatDateTime, localTime, relativeTime, today }

/**
 * Where this browser thinks it is — "Lisbon", "تهران", "New York".
 *
 * Read from the IANA zone rather than asked for or looked up: it is already correct, costs nothing
 * and never leaves the machine. The city is then translated like every other word on the screen —
 * see `$lib/i18n/timezones`. Zones without a city part ("UTC", "GMT+3") have nothing to show, so the
 * clock drops the place and shows only the time.
 */
export function localPlace(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return zone ? timezoneCity(zone) : null
}
