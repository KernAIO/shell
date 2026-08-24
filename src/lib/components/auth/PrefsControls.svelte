<script lang="ts">
import { DropdownMenu, Icon } from '@kernhq/ui'
import { getLocale, locales, setLocale } from '$lib/paraglide/runtime'
import { type ThemeChoice, theme } from '$lib/state/theme.svelte'
import * as m from '$msg'

/**
 * Language and theme, before there is an account to hang them on. Both are per-device settings, so
 * a reader can put the sign-in page into their own language and their own theme without an account
 * — which is the one moment they cannot reach Settings → Appearance.
 */
const localeNames: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
  de: 'Deutsch',
  tr: 'Türkçe',
}
const themeIcons: Record<ThemeChoice, string> = { light: 'sun', dark: 'moon', system: 'monitor' }
const themeOptions = $derived<Array<{ value: ThemeChoice; label: string; icon: string }>>([
  { value: 'light', label: m.theme_light(), icon: 'sun' },
  { value: 'dark', label: m.theme_dark(), icon: 'moon' },
  { value: 'system', label: m.theme_system(), icon: 'monitor' },
])
</script>

<div class="kprefs">
  <DropdownMenu
    side="top"
    align="start"
    items={[
      {
        type: 'radio',
        value: getLocale(),
        options: locales.map((code) => ({ value: code, label: localeNames[code] ?? code })),
        onValueChange: (v) => setLocale(v as (typeof locales)[number]),
      },
    ]}
  >
    {#snippet trigger(props)}
      <button type="button" class="kprefs-btn" aria-label={m.language()} {...props}>
        <Icon name="languages" size={14} strokeWidth={1.7} />
        <span>{localeNames[getLocale()] ?? getLocale()}</span>
      </button>
    {/snippet}
  </DropdownMenu>

  <DropdownMenu
    side="top"
    align="start"
    items={[
      {
        type: 'radio',
        value: theme.choice,
        options: themeOptions,
        onValueChange: (v) => theme.set(v as ThemeChoice),
      },
    ]}
  >
    {#snippet trigger(props)}
      <button type="button" class="kprefs-btn" aria-label={m.theme()} {...props}>
        <Icon name={themeIcons[theme.choice]} size={14} strokeWidth={1.7} />
        <span>{themeOptions.find((o) => o.value === theme.choice)?.label}</span>
      </button>
    {/snippet}
  </DropdownMenu>
</div>

<style>
  .kprefs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .kprefs-btn {
    display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px;
    border-radius: var(--kern-r-lg); color: var(--kern-ink-450); font-size: 12.5px;
    transition: background-color var(--kern-dur-fast), color var(--kern-dur-fast);
  }
  .kprefs-btn:hover { background: var(--kern-surface-hover); color: var(--kern-ink-700); }
  .kprefs-btn:focus-visible { outline: 2px solid var(--kern-accent); outline-offset: 1px; }
</style>
