<script lang="ts">
import { Icon } from '@kernhq/ui'
import { page } from '$app/state'
import { isLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'

/**
 * The not-found a stranger gets, rendered on the server like everything else in this group.
 *
 * It exists as its own boundary rather than falling through to `src/routes/+error.svelte`, and the
 * reason is structural rather than cosmetic: page options are collected from the branch that
 * renders, so an error escaping to the root boundary is rendered under the root layout's
 * `ssr = false` — which means a blank document, and a completely blank one for a reader with no
 * JavaScript. Measured, not assumed: `/p/<workspace>/<slug-that-does-not-exist>` answered 404 with
 * an empty body and a bootstrap script until this file existed.
 *
 * It says the same thing for every reason a page is not here — never published, opted out,
 * archived, trashed, expired, another workspace's, or a workspace with Quire switched off. A
 * refusal that separated them would confirm the page exists to whoever was guessing.
 */
const data = page.data as { locale?: unknown; dir?: unknown }
const locale = $derived(typeof data.locale === 'string' && isLocale(data.locale) ? data.locale : 'en')
const dir = $derived(data.dir === 'rtl' ? 'rtl' : 'ltr')
const notFound = $derived(page.status === 404)
</script>

<svelte:head>
  <title>{notFound ? m.not_found_title({}, { locale }) : m.error_page_title({}, { locale })}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="gone" lang={locale} {dir}>
  <div class="card">
    <span class="seal" aria-hidden="true">
      <Icon name={notFound ? 'circle-help' : 'triangle-alert'} size={20} strokeWidth={1.6} />
    </span>
    <h1>{notFound ? m.not_found_title({}, { locale }) : m.error_page_title({}, { locale })}</h1>
    <p>{notFound ? m.not_found_body({}, { locale }) : m.error_generic({}, { locale })}</p>
  </div>
  <footer><a href="https://kernaio.com">{m.pub_runs_on_kern({}, { locale })}</a></footer>
</div>

<style>
  .gone {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--kern-canvas);
    color: var(--kern-ink-700);
  }
  .card {
    flex: 1;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 4px;
    padding: 40px 24px;
    text-align: center;
  }
  .seal {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    margin-block-end: 14px;
    border-radius: var(--kern-r-2xl);
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    color: var(--kern-ink-600);
  }
  h1 {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--kern-ink-900);
  }
  p {
    margin: 6px 0 0;
    max-width: 42ch;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--kern-ink-600);
    text-wrap: pretty;
  }
  footer {
    padding: 16px 20px 24px;
    text-align: center;
    font-size: 12.5px;
  }
  footer a {
    color: var(--kern-ink-700);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--kern-border-strong);
  }
  footer a:hover {
    color: var(--kern-ink-900);
    text-decoration-color: currentColor;
  }
</style>
