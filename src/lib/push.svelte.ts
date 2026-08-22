import { browser } from '$app/environment'
import * as m from '$msg'
import { getApi } from './api/client'

/**
 * Web Push subscription for this device.
 *
 * A subscription belongs to one browser on one machine, not to the account, so this is deliberately
 * per-device: enabling it on a laptop says nothing about a phone. iOS only allows it once the app has
 * been added to the Home Screen, which is why the hint explains the state rather than just failing.
 */
class PushSubscriptionState {
  supported = $state(false)
  permission = $state<NotificationPermission>('default')
  enabled = $state(false)
  busy = $state(false)

  #ready = false

  get hint(): string {
    if (!this.supported) return m.notif_push_unsupported()
    if (this.permission === 'denied') return m.notif_push_denied()
    if (this.enabled) return m.notif_push_enabled()
    return m.notif_push_enable()
  }

  /** Reads the current state; safe to call repeatedly. */
  async refresh() {
    if (!browser) return
    this.supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!this.supported) return
    this.permission = Notification.permission
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    this.enabled = Boolean(subscription)
    this.#ready = true
  }

  async toggle() {
    if (!this.supported || this.busy) return
    this.busy = true
    try {
      if (!this.#ready) await this.refresh()
      this.enabled ? await this.#unsubscribe() : await this.#subscribe()
    } finally {
      this.busy = false
    }
  }

  async #subscribe() {
    const api = getApi()
    const { publicKey } = await api.notifications.vapidPublicKey()
    if (!publicKey) return
    this.permission = await Notification.requestPermission()
    if (this.permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
    const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
    if (!json.endpoint || !json.keys) return
    await api.notifications.subscribePush({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    })
    this.enabled = true
  }

  async #unsubscribe() {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      this.enabled = false
      return
    }
    await getApi().notifications.unsubscribePush({ endpoint: subscription.endpoint })
    await subscription.unsubscribe()
    this.enabled = false
  }
}

/** VAPID keys travel as base64url; the subscribe API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export const pushSubscription = new PushSubscriptionState()
