/**
 * In-memory implementation of the core API.
 *
 * Enabled with `PUBLIC_API_MOCK=1` (`pnpm dev:mock`). It exists so the interface can be built, demoed
 * and tested without running Postgres, NATS and the services — and so the end-to-end tests have a
 * deterministic backend. It implements the same shapes as the real contract; anything not implemented
 * throws loudly rather than silently returning empty data.
 */

import { type CapabilityDef, resolveCapabilities } from '@kernhq/contracts'
import { hrCapabilities, hrEvents, hrPermissions } from '@kernhq/module-hr/contract'
import {
  inventoryCapabilities,
  inventoryEvents,
  inventoryPermissions,
} from '@kernhq/module-inventory/contract'
import { mockObjectUrl } from '$lib/files/mock-storage'

/**
 * Three switches the mock reads from `localStorage`, so a test can put the app in a state the seed
 * data cannot express. All three are off unless something sets them, and with them off nothing here
 * changes any answer at all.
 *
 * They exist because the interesting branches are otherwise unreachable in `dev:mock`. The demo
 * workspace is healthy and its signed-in user is an owner *and* an instance admin, so the screens
 * for a lapsed subscription and for somebody without a permission had no way to be rendered —
 * which is exactly how a branch stays broken while looking finished.
 *
 * `kern.mock.signedout` is the third, and it is the one page in the product that needs it:
 * `/invite/:token` is opened by somebody who very often has no account yet, and mock mode has no
 * auth server to say so. With it set, `users.me` refuses exactly as core does for a stranger.
 */
const MOCK_SUSPENDED = 'kern.mock.suspended'
const MOCK_ROLE = 'kern.mock.role'
const MOCK_SIGNED_OUT = 'kern.mock.signedout'

function mockFlag(key: string): string | null {
  // Read per call rather than once: a test sets these before the app loads, and reading them live
  // means no ordering to get wrong. Wrapped because a browser set to block site data throws here.
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Whether the mock is pretending the workspace's subscription has lapsed. */
const mockSuspended = () => mockFlag(MOCK_SUSPENDED) === '1'

/**
 * Who the mock is signed in as. `owner` unless a test asks otherwise.
 *
 * `session.can()` returns true for an owner and for an instance admin *before* it consults the
 * permission set, so a member is only really a member when both are given up — see this repo's
 * CLAUDE.md.
 */
const mockIsOwner = () => mockFlag(MOCK_ROLE) !== 'member'

/** Whether the mock is pretending nobody is signed in. */
const mockSignedOut = () => mockFlag(MOCK_SIGNED_OUT) === '1'

/**
 * The refusal `Entitlements.requireActive` raises, copied exactly.
 *
 * Same code, same reason and same `data` shape as the kernel's, because a mock that refuses in a
 * shape the client does not recognise tests the client against a fiction.
 */
function suspendedError() {
  return Object.assign(new Error('This workspace is suspended because its subscription is not current'), {
    code: 'CONFLICT',
    data: { reason: 'billing.subscription.inactive', plan: 'Team' },
  })
}

/**
 * Names that change something. The kernel decides by the contract's declared HTTP method, which the
 * mock has no access to, so this approximates it by verb — good enough to put the app in a
 * believably suspended state, and inert unless the flag is on.
 */
const WRITES =
  /^(create|update|delete|remove|archive|unarchive|add|set|rename|invite|revoke|resend|leave|reset|save|enable|disable|move|reorder|mark|send|upload|restore|publish|unpublish|join|accept|decline|approve|reject|assign|unassign|toggle|complete|duplicate|rotate|regenerate|clear)/

/**
 * Wrap a mock API so that every write is refused while the workspace is marked suspended.
 *
 * This is what lets the end-to-end suite exercise the global suspension handler from any screen
 * rather than from the two that wire a plan limit by hand. With the flag off every call passes
 * straight through, so the wrapper cannot affect any other test.
 */
export function suspendable<T>(api: T): T {
  const walk = (node: unknown, name: string): unknown => {
    if (typeof node === 'function') {
      if (!WRITES.test(name)) return node
      const call = node as (...a: unknown[]) => unknown
      return (...args: unknown[]) => {
        if (mockSuspended()) throw suspendedError()
        return call(...args)
      }
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, k)]))
    }
    return node
  }
  return walk(api, '') as T
}

/**
 * Capabilities each module declares, mirroring what its server half declares.
 *
 * A module with none is simply absent, and that is not a bug; a module whose entry disagrees with
 * its server's is, and it fails in both directions. Declaring one the server does not is a nav row
 * that works in `dev:mock` and 404s against core. Declaring *none* where the server declares three
 * is the quieter half and it shipped: `capabilitiesFor('inventory')` answered `[]` while core would
 * have answered `['core','repairs','attachments']`, so every screen gated on `hasCapability` — the
 * Repairs and Files tabs of the asset panel, the repairs widget — was filtered out of the demo and
 * out of the UX sweep. A feature that is invisible in the environment used to show the product has
 * effectively not shipped.
 *
 * **Import the module's own declarations where they are reachable rather than copying them.** HR's
 * were hand-copied and fell two behind: `resolveCapabilities` prunes a stored key the module no
 * longer declares, so `periods` and `leave_accrual` were pruned out of the demo workspace however
 * they were stored — and the switchboard, which lists what is declared, did not offer them either.
 * Two capabilities could not be switched on from the interface at all, and one of them had just
 * grown a screen. A module's contract entry is zod and types only, so importing it costs nothing.
 */
const MODULE_CAPABILITIES: Record<string, CapabilityDef[]> = {
  /**
   * Mirrors what core's server manifest declares: MCP and personal API keys are each a capability
   * of the `core` module itself, switched per workspace from Settings → API & MCP.
   */
  core: [
    { id: 'mcp', label: 'MCP (AI access)', dependsOn: [], defaultEnabled: false, level: 2, required: false },
    {
      id: 'api_keys',
      label: 'Personal API keys',
      dependsOn: [],
      defaultEnabled: false,
      level: 2,
      required: false,
    },
  ],
  /**
   * Mirrors what `@kernhq/module-hr` declares on the server. A disagreement here is a screen that
   * works in `dev:mock` and 404s against core, which is the one failure the mock exists to prevent.
   */
  // The module's own eleven, imported rather than restated — see the note above.
  hr: hrCapabilities as unknown as CapabilityDef[],
  /**
   * `core` (required), `repairs` and `attachments`, imported for the same reason HR's are: the
   * three are `defaultEnabled`, so a demo workspace that has never touched the switchboard gets all
   * of them and the asset panel shows its five tabs rather than three.
   */
  inventory: inventoryCapabilities as unknown as CapabilityDef[],
}
const capabilityDefs = (moduleId: string): CapabilityDef[] => MODULE_CAPABILITIES[moduleId] ?? []

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
  {
    key: 'billing.subscription.view',
    label: 'View the plan and what it costs',
    module: 'billing',
    dangerous: false,
  },
  {
    key: 'billing.subscription.manage',
    label: 'Change the plan and the payment method',
    module: 'billing',
    dangerous: true,
  },
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

/**
 * Named rather than inferred, because an inferred array literal type is *too* precise: the second
 * seed's empty `autoJoinDomains` infers as `never[]`, so any workspace built from one of these with
 * a domain in it — or with an accent colour where the first has none — is assignable to neither
 * member of the union.
 */
type MockWorkspace = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  accentColor: string | null
  autoJoinDomains: string[]
  defaultRole: 'member'
  plan: 'self_hosted'
  archivedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

const workspaces: MockWorkspace[] = [
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

/**
 * The workspace the demo invitation is for — deliberately one the demo user is *not* already in.
 *
 * `/invite/:token` only has anything to do if joining is still possible, and the two seeded
 * workspaces both already have Maya in them, so an invitation to either would only ever render the
 * "you are already a member" panel.
 */
const invitedWorkspace: MockWorkspace = {
  ...workspaces[1]!,
  id: id(12),
  slug: 'meridian',
  name: 'Meridian Labs',
  description: 'Research group',
  accentColor: '#3A7D6B',
  autoJoinDomains: [],
  createdBy: people[1]!.id,
  createdAt: iso(60 * 864e5),
  updatedAt: iso(2 * 864e5),
}

/**
 * What `/invite/:token` is shown, chosen by the token in the link.
 *
 * An invitation is a row somebody else wrote, so the mock cannot seed "the one you were sent" — it
 * has to answer whatever token the URL happens to carry. Every entry here is a state the screen has
 * to draw and that nothing else in the demo can reach: an expired link, a link addressed to another
 * address, a link into a workspace you are already in, and the three refusals that only arrive once
 * *accept* has been pressed. An unlisted token is the healthy invitation, so a demo link never dead
 * ends; `missing` is the one that is deliberately not found.
 */
type InviteScenario = {
  workspace: MockWorkspace
  email: string
  inviter: string
  /** `preview.expired` conflates expired, revoked and already-accepted — core cannot tell them apart */
  expired: boolean
  /** thrown by `accept`, so the refusals that only exist after submission can be rendered too */
  acceptError?: () => Error
}

const INVITE_SCENARIOS: Record<string, InviteScenario> = {
  'mock-invite-expired': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: true,
  },
  'mock-invite-wrong-email': {
    workspace: invitedWorkspace,
    email: people[1]!.email,
    inviter: people[2]!.name,
    expired: false,
  },
  'mock-invite-member': {
    workspace: workspaces[0]!,
    email: user.email,
    inviter: people[1]!.name,
    expired: true,
  },
  'mock-invite-revoked': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: false,
    acceptError: () =>
      Object.assign(new Error('Invitation is no longer valid'), {
        code: 'CONFLICT',
        data: { reason: 'core.invitation.invalid' },
      }),
  },
  'mock-invite-lapsed': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: false,
    acceptError: () =>
      Object.assign(new Error('Invitation has expired'), {
        code: 'CONFLICT',
        data: { reason: 'core.invitation.expired' },
      }),
  },
  'mock-invite-archived': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: false,
    acceptError: () =>
      Object.assign(new Error('Workspace is archived'), {
        code: 'CONFLICT',
        data: { reason: 'core.workspace.archived' },
      }),
  },
  'mock-invite-full': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: false,
    acceptError: () =>
      Object.assign(new Error('Seat limit reached'), {
        code: 'CONFLICT',
        data: { reason: 'billing.seats.limit_reached', plan: 'Team' },
      }),
  },
  /**
   * `KernError.forbidden(permission)` puts its argument in `details`, not in `reason`, so an
   * email mismatch arrives with no reason code at all. Copied exactly, because a mock that refuses
   * in a shape the client does not recognise tests the client against a fiction.
   */
  'mock-invite-forbidden': {
    workspace: invitedWorkspace,
    email: user.email,
    inviter: people[1]!.name,
    expired: false,
    acceptError: () =>
      Object.assign(new Error('Forbidden'), {
        code: 'FORBIDDEN',
        data: { permission: 'core.invitation.email_mismatch' },
      }),
  },
}

const DEFAULT_INVITE: InviteScenario = {
  workspace: invitedWorkspace,
  email: user.email,
  inviter: people[1]!.name,
  expired: false,
}

/** The invitation a token names, or `null` for the one token that is deliberately unknown. */
const inviteFor = (token: string) =>
  token === 'mock-invite-missing' ? null : (INVITE_SCENARIOS[token] ?? DEFAULT_INVITE)

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

const MOCK_VERSION = '1.1.0'
const MOCK_LATEST = '1.2.0'
let mockPolicy = {
  mode: 'notify' as 'off' | 'notify' | 'auto',
  window: { start: '03:00', end: '05:00' },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  minReleaseAgeHours: 72,
}

/*
 * One entry per module, and the id is the key.
 *
 * `hr` was in here twice — the 0.4.0 rewrite left the old 0.1.0 manifest behind — and every list
 * keyed by module id then threw `each_key_duplicate`, which is a *render* error: the admin,
 * admin/modules, admin/updates and settings/modules screens stopped mid-paint and sat on their
 * skeletons for ever. Nothing failed a build or a type-check, and the pages looked like they were
 * still loading rather than broken.
 */
export const moduleManifests = [
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
    id: 'hr',
    name: 'People',
    version: '0.4.0',
    description: 'Staff directory, offices, org chart, holidays, leave and attendance',
    icon: 'users',
    core: false,
    dependsOn: ['core'],
    permissionCount: hrPermissions.length,
    eventCount: Object.keys(hrEvents).length,
    objectTypeCount: 2,
    hasSettings: true,
  },
  {
    id: 'quire',
    name: 'Quire',
    version: '0.2.0',
    description: 'Spaces, nested pages and documents a team writes together',
    icon: 'scroll-text',
    core: false,
    dependsOn: ['core'],
    permissionCount: 6,
    eventCount: 10,
    objectTypeCount: 2,
    hasSettings: false,
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
    id: 'billing',
    name: 'Billing',
    version: '0.1.0',
    description: 'Plans, entitlements and subscriptions — what lets an instance sell seats on itself',
    icon: 'credit-card',
    core: false,
    dependsOn: ['core'],
    permissionCount: 2,
    eventCount: 3,
    objectTypeCount: 0,
    hasSettings: true,
  },
  {
    id: 'inventory',
    name: 'Inventory',
    version: '0.2.0',
    description:
      'The asset register: what the company owns, item by item — tags, serial numbers, purchase and warranty details',
    icon: 'briefcase',
    core: false,
    dependsOn: ['core'],
    // Read off the contract rather than typed: these were written when the module had two of each
    // and Settings → Modules went on reporting that number for three phases of work, then broke
    // `main` the day the reach moved the module and the literal did not.
    permissionCount: inventoryPermissions.length,
    eventCount: Object.keys(inventoryEvents).length,
    objectTypeCount: 1,
    hasSettings: true,
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
]

/** One release ahead of the mock instance: tracker moves, chat is new, everything else stands still. */
const mockRelease = {
  version: MOCK_LATEST,
  channel: 'stable' as const,
  publishedAt: '2026-08-20T09:00:00.000Z',
  notesUrl: `https://github.com/KernAIO/app/releases/tag/v${MOCK_LATEST}`,
  services: { app: MOCK_LATEST, core: MOCK_LATEST, chat: MOCK_LATEST },
  modules: Object.fromEntries(
    moduleManifests.map((mod) => [mod.id, mod.id === 'tracker' ? '0.2.0' : mod.version]),
  ) as Record<string, string>,
  minPreviousVersion: '1.0.0',
  schemaChanges: 'additive' as const,
  requiredEnv: [] as string[],
}

function mockUpdateStatus() {
  const current = moduleManifests.map((mod) => ({ id: mod.id, version: mod.version }))
  const on = mockPolicy.mode !== 'off'
  const plan = {
    shouldUpgrade: false,
    version: on ? MOCK_LATEST : null,
    reason:
      mockPolicy.mode === 'off'
        ? 'Automatic updates are off'
        : mockPolicy.mode === 'notify'
          ? 'Automatic updates are set to notify only'
          : `Outside the update window (${mockPolicy.window.start}–${mockPolicy.window.end} ${mockPolicy.timezone})`,
    policy: mockPolicy,
  }
  return {
    policy: mockPolicy,
    lastAttempt: null,
    nextAttemptAt: mockPolicy.mode === 'auto' ? new Date(Date.now() + 6 * 3_600_000).toISOString() : null,
    plan: on ? plan : null,
    checkedAt: on ? new Date(Date.now() - 42 * 60_000).toISOString() : null,
    lastError: null,
    current: { version: MOCK_VERSION, modules: current },
    latest: on ? mockRelease : null,
    updateAvailable: on,
    moduleChanges: on
      ? current.map((mod) => ({
          moduleId: mod.id,
          from: mod.version,
          to: mockRelease.modules[mod.id] ?? null,
          kind: (mockRelease.modules[mod.id] === mod.version ? 'unchanged' : 'changed') as
            | 'added'
            | 'changed'
            | 'removed'
            | 'unchanged',
        }))
      : [],
    blockers: [] as Array<{ code: string; message: string }>,
    command: on ? `cd ~/kern && ./kern-upgrade.sh ${MOCK_LATEST}` : null,
  }
}

/**
 * Shapes a seed entry into the manifest `modules.list` returns.
 *
 * Exported for `mock-manifests.test.ts`, which holds it against the modules' own contracts: a count
 * here is a number typed by hand next to a module that keeps growing, and Settings → Modules is
 * where a demo reports what the product is. Inventory's said "2 permissions, 3 events, no settings"
 * for three phases after it had five, seven and two settings pages.
 */
export const manifestOf = (m: (typeof moduleManifests)[number]) => ({
  id: m.id,
  name: m.name,
  version: m.version,
  description: m.description,
  icon: m.icon,
  core: m.core,
  dependsOn: m.dependsOn,
  capabilities: capabilityDefs(m.id),
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

  /** Mirrors `DashboardLayout` in the contract, minus what the mock has no opinion about. */
  type MockDashboardLayout = {
    items: Array<Record<string, unknown>>
    presetId: string | null
    updatedAt: string
  }

  const state = {
    notifications: clone(notifications),
    workspaces: clone(workspaces),
    members: clone(members),
    enabled: new Map<string, Set<string>>(),
    /** `<workspaceId>:<moduleId>` → what the switchboard stored; absent means "never touched". */
    capabilities: new Map<string, Record<string, boolean>>(),
    /** `<workspaceId>:<moduleId>` → the settings object `updateSettings` last wrote. */
    moduleSettings: new Map<string, Record<string, unknown>>(),
    invitations: [] as Array<Record<string, unknown>>,
    dashboards: new Map<
      string,
      {
        policy: 'locked' | 'default' | 'open'
        defaultPresetId: string
        workspace: MockDashboardLayout | null
        personal: Map<string, MockDashboardLayout>
      }
    >(),
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
      set = new Set(['core', 'chat', 'tracker', 'quire', 'hr', 'mail', 'billing', 'inventory'])
      state.enabled.set(workspaceId, set)
    }
    return set
  }
  /**
   * Capabilities a workspace has switched, by module, and the set that follows from them.
   *
   * Resolved through the same `resolveCapabilities` the server uses rather than a mock of its own:
   * the whole value of the mock is that a screen behaves here the way it behaves against core, and a
   * second implementation of the dependency closure is exactly how that stops being true.
   */
  const capabilitiesFor = (workspaceId: string, moduleId: string) => [
    ...resolveCapabilities(capabilityDefs(moduleId), state.capabilities.get(`${workspaceId}:${moduleId}`)),
  ]

  /**
   * MCP demo data. One connected client with a token per member who used it, and one pending
   * authorization request at the fixed id the consent screen is opened with — enough for the
   * settings page and `/authorize` to behave against exactly as they do against core.
   */
  const mcpClient = {
    clientId: 'mock-client-claude',
    name: 'Claude Desktop',
    clientUri: 'https://claude.ai',
    logoUri: null as string | null,
    redirectUris: ['https://claude.ai/api/mcp/auth/callback'],
    firstParty: false,
    createdBy: user.id,
    createdAt: iso(6 * 864e5),
    workspaceId: workspaces[0]!.id,
    activeTokens: 2,
    lastUsedAt: iso(2 * 3600_000) as string | null,
  }
  const mcpTokens = [
    {
      id: id(701),
      clientId: mcpClient.clientId,
      clientName: mcpClient.name,
      userId: user.id,
      userName: user.name,
      workspaceId: workspaces[0]!.id,
      scopes: ['tracker:read', 'tracker:write', 'chat:read'],
      createdAt: iso(6 * 864e5),
      lastUsedAt: iso(2 * 3600_000) as string | null,
      expiresAt: new Date(now + 84 * 864e5).toISOString(),
    },
    {
      id: id(702),
      clientId: mcpClient.clientId,
      clientName: mcpClient.name,
      userId: people[1]!.id,
      userName: people[1]!.name,
      workspaceId: workspaces[0]!.id,
      scopes: ['tracker:read'],
      createdAt: iso(5 * 864e5),
      lastUsedAt: iso(26 * 3600_000),
      expiresAt: new Date(now + 85 * 864e5).toISOString(),
    },
  ]
  const mcpRequests = new Map(
    [
      {
        id: 'mock-auth-request',
        clientName: mcpClient.name,
        clientUri: mcpClient.clientUri,
        logoUri: mcpClient.logoUri,
        scopes: ['tracker:read', 'tracker:write'],
        returning: true,
        expiresAt: new Date(now + 10 * 60_000).toISOString(),
      },
    ].map((r) => [r.id, r]),
  )
  // The demo workspace has MCP switched on; the second one has never stored an opinion, so the
  // consent screen's workspace picker has something to filter.
  state.capabilities.set(`${workspaces[0]!.id}:core`, { mcp: true, api_keys: true })

  /** One key the demo user already made, so the settings page has something to show and revoke. */
  const apiKeys: Array<{
    id: string
    name: string
    start: string | null
    scope: 'read' | 'read_write'
    workspaceId: string
    userId: string
    userName: string
    lastUsedAt: string | null
    expiresAt: string | null
    createdAt: string
  }> = [
    {
      id: id(750),
      name: 'CI pipeline',
      start: 'kak_a1b2',
      scope: 'read',
      workspaceId: workspaces[0]!.id,
      userId: user.id,
      userName: user.name,
      lastUsedAt: iso(3 * 3600_000),
      expiresAt: new Date(now + 20 * 864e5).toISOString(),
      createdAt: iso(10 * 864e5),
    },
  ]

  /**
   * The demo workspace runs HR at its widest, and the reason is not that it looks better.
   *
   * Most of HR's capabilities default to off, which is right for a real workspace and wrong for
   * this one: the routes the end-to-end sweep walks — offices, attendance — resolved to nothing,
   * so `ux.spec.ts` was auditing a not-found page under the name of a screen and reporting it
   * clean. A demo environment that exercises a third of the module is not a demo of the module.
   *
   * Anything switched off here should be switched off deliberately, to demonstrate that it
   * disappears — not by inheriting a default nobody chose.
   */
  state.capabilities.set(`${workspaces[0]!.id}:hr`, {
    offices: true,
    legal_entities: true,
    calendars: true,
    documents: true,
    leave: true,
    leave_accrual: true,
    periods: true,
    approvals: true,
    attendance: true,
    overtime: true,
    // The three that arrived with hr 0.22–0.23. Off, their settings pages answer the 404 a
    // disabled capability answers, which the UX sweep reads as the page throwing.
    rosters: true,
    checklists: true,
    payroll_export: true,
  })

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
    health: async () => ({
      ok: true,
      service: 'mock',
      version: MOCK_VERSION,
      modules: moduleManifests.map((mod) => ({ id: mod.id, version: mod.version })),
    }),

    users: {
      me: async () => {
        // The same refusal core gives a request with no session, so a screen that has to draw
        // something for a stranger can be developed and swept against it.
        if (mockSignedOut()) throw Object.assign(new Error('Unauthorized'), { code: 'UNAUTHORIZED' })
        return {
          // `instanceAdmin` short-circuits every `session.can()`, so the mock member has to give it
          // up as well as the owner role — otherwise "member" is a label with no consequences.
          user: { ...clone(user), instanceAdmin: mockIsOwner() },
          workspaces: state.workspaces.map(summary),
          permissionVersion: 1,
        }
      },
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
      myPermissions: async () =>
        mockIsOwner()
          ? { role: 'owner', permissions: CORE_PERMISSIONS, version: 1 }
          : {
              role: 'member',
              permissions: CORE_PERMISSIONS.filter((p) => p !== 'billing.subscription.view'),
              version: 1,
            },

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
        preview: async ({ token }: { token: string }) => {
          const found = inviteFor(token)
          if (!found) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' })
          return {
            workspace: {
              id: found.workspace.id,
              name: found.workspace.name,
              slug: found.workspace.slug,
              logoUrl: found.workspace.logoUrl,
            },
            email: found.email,
            inviter: found.inviter,
            expired: found.expired,
          }
        },
        accept: async ({ token }: { token: string }) => {
          const found = inviteFor(token)
          if (!found) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' })
          if (found.acceptError) throw found.acceptError()
          // Joining is what makes the redirect land somewhere: `users.me` reads this list, and the
          // workspace layout sends anyone whose slug it cannot find back to their first workspace.
          if (!state.workspaces.some((w) => w.id === found.workspace.id))
            state.workspaces.push(clone(found.workspace))
          return clone(found.workspace)
        },
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
              settings: clone(state.moduleSettings.get(`${workspaceId}:${m.id}`) ?? {}),
              installedVersion: m.version,
              capabilities: capabilitiesFor(workspaceId, m.id),
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
        updateSettings: async ({
          workspaceId,
          moduleId,
          settings,
        }: {
          workspaceId: string
          moduleId: string
          settings: Record<string, unknown>
        }) => {
          const key = `${workspaceId}:${moduleId}`
          // Merged, the way core merges: a module's own settings and the reserved `$capabilities`
          // key are written one key at a time from different screens.
          const stored = { ...(state.moduleSettings.get(key) ?? {}), ...clone(settings) }
          state.moduleSettings.set(key, stored)
          if (stored.$capabilities && typeof stored.$capabilities === 'object')
            state.capabilities.set(key, clone(stored.$capabilities as Record<string, boolean>))
          return {
            moduleId,
            enabled: enabledFor(workspaceId).has(moduleId),
            settings: clone(stored),
            installedVersion: '0.1.0',
          }
        },
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

    /**
     * MCP: the consent decision, the connected clients and their live tokens. Mirrors core's
     * authorisation rules closely enough to exercise the interface: `authorize.*` answers only for
     * its owner (the demo user is everyone here), and revoking one of a connection's tokens removes
     * all of them.
     */
    mcp: {
      authorize: {
        get: async ({ id }: { id: string }) => {
          const request = mcpRequests.get(id)
          if (!request)
            throw Object.assign(new Error('authorization request not found'), { code: 'NOT_FOUND' })
          return clone(request)
        },
        approve: async ({ id }: { id: string; workspaceId: string }) => {
          const request = mcpRequests.get(id)
          if (!request)
            throw Object.assign(new Error('authorization request not found'), { code: 'NOT_FOUND' })
          return { redirectUrl: `${mcpClient.redirectUris[0]}?code=mock-auth-code&state=mock` }
        },
        deny: async ({ id }: { id: string }) => {
          const request = mcpRequests.get(id)
          if (!request)
            throw Object.assign(new Error('authorization request not found'), { code: 'NOT_FOUND' })
          return { redirectUrl: `${mcpClient.clientUri}?mcp=denied` }
        },
      },
      clients: {
        list: async ({ workspaceId }: { workspaceId: string }) =>
          mcpClient.workspaceId === workspaceId ? [clone(mcpClient)] : [],
      },
      tokens: {
        list: async ({ workspaceId }: { workspaceId: string }) =>
          mcpTokens.filter((t) => t.workspaceId === workspaceId).map(clone),
        revoke: async ({ id }: { id: string }) => {
          const token = mcpTokens.find((t) => t.id === id)
          if (!token) throw Object.assign(new Error('token not found'), { code: 'NOT_FOUND' })
          for (const other of [...mcpTokens])
            if (
              other.clientId === token.clientId &&
              other.userId === token.userId &&
              other.workspaceId === token.workspaceId
            )
              mcpTokens.splice(mcpTokens.indexOf(other), 1)
          mcpClient.activeTokens = Math.max(0, mcpClient.activeTokens - 1)
          if (mcpClient.activeTokens === 0) mcpClient.lastUsedAt = null
          return { ok: true as const }
        },
      },
    },

    /**
     * Personal API keys. `list` is always the demo user's own, in one workspace — real self-service,
     * the same as the server. `listAll` is the admin oversight view and is not filtered by user.
     */
    apiKeys: {
      list: async ({ workspaceId }: { workspaceId: string }) =>
        apiKeys
          .filter((k) => k.workspaceId === workspaceId && k.userId === user.id)
          .map(({ userId: _userId, userName: _userName, ...rest }) => clone(rest)),
      create: async ({
        workspaceId,
        name,
        scope,
        expiresInDays,
      }: {
        workspaceId: string
        name: string
        scope: 'read' | 'read_write'
        expiresInDays: number | null
      }) => {
        const created = {
          id: id(750 + apiKeys.length),
          name,
          start: `kak_${Math.random().toString(36).slice(2, 6)}`,
          scope,
          workspaceId,
          userId: user.id,
          userName: user.name,
          lastUsedAt: null as string | null,
          expiresAt: expiresInDays ? new Date(now + expiresInDays * 864e5).toISOString() : null,
          createdAt: new Date().toISOString(),
        }
        apiKeys.push(created)
        const { userId: _userId, userName: _userName, ...info } = created
        return { ...clone(info), key: `${created.start}_${Math.random().toString(36).slice(2, 10)}` }
      },
      revoke: async ({ id: keyId }: { id: string }) => {
        const index = apiKeys.findIndex((k) => k.id === keyId)
        if (index === -1) throw Object.assign(new Error('key not found'), { code: 'NOT_FOUND' })
        apiKeys.splice(index, 1)
        return { ok: true as const }
      },
      listAll: async ({ workspaceId }: { workspaceId: string }) =>
        apiKeys.filter((k) => k.workspaceId === workspaceId).map(clone),
    },

    /**
     * The dashboard, including every branch of the policy resolution table — the e2e suite drives
     * `locked` and its refusal through here, so a mock that only implemented the happy path would
     * make the one rule worth testing untestable.
     */
    dashboard: (() => {
      const bucket = (workspaceId: string) => {
        let b = state.dashboards.get(workspaceId)
        if (!b) {
          b = { policy: 'default', defaultPresetId: 'my-work', workspace: null, personal: new Map() }
          state.dashboards.set(workspaceId, b)
        }
        return b
      }
      const layout = (workspaceId: string, userId: string | null, row: MockDashboardLayout | null) => ({
        workspaceId,
        surface: 'home' as const,
        userId,
        items: row ? clone(row.items) : [],
        presetId: row?.presetId ?? null,
        updatedAt: row?.updatedAt ?? null,
      })
      const view = (workspaceId: string) => {
        const b = bucket(workspaceId)
        const mine = b.policy === 'locked' ? null : (b.personal.get(user.id) ?? null)
        const shared = b.policy === 'open' ? null : b.workspace
        const chosen = mine ?? shared
        return {
          policy: b.policy,
          defaultPresetId: b.defaultPresetId,
          layout: layout(workspaceId, mine ? user.id : null, chosen),
          source: mine ? ('personal' as const) : shared ? ('workspace' as const) : ('preset' as const),
          canCustomise: b.policy !== 'locked',
        }
      }
      return {
        get: async ({ workspaceId }: { workspaceId: string }) => view(workspaceId),
        save: async ({
          workspaceId,
          items,
          presetId,
        }: {
          workspaceId: string
          items: Array<Record<string, unknown>>
          presetId: string | null
        }) => {
          const b = bucket(workspaceId)
          if (b.policy === 'locked') {
            throw Object.assign(new Error('This dashboard is set by the workspace'), {
              code: 'CONFLICT',
              data: { reason: 'core.dashboard.locked' },
            })
          }
          const row = { items: clone(items), presetId, updatedAt: new Date().toISOString() }
          b.personal.set(user.id, row)
          return layout(workspaceId, user.id, row)
        },
        reset: async ({ workspaceId }: { workspaceId: string }) => {
          bucket(workspaceId).personal.delete(user.id)
          return view(workspaceId)
        },
        settings: {
          get: async ({ workspaceId }: { workspaceId: string }) => {
            const b = bucket(workspaceId)
            return {
              policy: b.policy,
              defaultPresetId: b.defaultPresetId,
              workspace: b.workspace ? layout(workspaceId, null, b.workspace) : null,
            }
          },
          set: async ({
            workspaceId,
            policy,
            defaultPresetId,
          }: {
            workspaceId: string
            policy?: 'locked' | 'default' | 'open'
            defaultPresetId?: string
          }) => {
            const b = bucket(workspaceId)
            if (policy) b.policy = policy
            if (defaultPresetId) b.defaultPresetId = defaultPresetId
            return {
              policy: b.policy,
              defaultPresetId: b.defaultPresetId,
              workspace: b.workspace ? layout(workspaceId, null, b.workspace) : null,
            }
          },
          saveWorkspace: async ({
            workspaceId,
            items,
            presetId,
          }: {
            workspaceId: string
            items: Array<Record<string, unknown>>
            presetId: string | null
          }) => {
            const b = bucket(workspaceId)
            b.workspace = { items: clone(items), presetId, updatedAt: new Date().toISOString() }
            return layout(workspaceId, null, b.workspace)
          },
        },
      }
    })(),

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
          icon: 'circle-alert',
          score: 0.9,
          updatedAt: iso(3 * 3600_000),
        },
        {
          object: { module: 'chat', type: 'channel', id: id(30) },
          title: '#platform',
          snippet: 'Team channel',
          url: `/chat/${id(30)}`,
          icon: 'message-square-text',
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
      /**
       * A plausible report for each mocked module. The shapes match the real one, so the panel is
       * built and demoed against the same fields it will get from a running instance.
       */
      diagnostics: async () =>
        moduleManifests.map((mod) => ({
          id: mod.id,
          name: mod.name,
          version: mod.version,
          hostedHere: mod.id === 'core' || mod.id === 'tracker' || mod.id === 'billing',
          host: mod.id === 'chat' ? 'chat' : mod.id === 'mail' ? 'mail' : 'core',
          procedures: [
            { name: `${mod.id}.list`, method: 'GET', path: `/${mod.id}`, middlewares: 2, gated: true },
            { name: `${mod.id}.create`, method: 'POST', path: `/${mod.id}`, middlewares: 2, gated: true },
          ],
          missing: [],
          undeclared: [],
          permissions: Array.from({ length: mod.permissionCount }, (_, n) => `${mod.id}.thing.${n}`),
          events: Array.from({ length: mod.eventCount }, (_, n) => `${mod.id}.thing.event${n}`),
          callable: [],
          jobs: [],
          subscriptions: mod.id === 'core' ? [] : ['core.workspace.created'],
          objectTypes: Array.from({ length: mod.objectTypeCount }, (_, n) => `${mod.id}.type${n}`),
          notificationTypes: [],
          public: mod.id === 'core' ? ['health'] : [],
          hasMigrations: true,
          hasSchema: true,
          problems: [],
        })),
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

      // The mock instance is deliberately one release behind, so the update screen has something to
      // show without a network call — including a module that moves and one that does not.
      updates: {
        get: async () => mockUpdateStatus(),
        check: async () => mockUpdateStatus(),
        setPolicy: async (patch: Partial<typeof mockPolicy>) => {
          mockPolicy = { ...mockPolicy, ...patch }
          return mockUpdateStatus()
        },
        plan: async () => mockUpdateStatus().plan,
      },
    },
  }
}
