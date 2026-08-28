<script lang="ts">
import { Icon } from '@kernhq/ui'
import { pageHref, pageUrl } from '$lib/public/address'
import * as m from '$msg'
import type { PageProps } from './$types'

/**
 * One published page: the door to it, a search over it, or the prose itself.
 *
 * The prose arrives as HTML and is written into the document with `{@html}`. That is safe here for
 * a reason worth stating rather than assuming: it is not user input arriving at a browser, it is
 * the **pinned published version** drawn once by the module's own renderer, escaped there, and put
 * through the public scrub — every `id` and `data-id` attribute removed, every page mention either
 * re-pointed at its public path or reduced to plain text. There is no sanitising to do here and
 * none should be added: a second, weaker sanitiser in the route layer would be the one people
 * trusted.
 */
let { data, form }: PageProps = $props()

const locale = $derived(data.locale)
const site = $derived(data.site)
const doc = $derived(data.page)

const heading = $derived(
  doc
    ? doc.title
    : data.results
      ? m.pub_search_heading({ query: data.query }, { locale })
      : m.pub_locked_title({}, { locale }),
)
/** The tab, and what a link preview leads with. A front page is its site and says so once. */
const title = $derived(
  !site
    ? m.pub_locked_title({}, { locale })
    : doc && doc.path === ''
      ? site.title
      : `${heading} · ${site.title}`,
)
const canonical = $derived(pageUrl(data.origin, data.basePath, doc?.path ?? ''))
/**
 * The chrome runs in the reader's direction; the document runs in its own.
 *
 * Everything the layout draws — the search box, the footer, the stamp — is written in the reader's
 * language, so it belongs to `data.dir`. A published page is not: it was written once, in one
 * language, and is read by whoever finds the link. Letting it inherit the reader's direction is not
 * a cosmetic mismatch, it corrupts the sentence — the bidi algorithm gives a trailing neutral the
 * *paragraph's* direction, so "How this team works, in one page." served to a Persian reader draws
 * its full stop to the left of the H, and a Persian page served to an English reader draws its full
 * stop to the right of the whole line. Both measured on the built server, in a browser.
 *
 * `dir="auto"` is the answer rather than a direction carried in the payload: the browser reads the
 * first strong character of the element's own text, which is exactly the question, and it costs no
 * contract change and no field a module has to be trusted to fill in. It goes on every element that
 * carries publication content — the prose, the title, the breadcrumb names, a search hit — and on
 * none that carries a translated string.
 */
const CONTENT_DIR = 'auto'
/**
 * Public and findable are different requests, and people mean both. A site can be open to anyone
 * with the link and still ask to stay out of an index; a search result page is nobody's page and is
 * never one; and a locked site has nothing to index at all.
 */
const indexable = $derived(Boolean(site?.indexable) && Boolean(doc))
/** UTC, for the reason spelled out on `updated` in the layout: a cached page, hydrated elsewhere. */
const published = $derived(
  doc
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(doc.publishedAt),
      )
    : '',
)
</script>

<svelte:head>
  <title>{title}</title>
  {#if site}<meta name="description" content={site.description} />{/if}
  <link rel="canonical" href={canonical} />
  {#if !indexable}<meta name="robots" content="noindex, nofollow" />{/if}
  <meta property="og:type" content={doc && doc.path === '' ? 'website' : 'article'} />
  <meta property="og:title" content={title} />
  <meta property="og:url" content={canonical} />
  <meta property="og:locale" content={locale} />
  {#if site}
    <meta property="og:site_name" content={site.title} />
    <meta property="og:description" content={site.description} />
    {#if site.ogImageUrl}<meta property="og:image" content={site.ogImageUrl} />{/if}
    <meta name="twitter:card" content={site.ogImageUrl ? 'summary_large_image' : 'summary'} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={site.description} />
    {#if site.ogImageUrl}<meta name="twitter:image" content={site.ogImageUrl} />{/if}
  {/if}
</svelte:head>

{#if data.locked}
  <!--
    A challenge and nothing else. The title, the description and the shape of the tree stay behind
    it, because a table of contents is most of what a private handbook is.

    A plain form post, unenhanced on purpose, so it works before hydration and without script at
    all. The action mints the module's capability token and puts it in an HttpOnly cookie scoped to
    this publication — never in the URL, because a token in a link is a token in a referrer header
    and in somebody's access log.
  -->
  <div class="gate">
    <span class="seal" aria-hidden="true"><Icon name="lock" size={18} strokeWidth={1.6} /></span>
    <h1>{m.pub_locked_title({}, { locale })}</h1>
    <p class="sub">{m.pub_locked_body({}, { locale })}</p>
    {#if form?.wrong}
      <p class="wrong" role="alert">{m.pub_wrong_password({}, { locale })}</p>
    {/if}
    <form method="POST" action="?/unlock" class="gate-form">
      <label for="pub-password">{m.pub_password({}, { locale })}</label>
      <input
        id="pub-password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      />
      <button type="submit">{m.pub_unlock({}, { locale })}</button>
    </form>
  </div>
{:else if data.results}
  <h1 class="hd">{heading}</h1>
  {#if data.query.length < 2}
    <p class="none">{m.pub_search_short({}, { locale })}</p>
  {:else if data.results.length === 0}
    <p class="none">{m.pub_search_none({}, { locale })}</p>
  {:else}
    <ul class="hits">
      {#each data.results as hit (hit.path)}
        <li>
          <a href={pageHref(data.basePath, hit.path)}>
            <span class="hit-t" dir={CONTENT_DIR}>{hit.title}</span>
            {#if hit.snippet}<span class="hit-s" dir={CONTENT_DIR}>{hit.snippet}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{:else if doc}
  {#if doc.breadcrumbs.length > 1}
    <nav class="crumbs" aria-label={m.pub_breadcrumb_label({}, { locale })}>
      <ol>
        {#each doc.breadcrumbs as crumb, i (crumb.path)}
          <li>
            {#if i === doc.breadcrumbs.length - 1}
              <span aria-current="page" dir={CONTENT_DIR}>{crumb.title}</span>
            {:else}
              <a href={pageHref(data.basePath, crumb.path)} dir={CONTENT_DIR}>{crumb.title}</a>
              <span class="sep" aria-hidden="true">/</span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  {/if}

  {#if doc.coverUrl}
    <img class="cover" src={doc.coverUrl} alt="" />
  {/if}

  <h1 class="hd" dir={CONTENT_DIR}>
    {#if doc.icon}<span class="emo" aria-hidden="true">{doc.icon}</span>{/if}{doc.title}
  </h1>
  <p class="stamp">{m.pub_published({ date: published }, { locale })}</p>

  <div class="kern-prose" dir={CONTENT_DIR}>{@html doc.html}</div>
{/if}

<style>
  .hd {
    margin: 0;
    font-size: 30px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.03em;
    color: var(--kern-ink-900);
    text-wrap: balance;
  }
  .emo {
    margin-inline-end: 8px;
  }
  .stamp {
    margin: 8px 0 22px;
    font-size: 12.5px;
    color: var(--kern-ink-600);
  }

  /* ---- breadcrumbs ---- */
  .crumbs {
    margin-block-end: 12px;
  }
  .crumbs ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12.5px;
    color: var(--kern-ink-600);
  }
  .crumbs li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .crumbs a {
    color: var(--kern-ink-600);
    padding-block: 3px;
  }
  .crumbs a:hover {
    color: var(--kern-ink-900);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .sep {
    color: var(--kern-ink-500);
  }

  .cover {
    display: block;
    width: 100%;
    max-height: 220px;
    object-fit: cover;
    border-radius: var(--kern-r-lg);
    margin-block-end: 20px;
  }

  /*
   * A measure people can read. Prose set the full width of a 1180px sheet is two hundred characters
   * a line, and the eye loses the next line's start on every return.
   */
  .kern-prose {
    max-width: 70ch;
  }

  /*
   * `--kern-accent` is 4.14:1 on `--kern-surface` in the light palette — under AA for body text, and
   * every link in a document is body text. The deeper tone measures 6.84:1 there and 7.50:1 on the
   * dark surface, so a published page uses it. Worth fixing in the palette rather than here, and
   * this is the one surface in the product made of nothing but prose and links.
   */
  .kern-prose :global(a) {
    color: var(--kern-accent-deep);
  }

  /* ---- search results ---- */
  .hits {
    list-style: none;
    margin: 20px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .hits a {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border-radius: var(--kern-r-md);
    border: 1px solid transparent;
  }
  .hits a:hover {
    background: var(--kern-surface-hover);
    border-color: var(--kern-border);
  }
  .hit-t {
    font-size: 14px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  .hit-s {
    font-size: 13px;
    line-height: 1.5;
    color: var(--kern-ink-600);
    overflow-wrap: anywhere;
  }
  .none {
    margin: 18px 0 0;
    font-size: 13.5px;
    color: var(--kern-ink-600);
  }

  /* ---- the password challenge ---- */
  .gate {
    text-align: center;
  }
  .seal {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-block-end: 16px;
    border-radius: var(--kern-r-2xl);
    background: var(--kern-accent-tint);
    color: var(--kern-accent-deep);
  }
  .gate h1 {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--kern-ink-900);
  }
  .sub {
    margin: 8px 0 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--kern-ink-600);
    text-wrap: pretty;
  }
  .wrong {
    margin: 16px 0 0;
    padding: 8px 12px;
    font-size: 13px;
    text-align: start;
    color: var(--kern-danger);
    background: var(--kern-danger-tint);
    border-radius: var(--kern-r-md);
  }
  .gate-form {
    display: grid;
    gap: 8px;
    margin-block-start: 20px;
    text-align: start;
  }
  .gate-form label {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--kern-ink-700);
  }
  .gate-form input {
    height: 38px;
    padding-inline: 12px;
    font: inherit;
    font-size: 14px;
    color: var(--kern-ink-900);
    background: var(--kern-surface-input);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
  }
  .gate-form input:focus-visible {
    outline: 2px solid var(--kern-accent);
    outline-offset: 1px;
  }
  .gate-form button {
    height: 38px;
    margin-block-start: 4px;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    color: var(--kern-ink-inverse);
    background: var(--kern-ink-900);
    border-radius: var(--kern-r-md);
    cursor: pointer;
  }
  .gate-form button:hover {
    background: var(--kern-ink-800);
  }
</style>
