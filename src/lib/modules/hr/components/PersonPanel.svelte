<script lang="ts">
import { Avatar, Badge, RightPanel, Skeleton } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import * as m from '$msg'
import { getHrApi } from '../api'
import { hrKeys } from '../query'

/**
 * One person, beside the directory rather than instead of it.
 *
 * A panel rather than a route because picking somebody out of a list and going back to it is the
 * whole interaction — a full page navigation loses the list's scroll position and the search term,
 * and both are how the person got here.
 */
interface Props {
  personId: string
  workspaceId: string
  workspaceSlug: string
}
const { personId, workspaceId, workspaceSlug }: Props = $props()

const api = getHrApi()

const personQuery = createQuery(() => ({
  queryKey: hrKeys.person(workspaceId, personId),
  enabled: Boolean(workspaceId && personId),
  queryFn: () => api.people.get({ workspaceId, personId }),
}))
const person = $derived(personQuery.data)

/**
 * Which office, calendar and timezone actually apply — straight from the server's own resolution.
 *
 * The support question this module will be asked most is "why does she have different holidays from
 * her team", and this is the screen that answers it without a database session.
 */
const resolutionQuery = createQuery(() => ({
  queryKey: hrKeys.resolution(workspaceId, personId),
  enabled: Boolean(workspaceId && personId),
  queryFn: () => api.offices.resolveFor({ workspaceId, personId }),
}))
const resolution = $derived(resolutionQuery.data)

const close = () => void goto(`/${workspaceSlug}/hr`)
</script>

<RightPanel onClose={close} title={person?.displayName ?? ''}>
  {#if personQuery.isLoading}
    <Skeleton height="120px" />
  {:else if person}
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
        <dt>#</dt>
        <dd>{person.employeeNo}</dd>
      {/if}
    </dl>

    <Badge tone={person.status === 'active' ? 'active' : 'grey'}>{person.status}</Badge>
  {/if}
</RightPanel>

<style>
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
</style>
