<script lang="ts">
import { Checkbox, SegmentedControl } from '@kernhq/ui'
import * as m from '$msg'

/**
 * Who a capability that is switched on is actually open to: everyone the switch already admits, or
 * only members of the groups picked here. This is not a second on/off switch — a member outside the
 * allowed groups sees exactly what an off capability shows everyone, so this control only matters
 * once the capability above it is already on.
 */
interface GroupOption {
  id: string
  name: string
}
interface Props {
  groups: GroupOption[]
  /** `null` = everyone; a list, even empty, = restricted to those groups */
  value: string[] | null
  disabled?: boolean
  onChange: (v: string[] | null) => void
}
let { groups, value, disabled = false, onChange }: Props = $props()

const mode = $derived(value === null ? 'everyone' : 'groups')

function setMode(next: string) {
  if (next === 'everyone') onChange(null)
  else onChange(value ?? [])
}
function toggleGroup(groupId: string, on: boolean) {
  const current = value ?? []
  onChange(on ? [...current, groupId] : current.filter((g) => g !== groupId))
}
</script>

<div class="grid gap-2.5">
  <div class={disabled ? 'pointer-events-none opacity-60' : ''}>
    <SegmentedControl
      size="sm"
      items={[
        { value: 'everyone', label: m.audience_everyone() },
        { value: 'groups', label: m.audience_specific_groups() },
      ]}
      value={mode}
      onValueChange={setMode}
      label={m.audience_who_can_use()}
    />
  </div>

  {#if mode === 'groups'}
    {#if groups.length === 0}
      <p class="text-[12px] text-[var(--kern-ink-450)]">{m.audience_no_groups()}</p>
    {:else}
      <div class="grid gap-1.5 rounded-[9px] border border-[var(--kern-border-hairline)] p-2.5">
        {#each groups as group (group.id)}
          <Checkbox
            checked={(value ?? []).includes(group.id)}
            {disabled}
            label={group.name}
            onCheckedChange={(on) => toggleGroup(group.id, on)}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>
