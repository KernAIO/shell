/**
 * Voice recording moved into `@kernhq/ui`.
 *
 * It wraps `MediaRecorder` and nothing about the application, and a module that lets somebody
 * record a message cannot import the app to get it.
 */
export { formatDuration, MediaRecording, type Recording } from '@kernhq/ui'
