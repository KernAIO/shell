# Kern web app

The SvelteKit PWA that every Kern module renders into. Part of [Kern](https://github.com/KernAIO/kern).

## Running it

```bash
pnpm dev:mock   # http://localhost:5173 against an in-memory API — no backend needed
pnpm dev        # against the real services (core on :4000, chat on :4100, collab on :4300)
```

`dev` proxies `/api`, `/ws` and `/collab` to the services, so session cookies work same-origin exactly
as they do behind Caddy in production. `dev:mock` swaps in a fake API with demo data
(`src/lib/api/mock.ts`): the whole interface — workspaces, inbox, members, modules — is browsable and
testable without Postgres, and the end-to-end tests run against it.

## How it is put together

| | |
|---|---|
| `src/lib/api` | the API client, and the mock that stands in for it |
| `src/lib/auth` | Better Auth client and the providers this instance offers |
| `src/lib/state` | session, theme — small runes classes shared through the tree |
| `src/lib/realtime.svelte.ts` | the WebSocket bridge: server events invalidate exactly the queries they touch |
| `src/lib/modules` | the client-side module registry that feeds navigation, the palette and slots |
| `src/routes/(auth)` | sign-in, sign-up, magic link, password reset, invitations |
| `src/routes/(app)/[ws]` | the workspace shell: rail, sidebar, home, inbox, settings |

Data flows through TanStack Query with keys shaped `[module, entity, …scope]`. The realtime gateway
sends `{module, entity, id}` when something changes, so a single event invalidates just the affected
queries rather than forcing a refetch of everything.

Modules are composed at build time and switched on per workspace at runtime: `workspaces.modules.list`
decides what appears in the rail, so an instance can ship every module while a workspace only sees the
ones it uses.

## Design

The interface follows [`DESIGN.md`](./DESIGN.md) — the "Ink / paper" system implemented in
`@kernaio/ui`. Light and dark are both first-class, as are right-to-left languages: layout uses
logical properties throughout, and Persian and Arabic ship with the app.

## Checks

```bash
pnpm typecheck   # svelte-check
pnpm lint
pnpm test        # unit
pnpm test:e2e    # Playwright, against mock mode
pnpm build       # adapter-node → `node build`
```
