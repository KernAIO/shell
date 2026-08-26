<script lang="ts">
import { Icon } from '@kernhq/ui'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'

let offline = $state(false)

$effect(() => {
  const update = () => (offline = !navigator.onLine)
  update()
  addEventListener('online', update)
  addEventListener('offline', update)
  return () => {
    removeEventListener('online', update)
    removeEventListener('offline', update)
  }
})

/**
 * How long the socket may be down before the interface says so.
 *
 * Opening a page opens a socket, and a handshake that takes a moment is not an outage — announcing
 * one flashed a warning across the top of every screen the user opened. Below this the connection
 * is simply not live yet, which nothing on the page depends on knowing.
 */
const GRACE_MS = 4000

// a dropped socket is worth surfacing too: the page still works, it just is not live any more
const down = $derived(!offline && (realtime.status === 'closed' || realtime.status === 'connecting'))
/** whether this session ever had a live socket — before that, "reconnecting" would be a lie */
let connected = $state(false)
let lingering = $state(false)

$effect(() => {
  if (realtime.status === 'open') connected = true
  if (!down) {
    lingering = false
    return
  }
  const timer = setTimeout(() => (lingering = true), GRACE_MS)
  return () => clearTimeout(timer)
})

const visible = $derived(offline || (down && lingering))
const label = $derived(offline ? m.offline_banner() : connected ? m.reconnecting() : m.connecting_banner())
</script>

{#if visible}
  <div
    role="status"
    class="flex items-center justify-center gap-2 bg-[var(--kern-warning-tint)] px-4 py-1.5 text-[12.5px] text-[var(--kern-warning)]"
  >
    <Icon name={offline ? 'cloud-off' : 'refresh-cw'} size={13} class={offline ? '' : 'animate-spin'} />
    {label}
  </div>
{/if}
