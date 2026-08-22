<script lang="ts">
import { byRank, type Issue, type StatusInfo, statusStyle } from '@kernhq/module-tracker/client'
import { Icon } from '@kernhq/ui'
import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action'
import * as m from '$msg'
import BoardCard from './BoardCard.svelte'
import StatusIcon from './StatusIcon.svelte'

/**
 * The board (DESIGN.md 3.3).
 *
 * One column per workflow status, each headed by a 2px rule that starts as a stub of the status
 * colour and fades to a hairline. Cards are dragged between columns with svelte-dnd-action; dropping
 * one reports both the column it landed in and the neighbours it landed between, so the page can
 * apply the status transition and the new rank in one go.
 *
 * A WIP limit is shown as `used/limit` and turns red when a column is over it. It warns rather than
 * refuses: a hard block just makes people rename columns.
 */
interface Props {
  issues: Issue[]
  columns: StatusInfo[]
  wipLimits?: Record<string, number | undefined>
  /** false when the viewer may not move work between statuses; cards stay readable, just not draggable */
  draggable?: boolean
  onopen: (issue: Issue) => void
  onmove: (issue: Issue, toStatusId: string, afterId: string | null, beforeId: string | null) => void
  oncreate?: (statusId: string) => void
}
let { issues, columns, wipLimits = {}, draggable = true, onopen, onmove, oncreate }: Props = $props()

const FLIP = 160

type Lane = { status: StatusInfo; items: Issue[] }

/**
 * `$state.raw` matters here: the drag library tracks items by identity, and a deep-reactive proxy
 * hands it a different object every read, which it reads as an endless stream of changes.
 */
let lanes = $state.raw<Lane[]>([])
let dragging = $state(false)

const replaceLane = (index: number, items: Issue[]) => {
  lanes = lanes.map((lane, i) => (i === index ? { status: lane.status, items } : lane))
}

// mirror the query into local lists the drag library can reorder, but leave them alone mid-drag
$effect(() => {
  if (dragging) return
  const sorted = [...issues].sort(byRank)
  lanes = columns.map((status) => ({
    status,
    items: sorted.filter((issue) => issue.statusId === status.id),
  }))
})

const isShadow = (issue: Issue) =>
  (issue as unknown as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME] === true

function consider(index: number, event: CustomEvent<{ items: Issue[] }>) {
  dragging = true
  replaceLane(index, event.detail.items)
}

function finalize(index: number, event: CustomEvent<{ items: Issue[]; info: { id: string } }>) {
  dragging = false
  const lane = lanes[index]
  if (!lane) return
  const items = event.detail.items
  replaceLane(index, items)

  const at = items.findIndex((i) => i.id === event.detail.info.id)
  const moved = items[at]
  // the drop reports on both the source and the target lane; only the target holds the card
  if (!moved) return
  onmove(moved, lane.status.id, items[at - 1]?.id ?? null, items[at + 1]?.id ?? null)
}

const laneRule = (status: StatusInfo) =>
  `linear-gradient(to var(--kern-lane-dir, right), ${statusStyle(status.category, status.id, status.name).color} 0 34px, var(--kern-border) 34px)`
</script>

<div class="kboard" data-testid="board">
  {#each lanes as lane, index (lane.status.id)}
    {@const limit = wipLimits[lane.status.id]}
    {@const over = limit !== undefined && lane.items.length > limit}
    <section class="col">
      <header class="head">
        <StatusIcon
          category={lane.status.category}
          statusId={lane.status.id}
          name={lane.status.name}
          size={15}
        />
        <h2 class="name">{lane.status.name}</h2>
        <span class="count" class:over title={over ? m.tracker_wip_exceeded() : undefined}>
          {limit === undefined ? lane.items.length : `${lane.items.length}/${limit}`}
        </span>
        <span class="sp"></span>
        {#if oncreate}
          <button
            type="button"
            class="add"
            aria-label={m.tracker_new_issue()}
            onclick={() => oncreate(lane.status.id)}
          >
            <Icon name="plus" size={13} strokeWidth={1.9} />
          </button>
        {/if}
      </header>
      <div class="rule" style:background={laneRule(lane.status)}></div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="stack"
        use:dndzone={{
          items: lane.items,
          flipDurationMs: FLIP,
          type: 'tracker-issues',
          dragDisabled: !draggable,
          dropTargetStyle: {},
        }}
        onconsider={(e) => consider(index, e)}
        onfinalize={(e) => finalize(index, e)}
      >
        {#each lane.items as issue (issue.id)}
          <div class="slot" class:shadow={isShadow(issue)}>
            <BoardCard {issue} {onopen} />
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .kboard {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding: 22px 28px 30px;
    overflow: auto;
    height: 100%;
  }
  :global([dir='rtl']) .kboard {
    --kern-lane-dir: left;
  }
  .col {
    width: var(--kern-board-col-w);
    flex: none;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 30px;
  }
  .name {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--kern-ink-900);
    white-space: nowrap;
  }
  .count {
    font-family: var(--kern-font-mono);
    font-size: 11.5px;
    letter-spacing: -0.01em;
    color: var(--kern-ink-250);
  }
  .count.over {
    color: var(--kern-danger);
    font-weight: 500;
  }
  .sp {
    flex: 1;
  }
  .add {
    width: 22px;
    height: 22px;
    border-radius: var(--kern-r-md);
    display: grid;
    place-items: center;
    color: var(--kern-ink-250);
  }
  .add:hover {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-900);
  }
  .rule {
    height: 2px;
    border-radius: 1px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
    min-height: 80px;
    padding-bottom: 4px;
  }
  .slot.shadow {
    opacity: 0.35;
  }
  @media (max-width: 768px) {
    .kboard {
      padding: 16px;
      gap: 14px;
    }
  }
</style>
