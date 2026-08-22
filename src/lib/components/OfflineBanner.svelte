<script lang="ts">
import { Icon } from '@kernaio/ui'
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

// a dropped socket is worth surfacing too: the page still works, it just is not live any more
const reconnecting = $derived(!offline && (realtime.status === 'closed' || realtime.status === 'connecting'))
const visible = $derived(offline || reconnecting)
</script>

{#if visible}
  <div
    role="status"
    class="flex items-center justify-center gap-2 bg-[var(--kern-warning-tint)] px-4 py-1.5 text-[12.5px] text-[var(--kern-warning)]"
  >
    <Icon name={offline ? 'cloud-off' : 'refresh-cw'} size={13} class={reconnecting ? 'animate-spin' : ''} />
    {offline ? m.offline_banner() : m.reconnecting()}
  </div>
{/if}
