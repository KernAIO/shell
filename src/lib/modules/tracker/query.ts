/**
 * Query keys for the tracker.
 *
 * Same convention as the core keys in `$lib/query`: `[module, entity, ...scope]`. The realtime
 * gateway sends `{module, entity, id}` for every change, so a tracker event invalidates exactly the
 * lists and panels that depend on it instead of refetching the whole page.
 */
export const trackerKeys = {
  projects: (workspaceId: string) => ['tracker', 'project', workspaceId] as const,
  project: (workspaceId: string, projectId: string) =>
    ['tracker', 'project', workspaceId, projectId] as const,
  statuses: (workspaceId: string) => ['tracker', 'status', workspaceId] as const,
  types: (workspaceId: string) => ['tracker', 'type', workspaceId] as const,
  labels: (workspaceId: string) => ['tracker', 'label', workspaceId] as const,
  fields: (workspaceId: string) => ['tracker', 'field', workspaceId] as const,
  cycles: (workspaceId: string, projectId: string | null) =>
    ['tracker', 'cycle', workspaceId, projectId ?? 'all'] as const,
  milestones: (workspaceId: string, projectId: string | null) =>
    ['tracker', 'milestone', workspaceId, projectId ?? 'all'] as const,
  views: (workspaceId: string) => ['tracker', 'view', workspaceId] as const,
  /** one entry per distinct query: the KQL string and ordering are the scope */
  issues: (workspaceId: string, scope: string) => ['tracker', 'issue', workspaceId, scope] as const,
  issue: (workspaceId: string, issueId: string) => ['tracker', 'issue', workspaceId, issueId] as const,
  comments: (workspaceId: string, issueId: string) => ['tracker', 'comment', workspaceId, issueId] as const,
  history: (workspaceId: string, issueId: string) => ['tracker', 'history', workspaceId, issueId] as const,
  transitions: (workspaceId: string, issueId: string) =>
    ['tracker', 'transition', workspaceId, issueId] as const,
  kqlFields: (workspaceId: string) => ['tracker', 'kql-field', workspaceId] as const,
}
