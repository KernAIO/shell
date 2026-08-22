<script lang="ts">
import type { AvailableTransition, Issue, Priority, ResolvedField } from '@kernhq/module-tracker/client'
import { PRIORITY_GROUP_ORDER } from '@kernhq/module-tracker/client'
import { Avatar, Button, DropdownMenu, Icon, type MenuItem, Sheet, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { relativeTime } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getTrackerApi } from '../api'
import { getTrackerCatalogue } from '../context.svelte'
import { priorityLabel } from '../labels'
import { canTracker } from '../permissions'
import { trackerKeys } from '../query'
import { docFromText, renderDoc, textFromDoc } from '../richtext'
import CustomField from './CustomField.svelte'
import DueDate from './DueDate.svelte'
import PriorityGlyph from './PriorityGlyph.svelte'
import StatusIcon from './StatusIcon.svelte'

/**
 * The issue detail panel (DESIGN.md 3.13).
 *
 * A 440px panel over the content column rather than a page of its own: you keep your place in the
 * list, and closing it puts you back exactly where you were. Every property is editable in place,
 * and each edit is its own small mutation, so a failed request only rolls back the field it touched.
 */
interface Props {
  workspaceId: string
  /** the issue key from the URL, so a panel can be linked to and reopened after a reload */
  issueKey: string | null
  onclose: () => void
}
let { workspaceId, issueKey, onclose }: Props = $props()

/** The built-in properties, in the order the panel showed them before layouts existed. */
const FALLBACK_SIDEBAR: ResolvedField[] = [
  'status',
  'assignees',
  'priority',
  'dueDate',
  'labels',
  'cycle',
  'estimate',
  'project',
].map((fieldId, order) => ({
  fieldId,
  kind: 'system' as const,
  label: fieldId,
  section: 'sidebar' as const,
  order,
  required: false,
  pinned: fieldId === 'status',
  showInCards: false,
  field: null,
}))

const api = getTrackerApi()
const cat = getTrackerCatalogue()
const queryClient = useQueryClient()

let editingDescription = $state(false)
let descriptionDraft = $state('')
let commentDraft = $state('')

const issueQuery = createQuery(() => ({
  queryKey: trackerKeys.issue(workspaceId, issueKey ?? ''),
  queryFn: () => api.issues.getByKey({ workspaceId, key: issueKey as string }),
  enabled: Boolean(issueKey),
}))
const issue = $derived(issueQuery.data ?? null)
const issueId = $derived(issue?.id ?? null)

/**
 * What this issue's type says to show, in what order. The panel used to render eight fixed
 * properties; it now renders whatever the type's layout resolves to, with the built-in controls
 * keyed by field id so nothing about them changed.
 */
const layoutQuery = createQuery(() => ({
  queryKey: trackerKeys.layout(workspaceId, issue?.typeId ?? '', issue?.projectId ?? null),
  queryFn: () =>
    api.types.layout({
      workspaceId,
      id: issue?.typeId as string,
      projectId: issue?.projectId ?? null,
    }),
  enabled: Boolean(issue?.typeId),
}))
/**
 * Until the layout arrives, show the built-in properties in their default order rather than an
 * empty panel — the fields are already in `issue`, so a spinner here would be a blank column over
 * data we have.
 */
const sidebarFields = $derived(layoutQuery.data?.sidebar ?? FALLBACK_SIDEBAR)

const commentsQuery = createQuery(() => ({
  queryKey: trackerKeys.comments(workspaceId, issueId ?? ''),
  queryFn: () => api.issues.comments.list({ workspaceId, issueId: issueId as string, limit: 50 }),
  enabled: Boolean(issueId),
}))

const historyQuery = createQuery(() => ({
  queryKey: trackerKeys.history(workspaceId, issueId ?? ''),
  queryFn: () => api.issues.history({ workspaceId, issueId: issueId as string, limit: 50 }),
  enabled: Boolean(issueId),
}))

const transitionsQuery = createQuery(() => ({
  queryKey: trackerKeys.transitions(workspaceId, issueId ?? ''),
  queryFn: () => api.issues.transitions.available({ workspaceId, issueId: issueId as string }),
  enabled: Boolean(issueId),
}))

const project = $derived(cat.project(issue?.projectId))
const status = $derived(cat.status(issue?.statusId))
const cycle = $derived(cat.cycle(issue?.cycleId))
const watching = $derived(Boolean(issue && session.user && issue.watcherIds.includes(session.user.id)))

// the server enforces these too; here they decide whether a control is offered at all
const canEdit = $derived(canTracker('edit'))
const canTransition = $derived(canTracker('transition'))
const canComment = $derived(canTracker('comment'))

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: ['tracker', 'issue'] })
  void queryClient.invalidateQueries({ queryKey: ['tracker', 'transition'] })
}

const patch = createMutation(() => ({
  mutationFn: (input: Record<string, unknown>) =>
    api.issues.update({ workspaceId, issueId: issue?.id as string, patch: input as never }),
  onSuccess: invalidate,
  onError: (error: Error) => toast.error(error.message),
}))

const transition = createMutation(() => ({
  mutationFn: (transitionId: string) =>
    api.issues.transitions.apply({ workspaceId, issueId: issue?.id as string, transitionId }),
  onSuccess: () => {
    invalidate()
    void queryClient.invalidateQueries({ queryKey: trackerKeys.history(workspaceId, issue?.id ?? '') })
  },
  onError: (error: Error) => toast.error(error.message),
}))

const comment = createMutation(() => ({
  mutationFn: (text: string) =>
    api.issues.comments.create({
      workspaceId,
      issueId: issue?.id as string,
      body: docFromText(text) ?? { type: 'doc', content: [] },
    }),
  onSuccess: () => {
    commentDraft = ''
    void queryClient.invalidateQueries({ queryKey: trackerKeys.comments(workspaceId, issue?.id ?? '') })
    invalidate()
  },
  onError: (error: Error) => toast.error(error.message),
}))

const react = createMutation(() => ({
  mutationFn: (input: { commentId: string; emoji: string }) =>
    api.issues.comments.react({ workspaceId, ...input }),
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: trackerKeys.comments(workspaceId, issue?.id ?? '') }),
}))

const watch = createMutation(() => ({
  mutationFn: (next: boolean) =>
    next
      ? api.issues.watchers.add({ workspaceId, issueId: issue?.id as string })
      : api.issues.watchers.remove({
          workspaceId,
          issueId: issue?.id as string,
          userId: session.user?.id as string,
        }),
  onSuccess: invalidate,
}))

const statusMenu = $derived<MenuItem[]>(
  (transitionsQuery.data ?? [])
    .filter((t: AvailableTransition) => !t.hidden)
    .map((t: AvailableTransition) => ({
      id: t.id,
      label: t.toStatus.name,
      disabled: !t.allowed,
      hint: t.allowed ? undefined : (t.reasons[0]?.message ?? undefined),
      onSelect: () => transition.mutate(t.id),
    })),
)

const priorityMenu = $derived<MenuItem[]>(
  PRIORITY_GROUP_ORDER.map((p: Priority) => ({
    id: p,
    label: priorityLabel(p),
    icon: issue?.priority === p ? 'check' : undefined,
    onSelect: () => patch.mutate({ priority: p }),
  })),
)

const assigneeMenu = $derived<MenuItem[]>(
  cat.people.map((person) => ({
    type: 'checkbox' as const,
    id: person.id,
    label: person.name,
    checked: issue?.assigneeIds.some((id) => id === person.id) ?? false,
    onCheckedChange: (on: boolean) =>
      patch.mutate(on ? { assigneeAdd: [person.id] } : { assigneeRemove: [person.id] }),
  })),
)

const labelMenu = $derived<MenuItem[]>(
  cat.labels.map((label) => ({
    type: 'checkbox' as const,
    id: label.id,
    label: label.name,
    checked: issue?.labelIds.includes(label.id) ?? false,
    onCheckedChange: (on: boolean) =>
      patch.mutate(on ? { labelAdd: [label.id] } : { labelRemove: [label.id] }),
  })),
)

const cycleMenu = $derived<MenuItem[]>([
  { id: 'none', label: m.tracker_no_cycle(), onSelect: () => patch.mutate({ cycleId: null }) },
  { type: 'separator' as const },
  ...cat.cycles
    .filter((c) => c.status !== 'completed')
    .map((c) => ({
      id: c.id,
      label: c.name,
      icon: issue?.cycleId === c.id ? 'check' : undefined,
      onSelect: () => patch.mutate({ cycleId: c.id }),
    })),
])

const estimateMenu = $derived<MenuItem[]>([
  { id: 'none', label: m.tracker_no_estimate(), onSelect: () => patch.mutate({ estimate: null }) },
  { type: 'separator' as const },
  ...(project?.settings.estimateScale ?? [1, 2, 3, 5, 8]).map((value) => ({
    id: String(value),
    label: m.tracker_points({ count: value }),
    icon: issue?.estimate === value ? 'check' : undefined,
    onSelect: () => patch.mutate({ estimate: value }),
  })),
])

/** Comments and history interleaved, oldest first, the way the design shows the activity feed. */
const activity = $derived.by(() => {
  const comments = (commentsQuery.data?.items ?? []).map((c) => ({
    kind: 'comment' as const,
    at: c.createdAt,
    comment: c,
  }))
  const events = (historyQuery.data?.items ?? []).map((h) => ({
    kind: 'event' as const,
    at: h.occurredAt,
    event: h,
  }))
  return [...comments, ...events].sort((a, b) => a.at.localeCompare(b.at))
})

function startEditingDescription(current: Issue) {
  descriptionDraft = textFromDoc(current.description)
  editingDescription = true
}

function saveDescription() {
  patch.mutate({ description: docFromText(descriptionDraft) })
  editingDescription = false
}

function describeEvent(action: string, changes: Array<{ field: string; to: unknown }>): string {
  if (action === 'created') return m.tracker_event_created()
  const change = changes[0]
  if (action === 'status_changed' && change) {
    return m.tracker_event_status({ status: cat.status(String(change.to))?.name ?? String(change.to) })
  }
  return m.tracker_event_updated({ field: change?.field ?? '' })
}
</script>

<Sheet
  open={issueKey !== null}
  inline
  width={440}
  onOpenChange={(open) => {
    if (!open) onclose()
  }}
>
  {#snippet header()}
    {#if issue}
      <StatusIcon
        category={issue.statusCategory}
        statusId={issue.statusId}
        name={status?.name}
        size={16}
      />
      <span class="hkey">{issue.key}</span>
      <span class="hstatus">{status?.name ?? ''}</span>
    {/if}
  {/snippet}


  {#if !issue}
    <div class="loading"><Spinner /></div>
  {:else}
    <h1 class="title">{issue.title}</h1>

    {#snippet row_status()}
            <dt>{m.tracker_detail_status()}</dt>
            <dd>
              <DropdownMenu items={canTransition ? statusMenu : []} align="start">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="val"
                    class:static={!canTransition}
                    disabled={!canTransition}
                    title={canTransition ? undefined : m.tracker_no_permission()}
                    data-testid="status-picker"
                  >
                    <StatusIcon
                      category={issue.statusCategory}
                      statusId={issue.statusId}
                      name={status?.name}
                      size={15}
                    />
                    {status?.name ?? issue.statusId}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_assignees()}
            <dt>{m.tracker_detail_assignee()}</dt>
            <dd>
              <DropdownMenu items={canEdit ? assigneeMenu : []} align="start">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="val"
                    class:static={!canEdit}
                    disabled={!canEdit}
                    title={canEdit ? undefined : m.tracker_no_permission()}>
                    {#if issue.assigneeIds.length === 0}
                      <span class="muted">{m.tracker_unassigned()}</span>
                    {:else}
                      {#each issue.assigneeIds as id (id)}
                        {@const person = cat.person(id)}
                        <Avatar name={person?.name} src={person?.avatarUrl} {id} size={22} />
                      {/each}
                      <span>{cat.person(issue.assigneeIds[0])?.name ?? ''}</span>
                      {#if issue.assigneeIds.length > 1}
                        <span class="muted">+{issue.assigneeIds.length - 1}</span>
                      {/if}
                    {/if}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_priority()}
            <dt>{m.tracker_detail_priority()}</dt>
            <dd>
              <DropdownMenu items={canEdit ? priorityMenu : []} align="start">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="val"
                    class:static={!canEdit}
                    disabled={!canEdit}
                    title={canEdit ? undefined : m.tracker_no_permission()}>
                    <PriorityGlyph priority={issue.priority} size={15} />
                    {priorityLabel(issue.priority)}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_dueDate()}
            <dt>{m.tracker_detail_due()}</dt>
            <dd>
              <label class="val date" class:static={!canEdit}>
                {#if issue.dueDate}
                  <DueDate date={issue.dueDate} />
                {:else}
                  <span class="muted">{m.tracker_no_due()}</span>
                {/if}
                <input
                  type="date"
                  value={issue.dueDate ?? ''}
                  aria-label={m.tracker_detail_due()}
                  disabled={!canEdit}
                  onchange={(e) => patch.mutate({ dueDate: e.currentTarget.value || null })}
                />
              </label>
            </dd>

    {/snippet}

    {#snippet row_labels()}
            <dt>{m.tracker_detail_labels()}</dt>
            <dd>
              <DropdownMenu items={labelMenu} align="start">
                {#snippet trigger(props)}
                  <button {...props} type="button" class="val wrap">
                    {#if issue.labelIds.length === 0}
                      <span class="muted">{m.tracker_no_label()}</span>
                    {:else}
                      {#each issue.labelIds as id (id)}
                        {@const label = cat.label(id)}
                        <span class="lbl">
                          <span class="swatch" style:background={label?.color ?? 'var(--kern-ink-330)'}></span>
                          {label?.name ?? ''}
                        </span>
                      {/each}
                    {/if}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_cycle()}
            <dt>{m.tracker_detail_cycle()}</dt>
            <dd>
              <DropdownMenu items={canEdit ? cycleMenu : []} align="start">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="val"
                    class:static={!canEdit}
                    disabled={!canEdit}
                    title={canEdit ? undefined : m.tracker_no_permission()}>
                    {#if cycle}{cycle.name}{:else}<span class="muted">{m.tracker_no_cycle()}</span>{/if}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_estimate()}
            <dt>{m.tracker_detail_estimate()}</dt>
            <dd>
              <DropdownMenu items={canEdit ? estimateMenu : []} align="start">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    type="button"
                    class="val"
                    class:static={!canEdit}
                    disabled={!canEdit}
                    title={canEdit ? undefined : m.tracker_no_permission()}>
                    {#if issue.estimate !== null}
                      {m.tracker_points({ count: issue.estimate })}
                    {:else}
                      <span class="muted">{m.tracker_no_estimate()}</span>
                    {/if}
                  </button>
                {/snippet}
              </DropdownMenu>
            </dd>

    {/snippet}

    {#snippet row_project()}
            <dt>{m.tracker_detail_project()}</dt>
            <dd><span class="val static">{project?.name ?? ''}</span></dd>
    {/snippet}

    <dl class="props">
      <!-- Dispatched by field id: the layout decides which rows appear and in what order, and each
           built-in control is the same one the panel always had. -->
      {#each sidebarFields as f (f.fieldId)}
        {#if f.fieldId === 'status'}
          {@render row_status()}
        {:else if f.fieldId === 'assignees'}
          {@render row_assignees()}
        {:else if f.fieldId === 'priority'}
          {@render row_priority()}
        {:else if f.fieldId === 'dueDate'}
          {@render row_dueDate()}
        {:else if f.fieldId === 'labels'}
          {@render row_labels()}
        {:else if f.fieldId === 'cycle'}
          {@render row_cycle()}
        {:else if f.fieldId === 'estimate'}
          {@render row_estimate()}
        {:else if f.fieldId === 'project'}
          {@render row_project()}
        {:else if f.kind === 'custom' && f.field}
          <dt>{f.label}</dt>
          <dd>
            <CustomField
              field={f.field}
              value={issue.custom?.[f.field.key] ?? null}
              editable={canEdit}
              required={f.required}
              onchange={(value) => patch.mutate({ custom: { [f.field!.key]: value } })}
            />
          </dd>
        {/if}
      {/each}
    </dl>

    <section class="desc">
      {#if editingDescription}
        <textarea
          bind:value={descriptionDraft}
          rows="6"
          aria-label={m.tracker_detail_description()}
          onkeydown={(e) => {
            if (e.key === 'Escape') editingDescription = false
          }}
        ></textarea>
        <div class="row">
          <Button size="sm" onclick={saveDescription}>{m.save()}</Button>
          <Button size="sm" variant="ghost" onclick={() => (editingDescription = false)}>
            {m.cancel()}
          </Button>
        </div>
      {:else}
        <button
          type="button"
          class="prose"
          disabled={!canEdit}
          onclick={() => startEditingDescription(issue)}
        >
          {#if issue.description}
            <!-- rendered from stored ProseMirror JSON; see richtext.ts for the allowed nodes -->
            {@html renderDoc(issue.description)}
          {:else}
            <span class="muted">{m.tracker_no_description()}</span>
          {/if}
        </button>
      {/if}
    </section>

    <section class="activity">
      <div class="arow">
        <span class="kern-sublabel">{m.tracker_activity()}</span>
        <span class="sp"></span>
        <button type="button" class="watch" onclick={() => watch.mutate(!watching)}>
          <Icon name={watching ? 'eye' : 'eye-off'} size={13} strokeWidth={1.6} />
          {watching ? m.tracker_watching({ count: issue.watcherIds.length }) : m.tracker_watch()}
        </button>
      </div>

      {#each activity as entry (entry.kind === 'comment' ? entry.comment.id : entry.event.id)}
        {#if entry.kind === 'comment'}
          {@const person = cat.person(entry.comment.authorId)}
          <article class="thread">
            <Avatar name={person?.name} src={person?.avatarUrl} id={person?.id} size={28} />
            <div class="tbody">
              <div class="thead">
                <span class="author">{person?.name ?? ''}</span>
                <time datetime={entry.comment.createdAt}>{relativeTime(entry.comment.createdAt)}</time>
              </div>
              <div class="tprose">{@html renderDoc(entry.comment.body)}</div>
              <div class="reactions">
                {#each entry.comment.reactions as reaction (reaction.emoji)}
                  <button
                    type="button"
                    class="reaction"
                    class:mine={session.user ? reaction.userIds.includes(session.user.id) : false}
                    onclick={() =>
                      react.mutate({ commentId: entry.comment.id, emoji: reaction.emoji })}
                  >
                    {reaction.emoji}
                    {reaction.count}
                  </button>
                {/each}
                <button
                  type="button"
                  class="reaction add"
                  aria-label={m.tracker_add_reaction()}
                  onclick={() => react.mutate({ commentId: entry.comment.id, emoji: '👍' })}
                >
                  <Icon name="smile" size={13} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          </article>
        {:else}
          {@const person = cat.person(entry.event.actorId)}
          <div class="event">
            <span class="ename">{person?.name ?? m.audit_actor_system()}</span>
            {describeEvent(entry.event.action, entry.event.changes)}
            <time datetime={entry.event.occurredAt}>{relativeTime(entry.event.occurredAt)}</time>
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  {#snippet footer()}
    <form
      class="reply"
      onsubmit={(e) => {
        e.preventDefault()
        if (commentDraft.trim()) comment.mutate(commentDraft)
      }}
    >
      <input
        bind:value={commentDraft}
        disabled={!canComment}
        placeholder={canComment ? m.tracker_comment_placeholder() : m.tracker_no_permission()}
        aria-label={m.tracker_comment_placeholder()}
        data-testid="comment-input"
      />
    </form>
  {/snippet}
</Sheet>

<style>
  .loading {
    display: grid;
    place-items: center;
    padding: 40px;
  }
  .hkey {
    font-family: var(--kern-font-mono);
    font-size: 12px;
    letter-spacing: -0.01em;
    color: var(--kern-ink-300);
  }
  .hstatus {
    font-size: 13px;
    color: var(--kern-ink-550);
  }
  .title {
    margin: 0;
    font-size: 19px;
    font-weight: 600;
    line-height: 1.32;
    letter-spacing: -0.02em;
    color: var(--kern-ink-900);
    text-wrap: pretty;
  }
  .props {
    display: grid;
    grid-template-columns: 84px 1fr;
    align-items: center;
    gap: 10px 12px;
    margin: 18px 0 0;
    font-size: 13px;
  }
  .props dt {
    color: var(--kern-ink-350);
  }
  .props dd {
    margin: 0;
    min-width: 0;
  }
  .val {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    max-width: 100%;
    padding: 2px 6px;
    margin-inline-start: -6px;
    border-radius: var(--kern-r-md);
    color: var(--kern-ink-700);
    text-align: start;
  }
  .val:not(.static):hover {
    background: var(--kern-surface-hover);
  }
  .val.static,
  .val:disabled {
    cursor: default;
  }
  .prose:disabled {
    cursor: default;
  }
  .prose:disabled:hover {
    background: transparent;
  }
  .val.wrap {
    flex-wrap: wrap;
  }
  .val.date {
    position: relative;
    cursor: pointer;
  }
  .val.date input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
  }
  .muted {
    color: var(--kern-ink-350);
  }
  .lbl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    padding: 3px 9px;
    border-radius: var(--kern-r-md);
    background: var(--kern-surface-chip);
    color: var(--kern-ink-520);
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: var(--kern-r-full);
  }
  .desc {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--kern-border-hairline);
  }
  .prose {
    display: block;
    width: 100%;
    text-align: start;
    font-size: 14px;
    line-height: 1.6;
    color: var(--kern-ink-700);
    border-radius: var(--kern-r-lg);
  }
  .prose:hover {
    background: var(--kern-surface-hover);
  }
  .prose :global(p) {
    margin: 0 0 10px;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(code) {
    font-family: var(--kern-font-mono);
    font-size: 0.92em;
    background: var(--kern-surface-chip);
    padding: 1px 4px;
    border-radius: var(--kern-r-xs);
  }
  .desc textarea {
    width: 100%;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    padding: 10px 12px;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--kern-ink-800);
    resize: vertical;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .activity {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--kern-border-hairline);
  }
  .arow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .sp {
    flex: 1;
  }
  .watch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--kern-ink-400);
    padding: 3px 7px;
    border-radius: var(--kern-r-md);
  }
  .watch:hover {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-700);
  }
  .thread {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  .thead {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }
  .author {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  .thead time,
  .event time {
    font-size: 12px;
    color: var(--kern-ink-280);
  }
  .tprose {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--kern-ink-700);
    margin-top: 3px;
  }
  .tprose :global(p) {
    margin: 0 0 6px;
  }
  .tprose :global(p:last-child) {
    margin-bottom: 0;
  }
  .reactions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }
  .reaction {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 7px;
    border-radius: var(--kern-r-md);
    background: var(--kern-surface-chip);
    color: var(--kern-ink-520);
    font-size: 12px;
  }
  .reaction.mine {
    background: var(--kern-accent-tint);
    color: var(--kern-accent-deep);
  }
  .reaction.add {
    background: transparent;
    color: var(--kern-ink-350);
  }
  .reaction.add:hover {
    background: var(--kern-surface-hover);
  }
  .event {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px 38px;
    font-size: 12.5px;
    color: var(--kern-ink-450);
  }
  :global([dir='rtl']) .event {
    margin: 0 38px 14px 0;
  }
  .ename {
    font-weight: 500;
    color: var(--kern-ink-700);
  }
  .reply input {
    width: 100%;
    height: 36px;
    border: 1px solid var(--kern-border-strong);
    border-radius: var(--kern-r-lg);
    background: var(--kern-surface-raised);
    padding: 0 12px;
    font-size: 13.5px;
    color: var(--kern-ink-800);
  }
</style>
