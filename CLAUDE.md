# CLAUDE.md — Kern project rules

Rules for anyone (human or AI agent) working on Kern repositories. These apply to every repo in the KernAIO org.

## We build in the open
The repositories are **public**, so every commit is visible the moment it is pushed:
- Never commit secrets, tokens, personal data, or machine-specific paths. Use `.env` (gitignored) + `.env.example`.
- Write READMEs, docs, and issue/PR text for external contributors, not for ourselves.
- Keep commit history clean and meaningful — it is part of what people judge the project by.
- Every repo carries LICENSE (AGPL-3.0), CLA.md, CODE_OF_CONDUCT.md, SECURITY.md, CONTRIBUTING.md.

## Git
- Author identity: `Navid Mirzaaghazadeh <mirzaaghazadeh@icloud.com>` (already set in each repo's local git config — plain `git commit` is correct; do not override with `-c`).
- **Do not add `Claude-Session:`, `Co-Authored-By: Claude`, "Generated with", or any AI trailer/branding to commit messages, PRs, or code comments.**
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with optional scope). Imperative mood, ≤ 72-char subject.
- Push to `origin main`. Never force-push. If `git pull --rebase` complains about unstaged files that aren't yours (parallel agents share worktrees), use `git -c rebase.autoStash=true pull --rebase`.

## Layout & workflow
- Umbrella dev workspace: `kern/` with sibling repos cloned under `kern/repos/<name>` (gitignored there). pnpm links all `@kernhq/*` packages via the umbrella workspace.
- Install dependencies ONLY via `kern/scripts/pnpm-install-locked.sh` (serialises pnpm at the umbrella root).
- Node 24 (`nvm use 24`), pnpm 10, TypeScript ~5.9, ESM/NodeNext, Biome for lint+format (run `pnpm exec biome check --write <paths>` before committing), Vitest.
- Contracts first: changes to `@kernhq/contracts` / module contracts land (and build) before their consumers.
- Modules own their data: Postgres schema `mod_<id>`, `workspace_id` + RLS on every tenant table, cross-module access only via `kernel.call()` and events. See `modules` repo `packages/_template`.
- Ports: app 5173 · core 4000 · chat 4100 · mail 4200 · collab 4300 · docs 4400.
- Dev DB on this machine: Homebrew Postgres 18 at `localhost:5432` (`kern`/`kern`); the compose Postgres listens on `${KERN_PG_PORT:-5432}` (5433 here).

## Quality bar
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass before pushing.
- UI follows `app/DESIGN.md` (Ink/paper design system) and must work in RTL (fa/ar) and dark mode.
- All user-facing strings go through i18n (Paraglide) — no hardcoded English in components.

## Keeping this file current
This file is how the next person — or the next agent — avoids repeating what we already worked out.
When you learn something durable, add it here **in the same commit as the change that taught you**:
- a trap that cost you time (a silent failure, a misleading error, a tool that lies about success)
- a convention you had to infer from reading several files
- a decision and the reason behind it, especially where the obvious choice is wrong
Keep it specific and short. Delete anything that stops being true — a stale note is worse than none.

---

# This repository: app (the web client)

The SvelteKit PWA every module renders into. `pnpm dev:mock` runs the whole interface against an
in-memory API with demo data — no backend, no database.

**Things worth knowing**
- **`DESIGN.md` is the authority.** It is derived from the product's own design file: exact tokens,
  sizes and per-view anatomy. Match it rather than inventing.
- Use the tokens that exist. `--kern-paper`, `--kern-hover` and friends were invented once and silently
  resolved to nothing; the real names are in `@kernhq/ui/styles/tokens.css`.
- The design system's base styles sit in `@layer base` so a Tailwind utility can override them.
  Unlayered CSS beats layered CSS, so an unlayered `a { color }` silently wins over `class="text-…"`.
- Check a component's actual props before using it — several differ from the obvious guess (`Field`
  takes `id` and passes it to its children snippet; `Tabs` items use `value`, not `id`; `Card` is a
  block, so wrap flex layouts in your own element).
- **Kill stale dev servers before debugging.** A second process on :5173 served old code twice in one
  day and made correct fixes look broken. `lsof -ti:5173` should print exactly one pid.
- Query keys are `[module, entity, …scope]` so a realtime `change` event invalidates precisely what it
  touched. Keep new queries in that shape.
- Every user-facing string goes through Paraglide (`messages/*.json`), and the layout must survive
  `dir="rtl"` — use logical properties, never `left`/`right`.
