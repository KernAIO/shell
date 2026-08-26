<script lang="ts">
import { Button, EmptyState } from '@kernhq/ui'
import * as m from '$msg'

/**
 * "This page does not exist", as a component rather than only as an error boundary.
 *
 * `+error.svelte` answers when SvelteKit itself fails a navigation, but a module route resolves on
 * the client — after the workspace's module list lands — so nothing has failed by the time we learn
 * the path belongs to nobody. Throwing from an effect does not reach the boundary either: the
 * result was a blank content area under the shell chrome, with an empty browser tab title, for
 * every unclaimed URL and for every capability-gated page whose capability was off.
 *
 * A blank page reads as a broken app. This says what happened and offers the way out.
 */
interface Props {
  /** Overrides the body copy where a screen can say something more useful than the default. */
  description?: string
}
const { description }: Props = $props()
</script>

<svelte:head>
  <title>{m.not_found_title()} · Kern</title>
</svelte:head>

<div class="wrap">
  <!--
    The audit requires a level-1 heading on every page, and it is right to: without one a screen
    reader has nothing to jump to. `EmptyState` renders its title as a span, because it is usually
    a region inside a page that already has a heading — here it *is* the page. Rather than change
    the shared component (a kernel release, for one caller), the heading is stated here and hidden
    visually, so the design is unchanged and the page is still announced.
  -->
  <h1 class="kern-sr-only">{m.not_found_title()}</h1>
  <EmptyState
    icon="circle-help"
    title={m.not_found_title()}
    description={description ?? m.not_found_body()}
  >
    {#snippet actions()}
      <Button href="/">{m.go_home()}</Button>
    {/snippet}
  </EmptyState>
</div>

<style>
.wrap {
  display: grid;
  place-items: center;
  min-height: 60vh;
  padding: 32px;
}
</style>
