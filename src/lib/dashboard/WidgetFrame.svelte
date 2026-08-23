<script lang="ts">
import type { MenuItem, WidgetSize } from '@kernhq/ui'
import { Card, DropdownMenu, EmptyState, Icon, IconButton } from '@kernhq/ui'
import type { Snippet } from 'svelte'
import type { WidgetEntry } from '$lib/modules/registry'
import * as m from '$msg'
import { SIZE_ORDER } from './grid'

/**
 * The chrome around one widget.
 *
 * The frame belongs to the shell and the body belongs to the module. That split is what keeps drag
 * handling, permission gating, the four states and DESIGN.md fidelity out of every module's code —
 * and it is why a widget component is never passed its own title.
 */
interface Props {
  entry: WidgetEntry | undefined
  size: WidgetSize
  editing: boolean
  /** true while this card is the one being dragged or held by the keyboard */
  active?: boolean
  grabbed?: boolean
  first?: boolean
  last?: boolean
  onGrip: (event: PointerEvent) => void
  onResizeStart: (event: PointerEvent) => void
  onKeys: (event: KeyboardEvent) => void
  onMove: (delta: -1 | 1) => void
  onSize: (size: WidgetSize) => void
  onConfigure: () => void
  onRemove: () => void
  children?: Snippet
}
let {
  entry,
  size,
  editing,
  active = false,
  grabbed = false,
  first = false,
  last = false,
  onGrip,
  onResizeStart,
  onKeys,
  onMove,
  onSize,
  onConfigure,
  onRemove,
  children,
}: Props = $props()

const sizes = $derived(SIZE_ORDER.filter((s) => entry?.sizes.includes(s)))
/**
 * A compact widget never grows a header.
 *
 * Its body is one number under its own label, so a header would say the same word twice — and in a
 * card one row high there is no room for both. In edit mode it gets a floating grip and menu laid
 * over the card instead, which changes nothing about its geometry.
 */
const compact = $derived(Boolean(entry?.compact))
const showHead = $derived(!compact)
const sizeLabel = (s: WidgetSize) =>
  ({ s: m.dash_size_s(), m: m.dash_size_m(), l: m.dash_size_l(), xl: m.dash_size_xl() })[s]

const menu = $derived.by((): MenuItem[] => {
  const items: MenuItem[] = [
    { label: m.dash_move_earlier(), icon: 'chevron-up', disabled: first, onSelect: () => onMove(-1) },
    { label: m.dash_move_later(), icon: 'chevron-down', disabled: last, onSelect: () => onMove(1) },
  ]
  if (sizes.length > 1) {
    items.push(
      { type: 'separator' },
      { type: 'label', label: m.dash_size() },
      {
        type: 'radio',
        value: size,
        options: sizes.map((s) => ({ value: s, label: sizeLabel(s) })),
        onValueChange: (v) => onSize(v as WidgetSize),
      },
    )
  }
  if (entry?.settings?.length) {
    items.push(
      { type: 'separator' },
      { label: m.dash_configure(), icon: 'sliders-vertical', onSelect: onConfigure },
    )
  }
  items.push({ type: 'separator' }, { label: m.remove(), icon: 'trash-2', danger: true, onSelect: onRemove })
  return items
})
</script>

<Card class="kwidget {active ? 'active' : ''} {grabbed ? 'grabbed' : ''}" padding="none">
{#if showHead}
    <header class="head">
      {#if editing}
        <!--
          The grip is a real button, not a styled div: it has to take focus, because grabbing a card
          and moving it with the arrow keys is the route that does not need a pointer.
        -->
        <button
          type="button"
          class="grip"
          aria-pressed={grabbed}
          aria-label={m.dash_grip_label({ name: entry?.title ?? m.dash_widget_unknown() })}
          onpointerdown={onGrip}
          onkeydown={onKeys}
        >
          <Icon name="grip-vertical" size={14} />
        </button>
      {:else if entry?.icon}
        <Icon name={entry.icon} size={15} />
      {/if}

      <h3 class="title">{entry?.title ?? m.dash_widget_unknown()}</h3>

      {#if editing}
        <DropdownMenu items={menu}>
          {#snippet trigger(props)}
            <IconButton {...props} icon="ellipsis" size={26} label={m.dash_widget_menu()} />
          {/snippet}
        </DropdownMenu>
      {/if}
    </header>
  {/if}

  {#if compact && editing}
    <div class="floating">
      <button
        type="button"
        class="grip"
        aria-pressed={grabbed}
        aria-label={m.dash_grip_label({ name: entry?.title ?? m.dash_widget_unknown() })}
        onpointerdown={onGrip}
        onkeydown={onKeys}
      >
        <Icon name="grip-vertical" size={14} />
      </button>
      <DropdownMenu items={menu}>
        {#snippet trigger(props)}
          <IconButton {...props} icon="ellipsis" size={22} label={m.dash_widget_menu()} />
        {/snippet}
      </DropdownMenu>
    </div>
  {/if}

  <div class="body">
    {#if !entry}
      <!--
        A layout can name a widget whose module was switched off, uninstalled, or renamed between
        releases. That is ordinary, so it gets a real explanation and a way out — never a blank card.
      -->
      <div class="gone">
        <EmptyState
          icon="circle-help"
          title={m.dash_widget_unavailable()}
          description={m.dash_widget_unavailable_hint()}
          compact
          bare
        />
        <button type="button" class="remove" onclick={onRemove}>{m.remove()}</button>
      </div>
    {:else}
      {@render children?.()}
    {/if}
  </div>

  {#if editing && entry && sizes.length > 1}
    <button
      type="button"
      class="resize"
      aria-label={m.dash_resize_label({ name: entry.title })}
      onpointerdown={onResizeStart}
    >
      <Icon name="maximize-2" size={11} />
    </button>
  {/if}
</Card>

<style>
  :global(.kwidget) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }
  :global(.kwidget.active) {
    border-color: var(--kern-accent);
    box-shadow: 0 0 0 3px var(--kern-ring);
  }
  /* A held card is lifted, so it is obvious which one the arrow keys are moving. */
  :global(.kwidget.grabbed) {
    box-shadow: var(--kern-shadow-popover);
  }

  /* Logical padding: `padding-left` would put the title against the edge in Persian. */
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-block: 10px;
    padding-inline: 14px 10px;
    border-block-end: 1px solid var(--kern-border-hairline);
    min-height: 40px;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--kern-ink-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grip {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--kern-r-sm);
    color: var(--kern-ink-400);
    cursor: grab;
    touch-action: none; /* only here, so the page still scrolls everywhere else */
  }
  .grip:hover {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-700);
  }
  .grip[aria-pressed='true'] {
    background: var(--kern-accent-tint);
    color: var(--kern-accent-text);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .floating {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-end: 4px;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: var(--kern-r-md);
    background: var(--kern-surface-raised);
    border: 1px solid var(--kern-border);
  }

  .gone {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 14px;
  }
  .remove {
    font-size: 12.5px;
    color: var(--kern-accent-text);
    text-decoration: underline;
  }

  .resize {
    position: absolute;
    inset-block-end: 4px;
    inset-inline-end: 4px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--kern-r-xs);
    color: var(--kern-ink-350);
    cursor: nwse-resize;
    touch-action: none;
  }
  :global([dir='rtl']) .resize {
    cursor: nesw-resize;
    transform: scaleX(-1);
  }
  .resize:hover {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-700);
  }
</style>
