<script lang="ts">
import type { Issue, Priority } from '@kernhq/module-tracker/client'
import { PRIORITY_GROUP_ORDER } from '@kernhq/module-tracker/client'
import { Button, Dialog, DropdownMenu, type MenuItem, Select, toast } from '@kernhq/ui'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { untrack } from 'svelte'
import * as m from '$msg'
import { getTrackerApi } from '../api'
import { getTrackerCatalogue } from '../context.svelte'
import { priorityLabel } from '../labels'
import { docFromText } from '../richtext'
import PriorityGlyph from './PriorityGlyph.svelte'

/**
 * Creating an issue, keyboard first.
 *
 * `c` opens it from anywhere in the tracker, the title has focus immediately, and Cmd/Ctrl+Enter
 * submits without reaching for the mouse. Everything except the title is optional and prefilled from
 * wherever you pressed `c` — the project you are looking at, the column you clicked `+` on.
 */
interface Props {
  open: boolean
  workspaceId: string
  /** prefilled from the caller: the project in view and the group the "+" belonged to */
  defaults?: { projectId?: string; statusId?: string; priority?: Priority; assigneeIds?: string[] }
  oncreated?: (issue: Issue) => void
}
let { open = $bindable(false), workspaceId, defaults = {}, oncreated }: Props = $props()

const api = getTrackerApi()
const cat = getTrackerCatalogue()
const queryClient = useQueryClient()

let title = $state('')
let description = $state('')
let projectId = $state('')
let typeId = $state('')
let priority = $state<Priority>('none')
let titleEl = $state<HTMLInputElement | null>(null)

// Reset when the dialog opens, and only then: the defaults come from queries that may still be
// settling, and re-running this while someone is typing would wipe what they had written.
$effect(() => {
  if (!open) return
  untrack(() => {
    title = ''
    description = ''
    priority = defaults.priority ?? 'none'
    projectId = defaults.projectId ?? cat.projects[0]?.id ?? ''
    typeId = cat.types.find((t) => t.isDefault)?.id ?? cat.types[0]?.id ?? ''
  })
})

const create = createMutation(() => ({
  mutationFn: () =>
    api.issues.create({
      workspaceId,
      projectId,
      typeId: typeId || undefined,
      title: title.trim(),
      description: docFromText(description),
      priority,
      statusId: defaults.statusId,
      assigneeIds: defaults.assigneeIds,
    }),
  onSuccess: (issue) => {
    toast.success(m.tracker_created({ key: issue.key }))
    void queryClient.invalidateQueries({ queryKey: ['tracker', 'issue'] })
    open = false
    oncreated?.(issue)
  },
  onError: (error: Error) => toast.error(error.message),
}))

const canSubmit = $derived(title.trim().length > 0 && projectId !== '')

function submit() {
  if (canSubmit && !create.isPending) create.mutate()
}

const priorityMenu = $derived<MenuItem[]>(
  PRIORITY_GROUP_ORDER.map((p) => ({
    id: p,
    label: priorityLabel(p),
    icon: priority === p ? 'check' : undefined,
    onSelect: () => (priority = p),
  })),
)
</script>

<Dialog bind:open title={m.tracker_new_issue()} size="lg" initialFocus={() => titleEl}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    onsubmit={(e) => {
      e.preventDefault()
      submit()
    }}
    onkeydown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    }}
  >
    <input
      bind:this={titleEl}
      bind:value={title}
      class="title"
      placeholder={m.tracker_title_placeholder()}
      aria-label={m.tracker_field_title()}
      data-testid="new-issue-title"
    />
    <textarea
      bind:value={description}
      class="body"
      rows="4"
      placeholder={m.tracker_description_placeholder()}
      aria-label={m.tracker_field_description()}
    ></textarea>

    <div class="controls">
      <Select
        bind:value={projectId}
        options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
        placeholder={m.tracker_field_project()}
        size="sm"
      />
      <Select
        bind:value={typeId}
        options={cat.types.map((t) => ({ value: t.id, label: t.name }))}
        placeholder={m.tracker_field_type()}
        size="sm"
      />
      <DropdownMenu items={priorityMenu} align="start">
        {#snippet trigger(props)}
          <button {...props} type="button" class="pri">
            <PriorityGlyph {priority} size={15} />
            {priorityLabel(priority)}
          </button>
        {/snippet}
      </DropdownMenu>
    </div>
  </form>

  {#snippet footer()}
    <span class="hint">{m.tracker_submit_hint()}</span>
    <Button variant="ghost" size="sm" onclick={() => (open = false)}>{m.cancel()}</Button>
    <Button size="sm" disabled={!canSubmit} loading={create.isPending} onclick={submit}>
      {m.create()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .title {
    width: 100%;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--kern-ink-900);
    background: transparent;
    border: 0;
    padding: 0 0 8px;
  }
  .title:focus-visible {
    box-shadow: none;
  }
  .body {
    width: 100%;
    border: 0;
    background: transparent;
    resize: vertical;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--kern-ink-700);
    padding: 0;
  }
  .body:focus-visible {
    box-shadow: none;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--kern-border-hairline);
  }
  .pri {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 11px;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-md);
    background: var(--kern-btn-secondary-bg);
    color: var(--kern-ink-650);
    font-size: 13px;
  }
  .pri:hover {
    background: var(--kern-btn-secondary-hover);
  }
  .hint {
    margin-inline-end: auto;
    font-family: var(--kern-font-mono);
    font-size: 11.5px;
    color: var(--kern-ink-250);
  }
</style>
