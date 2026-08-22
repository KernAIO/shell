import type {
  Cycle,
  Label,
  Milestone,
  Project,
  StatusInfo,
  WorkItemType,
} from '@kernhq/module-tracker/client'
import { getContext, setContext } from 'svelte'

export interface Person {
  id: string
  name: string
  avatarUrl: string | null
}

/**
 * The reference data every tracker view needs to turn ids into something a person can read.
 *
 * Issues carry ids, not names: a row has a `projectId`, a `statusId` and `assigneeIds`. Rather than
 * threading six lists through every component, the page loads them once and publishes them here, and
 * the rows, cards and detail panel look up what they need. Kept in runes so a refetch (or a realtime
 * change) redraws the views that read it.
 */
export class TrackerCatalogue {
  projects = $state<Project[]>([])
  statuses = $state<StatusInfo[]>([])
  types = $state<WorkItemType[]>([])
  labels = $state<Label[]>([])
  cycles = $state<Cycle[]>([])
  milestones = $state<Milestone[]>([])
  people = $state<Person[]>([])

  #projects = $derived(new Map(this.projects.map((p) => [p.id, p])))
  #statuses = $derived(new Map(this.statuses.map((s) => [s.id, s])))
  #types = $derived(new Map(this.types.map((t) => [t.id, t])))
  #labels = $derived(new Map(this.labels.map((l) => [l.id, l])))
  #cycles = $derived(new Map(this.cycles.map((c) => [c.id, c])))
  #milestones = $derived(new Map(this.milestones.map((ms) => [ms.id, ms])))
  #people = $derived(new Map(this.people.map((p) => [p.id, p])))

  project = (id: string | null | undefined) => (id ? this.#projects.get(id) : undefined)
  status = (id: string | null | undefined) => (id ? this.#statuses.get(id) : undefined)
  type = (id: string | null | undefined) => (id ? this.#types.get(id) : undefined)
  label = (id: string | null | undefined) => (id ? this.#labels.get(id) : undefined)
  cycle = (id: string | null | undefined) => (id ? this.#cycles.get(id) : undefined)
  milestone = (id: string | null | undefined) => (id ? this.#milestones.get(id) : undefined)
  person = (id: string | null | undefined) => (id ? this.#people.get(id) : undefined)

  /** The active cycle drives the sprint progress bar in the header. */
  activeCycle = $derived(this.cycles.find((c) => c.status === 'active') ?? null)

  /** Workflow order of a status, used to sort list groups and board columns. */
  statusOrder = (id: string) => this.status(id)?.order ?? 99
  statusCategory = (id: string) => this.status(id)?.category ?? 'todo'
}

const KEY = Symbol('tracker.catalogue')

export function setTrackerCatalogue(catalogue: TrackerCatalogue): TrackerCatalogue {
  return setContext(KEY, catalogue)
}

export function getTrackerCatalogue(): TrackerCatalogue {
  const catalogue = getContext<TrackerCatalogue | undefined>(KEY)
  if (!catalogue) throw new Error('Tracker components must be rendered inside the tracker page')
  return catalogue
}
