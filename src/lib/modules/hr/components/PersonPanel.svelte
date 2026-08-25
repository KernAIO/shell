<script lang="ts">
import { Avatar, Badge, Button, Dialog, Field, Input, RightPanel, Skeleton, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import * as m from '$msg'
import { getHrApi } from '../api'
import { canHr } from '../permissions'
import { hrKeys, isoDate } from '../query'

/**
 * One person, beside the directory rather than instead of it.
 *
 * A panel rather than a route because picking somebody out of a list and going back to it is the
 * whole interaction — a full page navigation loses the list's scroll position and the search term,
 * and both are how the person got here.
 *
 * The record is editable here: name and contact, and ending employment. Those APIs existed before
 * this panel did; showing three fields and no actions was not a finished screen.
 */
interface Props {
  personId: string
  workspaceId: string
  workspaceSlug: string
}
const { personId, workspaceId, workspaceSlug }: Props = $props()

const api = getHrApi()
const queryClient = useQueryClient()

const personQuery = createQuery(() => ({
  queryKey: hrKeys.person(workspaceId, personId),
  enabled: Boolean(workspaceId && personId),
  queryFn: () => api.people.get({ workspaceId, personId }),
}))
const person = $derived(personQuery.data)

const resolutionQuery = createQuery(() => ({
  queryKey: hrKeys.resolution(workspaceId, personId),
  enabled: Boolean(workspaceId && personId),
  queryFn: () => api.offices.resolveFor({ workspaceId, personId }),
}))
const resolution = $derived(resolutionQuery.data)

const employmentQuery = createQuery(() => ({
  queryKey: hrKeys.employment(workspaceId, personId),
  enabled: Boolean(workspaceId && personId) && canHr('employmentView'),
  queryFn: () => api.employment.current({ workspaceId, personId }),
}))
const employment = $derived(employmentQuery.data)

const managerId = $derived(resolution?.managerPersonId ?? employment?.managerPersonId ?? null)
const managerQuery = createQuery(() => ({
  queryKey: hrKeys.person(workspaceId, managerId ?? ''),
  enabled: Boolean(workspaceId && managerId),
  queryFn: () => api.people.get({ workspaceId, personId: managerId! }),
}))

const close = () => void goto(`/${workspaceSlug}/hr`, { replaceState: true, keepFocus: true, noScroll: true })

let editing = $state(false)
let displayName = $state('')
let workEmail = $state('')
let personalEmail = $state('')
let phone = $state('')

$effect(() => {
  if (editing && person) {
    displayName = person.displayName
    workEmail = person.workEmail ?? ''
    personalEmail = person.personalEmail ?? ''
    phone = person.phone ?? ''
  }
})

const save = createMutation(() => ({
  mutationFn: () =>
    api.people.update({
      workspaceId,
      personId,
      displayName: displayName.trim(),
      workEmail: workEmail.trim() || null,
      personalEmail: personalEmail.trim() || null,
      phone: phone.trim() || null,
    }),
  onSuccess: () => {
    toast.success(m.hr_person_updated())
    void queryClient.invalidateQueries({ queryKey: ['hr'] })
    editing = false
  },
  onError: (error: Error) => toast.error(error.message),
}))

let offboarding = $state(false)
let lastDay = $state(isoDate())
let offboardReason = $state('')

const offboard = createMutation(() => ({
  mutationFn: () =>
    api.people.offboard({
      workspaceId,
      personId,
      on: lastDay,
      reason: offboardReason.trim() || undefined,
    }),
  onSuccess: (updated) => {
    toast.success(m.hr_person_offboarded({ name: updated.displayName }))
    void queryClient.invalidateQueries({ queryKey: ['hr'] })
    offboarding = false
  },
  onError: (error: Error) => toast.error(error.message),
}))

const typeLabel = (t: string) =>
  t === 'full_time'
    ? m.hr_employment_full_time()
    : t === 'part_time'
      ? m.hr_employment_part_time()
      : t === 'contract'
        ? m.hr_employment_contract()
        : t === 'intern'
          ? m.hr_employment_intern()
          : t === 'temporary'
            ? m.hr_employment_temporary()
            : t === 'freelance'
              ? m.hr_employment_freelance()
              : t

const canManage = $derived(canHr('personManage'))
const left = $derived(person?.status === 'terminated')
</script>

<RightPanel onClose={close} title={person?.displayName ?? ''}>
  {#if personQuery.isLoading}
    <div class="pad"><Skeleton height="120px" /></div>
  {:else if person}
    <div class="pad">
    <div class="head">
      <Avatar name={person.displayName} id={person.id} size={56} />
      <div>
        <h2>{person.displayName}</h2>
        {#if person.workEmail}<p class="meta">{person.workEmail}</p>{/if}
      </div>
    </div>

    <dl>
      {#if resolution?.primaryOfficeName}
        <dt>{m.hr_office()}</dt>
        <dd>{resolution.primaryOfficeName}</dd>
      {/if}
      {#if resolution?.timezone}
        <dt>{m.hr_local_time()}</dt>
        <dd>
          {new Intl.DateTimeFormat(undefined, {
            timeZone: resolution.timezone,
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date())}
          <span class="meta">{resolution.timezone}</span>
        </dd>
      {/if}
      {#if person.employeeNo}
        <dt>{m.hr_employee_no()}</dt>
        <dd>{person.employeeNo}</dd>
      {/if}
      {#if person.hiredOn}
        <dt>{m.hr_started()}</dt>
        <dd>
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(`${person.hiredOn}T00:00:00`),
          )}
        </dd>
      {/if}
      {#if person.phone}
        <dt>{m.hr_phone()}</dt>
        <dd>{person.phone}</dd>
      {/if}
      {#if resolution?.orgUnitPath}
        <dt>{m.hr_department()}</dt>
        <dd>{resolution.orgUnitPath}</dd>
      {/if}
      {#if managerQuery.data}
        <dt>{m.hr_manager()}</dt>
        <dd>{managerQuery.data.displayName}</dd>
      {/if}
      {#if employment}
        <dt>{m.hr_employment()}</dt>
        <dd>{typeLabel(employment.employmentType)}</dd>
      {/if}
    </dl>

    <Badge tone={person.status === 'active' ? 'active' : person.status === 'on_leave' ? 'upcoming' : 'grey'}
      >{person.status === 'active'
        ? m.hr_status_active()
        : person.status === 'on_leave'
          ? m.hr_status_on_leave()
          : person.status === 'onboarding'
            ? m.hr_status_onboarding()
            : person.status === 'offboarding'
              ? m.hr_status_offboarding()
              : m.hr_status_terminated()}</Badge
    >
    </div>
  {/if}

  {#snippet footer()}
    {#if canManage && person && !left}
      <div class="actions">
        <Button size="sm" variant="secondary" onclick={() => (editing = true)}>{m.hr_edit_person()}</Button>
        <Button size="sm" variant="danger" onclick={() => (offboarding = true)}>{m.hr_offboard()}</Button>
      </div>
    {/if}
  {/snippet}
</RightPanel>

<Dialog bind:open={editing} title={m.hr_edit_person()}>
  <div class="form">
    <Field label={m.hr_display_name()} id="hr-edit-name" required>
      {#snippet children(id)}
        <Input {id} bind:value={displayName} autocomplete="name" />
      {/snippet}
    </Field>
    <Field label={m.hr_work_email()} id="hr-edit-work" hint={m.optional()}>
      {#snippet children(id)}
        <Input {id} type="email" bind:value={workEmail} autocomplete="email" />
      {/snippet}
    </Field>
    <Field label={m.hr_personal_email()} id="hr-edit-personal" hint={m.optional()}>
      {#snippet children(id)}
        <Input {id} type="email" bind:value={personalEmail} />
      {/snippet}
    </Field>
    <Field label={m.hr_phone()} id="hr-edit-phone" hint={m.optional()}>
      {#snippet children(id)}
        <Input {id} type="tel" bind:value={phone} autocomplete="tel" />
      {/snippet}
    </Field>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (editing = false)}>{m.cancel()}</Button>
    <Button
      onclick={() => save.mutate()}
      disabled={displayName.trim().length === 0}
      loading={save.isPending}>{m.save()}</Button
    >
  {/snippet}
</Dialog>

<Dialog
  bind:open={offboarding}
  title={m.hr_offboard_title({ name: person?.displayName ?? '' })}
  description={m.hr_offboard_body()}
  size="sm"
>
  <div class="form">
    <Field label={m.hr_offboard_date()} id="hr-offboard-on" required>
      {#snippet children(id)}
        <Input {id} type="date" bind:value={lastDay} />
      {/snippet}
    </Field>
    <Field label={m.hr_offboard_reason()} id="hr-offboard-reason" hint={m.optional()}>
      {#snippet children(id)}
        <Input {id} bind:value={offboardReason} />
      {/snippet}
    </Field>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (offboarding = false)}>{m.cancel()}</Button>
    <Button variant="danger" onclick={() => offboard.mutate()} loading={offboard.isPending}
      >{m.hr_offboard()}</Button
    >
  {/snippet}
</Dialog>

<style>
.pad {
  padding: 18px 20px;
}
.head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-block-end: 16px;
}
h2 {
  margin: 0;
  font-size: 15px;
}
.meta {
  color: var(--kern-ink-500);
  font-size: 12px;
  margin: 0;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0 0 16px;
}
dt {
  color: var(--kern-ink-500);
  font-size: 12px;
}
dd {
  margin: 0;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: end;
}
.form {
  display: grid;
  gap: 14px;
}
</style>
