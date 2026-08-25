/**
 * File-size formatting moved into `@kernhq/ui`.
 *
 * There were two copies — one here for attachments, one in the billing module for storage limits —
 * which is one too many for a function whose whole job is to agree with itself everywhere.
 */
export { formatBytes } from '@kernhq/ui'
