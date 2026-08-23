<script lang="ts">
import { StatTile } from '@kernhq/ui'

/**
 * The shared body behind every counting widget.
 *
 * A stat tile is one number, so the widget frame's header would repeat the label it already shows —
 * hence `size="md"` and no heading of its own.
 */
interface Props {
  label: string
  value: number | string
  note?: string | null
  href?: string
}
let { label, value, note = null, href }: Props = $props()
</script>

<div class="wrap">
  <StatTile {label} {value} {note} {href} size="md" class="tile" />
</div>

<style>
  .wrap {
    display: grid;
    align-content: center;
    height: 100%;
    padding: 14px 16px;
  }
  .wrap :global(.tile) {
    border: 0;
    background: transparent;
    padding: 0;
  }
</style>
