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
