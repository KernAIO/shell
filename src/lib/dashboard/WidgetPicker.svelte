<script lang="ts">
import type { ClientContext } from '@kernhq/ui'
import { Icon, SectionLabel, Sheet } from '@kernhq/ui'
import type { WidgetEntry } from '$lib/modules/registry'
import * as m from '$msg'

/**
 * What can go on the dashboard.
 *
 * Built entirely from `widgetsFor`, so a module that ships a widget appears here without the shell
 * knowing anything about it, and a module a workspace switched off disappears from it completely.
 */
interface Props {
  open: boolean
  widgets: WidgetEntry[]
  /** ids already on the board, for widgets that only make sense once */
  placed: string[]
  ctx: ClientContext
  onPick: (entry: WidgetEntry) => void
  onOpenChange: (open: boolean) => void
}
let { open = $bindable(false), widgets, placed, ctx, onPick, onOpenChange }: Props = $props()

interface Group {
  moduleId: string
  moduleName: string
  items: WidgetEntry[]
}

const groups = $derived.by((): Group[] => {
  const by = new Map<string, Group>()
  for (const w of widgets) {
    const g = by.get(w.moduleId) ?? { moduleId: w.moduleId, moduleName: w.moduleName, items: [] }
    g.items.push(w)
    by.set(w.moduleId, g)
  }
  return [...by.values()].sort((a, b) => a.moduleName.localeCompare(b.moduleName))
})

/**
 * A widget can be unavailable for a reason no permission expresses — the workspace has no projects
 * yet, so a cycle card would have nothing to show. It stays in the list, disabled and explained:
 * hiding it makes the workspace look emptier than it is, and gives no hint what would fill it.
 */
const blocked = (w: WidgetEntry) => Boolean(w.when && !w.when(ctx))
</script>

<Sheet bind:open title={m.dash_add_widget()} width={420} modal {onOpenChange}>
  {#if groups.length === 0}
    <p class="none">{m.dash_no_widgets()}</p>
  {/if}
  {#each groups as group (group.moduleId)}
    <SectionLabel label={group.moduleName} />
    <ul class="list">
      {#each group.items as w (w.id)}
        {@const off = blocked(w)}
        <li>
          <button type="button" class="row" disabled={off} onclick={() => onPick(w)}>
            <span class="ico"><Icon name={w.icon ?? 'layout-grid'} size={16} /></span>
            <span class="text">
              <span class="name">
                {w.title}
                {#if placed.includes(w.id)}<span class="on">{m.dash_already_added()}</span>{/if}
              </span>
              {#if w.description}<span class="desc">{w.description}</span>{/if}
              {#if off}<span class="why">{m.dash_widget_needs_setup()}</span>{/if}
            </span>
            <Icon name="plus" size={15} />
          </button>
        </li>
      {/each}
    </ul>
  {/each}
</Sheet>

<style>
  .none {
    padding: 24px 4px;
    font-size: 13px;
    color: var(--kern-ink-500);
  }
  .list {
    display: grid;
    gap: 2px;
    margin-block: 4px 14px;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 10px;
    border-radius: var(--kern-r-lg);
    text-align: start;
    color: var(--kern-ink-700);
  }
  .row:hover:not(:disabled) {
    background: var(--kern-surface-hover);
  }
  .row:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .ico {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--kern-r-md);
    background: var(--kern-surface-chip);
    color: var(--kern-ink-600);
    flex-shrink: 0;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .name {
    font-size: 13px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  .on {
    margin-inline-start: 6px;
    font-size: 11.5px;
    font-weight: 400;
    color: var(--kern-ink-400);
  }
  .desc,
  .why {
    font-size: 12.5px;
    color: var(--kern-ink-500);
    line-height: 1.45;
  }
  .why {
    color: var(--kern-accent-text);
  }
</style>
