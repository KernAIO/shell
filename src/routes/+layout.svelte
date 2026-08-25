<script lang="ts">
import { setHost, setMessageLocale, Toaster, TooltipProvider } from '@kernhq/ui'
import { QueryClientProvider } from '@tanstack/svelte-query'
import '@kernhq/ui/styles/index.css'
import '../app.css'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { getApi, isMock } from '$lib/api/client'
import { putMockObject } from '$lib/files/mock-storage'
import { loadTimezoneCities } from '$lib/i18n/timezones.svelte'
import { getLocale } from '$lib/paraglide/runtime'
import { createQueryClient } from '$lib/query'
import { theme } from '$lib/state/theme.svelte'

let { children } = $props()
const queryClient = createQueryClient()

/**
 * Hand the framework the few things only the application can build, before anything renders.
 *
 * A module's screens reach for these through `@kernhq/ui` rather than importing the app, which they
 * cannot do. Keep it small: every field here is a thing a third-party module may depend on for ever.
 */
setHost({
  api: getApi(),
  apiBaseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : ''),
  isMock: isMock(),
  putMockObject,
})

const RTL = new Set(['fa', 'ar'])
const locale = $derived(getLocale())
const dir = $derived(RTL.has(locale) ? 'rtl' : 'ltr')

// keep <html lang/dir> in step with the chosen locale so RTL layout and hyphenation are correct
$effect(() => {
  document.documentElement.lang = locale
  document.documentElement.dir = dir
})
/**
 * Module strings resolve against the framework's own locale, not Paraglide's — a module ships its
 * bundles separately and Paraglide only compiles this repository's catalogues. This is the one
 * place the two are kept in step; forget it and every module screen stays in the previous language
 * while the shell around it changes.
 */
$effect(() => setMessageLocale(locale))
// referenced so the theme singleton initialises with the layout
$effect(() => void theme.resolved)
// the clock and the zone pickers name cities in the reader's language; fetch that language's list
loadTimezoneCities()
</script>

<QueryClientProvider client={queryClient}>
  <TooltipProvider>
    {@render children()}
    <Toaster />
  </TooltipProvider>
</QueryClientProvider>
