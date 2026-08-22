/**
 * In-memory implementation of the core API.
 *
 * Enabled with `PUBLIC_API_MOCK=1` (`pnpm dev:mock`). It exists so the interface can be built, demoed
 * and tested without running Postgres, NATS and the services — and so the end-to-end tests have a
 * deterministic backend. It implements the same shapes as the real contract; anything not implemented
 * throws loudly rather than silently returning empty data.
 */

import { mockObjectUrl } from '$lib/files/mock-storage'

const now = Date.now()
const iso = (msAgo = 0) => new Date(now - msAgo).toISOString()
const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, '0')}`

const CORE_PERMISSIONS = [
  'core.workspace.view',
  'core.workspace.manage',
  'core.workspace.delete',
  'core.members.view',
  'core.members.invite',
  'core.members.manage',
  'core.roles.manage',
  'core.modules.manage',
  'core.integrations.manage',
  'core.audit.view',
  'core.files.upload',
  'core.webhooks.manage',
  'core.export.run',
]

const PERMISSION_LABELS: Record<string, string> = {
  'core.workspace.view': 'View the workspace',
  'core.workspace.manage': 'Change workspace settings',
  'core.workspace.delete': 'Archive or delete the workspace',
  'core.members.view': 'See who is a member',
  'core.members.invite': 'Invite people',
  'core.members.manage': 'Change roles and remove members',
  'core.roles.manage': 'Create and edit roles',
  'core.modules.manage': 'Turn modules on and off',
  'core.integrations.manage': 'Configure integrations and secrets',
  'core.audit.view': 'Read the audit log',
  'core.files.upload': 'Upload files',
  'core.webhooks.manage': 'Manage webhooks and API tokens',
  'core.export.run': 'Export workspace data',
}

const MODULE_PERMISSIONS = [
  { key: 'tracker.issue.view', label: 'View work items', module: 'tracker', dangerous: false },
  { key: 'tracker.issue.create', label: 'Create work items', module: 'tracker', dangerous: false },
  { key: 'tracker.issue.edit', label: 'Edit work items they reported', module: 'tracker', dangerous: false },
  { key: 'tracker.issue.edit_any', label: 'Edit any work item', module: 'tracker', dangerous: false },
  { key: 'tracker.issue.delete_any', label: 'Delete any work item', module: 'tracker', dangerous: true },
  { key: 'tracker.triage.manage', label: 'Triage incoming reports', module: 'tracker', dangerous: false },
  {
    key: 'tracker.version.manage',
    label: 'Manage versions and releases',
    module: 'tracker',
    dangerous: false,
  },
  { key: 'tracker.workflow.manage', label: 'Change workflows', module: 'tracker', dangerous: true },
  { key: 'chat.channel.view', label: 'Browse channels', module: 'chat', dangerous: false },
  { key: 'chat.channel.create', label: 'Create channels', module: 'chat', dangerous: false },
  { key: 'chat.message.post', label: 'Post messages', module: 'chat', dangerous: false },
  { key: 'chat.message.delete_any', label: 'Delete anyone’s message', module: 'chat', dangerous: true },
]

const user = {
  id: id(1),
  email: 'maya@northstar.dev',
  name: 'Maya Rivera',
  username: 'maya',
  avatarUrl: null,
  locale: 'en' as const,
  timezone: 'Europe/Istanbul',
  instanceAdmin: true,
  status: 'active' as const,
  emailVerified: true,
  createdAt: iso(90 * 864e5),
  updatedAt: iso(864e5),
}

const people = [
  user,
  {
    ...user,
    id: id(2),
    email: 'dan@northstar.dev',
    name: 'Dan Brekke',
    username: 'dan',
    instanceAdmin: false,
  },
  {
    ...user,
    id: id(3),
    email: 'tomas@northstar.dev',
    name: 'Tomás Lindqvist',
    username: 'tomas',
    instanceAdmin: false,
  },
  {
    ...user,
    id: id(4),
    email: 'ines@atlas.example',
    name: 'Inés Cabrera',
    username: 'ines',
    instanceAdmin: false,
  },
]

const workspaces = [
  {
    id: id(10),
    slug: 'northstar',
    name: 'Northstar',
    description: 'Platform team' as string | null,
    logoUrl: null,
    accentColor: null,
    autoJoinDomains: ['northstar.dev'],
    defaultRole: 'member' as const,
    plan: 'self_hosted' as const,
    archivedAt: null,
    createdBy: user.id,
    createdAt: iso(120 * 864e5),
    updatedAt: iso(3 * 864e5),
  },
  {
    id: id(11),
    slug: 'atlas',
    name: 'Atlas Studio',
    description: 'Client work' as string | null,
    logoUrl: null,
    accentColor: '#3A69B8',
    autoJoinDomains: [],
    defaultRole: 'member' as const,
    plan: 'self_hosted' as const,
    archivedAt: null,
    createdBy: user.id,
    createdAt: iso(40 * 864e5),
    updatedAt: iso(864e5),
  },
]

type MockNotification = {
  id: string
  userId: string
  workspaceId: string | null
  module: string
  type: string
  title: string
  body: string | null
  object: { module: string; type: string; id: string } | null
  url: string | null
  actor: { id: string; name: string; avatarUrl: string | null } | null
  data: Record<string, unknown>
  groupKey: string | null
  readAt: string | null
  archivedAt: string | null
  createdAt: string
}

const notifications: MockNotification[] = [
  {
    id: id(20),
    userId: user.id,
    workspaceId: workspaces[0]!.id,
    module: 'chat',
    type: 'chat.mention',
    title: 'Dan mentioned you in #platform',
    body: 'can you take a look at the migration plan before standup?',
    object: { module: 'chat', type: 'channel', id: id(30) },
    url: `/chat/${id(30)}`,
    actor: { id: people[1]!.id, name: people[1]!.name, avatarUrl: null },
    data: {},
    groupKey: id(30),
    readAt: null,
    archivedAt: null,
    createdAt: iso(11 * 60_000),
  },
  {
    id: id(21),
    userId: user.id,
    workspaceId: workspaces[0]!.id,
    module: 'tracker',
    type: 'tracker.issue.assigned',
    title: 'KRN-412 assigned to you',
    body: 'Voice rooms drop after 20 minutes',
    object: { module: 'tracker', type: 'issue', id: id(31) },
    url: '/tracker/KRN-412',
    actor: { id: people[2]!.id, name: people[2]!.name, avatarUrl: null },
    data: {},
    groupKey: null,
    readAt: null,
    archivedAt: null,
    createdAt: iso(3 * 3600_000),
  },
  {
    id: id(22),
    userId: user.id,
    workspaceId: workspaces[1]!.id,
    module: 'tracker',
    type: 'tracker.issue.commented',
    title: 'Inés commented on ATL-88',
    body: 'Pushed the revised storyboard, ready for review.',
    object: { module: 'tracker', type: 'issue', id: id(32) },
    url: '/tracker/ATL-88',
    actor: { id: people[3]!.id, name: people[3]!.name, avatarUrl: null },
    data: {},
    groupKey: null,
    readAt: null,
    archivedAt: null,
    createdAt: iso(26 * 3600_000),
  },
  {
    id: id(23),
    userId: user.id,
    workspaceId: workspaces[0]!.id,
    module: 'core',
    type: 'core.member.joined',
    title: 'Tomás joined Northstar',
    body: null,
    object: null,
    url: '/settings/members',
    actor: null,
    data: {},
    groupKey: null,
    readAt: iso(2 * 864e5),
    archivedAt: null,
    createdAt: iso(2 * 864e5),
  },
]

const members = [
  { userId: people[0]!.id, role: 'owner', title: 'Founder' as string | null, status: 'active' },
  { userId: people[1]!.id, role: 'admin', title: 'Engineering lead' as string | null, status: 'active' },
  { userId: people[2]!.id, role: 'member', title: 'Design' as string | null, status: 'active' },
]

const moduleManifests = [
  {
    id: 'core',
    name: 'Core',
    version: '0.1.0',
    description: 'Accounts, workspaces, members, permissions, notifications, settings, files and search',
    icon: 'settings',
    core: true,
    dependsOn: [] as string[],
    permissionCount: 13,
    eventCount: 12,
    objectTypeCount: 2,
    hasSettings: false,
  },
  {
    id: 'chat',
    name: 'Chat',
    version: '0.1.0',
    description:
      'Channels, direct messages and threads, with reactions, mentions, read state and per-object discussions',
    icon: 'message-square-text',
    core: false,
    dependsOn: ['core'],
    permissionCount: 9,
    eventCount: 8,
    objectTypeCount: 2,
    hasSettings: true,
  },
  {
    id: 'tracker',
    name: 'Issues',
    version: '0.1.0',
    description: 'Projects and work items with custom fields, workflows, cycles, milestones and saved views',
    icon: 'target',
    core: false,
    dependsOn: ['core'],
    permissionCount: 18,
    eventCount: 11,
    objectTypeCount: 5,
    hasSettings: true,
  },
  {
    id: 'docs',
    name: 'Docs',
    version: '0.1.0',
    description: 'Collaborative pages with live editing, version history and publishing',
    icon: 'file-text',
    core: false,
    dependsOn: ['core'],
    permissionCount: 6,
    eventCount: 4,
    objectTypeCount: 2,
    hasSettings: false,
  },
  {
    id: 'mail',
    name: 'Mail',
    version: '0.1.0',
    description: 'Outbound email providers, templates, delivery log and suppression lists',
    icon: 'mail',
    core: false,
    dependsOn: ['core'],
    permissionCount: 2,
    eventCount: 3,
    objectTypeCount: 0,
    hasSettings: true,
  },
  {
    id: 'hr',
    name: 'People',
    version: '0.1.0',
    description: 'Employees, org chart, leave requests with approvals, holidays and onboarding',
    icon: 'users',
    core: false,
    dependsOn: ['core', 'docs'],
    permissionCount: 11,
    eventCount: 7,
    objectTypeCount: 4,
    hasSettings: true,
  },
]

/** Shapes a seed entry like the manifest the real API returns. */
const manifestOf = (m: (typeof moduleManifests)[number]) => ({
  id: m.id,
  name: m.name,
  version: m.version,
  description: m.description,
  icon: m.icon,
  core: m.core,
  dependsOn: m.dependsOn,
  permissions: Array.from({ length: m.permissionCount }, (_, i) => ({
    key: `${m.id}.permission.${i}`,
    label: `${m.name} permission ${i + 1}`,
    scope: 'workspace',
    defaultRoles: [],
    dangerous: false,
  })),
  events: Array.from({ length: m.eventCount }, (_, i) => `${m.id}.event.${i}`),
  objectTypes: Array.from({ length: m.objectTypeCount }, (_, i) => ({
    type: `${m.id}-object-${i}`,
    label: `${m.name} object ${i + 1}`,
    channelable: false,
  })),
  settingsSchema: m.hasSettings ? { type: 'object', properties: {} } : undefined,
  defaultHost: 'core',
})

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const wsById = (workspaceId: string) => workspaces.find((w) => w.id === workspaceId)
const notImplemented = (name: string) => () => {
  throw new Error(`[mock] ${name} is not implemented`)
}

/** Files uploaded during a demo. The bytes live in `$lib/files/mock-storage`; this is the metadata. */
type MockFile = {
  id: string
  workspaceId: string
  name: string
  mimeType: string
  size: number
  key: string
  sha256: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  thumbnailKey: string | null
  attachedTo: { module: string; type: string; id: string } | null
  uploadedBy: string
  status: 'pending' | 'ready' | 'failed' | 'deleted'
  createdAt: string
}

export function createMockApi() {
  const files = new Map<string, MockFile>()
  let fileCounter = 0
  const fileId = (n: number) => `01920000-0000-7000-8003-${String(n).padStart(12, '0')}`

  const state = {
    notifications: clone(notifications),
    workspaces: clone(workspaces),
    members: clone(members),
    enabled: new Map<string, Set<string>>(),
    invitations: [] as Array<Record<string, unknown>>,
    roles: [
      {
        id: id(400),
        workspaceId: workspaces[0]!.id,
        name: 'Release manager',
        description: 'Runs releases without full admin rights' as string | null,
        permissions: ['core.members.view', 'core.audit.view', 'tracker.version.manage'],
        builtin: false,
        createdAt: iso(20 * 864e5),
      },
      {
        id: id(401),
        workspaceId: workspaces[0]!.id,
        name: 'Support',
        description: 'Triages incoming reports' as string | null,
        permissions: ['core.members.view', 'tracker.issue.view', 'tracker.triage.manage'],
        builtin: false,
        createdAt: iso(9 * 864e5),
      },
    ],
    groups: [
      {
        id: id(500),
        name: 'Platform',
        handle: 'platform',
        description: 'Core services team',
        memberCount: 3,
      },
      { id: id(501), name: 'Design', handle: 'design', description: null as string | null, memberCount: 2 },
    ],
  }
  const enabledFor = (workspaceId: string) => {
    let set = state.enabled.get(workspaceId)
    if (!set) {
      set = new Set(['core', 'chat', 'tracker'])
      state.enabled.set(workspaceId, set)
    }
    return set
  }
  const summary = (w: (typeof workspaces)[number]) => {
    const unread = state.notifications.filter(
      (n) => n.workspaceId === w.id && !n.readAt && !n.archivedAt,
    ).length
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      logoUrl: w.logoUrl,
      accentColor: w.accentColor,
      role: 'owner' as const,
      unread,
      mentions: state.notifications.filter(
        (n) => n.workspaceId === w.id && !n.readAt && !n.archivedAt && n.type.endsWith('mention'),
      ).length,
      memberCount: state.members.length,
    }
  }

  return {
    health: async () => ({ ok: true, service: 'mock', version: '0.1.0', modules: ['core'] }),

    users: {
      me: async () => ({
        user: clone(user),
        workspaces: state.workspaces.map(summary),
        permissionVersion: 1,
      }),
      updateMe: async (input: Record<string, unknown>) => Object.assign(clone(user), input),
      get: async ({ id: userId }: { id: string }) => clone(people.find((p) => p.id === userId) ?? people[0]!),
      directory: async ({ q }: { q?: string } = {}) => ({
        items: people
          .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
          .map((p) => ({ ...clone(p), sharedWorkspaces: [state.workspaces[0]!.name] })),
        nextCursor: null,
      }),
    },

    workspaces: {
      list: async () => state.workspaces.map(summary),
      create: async (input: { name: string; slug: string; description?: string }) => {
        const w = {
          ...clone(workspaces[0]!),
          id: id(100 + state.workspaces.length),
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          createdAt: new Date().toISOString(),
        }
        state.workspaces.push(w)
        return w
      },
      get: async ({ workspaceId }: { workspaceId: string }) => clone(wsById(workspaceId) ?? workspaces[0]!),
      update: async ({ workspaceId, patch }: { workspaceId: string; patch: Record<string, unknown> }) =>
        Object.assign(wsById(workspaceId) ?? workspaces[0]!, patch),
      archive: async ({ workspaceId }: { workspaceId: string }) => ({
        ...clone(wsById(workspaceId) ?? workspaces[0]!),
        archivedAt: new Date().toISOString(),
      }),
      myPermissions: async () => ({ role: 'owner', permissions: CORE_PERMISSIONS, version: 1 }),

      members: {
        list: async ({ workspaceId }: { workspaceId: string }) => ({
          items: state.members.map((m, i) => {
            const p = people.find((x) => x.id === m.userId) ?? people[0]!
            return {
              id: id(200 + i),
              workspaceId,
              userId: m.userId,
              role: m.role as 'owner' | 'admin' | 'member' | 'guest',
              roleIds: [],
              groupIds: [],
              title: m.title,
              status: m.status as 'active' | 'invited' | 'suspended',
              joinedAt: iso((30 - i * 8) * 864e5),
              user: { id: p.id, name: p.name, email: p.email, username: p.username, avatarUrl: null },
            }
          }),
          nextCursor: null,
        }),
        update: async ({
          workspaceId,
          userId,
          patch,
        }: {
          workspaceId: string
          userId: string
          patch: Record<string, unknown>
        }) => {
          const member = state.members.find((mem) => mem.userId === userId)
          if (member) Object.assign(member, patch)
          const p = people.find((x) => x.id === userId) ?? people[0]!
          return {
            id: id(200),
            workspaceId,
            userId,
            role: (member?.role ?? 'member') as 'owner' | 'admin' | 'member' | 'guest',
            roleIds: [],
            groupIds: [],
            title: member?.title ?? null,
            status: (member?.status ?? 'active') as 'active' | 'invited' | 'suspended',
            joinedAt: iso(30 * 864e5),
            user: { id: p.id, name: p.name, email: p.email, username: p.username, avatarUrl: null },
          }
        },
        remove: async ({ userId }: { userId: string }) => {
          state.members = state.members.filter((mem) => mem.userId !== userId)
          return { ok: true as const }
        },
        leave: async () => ({ ok: true as const }),
      },

      invitations: {
        list: async () => clone(state.invitations),
        create: async ({
          workspaceId,
          invites,
        }: {
          workspaceId: string
          invites: Array<{ email?: string; role?: string }>
        }) => {
          const created = invites.map((i, n) => ({
            id: id(300 + state.invitations.length + n),
            workspaceId,
            email: i.email ?? 'someone@example.com',
            role: i.role ?? 'member',
            roleIds: [],
            groupIds: [],
            guestScopes: [],
            invitedBy: user.id,
            message: null,
            status: 'pending' as const,
            expiresAt: iso(-14 * 864e5),
            createdAt: new Date().toISOString(),
          }))
          state.invitations.push(...created)
          return created
        },
        revoke: async () => ({ ok: true as const }),
        preview: notImplemented('workspaces.invitations.preview'),
        accept: async () => clone(state.workspaces[0]!),
      },

      roles: {
        list: async ({ workspaceId }: { workspaceId: string }) =>
          state.roles.map((r) => ({ ...clone(r), workspaceId })),
        create: async ({
          workspaceId,
          name,
          description,
        }: {
          workspaceId: string
          name: string
          description?: string | null
        }) => {
          const role = {
            id: id(400 + state.roles.length),
            workspaceId,
            name,
            description: description ?? null,
            permissions: [] as string[],
            builtin: false,
            createdAt: new Date().toISOString(),
          }
          state.roles.push(role)
          return clone(role)
        },
        update: async ({
          id: roleId,
          patch,
        }: {
          id: string
          patch: { permissions?: string[]; name?: string }
        }) => {
          const role = state.roles.find((r) => r.id === roleId)
          if (role) Object.assign(role, patch)
          return clone(role ?? state.roles[0]!)
        },
        delete: async ({ id: roleId }: { id: string }) => {
          state.roles = state.roles.filter((r) => r.id !== roleId)
          return { ok: true as const }
        },
        permissions: async () => [
          ...CORE_PERMISSIONS.map((key) => ({
            key,
            label: PERMISSION_LABELS[key] ?? key.split('.').slice(1).join(' '),
            module: 'core',
            scope: 'workspace',
            dangerous: key.endsWith('delete') || key === 'core.roles.manage',
          })),
          ...MODULE_PERMISSIONS.map((p) => ({ ...p, scope: 'workspace' })),
        ],
        bindings: {
          list: async () => [],
          set: notImplemented('bindings.set'),
          delete: async () => ({ ok: true as const }),
        },
      },

      groups: {
        list: async ({ workspaceId }: { workspaceId: string }) =>
          state.groups.map((g) => ({ ...clone(g), workspaceId, createdAt: iso(30 * 864e5) })),
        create: async ({
          workspaceId,
          name,
          handle,
          description,
        }: {
          workspaceId: string
          name: string
          handle: string
          description?: string | null
        }) => {
          const group = {
            id: id(500 + state.groups.length),
            name,
            handle,
            description: description ?? null,
            memberCount: 0,
          }
          state.groups.push(group)
          return { ...clone(group), workspaceId, createdAt: new Date().toISOString() }
        },
        update: notImplemented('workspaces.groups.update'),
        delete: async () => ({ ok: true as const }),
        setMembers: notImplemented('workspaces.groups.setMembers'),
        members: async () => people.slice(0, 3).map(clone),
      },

      modules: {
        list: async ({ workspaceId }: { workspaceId: string }) => {
          const on = enabledFor(workspaceId)
          return moduleManifests.map((m) => ({
            manifest: manifestOf(m),
            state: {
              moduleId: m.id,
              enabled: m.core || on.has(m.id),
              settings: {},
              installedVersion: m.version,
            },
          }))
        },
        setEnabled: async ({
          workspaceId,
          moduleId,
          enabled,
        }: {
          workspaceId: string
          moduleId: string
          enabled: boolean
        }) => {
          const on = enabledFor(workspaceId)
          if (enabled) on.add(moduleId)
          else on.delete(moduleId)
          return { moduleId, enabled, settings: {}, installedVersion: '0.1.0' }
        },
        updateSettings: async ({ moduleId, settings }: { moduleId: string; settings: unknown }) => ({
          moduleId,
          enabled: true,
          settings: settings as Record<string, unknown>,
          installedVersion: '0.1.0',
        }),
      },

      audit: async ({ workspaceId }: { workspaceId: string }) => ({
        items: [
          {
            id: id(600),
            workspaceId,
            module: 'core',
            object: { module: 'core', type: 'workspace', id: workspaceId },
            action: 'updated',
            actorId: user.id,
            changes: [{ field: 'name', from: 'Northstar Inc', to: 'Northstar' }],
            data: {},
            occurredAt: iso(4 * 3600_000),
          },
        ],
        nextCursor: null,
      }),
    },

    notifications: {
      list: async ({ workspaceId, unreadOnly }: { workspaceId?: string; unreadOnly?: boolean } = {}) => ({
        items: state.notifications
          .filter((n) => !n.archivedAt)
          .filter((n) => !workspaceId || n.workspaceId === workspaceId)
          .filter((n) => !unreadOnly || !n.readAt)
          .map(clone),
        nextCursor: null,
      }),
      counts: async () =>
        state.workspaces.map((w) => {
          const s = summary(w)
          return { workspaceId: w.id, unread: s.unread, mentions: s.mentions }
        }),
      markRead: async ({
        ids,
        workspaceId,
        all,
      }: {
        ids?: string[]
        workspaceId?: string
        all?: boolean
      }) => {
        let updated = 0
        for (const n of state.notifications) {
          const match = all
            ? true
            : ids
              ? ids.includes(n.id)
              : workspaceId
                ? n.workspaceId === workspaceId
                : false
          if (match && !n.readAt) {
            n.readAt = new Date().toISOString()
            updated++
          }
        }
        return { updated }
      },
      archive: async ({ id: nid }: { id: string }) => {
        const n = state.notifications.find((x) => x.id === nid)
        if (n) n.archivedAt = new Date().toISOString()
        return clone(n ?? state.notifications[0]!)
      },
      types: async () => [
        {
          type: 'chat.mention',
          module: 'chat',
          label: 'Mentions',
          defaults: { inapp: true, push: true, email: false },
          urgent: true,
        },
        {
          type: 'chat.dm',
          module: 'chat',
          label: 'Direct messages',
          defaults: { inapp: true, push: true, email: false },
          urgent: true,
        },
        {
          type: 'tracker.issue.assigned',
          module: 'tracker',
          label: 'Issue assigned to you',
          defaults: { inapp: true, push: true, email: true },
          urgent: false,
        },
        {
          type: 'tracker.issue.commented',
          module: 'tracker',
          label: 'Comments on issues you watch',
          defaults: { inapp: true, push: false, email: false },
          urgent: false,
        },
      ],
      settings: async () => ({ emailDigest: 'daily' as const, quietHours: null, preferences: [] }),
      updateSettings: async (input: Record<string, unknown>) => input as never,
      subscribePush: async () => ({ ok: true as const }),
      unsubscribePush: async () => ({ ok: true as const }),
      vapidPublicKey: async () => ({ publicKey: null }),
    },

    /**
     * Files, with the bytes held in memory rather than a bucket.
     *
     * `createUpload` hands back a `mock-upload://` URL, which is the one thing the uploader knows
     * about the mock; the bytes go into `$lib/files/mock-storage` and come back out as object URLs.
     * Everything else — the three-step upload, the `pending` → `ready` transition, the shape of a
     * `FileObject` — is exactly what the real service does.
     */
    files: {
      createUpload: async (input: {
        workspaceId: string
        name: string
        mimeType: string
        size: number
        attachedTo?: { module: string; type: string; id: string }
      }) => {
        fileCounter += 1
        const file = {
          id: fileId(fileCounter),
          workspaceId: input.workspaceId,
          name: input.name,
          mimeType: input.mimeType,
          size: input.size,
          key: `mock/${input.workspaceId}/${fileCounter}/${input.name}`,
          sha256: null,
          width: null,
          height: null,
          durationMs: null,
          thumbnailKey: null,
          attachedTo: input.attachedTo ?? null,
          uploadedBy: user.id,
          status: 'pending' as const,
          createdAt: iso(0),
        }
        files.set(file.id, file)
        return {
          file: clone(file),
          method: 'put' as const,
          url: `mock-upload://${file.id}`,
          headers: {},
          expiresAt: new Date(now + 900_000).toISOString(),
        }
      },
      complete: async ({ id: fid }: { id: string }) => {
        const file = files.get(fid)
        if (!file) throw new Error(`mock: no file ${fid}`)
        file.status = 'ready'
        return clone(file)
      },
      get: async ({ id: fid }: { id: string }) => {
        const file = files.get(fid)
        if (!file) throw new Error(`mock: no file ${fid}`)
        return clone(file)
      },
      downloadUrl: async ({ id: fid }: { id: string }) => ({
        url: mockObjectUrl(fid) || `mock-upload://${fid}`,
        expiresAt: new Date(now + 900_000).toISOString(),
      }),
      delete: async ({ id: fid }: { id: string }) => {
        files.delete(fid)
        return { ok: true as const }
      },
    },

    search: async ({ q }: { q: string }) => ({
      hits: [
        {
          object: { module: 'tracker', type: 'issue', id: id(31) },
          title: `KRN-412 · Voice rooms drop after 20 minutes`,
          snippet: `matches “${q}”`,
          url: '/tracker/KRN-412',
          icon: 'circle-dot',
          score: 0.9,
          updatedAt: iso(3 * 3600_000),
        },
        {
          object: { module: 'chat', type: 'channel', id: id(30) },
          title: '#platform',
          snippet: 'Team channel',
          url: `/chat/${id(30)}`,
          icon: 'message-square',
          score: 0.6,
          updatedAt: iso(11 * 60_000),
        },
      ],
      tookMs: 4,
    }),

    admin: {
      settings: async () => ({
        name: 'Kern',
        baseUrl: 'http://localhost:5173',
        allowSignup: true,
        allowWorkspaceCreation: 'everyone' as const,
        defaultLocale: 'en' as const,
        mailFrom: null,
        supportEmail: null,
      }),
      updateSettings: async (input: Record<string, unknown>) => input as never,
      users: async () => ({ items: people.map(clone), nextCursor: null }),
      setUserStatus: async ({ id: uid }: { id: string }) =>
        clone(people.find((p) => p.id === uid) ?? people[0]!),
      workspaces: async () => ({
        items: state.workspaces.map((w) => ({ ...clone(w), memberCount: state.members.length })),
        nextCursor: null,
      }),
      modules: async () =>
        moduleManifests.map((m) => ({
          ...m,
          dependsOn: [],
          permissions: [],
          events: [],
          objectTypes: [],
          defaultHost: 'core',
          host: 'core',
          healthy: true,
        })),
    },
  }
}
