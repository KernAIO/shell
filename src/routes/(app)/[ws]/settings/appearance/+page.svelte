<script lang="ts">
import { Icon, Select, Switch } from '@kernhq/ui'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getLocale, locales, setLocale } from '$lib/paraglide/runtime'
import { prefs } from '$lib/state/prefs.svelte'
import { type ThemeChoice, theme } from '$lib/state/theme.svelte'
import * as m from '$msg'

/** Appearance is per-device: it lives in this browser rather than on the account. */
const THEMES: Array<{ value: ThemeChoice; label: string; icon: string }> = [
  { value: 'light', label: m.theme_light(), icon: 'sun' },
  { value: 'dark', label: m.theme_dark(), icon: 'moon' },
  { value: 'system', label: m.theme_system(), icon: 'monitor' },
]

const localeNames: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
  de: 'Deutsch',
  tr: 'Türkçe',
}
const localeOptions = locales.map((code) => ({ value: code, label: localeNames[code] ?? code }))
</script>


<SettingsPage title={m.appearance_title()} description={m.appearance_hint()}>
  <SettingsSection title={m.theme()}>
    <div class="grid grid-cols-3 gap-2.5 pt-1">
      {#each THEMES as option (option.value)}
        <button
          type="button"
          onclick={() => theme.set(option.value)}
          aria-pressed={theme.choice === option.value}
          class="grid gap-2 rounded-[10px] border p-3 text-start transition-colors {theme.choice ===
          option.value
            ? 'border-[var(--kern-accent)] bg-[var(--kern-accent-tint)]'
            : 'border-[var(--kern-border)] hover:border-[var(--kern-border-hover)]'}"
        >
          <!-- a miniature of the shell, so the choice is visible rather than described -->
          <span
            class="flex h-14 overflow-hidden rounded-[6px] border border-[var(--kern-border-hairline)] {option.value ===
            'dark'
              ? 'bg-[#1c1a17]'
              : option.value === 'light'
                ? 'bg-[#f0eee7]'
                : 'bg-gradient-to-r from-[#f0eee7] from-50% to-[#1c1a17] to-50%'}"
          >
            <span
              class="w-3 border-e {option.value === 'dark'
                ? 'border-[#2a2721] bg-[#181715]'
                : 'border-[#e4e0d6] bg-[#e9e6dd]'}"
            ></span>
            <span class="flex-1 p-1.5">
              <span
                class="block h-1.5 w-8 rounded-[2px] {option.value === 'dark' ? 'bg-[#3a362e]' : 'bg-[#d5cfc2]'}"
              ></span>
            </span>
          </span>

          <span class="flex items-center gap-1.5">
            <Icon name={option.icon} size={14} class="text-[var(--kern-ink-500)]" />
            <span class="text-[13px] text-[var(--kern-ink-800)]">{option.label}</span>
          </span>
        </button>
      {/each}
    </div>
  </SettingsSection>

  <SettingsSection title={m.appearance_interface()} description={m.appearance_interface_hint()}>
    <SettingsRow label={m.appearance_tabbar()} hint={m.appearance_tabbar_hint()} for="tabbar" first>
      <Switch
        id="tabbar"
        checked={prefs.tabBar}
        onCheckedChange={(v) => prefs.set('tabBar', v)}
      />
    </SettingsRow>
    <SettingsRow label={m.appearance_clock()} hint={m.appearance_clock_hint()} for="clock">
      <!-- the clock lives in the strip, so it has nowhere to be while the strip is off -->
      <Switch
        id="clock"
        checked={prefs.clock}
        disabled={!prefs.tabBar}
        onCheckedChange={(v) => prefs.set('clock', v)}
      />
    </SettingsRow>
  </SettingsSection>

  <SettingsSection title={m.language()} description={m.appearance_language_hint()}>
    <SettingsRow label={m.language()} for="locale" first>
      <Select
        id="locale"
        value={getLocale()}
        options={localeOptions}
        width="200px"
        onValueChange={(v) => setLocale(v as (typeof locales)[number])}
      />
    </SettingsRow>
  </SettingsSection>
</SettingsPage>
