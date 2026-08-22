<script lang="ts">
import type { ChatStore } from '@kernhq/module-chat/client'
import { Button, Dialog, Field, Input, toast } from '@kernhq/ui'
import * as m from '$msg'
import { canChat } from '../permissions'

/**
 * Creating a channel.
 *
 * Visibility is a radio pair rather than a switch because "private" is not the absence of "public":
 * both need saying out loud, with what each one means, before someone commits to it.
 */

interface Props {
  open?: boolean
  store: ChatStore
  oncreated?: (channelId: string) => void
}
let { open = $bindable(false), store, oncreated }: Props = $props()

let name = $state('')
let topic = $state('')
let visibility = $state<'public' | 'private'>('public')
let saving = $state(false)
let nameEl = $state<HTMLInputElement | null>(null)

const allowed = $derived(canChat('createChannel'))
const canSubmit = $derived(name.trim().length > 0 && allowed && !saving)

$effect(() => {
  if (!open) return
  name = ''
  topic = ''
  visibility = 'public'
})

async function create() {
  if (!canSubmit) return
  saving = true
  try {
    const view = await store.createChannel({ name: name.trim(), type: visibility, topic: topic.trim() })
    toast.success(m.chat_created({ name: view.name ?? name.trim() }))
    open = false
    oncreated?.(view.id)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : m.chat_failed())
  } finally {
    saving = false
  }
}
</script>

<Dialog bind:open title={m.chat_new_channel()} initialFocus={() => nameEl}>
  <form
    onsubmit={(e) => {
      e.preventDefault()
      void create()
    }}
  >
    <Field id="channel-name" label={m.chat_channel_name()}>
      {#snippet children(id)}
        <Input
          {id}
          bind:ref={nameEl}
          bind:value={name}
          placeholder={m.chat_channel_name_placeholder()}
          data-testid="channel-name"
        />
      {/snippet}
    </Field>

    <Field id="channel-topic" label={m.chat_channel_topic()}>
      {#snippet children(id)}
        <Input {id} bind:value={topic} placeholder={m.chat_channel_topic_placeholder()} />
      {/snippet}
    </Field>

    <fieldset class="visibility">
      <legend>{m.chat_channel_visibility()}</legend>
      <label class="choice" class:picked={visibility === 'public'}>
        <input type="radio" name="visibility" value="public" bind:group={visibility} />
        <span>{m.chat_channel_public()}</span>
      </label>
      <label class="choice" class:picked={visibility === 'private'}>
        <input type="radio" name="visibility" value="private" bind:group={visibility} />
        <span>{m.chat_channel_private()}</span>
      </label>
    </fieldset>
  </form>

  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{m.chat_close_thread()}</Button>
    <Button onclick={create} disabled={!canSubmit} loading={saving} data-testid="create-channel">
      {m.chat_create()}
    </Button>
  {/snippet}
</Dialog>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .visibility {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  legend {
    padding: 0 0 6px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--kern-ink-600);
  }
  .choice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 9px 11px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md2);
    font-size: 13.5px;
    color: var(--kern-ink-700);
    cursor: pointer;
  }
  .choice.picked {
    border-color: var(--kern-accent);
    background: var(--kern-accent-tint);
  }
</style>
