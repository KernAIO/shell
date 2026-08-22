import type { core } from '@kernhq/contracts'
import { getApi, isMock } from '$lib/api/client'
import { putMockObject } from './mock-storage'

/**
 * Putting a file into Kern.
 *
 * Three steps, and all three matter. Core hands out a presigned URL and records the file as
 * `pending`; the bytes go straight to object storage without passing through the API; then core is
 * told to mark the file `ready`. A file that is uploaded but never completed stays `pending` for
 * ever and nothing will show it, so the third step is not optional.
 *
 * This is the only uploader in the application. Anything that attaches a file — a chat message, a
 * voice note, an issue — comes through here.
 */

export interface UploadProgress {
  /** 0 to 1, or null while the browser is not reporting progress */
  ratio: number | null
}

export interface UploadOptions {
  workspaceId: string
  file: Blob
  name: string
  mimeType?: string
  /** what the file belongs to, when that is known before the upload */
  attachedTo?: { module: string; type: string; id: string }
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

/** Upload a blob and return the finished file. Throws `UploadError` at every step it can fail. */
export async function uploadFile(opts: UploadOptions): Promise<core.FileObject> {
  const api = getApi()
  const mimeType = opts.mimeType || opts.file.type || 'application/octet-stream'

  const ticket = await api.files
    .createUpload({
      workspaceId: opts.workspaceId as never,
      name: opts.name,
      mimeType,
      size: opts.file.size,
      ...(opts.attachedTo ? { attachedTo: opts.attachedTo as never } : {}),
    })
    .catch((error: unknown) => {
      throw new UploadError('createUpload failed', error)
    })

  try {
    await putBytes(ticket, opts.file, mimeType, opts.onProgress, opts.signal)
  } catch (error) {
    throw new UploadError('upload failed', error)
  }

  try {
    return await api.files.complete({ id: ticket.file.id })
  } catch (error) {
    throw new UploadError('complete failed', error)
  }
}

/**
 * Send the bytes.
 *
 * `XMLHttpRequest` rather than `fetch`, because it is still the only way to watch an upload's
 * progress — `fetch` reports nothing until the whole body has gone. A voice note is small, but a
 * screen recording is not, and a progress bar that never moves is worse than none.
 */
function putBytes(
  ticket: { method: string; url: string; headers?: Record<string, unknown>; file: { id: string } },
  blob: Blob,
  mimeType: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  // The mock backend has no object storage to PUT to, so it keeps the bytes in memory instead.
  // This is the one place that knows about it: everything above and below is the real path.
  if (isMock() && ticket.url.startsWith('mock-upload://')) {
    putMockObject(ticket.file.id, blob)
    onProgress?.({ ratio: 1 })
    return Promise.resolve()
  }

  if (ticket.method !== 'put') {
    return Promise.reject(new Error(`unsupported upload method: ${ticket.method}`))
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', ticket.url, true)
    request.setRequestHeader('Content-Type', mimeType)
    for (const [header, value] of Object.entries(ticket.headers ?? {}))
      request.setRequestHeader(header, String(value))

    request.upload.onprogress = (event) => {
      onProgress?.({ ratio: event.lengthComputable ? event.loaded / event.total : null })
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`storage answered ${request.status}`))
    }
    request.onerror = () => reject(new Error('the browser could not reach storage'))
    request.onabort = () => reject(new Error('cancelled'))

    signal?.addEventListener('abort', () => request.abort(), { once: true })
    request.send(blob)
  })
}
