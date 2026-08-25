<script lang="ts">
import { EmptyState } from '@kernhq/ui'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import * as m from '$msg'

/**
 * schedules settings.
 *
 * The API behind this is complete — the module's server implements the full surface — but the
 * editing screen is not built yet. Saying so is deliberate: a settings page that renders controls
 * doing nothing is worse than one that admits what it is, and the shell only reaches this route
 * because the capability is on.
 */
</script>

<SettingsPage title={m.hr_settings_schedules()}>
  <EmptyState
    icon="clock"
    title={m.hr_settings_schedules()}
    description={m.hr_settings_not_built()}
  />
</SettingsPage>
