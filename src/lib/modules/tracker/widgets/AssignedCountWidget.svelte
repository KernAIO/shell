<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import * as m from '$msg'
import CountWidget from './CountWidget.svelte'

let { workspaceId, workspaceSlug }: WidgetProps = $props()
</script>

<CountWidget
  label={m.widget_assigned_title()}
  kql="assignee = currentUser() and statusCategory in (todo, in_progress)"
  {workspaceId}
  href="/{workspaceSlug}/tracker?preset=assigned"
/>
