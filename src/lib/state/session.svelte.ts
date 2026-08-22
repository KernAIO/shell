import type { core } from '@kernaio/contracts'

/**
 * The signed-in user, their workspaces and the permissions they hold in the workspace they are
 * looking at. Loaded once per navigation by the layout and shared through context.
 */
class SessionState {
  user = $state<core.User | null>(null)
  workspaces = $state<core.WorkspaceSummary[]>([])
  permissions = $state<Set<string>>(new Set())
  role = $state<string>('member')
  ready = $state(false)

  get signedIn() {
    return this.user !== null
  }

  can(permission: string) {
    return this.user?.instanceAdmin === true || this.role === 'owner' || this.permissions.has(permission)
  }

  setSession(user: core.User | null, workspaces: core.WorkspaceSummary[]) {
    this.user = user
    this.workspaces = workspaces
    this.ready = true
  }

  setPermissions(role: string, permissions: string[]) {
    this.role = role
    this.permissions = new Set(permissions)
  }

  clear() {
    this.user = null
    this.workspaces = []
    this.permissions = new Set()
    this.ready = true
  }
}

export const session = new SessionState()
