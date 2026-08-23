import { timezoneCity } from '$lib/i18n/timezones.svelte'
import { getLocale } from '$lib/paraglide/runtime'

/** Locale-aware relative time ("11m", "3h", "2d") for dense rows. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'narrow' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 864e5],
    ['month', 30 * 864e5],
    ['week', 7 * 864e5],
    ['day', 864e5],
    ['hour', 3600e3],
    ['minute', 60e3],
  ]
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(Math.round(diff / 1000), 'second')
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(getLocale(), opts).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Today's date as shown under the home greeting. */
export function today(): string {
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

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

/** The wall clock, in the interface language. */
export function localTime(at: Date = new Date()): string {
  return new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit' }).format(at)
}

/**
 * A count as a badge shows it.
 *
 * Numbers go through `Intl` for the same reason dates do: a Persian interface writes them in Persian
 * digits, and a badge reading "2" beside "۱۱ دقیقه پیش" is the one number on the screen that did not
 * get translated. The cap is here rather than in the badge component so every caller agrees on it —
 * a nav row is not wide enough to argue with a four-digit unread count.
 */
export function formatCount(n: number, max = 99): string {
  const nf = new Intl.NumberFormat(getLocale())
  return n > max ? `${nf.format(max)}+` : nf.format(n)
}
