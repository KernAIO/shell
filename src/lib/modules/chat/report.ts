import { toast } from '@kernhq/ui'
import * as m from '$msg'

/**
 * Run a mutation and say something when it fails.
 *
 * Every action in chat used to be fired with `void store.something()`, which throws the failure on
 * the floor: the reaction does not appear, the channel does not mute, and nothing tells you why.
 * Optimism is fine — silence is not.
 */
export function attempt(work: () => Promise<unknown>, failed: () => string = () => m.chat_failed()) {
  void work().catch((error: unknown) => {
    toast.error(error instanceof Error && error.message ? error.message : failed())
  })
}
