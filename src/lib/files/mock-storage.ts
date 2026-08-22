/**
 * Object storage for the mock backend.
 *
 * `PUBLIC_API_MOCK=1` runs the whole interface with no services behind it, which means there is no
 * bucket to upload to. Files uploaded in a demo live here instead, in memory, for as long as the tab
 * is open. That is the honest shape of a mock: a voice note you record plays back, and it is gone
 * when you reload, because nothing was ever stored anywhere.
 *
 * Object URLs are created lazily and kept, so the same file id always yields the same URL and a
 * `<video>` that re-renders does not lose its source.
 */

const blobs = new Map<string, Blob>()
const urls = new Map<string, string>()

export function putMockObject(id: string, blob: Blob): void {
  blobs.set(id, blob)
}

export function hasMockObject(id: string): boolean {
  return blobs.has(id)
}

/** A URL a media element or a download link can use. Empty when nothing was stored under this id. */
export function mockObjectUrl(id: string): string {
  const existing = urls.get(id)
  if (existing) return existing
  const blob = blobs.get(id)
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  urls.set(id, url)
  return url
}

export function clearMockObjects(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
  blobs.clear()
}
