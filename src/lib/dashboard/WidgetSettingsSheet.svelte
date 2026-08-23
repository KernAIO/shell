<script lang="ts">
import type { WidgetOption, WidgetSettings } from '@kernhq/ui'
import { Button, Field, Input, Select, Sheet, Switch } from '@kernhq/ui'
import type { WidgetEntry } from '$lib/modules/registry'
import * as m from '$msg'
import { resolveSettings } from './settings'

/**
 * One placed widget's settings, generated from what the widget declared.
 *
 * Generated rather than hand-written per widget so that every widget's settings look and behave the
 * same, and so the shell can still make sense of a stored value when the widget that wrote it is
 * gone.
 */
interface Props {
  open: boolean
  entry: WidgetEntry | undefined
  value: WidgetSettings
  workspaceId: string
  workspaceSlug: string
  userId: string | null
  onSave: (settings: WidgetSettings) => void
  onOpenChange: (open: boolean) => void
}
let {
  open = $bindable(false),
  entry,
  value,
  workspaceId,
  workspaceSlug,
  userId,
  onSave,
  onOpenChange,
}: Props = $props()

let draft = $state<WidgetSettings>({})
let loaded = $state<Record<string, WidgetOption[]>>({})

// Seeding runs on open, not on every change to `draft`: an effect that reads what it writes re-runs
// itself, and would discard whatever the person had just typed.
$effect(() => {
  if (!open || !entry) return
  draft = resolveSettings(entry.settings, value)
  loaded = {}
  for (const field of entry.settings ?? []) {
    if (field.kind !== 'select' || !field.loadOptions) continue
    const key = field.key
    void field
      .loadOptions({ workspaceId, workspaceSlug, userId })
      .then((options) => {
        loaded = { ...loaded, [key]: options }
      })
      .catch(() => {
        loaded = { ...loaded, [key]: [] }
      })
  }
})

/** `Select` speaks strings, so "any" needs a sentinel that no real option id can collide with. */
const ANY = '__any__'

function optionsFor(
  key: string,
  field: { options?: WidgetOption[]; nullable?: boolean; nullLabel?: string },
) {
  const base = loaded[key] ?? field.options ?? []
  const list = base.map((o) => ({ value: o.value, label: o.label }))
  return field.nullable ? [{ value: ANY, label: field.nullLabel ?? m.dash_any() }, ...list] : list
}
</script>

<Sheet
  bind:open
  title={entry ? m.dash_configure_title({ name: entry.title }) : ''}
  width={400}
  modal
  {onOpenChange}
>
  {#if entry}
    <div class="form">
      {#each entry.settings ?? [] as field (field.key)}
        <Field label={field.label}>
          {#snippet children(id)}
            {#if field.kind === 'number'}
              <Input
                {id}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={String(draft[field.key] ?? field.default)}
                oninput={(e) => {
                  draft = {
                    ...draft,
                    [field.key]: Number((e.currentTarget as HTMLInputElement).value),
                  }
                }}
              />
            {:else if field.kind === 'text'}
              <Input
                {id}
                placeholder={field.placeholder}
                maxlength={field.maxLength}
                value={String(draft[field.key] ?? '')}
                oninput={(e) => {
                  draft = { ...draft, [field.key]: (e.currentTarget as HTMLInputElement).value }
                }}
              />
            {:else if field.kind === 'toggle'}
              <Switch
                {id}
                checked={Boolean(draft[field.key])}
                onCheckedChange={(v) => {
                  draft = { ...draft, [field.key]: v }
                }}
              />
            {:else if field.kind === 'select'}
              <Select
                {id}
                value={draft[field.key] === null ? ANY : String(draft[field.key] ?? '')}
                options={optionsFor(field.key, field)}
                onValueChange={(v) => {
                  draft = { ...draft, [field.key]: v === ANY ? null : v }
                }}
              />
            {/if}
          {/snippet}
        </Field>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="ghost" onclick={() => onOpenChange(false)}>{m.cancel()}</Button>
    <Button
      onclick={() => {
        // A state proxy cannot be structuredClone'd, and this value travels into a mutation.
        onSave($state.snapshot(draft))
        onOpenChange(false)
      }}
    >
      {m.save()}
    </Button>
  {/snippet}
</Sheet>

<style>
  .form {
    display: grid;
    gap: 14px;
    padding-block: 4px;
  }
</style>
