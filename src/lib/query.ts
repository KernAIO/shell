/**
 * Query keys and the client defaults moved into `@kernhq/ui`.
 *
 * A module builds queries and the shell invalidates them from realtime `change` messages, so both
 * halves have to agree on the `[module, entity, …scope]` shape — which means it cannot live in the
 * app, where a module cannot see it.
 *
 * `keys` names core's queries only. A module names its own the same way and gets the same
 * invalidation; it does not add them here.
 */
export { createQueryClient, keys } from '@kernhq/ui'
