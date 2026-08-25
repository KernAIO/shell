/**
 * The uploader moved into `@kernhq/ui`.
 *
 * There is still exactly one — ask core for a ticket, PUT the bytes straight to storage, then tell
 * core the file is `ready`; skipping the third step leaves the file `pending` and invisible for
 * ever. It lives in the framework now because a module's screens attach files, and a module cannot
 * import the app. What the app still owns — the configured API client and the mock storage — it
 * hands over through `setHost()` in the root layout.
 */
export { UploadError, type UploadOptions, type UploadProgress, uploadFile } from '@kernhq/ui'
