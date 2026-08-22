<script lang="ts">
import { Button, Card, IconButton } from '@kernhq/ui'
import * as m from '$msg'

/**
 * Invitation to install the app.
 *
 * Chromium fires `beforeinstallprompt`, which we defer so the invitation appears in our own UI rather
 * than as a browser bar. iOS has no such event and requires Add to Home Screen, so Safari users get
 * the manual instructions instead — and only once, since it cannot be automated away.
 */
const DISMISSED = 'kern.install-dismissed'

let deferred = $state<(Event & { prompt(): Promise<void> }) | null>(null)
let showIos = $state(false)
let dismissed = $state(true)

$effect(() => {
  dismissed = localStorage.getItem(DISMISSED) === '1'
  if (dismissed) return

  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return

  const onPrompt = (e: Event) => {
    e.preventDefault()
    deferred = e as Event & { prompt(): Promise<void> }
  }
  addEventListener('beforeinstallprompt', onPrompt)

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
  if (isIos && isSafari) showIos = true

  return () => removeEventListener('beforeinstallprompt', onPrompt)
})

function dismiss() {
  localStorage.setItem(DISMISSED, '1')
  dismissed = true
  deferred = null
  showIos = false
}

async function install() {
  await deferred?.prompt()
  dismiss()
}
</script>

{#if !dismissed && (deferred || showIos)}
  <Card
    class="fixed bottom-4 end-4 z-50 w-[320px] p-4 shadow-[var(--kern-shadow-dialog)]"
    role="dialog"
    aria-label={m.pwa_install_title()}
  >
    <div class="flex items-start justify-between gap-2">
      <h2 class="text-[13.5px] font-semibold text-[var(--kern-ink-900)]">
        {deferred ? m.pwa_install_title() : m.pwa_ios_title()}
      </h2>
      <IconButton icon="x" label={m.close()} size={26} onclick={dismiss} />
    </div>

    {#if deferred}
      <p class="mt-1.5 text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">{m.pwa_install_body()}</p>
      <div class="mt-3 flex gap-2">
        <Button size="sm" onclick={install}>{m.pwa_install()}</Button>
        <Button size="sm" variant="ghost" onclick={dismiss}>{m.pwa_install_later()}</Button>
      </div>
    {:else}
      <ol class="mt-2 grid gap-1.5 text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">
        <li>{m.pwa_ios_step1()}</li>
        <li>{m.pwa_ios_step2()}</li>
      </ol>
    {/if}
  </Card>
{/if}
