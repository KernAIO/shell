<script lang="ts">
import { Icon } from '@kernhq/ui'
import { page as current } from '$app/state'
import { pageHref } from '$lib/public/address'
import { ancestorPaths, buildPublicNav, type PublicNavNode } from '$lib/public/nav'
import * as m from '$msg'
import type { LayoutProps } from './$types'

/**
 * The chrome of a published site — and deliberately none of the application's.
 *
 * A reader here is signed out and has no workspace, so there is no switcher to offer, no sidebar of
 * modules, no command palette and no inbox. What is left is what a documentation site is: a name to
 * click back to, a table of contents, a search box, the prose, and a line at the bottom saying what
 * this runs on.
 *
 * Every string is rendered with an explicit `{ locale }`. The locale was resolved on the server from
 * the same cookie and `Accept-Language` header Paraglide's own strategy reads — and it has to be
 * passed rather than looked up, because `getLocale()` has no request to read on the server and would
 * answer English for a Persian reader.
 */
let { data, children }: LayoutProps = $props()

const site = $derived(data.site)
const locale = $derived(data.locale)
const nav = $derived(buildPublicNav(site?.nav ?? []))
/** The page being read, as the module addresses it: '' is the front page. */
const here = $derived(typeof current.params.path === 'string' ? current.params.path : '')
/**
 * The open page's ancestors, so the branch leading to it reads as the branch leading to it.
 *
 * The whole tree is drawn — a table of contents that hides half of itself is worth less than one
 * that scrolls, and collapsing without script means a `<details>` per node with a link inside a
 * `<summary>`, which is a well-known way to make a nav unusable with a keyboard. Marking the trail
 * costs nothing and answers the same question: where am I.
 */
const trail = $derived(ancestorPaths(here))
const query = $derived(current.url.searchParams.get('q') ?? '')
/**
 * The site's name and its page titles are content, not chrome, so they run in their own direction.
 *
 * `data.dir` is the reader's, and it is right for everything this layout writes — the search box,
 * the footer, the stamp. It is wrong for anything the publication wrote: a title inherits the
 * paragraph direction, so an English name in a Persian reading puts its trailing punctuation at the
 * wrong end and a Persian name in an English one does the same in reverse. `dir="auto"` asks the
 * browser to read the first strong character of the element's own text, which is the question.
 */
const CONTENT_DIR = 'auto'
/**
 * Dates on a published page are formatted in UTC, deliberately.
 *
 * Two reasons and they point the same way. The response is cached for everybody, so a date read off
 * the reader's own clock would be baked into whatever copy the first reader happened to warm. And
 * the page is rendered on the server and then hydrated in the browser: the two run in different
 * zones, so "27 August" server-side becomes "28 August" in Tokyo, and the reader watches the date
 * change under them.
 */
const updated = $derived(
  site
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(site.updatedAt))
    : '',
)
</script>

{#snippet branch(nodes: PublicNavNode[])}
  <ul>
    {#each nodes as node (node.path)}
      <li>
        <a
          href={pageHref(data.basePath, node.path)}
          aria-current={node.path === here ? 'page' : undefined}
          class:on={node.path === here}
          class:trail={node.path !== here && trail.has(node.path)}
        >
          {#if node.icon}<span class="emo" aria-hidden="true">{node.icon}</span>{/if}
          <span class="lbl" dir={CONTENT_DIR}>{node.title}</span>
        </a>
        {#if node.children.length > 0}{@render branch(node.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet finder()}
  <form class="find" method="GET" action={data.basePath} role="search">
    <label class="kern-sr-only" for="pub-q">{m.pub_search_label({}, { locale })}</label>
    <span class="find-ic" aria-hidden="true"><Icon name="search" size={14} strokeWidth={1.7} /></span>
    <input
      id="pub-q"
      name="q"
      type="search"
      value={query}
      autocomplete="off"
      placeholder={m.pub_search_placeholder({}, { locale })}
    />
    <button type="submit">{m.search({}, { locale })}</button>
  </form>
{/snippet}

<div
  class="site"
  lang={locale}
  dir={data.dir}
  data-theme={data.theme === 'dark' ? 'dark' : undefined}
  class:plain={data.locked || !site}
>
  <a class="kern-skip-link" href="#doc">{m.pub_skip_to_content({}, { locale })}</a>

  {#if site}
    <header class="top">
      <div class="bar">
        <a class="brand" href={data.basePath} dir={CONTENT_DIR}>{site.title}</a>
        {@render finder()}
      </div>
    </header>

    <div class="body">
      <details class="toc phone">
        <summary>{m.pub_contents({}, { locale })}</summary>
        {@render branch(nav)}
      </details>
      <nav class="toc desk" aria-label={m.pub_nav_label({}, { locale })}>{@render branch(nav)}</nav>
      <main class="doc" id="doc" tabindex="-1">{@render children()}</main>
    </div>
  {:else}
    <main class="doc lone" id="doc" tabindex="-1">{@render children()}</main>
  {/if}

  <footer class="foot">
    <a class="runs" href="https://kernaio.com">{m.pub_runs_on_kern({}, { locale })}</a>
    {#if site}<span class="upd">{m.pub_updated({ date: updated }, { locale })}</span>{/if}
  </footer>
</div>

<style>
  /*
   * The wrapper carries `lang`, `dir` and the publication's theme rather than <html>.
   *
   * <html> belongs to the application shell: its `lang` and `dir` are set by an effect, which runs
   * only in the browser and only after hydration — so a reader with no JavaScript would be served a
   * Persian page laid out left to right. Both the direction and the dark palette are inherited by
   * descendants (`[dir="rtl"]` and `[data-theme="dark"]` are plain selectors, not :root ones), so a
   * wrapper is enough for everything drawn inside it and it is correct in the first byte.
   *
   * `auto` and `light` follow the document, which `app.html` sets from the reader's system
   * preference before first paint; only `dark` forces the palette, because forcing *light* would
   * mean restating a hundred tokens here to win against a dark <html>.
   */
  .site {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--kern-canvas);
    color: var(--kern-ink-700);
  }

  /* ---- header ---- */
  .top {
    position: sticky;
    top: 0;
    z-index: var(--kern-z-anchored);
    background: var(--kern-surface-header);
    border-block-end: 1px solid var(--kern-border);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 1180px;
    margin-inline: auto;
    padding: 10px 20px;
  }
  .brand {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--kern-ink-900);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .brand:hover {
    color: var(--kern-accent-deep);
  }

  .find {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-inline-start: auto;
  }
  .find-ic {
    position: absolute;
    inset-inline-start: 9px;
    display: grid;
    place-items: center;
    color: var(--kern-ink-500);
    pointer-events: none;
  }
  .find input {
    width: 190px;
    max-width: 42vw;
    height: 32px;
    padding-block: 0;
    padding-inline: 30px 10px;
    font: inherit;
    font-size: 13px;
    color: var(--kern-ink-900);
    background: var(--kern-surface-input);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
  }
  .find input::placeholder {
    color: var(--kern-ink-500);
  }
  .find input:focus-visible {
    outline: 2px solid var(--kern-accent);
    outline-offset: 1px;
  }
  .find button {
    height: 32px;
    padding-inline: 12px;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--kern-ink-900);
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
    cursor: pointer;
  }
  .find button:hover {
    background: var(--kern-surface-hover);
    border-color: var(--kern-border-hover);
  }

  /* ---- the two columns ---- */
  .body {
    flex: 1;
    width: 100%;
    max-width: 1180px;
    margin-inline: auto;
    padding: 20px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-content: start;
  }

  .toc.desk {
    display: none;
  }
  .toc.phone > summary {
    /* A <details> is the only disclosure that works with no script, and its default cursor is an
       arrow — which reads as "not a control" under the pointer. */
    cursor: pointer;
    list-style: none;
    padding: 7px 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--kern-ink-900);
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-md);
  }
  .toc.phone > summary::-webkit-details-marker {
    display: none;
  }
  .toc :global(ul) {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1px;
  }
  .toc.phone[open] > :global(ul) {
    margin-block-start: 8px;
  }
  .toc :global(li ul) {
    margin-inline-start: 9px;
    padding-inline-start: 9px;
    border-inline-start: 1px solid var(--kern-border);
  }
  .toc :global(a) {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 28px;
    padding: 4px 8px;
    border-radius: var(--kern-r-sm);
    font-size: 13.5px;
    line-height: 1.35;
    color: var(--kern-ink-600);
  }
  .toc :global(a:hover) {
    background: var(--kern-surface-hover);
    color: var(--kern-ink-900);
  }
  .toc :global(a.on) {
    background: var(--kern-accent-tint);
    color: var(--kern-ink-900);
    font-weight: 500;
  }
  .toc :global(a.trail) {
    color: var(--kern-ink-900);
  }
  .toc :global(.emo) {
    flex: none;
    font-size: 13px;
  }
  .toc :global(.lbl) {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* ---- the sheet the prose is printed on ---- */
  .doc {
    min-width: 0;
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-card);
    padding: 24px 22px 32px;
  }
  .doc:focus-visible {
    outline: 2px solid var(--kern-accent);
    outline-offset: 2px;
  }
  .lone {
    width: 100%;
    max-width: 420px;
    margin: auto;
  }
  .plain .foot {
    justify-content: center;
  }

  /* ---- footer ---- */
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    max-width: 1180px;
    width: 100%;
    margin-inline: auto;
    padding: 16px 20px 24px;
    font-size: 12.5px;
    color: var(--kern-ink-600);
  }
  .runs {
    color: var(--kern-ink-700);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--kern-border-strong);
  }
  .runs:hover {
    color: var(--kern-ink-900);
    text-decoration-color: currentColor;
  }

  @media (min-width: 900px) {
    .body {
      grid-template-columns: 232px minmax(0, 1fr);
      gap: 32px;
      padding-block: 28px 40px;
    }
    .toc.phone {
      display: none;
    }
    .toc.desk {
      display: block;
      position: sticky;
      top: 72px;
      align-self: start;
      max-height: calc(100dvh - 96px);
      overflow-y: auto;
    }
    .doc {
      padding: 34px 40px 48px;
    }
  }
</style>
