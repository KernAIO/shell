/**
 * The cookie a reader who has answered the password challenge carries.
 *
 * What it holds is the module's own capability token: an AES-GCM envelope sealed with the instance
 * secret, bound by its associated data to one publication, carrying an expiry and no identity. It
 * is not a session, nothing on the server remembers it, and it says nothing about who is reading.
 *
 * Three properties, and each of them is the reason for the next:
 *
 *   - **HttpOnly.** No script on a published page ever needs to read it, and the pages that render
 *     the token's own site are the pages most likely to contain somebody else's prose.
 *   - **Scoped to the publication's path.** One name is enough because the browser scopes by path:
 *     `/p/acme/handbook` and `/p/acme/payroll` each get their own, and unlocking one does not hand
 *     the reader the other. Path matching is on segment boundaries, so `/p/acme/handbook-2` is a
 *     different site and not a prefix of this one.
 *   - **Never in a URL.** A token in a link is a token in a referrer header, in a bookmark and in
 *     somebody's access log. The form posts it and the server puts it here; nothing else moves it.
 */
export const PUBLICATION_TOKEN_COOKIE = 'kern_pub'
