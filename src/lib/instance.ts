import { env } from '$env/dynamic/public'

/**
 * Where an instance admin finds the settings that belong to the whole installation.
 *
 * The pages are the same everywhere; who the admin *is* is not, and that is what decides where they
 * sit. On a self-hosted instance the instance admin is the customer — instance settings are their
 * settings, so they belong beside their workspace and account ones under Settings. On Kern Cloud the
 * instance admin is us, the operator; those pages are not a customer setting at all and stay in
 * their own console at `/admin`, where nothing in the customer's own settings suggests they exist.
 *
 * `PUBLIC_KERN_HOSTING` is read from `$env/dynamic/public`, so one image serves both: the cloud
 * stack sets it to `cloud` and every self-host stack leaves it alone. It is not a security boundary
 * and must never be used as one — `instanceAdmin` is the only thing gating these pages, on the
 * server, and a browser that lies about this variable moves rows in a sidebar and reaches nothing.
 */
export const isCloudHosted = () => env.PUBLIC_KERN_HOSTING === 'cloud'

/** The base the instance pages live under, for the hosting this build is running as. */
export const instanceBase = (slug: string) =>
  isCloudHosted() ? `/${slug}/admin` : `/${slug}/settings/instance`

/** An instance page's address — `path` is the part after the base, `''` for the section itself. */
export const instanceHref = (slug: string, path = '') => `${instanceBase(slug)}${path}`
