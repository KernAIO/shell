<script lang="ts">
import ChatPage from '$lib/modules/chat/ChatPage.svelte'

/**
 * `/:workspace/chat` — the module's own view, mounted by the shell.
 *
 * The route is deliberately thin: chat owns its screens under `$lib/modules/chat`, and the same
 * component is what `ClientModule.routes` points at, so nothing has to be rewritten when the shell
 * starts mounting module routes itself.
 */
</script>

<ChatPage />
