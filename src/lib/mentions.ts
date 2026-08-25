/**
 * Mention parsing moved into `@kernhq/ui`.
 *
 * Both chat and tracker use it, so it is neither module's — and it typed against chat's `RichDoc`
 * while tracker declares an identical one of its own, which made a shared helper pick a winner
 * arbitrarily. The framework's copy names the shape structurally instead.
 */
export {
  EVERYONE_TOKENS,
  literalFor,
  type MentionCandidate,
  type MentionQuery,
  mentionQueryAt,
  mentionsIn,
  type PickedMention,
  rankCandidates,
  textToDoc,
} from '@kernhq/ui'
