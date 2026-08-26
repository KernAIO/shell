<script lang="ts">
/**
 * Settings has no navigation of its own any more: it is a section, so its list is the shell's
 * sidebar (`SettingsNav`, rendered by `(app)/[ws]/+layout.svelte`). This used to be a two-column
 * grid whose first column was a second navigation panel beside the workspace one, which put the
 * page 268px in from the edge and offered two sets of rows at once.
 *
 * `min-h-0 flex-1`, not an implicit height: the shell's content area is a flex column with
 * `overflow: hidden`, so a child that does not claim the space scrolls past the bottom of the
 * window instead of scrolling inside it.
 */
let { children } = $props()
</script>

<div class="min-h-0 flex-1 overflow-y-auto px-6 py-6 pb-16">{@render children()}</div>
