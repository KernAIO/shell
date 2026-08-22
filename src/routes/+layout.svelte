<script lang="ts">
import { Toaster, TooltipProvider } from '@kernhq/ui'
import { QueryClientProvider } from '@tanstack/svelte-query'
import '@kernhq/ui/styles/index.css'
import '../app.css'
import { getLocale } from '$lib/paraglide/runtime'
import { createQueryClient } from '$lib/query'
import { theme } from '$lib/state/theme.svelte'

let { children } = $props()
const queryClient = createQueryClient()

const RTL = new Set(['fa', 'ar'])
const locale = $derived(getLocale())
const dir = $derived(RTL.has(locale) ? 'rtl' : 'ltr')

// keep <html lang/dir> in step with the chosen locale so RTL layout and hyphenation are correct
$effect(() => {
  document.documentElement.lang = locale
  document.documentElement.dir = dir
})
// referenced so the theme singleton initialises with the layout
$effect(() => void theme.resolved)
</script>

<QueryClientProvider client={queryClient}>
  <TooltipProvider>
    {@render children()}
    <Toaster />
  </TooltipProvider>
</QueryClientProvider>
