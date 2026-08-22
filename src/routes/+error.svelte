<script lang="ts">
import { Button, EmptyState } from '@kernalo/ui'
import { page } from '$app/state'
import * as m from '$msg'

const isNotFound = $derived(page.status === 404)
</script>

<div class="grid min-h-dvh place-items-center p-8">
  <EmptyState
    icon={isNotFound ? 'compass' : 'alert-triangle'}
    title={isNotFound ? m.not_found_title() : m.error_page_title()}
    description={isNotFound ? m.not_found_body() : (page.error?.message ?? m.error_generic())}
  >
    {#snippet actions()}
      <Button href="/">{m.go_home()}</Button>
    {/snippet}
  </EmptyState>
</div>
