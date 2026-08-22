/** File sizes for people, beside the uploader that produces them. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * A byte count as a short human string.
 *
 * Uses 1024, because that is what an operating system's file browser shows and a number that
 * disagrees with the one next to it in Finder reads as a bug.
 */
export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  // Whole numbers for bytes, one decimal above that: "1.4 MB" reads better than "1.44 MB".
  const digits = exponent === 0 ? 0 : value >= 10 ? 0 : 1
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[exponent]}`
}
