<script lang="ts">
// Entry point: send people to the workspace they used last, or to sign-in / onboarding.

import { Spinner } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import { authDisabled } from '$lib/auth/client'

const LAST_WORKSPACE = 'kern.workspace'

$effect(() => {
  void (async () => {
    try {
      const { workspaces } = await getApi().users.me()
      if (workspaces.length === 0) return void goto('/onboarding', { replaceState: true })
      const remembered = localStorage.getItem(LAST_WORKSPACE)
      const target = workspaces.find((w) => w.slug === remembered) ?? workspaces[0]
      if (!target) return void goto('/onboarding', { replaceState: true })
      await goto(`/${target.slug}`, { replaceState: true })
    } catch {
      await goto(authDisabled() ? '/onboarding' : '/sign-in', { replaceState: true })
    }
  })()
})
</script>

<div class="grid min-h-dvh place-items-center">
  <Spinner />
</div>
