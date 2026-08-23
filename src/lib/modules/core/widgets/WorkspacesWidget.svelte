<script lang="ts">
import { formatCount } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import StatTileWidget from './StatTileWidget.svelte'

/** How many workspaces this person belongs to. Read from the session, so it costs no request. */
const value = $derived(session.workspaces.length)
</script>

<StatTileWidget label={m.home_stat_workspaces()} value={formatCount(value)} />
