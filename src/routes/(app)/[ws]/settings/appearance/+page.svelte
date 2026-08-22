<script lang="ts">
import { Card, Field, Select } from '@kernalo/ui'
import { getLocale, locales, setLocale } from '$lib/paraglide/runtime'
import { type ThemeChoice, theme } from '$lib/state/theme.svelte'
import * as m from '$msg'

const themeOptions = [
  { value: 'light', label: m.theme_light() },
  { value: 'dark', label: m.theme_dark() },
  { value: 'system', label: m.theme_system() },
]

const localeNames: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
  de: 'Deutsch',
}
const localeOptions = locales.map((code) => ({ value: code, label: localeNames[code] ?? code }))
</script>

<svelte:head><title>{m.settings_appearance()} · {m.settings_title()}</title></svelte:head>

<Card class="p-5">
  <h2 class="text-[15px] font-semibold text-[var(--kern-ink-900)]">{m.appearance_title()}</h2>
  <p class="mt-1 text-[12.5px] text-[var(--kern-ink-500)]">{m.appearance_hint()}</p>

  <div class="mt-5 grid gap-4">
    <Field label={m.theme()} id="theme">
      <Select
        id="theme"
        value={theme.choice}
        options={themeOptions}
        onValueChange={(v) => theme.set(v as ThemeChoice)}
      />
    </Field>

    <Field label={m.language()} id="locale">
      <Select
        id="locale"
        value={getLocale()}
        options={localeOptions}
        onValueChange={(v) => setLocale(v as (typeof locales)[number])}
      />
    </Field>
  </div>
</Card>
