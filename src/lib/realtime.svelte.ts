import { channel, type ServerMessage } from '@kernalo/contracts'
import { RealtimeClient } from '@kernalo/sdk'
import type { QueryClient } from '@tanstack/svelte-query'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { keys } from './query'

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'disabled'

/**
 * Bridges the realtime gateway to the query cache.
 *
 * The server tells us *what* changed (`{module, entity, id}`); query keys are structured the same way,
 * so an event invalidates exactly the queries that depend on it instead of triggering a global refetch.
 * Notifications and badge counts arrive on the same socket and update the inbox and rail immediately.
 */
class Realtime {
  /** `disabled` while no socket is wanted (mock mode), so the UI does not report a false outage */
  status = $state<ConnectionStatus>('disabled')
  /** unread and mention counts per workspace, pushed by the server */
  badges = $state<Record<string, { unread: number; mentions: number }>>({})
  /** users currently online, for presence dots */
  online = $state<Set<string>>(new Set())

  #client: RealtimeClient | null = null
  #queryClient: QueryClient | null = null
  #subscribed = new Set<string>()

  connect(queryClient: QueryClient, getToken: () => string | null) {
    if (!browser || this.#client) return
    this.#queryClient = queryClient
    const url = env.PUBLIC_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

    this.#client = new RealtimeClient({
      url,
      getToken,
      onStatus: (s) => {
        this.status = s
        // a reconnect may have missed events, so refresh what the user is looking at
        if (s === 'open') this.#queryClient?.invalidateQueries()
      },
      onMessage: (msg) => this.#handle(msg),
    })
    this.#client.connect()
  }

  /** Follow a workspace (its entity changes) — called when the active workspace changes. */
  watchWorkspace(workspaceId: string) {
    const name = channel.workspace(workspaceId)
    if (this.#subscribed.has(name)) return
    this.#subscribed.add(name)
    this.#client?.subscribe(name)
  }

  /** Follow one object while its detail view is open. */
  watchObject(workspaceId: string, module: string, id: string) {
    const name = channel.object(workspaceId, module, id)
    this.#client?.subscribe(name)
    return () => this.#client?.unsubscribe(name)
  }

  setPresence(status: 'online' | 'away' | 'dnd' | 'offline') {
    this.#client?.presence(status)
  }

  disconnect() {
    this.#client?.close()
    this.#client = null
    this.#subscribed.clear()
    this.status = 'disabled'
  }

  #handle(msg: ServerMessage) {
    const qc = this.#queryClient
    if (!qc) return
    switch (msg.t) {
      case 'change': {
        const { module, entity, id, scope } = msg.change
        // `[module, entity]` is the prefix every key for this entity starts with
        void qc.invalidateQueries({ queryKey: [module, entity] })
        if (scope?.projectId) void qc.invalidateQueries({ queryKey: [module, entity, scope.projectId] })
        if (id) void qc.invalidateQueries({ queryKey: [module, entity, id] })
        break
      }
      case 'notification':
        void qc.invalidateQueries({ queryKey: ['core', 'notification'] })
        void qc.invalidateQueries({ queryKey: keys.notificationCounts() })
        break
      case 'badge': {
        this.badges = {
          ...this.badges,
          [msg.workspaceId]: { unread: msg.unread, mentions: msg.mentions },
        }
        this.#updateAppBadge()
        break
      }
      case 'presence': {
        const next = new Set(this.online)
        if (msg.status === 'offline') next.delete(msg.userId)
        else next.add(msg.userId)
        this.online = next
        break
      }
      default:
        break
    }
  }

  /** Show the total unread count on the installed app icon where the platform supports it. */
  #updateAppBadge() {
    if (!browser || !('setAppBadge' in navigator)) return
    const total = Object.values(this.badges).reduce((sum, b) => sum + b.unread, 0)
    const nav = navigator as Navigator & {
      setAppBadge(count?: number): Promise<void>
      clearAppBadge(): Promise<void>
    }
    void (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {})
  }
}

export const realtime = new Realtime()
