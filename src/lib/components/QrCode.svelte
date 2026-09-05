<script lang="ts">
import { qrMatrix, qrPath } from '$lib/qr'

/**
 * A QR code as one SVG path.
 *
 * **Not themed, on purpose.** Every other surface in Kern follows the reader's theme; this one is
 * read by a camera, and a scanner expects dark modules on a light ground. Inverting it in dark
 * mode would make the picture agree with the page and stop working on half the phones that point
 * at it, so the ground is white and the modules are near-black at both themes, inside a bordered
 * card that makes the white deliberate rather than a gap.
 *
 * `value` too long to encode draws nothing and leaves the caller's fallback — the manual key — as
 * the only route, which is a worse screen but never a broken one.
 */
interface Props {
  value: string
  /** what the picture is, for a reader who cannot see it */
  label: string
  /** drawn size in px; the SVG itself is resolution-independent */
  size?: number
}
let { value, label, size = 168 }: Props = $props()

const drawing = $derived.by(() => {
  if (!value) return null
  try {
    const matrix = qrMatrix(value)
    const quiet = 4 // the standard's four-module margin, without which a scanner may find nothing
    return { span: matrix.length + quiet * 2, path: qrPath(matrix, quiet) }
  } catch {
    return null
  }
})
</script>

{#if drawing}
  <svg
    class="qr"
    role="img"
    aria-label={label}
    viewBox="0 0 {drawing.span} {drawing.span}"
    width={size}
    height={size}
    shape-rendering="crispEdges"
  >
    <rect width={drawing.span} height={drawing.span} fill="#ffffff" />
    <path d={drawing.path} fill="#12100e" />
  </svg>
{/if}

<style>
  .qr {
    display: block;
    border-radius: var(--kern-r-2xl);
    border: 1px solid var(--kern-border);
    /* the quiet zone is drawn white by the rect, so the border sits on the edge of the margin */
    background: #ffffff;
  }
</style>
