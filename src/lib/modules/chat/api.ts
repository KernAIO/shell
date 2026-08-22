import { type ChatApi, createChatClient } from '@kernhq/module-chat/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockChatApi } from './mock'

/**
 * The chat API client.
 *
 * Chat runs in its own service because it holds a websocket per client, but its REST surface is
 * reached the same way as any other module's: `/api/chat`, same origin, same session cookie.
 * `PUBLIC_API_MOCK=1` swaps in the in-memory implementation from `./mock`, which satisfies the same
 * contract types, so no view has a second code path for demos and end-to-end tests.
 */
export type { ChatApi }

let cached: ChatApi | null = null

export function getChatApi(): ChatApi {
  if (cached) return cached
  cached = isMock() ? (createMockChatApi() as unknown as ChatApi) : createReal()
  return cached
}

function createReal(): ChatApi {
  return createChatClient({
    // empty base URL keeps requests same-origin: the dev server proxies /api, and in production the
    // reverse proxy routes /api/chat to the chat service, so the session cookie works in both
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4100'),
  })
}

/** Test seam: lets tests install a fake without touching module state elsewhere. */
export function __setChatApi(api: ChatApi | null) {
  cached = api
}
