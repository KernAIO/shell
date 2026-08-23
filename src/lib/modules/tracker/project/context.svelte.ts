import type { Project } from '@kernhq/module-tracker/client'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { session } from '$lib/state/session.svelte'
import { getTrackerApi } from '../api'
import { trackerKeys } from '../query'

/**
 * The project a page is about, taken from the URL.
 *
 * Every one of a project's pages needs the same three things — the workspace, the project and
 * whether it has arrived yet — and they must not each resolve them differently. The list itself is
 * one query the whole tracker shares, so asking for it here costs nothing beyond the first page.
 */
export interface RouteProject {
  readonly slug: string
  readonly workspaceId: string
  readonly projectKey: string
  readonly project: Project | null
  readonly projectId: string
  readonly pending: boolean
}

export function useRouteProject(): RouteProject {
  const api = getTrackerApi()

  const slug = $derived(page.params.ws ?? '')
  const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
  const projectKey = $derived((page.params.key ?? '').toUpperCase())

  const projectsQuery = createQuery(() => ({
    queryKey: trackerKeys.projects(workspaceId),
    queryFn: () => api.projects.list({ workspaceId }),
    enabled: Boolean(workspaceId),
  }))

  const project = $derived((projectsQuery.data ?? []).find((p) => p.key === projectKey) ?? null)

  return {
    get slug() {
      return slug
    },
    get workspaceId() {
      return workspaceId
    },
    get projectKey() {
      return projectKey
    },
    get project() {
      return project
    },
    get projectId() {
      return project?.id ?? ''
    },
    get pending() {
      return projectsQuery.isPending
    },
  }
}
