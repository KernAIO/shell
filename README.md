# app

**Every screen people actually use.**

The web application for [Kern](https://github.com/KernAIO/kern). It installs like an app, works in
four languages including right-to-left ones, and follows the system's light or dark setting.

Each Kern module contributes its own screens, navigation and command-palette actions here. The shell
composes whatever a workspace has switched on and knows nothing about any particular feature.

## Run it

Goal: open Kern's interface on your own machine.

You need:

- Node 24 and pnpm 10.

### Run it against demo data

This is the fastest way to see the whole interface. It needs no database, no services and no setup.

```bash
pnpm install
pnpm dev:mock
```

**Expected result:** the app is at http://localhost:5173, already signed in, with a workspace full of
issues and conversations.

### Run it against real services

If you want the app talking to a real backend, start everything from the
[umbrella repository](https://github.com/KernAIO/kern):

```bash
pnpm setup
pnpm infra
pnpm dev
```

**Expected result:** the app is at http://localhost:5173 and calls core on port 4000.

## Test it

```bash
pnpm test       # unit tests
pnpm test:e2e   # the interface, driven in a real browser against demo data
```

**Expected result:** both report all tests passed.

## Things worth knowing

- **`DESIGN.md` is the authority.** It is taken from the product's own design file: exact colours,
  sizes and the anatomy of every view. Match it rather than inventing.
- **Use the design tokens that exist.** They are listed in `@kernhq/ui`. A token nobody defined
  resolves to nothing, and the result looks almost right, which is worse than looking broken.
- **The sidebar belongs to whichever module you are in.** A module fills it by contributing a
  `sidebar.widget` slot — that is how chat puts conversations there.
- **Every string goes through the message catalogue** in `messages/`. No English is written into a
  component.
- **The layout must survive `dir="rtl"`.** Use logical CSS properties. Never `left` or `right`.

### If a change does not appear

**Problem:** you edited a component, and the browser still shows the old one.

**Cause:** a second dev server is running and serving stale code.

**Solution:**

1. Run `lsof -ti:5173`.
2. If it prints more than one process id, stop all of them.
3. Run `pnpm dev:mock` again.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [DESIGN.md](DESIGN.md) and [CLAUDE.md](CLAUDE.md).
Licence: [AGPL-3.0](LICENSE).

Website: [kernaio.com](https://kernaio.com).
