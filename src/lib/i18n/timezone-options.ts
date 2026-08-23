import type { SelectOption } from '@kernhq/ui'
import * as m from '$msg'
import { timezoneCity, timezoneOffset, timezoneRegion, zoneIdCity } from './timezones.svelte'

/**
 * The zone pickers' options: the city in the reader's language, grouped by region.
 *
 * The zone id stays on as the description — it is what the server stores, it is what a support
 * request quotes, and it is the only thing that tells two Georgetowns apart.
 *
 * Call this inside a `$derived`: the city names arrive asynchronously, so the list has to be rebuilt
 * when they land.
 */
export function timezoneOptions(zones: string[], firstGroup?: string): SelectOption[] {
  const regions: Record<string, string> = {
    Africa: m.tz_region_africa(),
    America: m.tz_region_america(),
    Antarctica: m.tz_region_antarctica(),
    Arctic: m.tz_region_arctic(),
    Asia: m.tz_region_asia(),
    Atlantic: m.tz_region_atlantic(),
    Australia: m.tz_region_australia(),
    Etc: m.tz_region_etc(),
    Europe: m.tz_region_europe(),
    Indian: m.tz_region_indian(),
    Pacific: m.tz_region_pacific(),
  }
  const seen = new Set<string>()
  return zones.flatMap((zone, i) => {
    if (seen.has(zone)) return []
    seen.add(zone)
    const region = timezoneRegion(zone)
    const city = timezoneCity(zone) ?? zoneIdCity(zone) ?? zone
    const offset = timezoneOffset(zone)
    return [
      {
        value: zone,
        label: offset ? `${city} · ${offset}` : city,
        description: zone,
        // the reader's own zone is pinned above the regions rather than hunted for among six hundred
        group: firstGroup && i === 0 ? firstGroup : (region && regions[region]) || m.tz_region_other(),
      },
    ]
  })
}
