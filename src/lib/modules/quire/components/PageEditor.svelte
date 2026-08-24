<script lang="ts">
import { type Page, pageDocumentName } from '@kernhq/module-quire/client'
import { CollaborativeEditor, type CollabPeer, type CollabStatus, EmptyState } from '@kernhq/ui'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The body of a page, synchronised through the collab service.
 *
 * The document name is built with `formatCollabDocument` rather than assembled here: the gateway
 * parses it with the matching function from the same package, and a name it cannot parse is a
 * rejected connection with no useful error.
 */
interface Props {
  doc: Page
  onpeers?: (peers: CollabPeer[]) => void
  onstatus?: (status: CollabStatus) => void
}
const { doc, onpeers, onstatus }: Props = $props()

const name = $derived(pageDocumentName(doc))

/**
 * Same-origin by default, so the dev proxy and the reverse proxy both work without configuration.
 * `PUBLIC_COLLAB_URL` is for an instance that puts the collab service somewhere else.
 */
const url = $derived(
  env.PUBLIC_COLLAB_URL ||
    (browser ? `${location.origin.replace(/^http/, 'ws')}/collab` : 'ws://localhost:4300'),
)

const user = $derived({
  id: session.user?.id ?? '',
  name: session.user?.name ?? '',
  avatarUrl: session.user?.avatarUrl ?? null,
})
</script>

{#if isMock()}
  <!--
    There is no collab service behind `dev:mock`, and an editor that silently fails to sync is worse
    than one that says so — this is the environment used for demos, where "it looked like it saved"
    is exactly the wrong impression to leave.
  -->
  <EmptyState icon="wifi-off" title={m.quire_editor_mock()} description={m.quire_editor_mock_desc()} />
{:else if !user.id}
  <EmptyState icon="triangle-alert" title={m.quire_editor_no_session()} description={m.quire_editor_no_session_desc()} />
{:else}
  {#key name}
    <CollaborativeEditor {url} {name} {user} placeholder={m.quire_editor_placeholder()} {onpeers} {onstatus} />
  {/key}
{/if}
