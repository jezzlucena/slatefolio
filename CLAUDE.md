# CLAUDE.md

Guidance for AI agents (Claude Code and similar) working in this repository.

## Ground rules for agents — read first

These are hard rules from the repository owner:

1. **NEVER run the dev server or the app to "see" a change.** Do not start
   `pnpm dev`, `next dev`, the backend, MongoDB, or Docker services on your
   own initiative. The owner runs the app and does all visual verification
   themselves.
2. **NEVER perform visual checks.** No headless-browser screenshots, no
   Playwright/chromium driving, no rendering pipelines. These are extremely
   token-intensive and are not your call to make.
3. **NEVER create throwaway test code or scratch routes** (e.g. a temporary
   preview page under `src/app` to render a component). Do not add files to
   the app purely to verify your own work.
4. **Validation you MAY do freely:** type checks, linting, builds, and SCSS
   compilation (see [Validation commands](#validation-commands)). These are
   cheap and encouraged after any change.
5. Exceptions to rules 1–3 exist only when the owner **explicitly asks** you
   to run, launch, screenshot, or scaffold something in that same request.
6. After making UI changes, describe what to look for (which component, what
   behavior, what might regress) and let the owner check it in the browser.

## What this project is

Slatefolio is a self-hosted portfolio/CMS: a Next.js frontend showing
projects, testimonials, a profile, and a resume, with an admin panel
(WebAuthn/passkey + JWT auth), backed by an Express + Mongoose API and
MongoDB. It is a pnpm monorepo:

```
├── apps/
│   ├── frontend/    # Next.js 15 (App Router, next-intl i18n, SCSS modules, Tailwind 4)
│   │   ├── src/app/[locale]/   # routed pages (locale segment via next-intl middleware)
│   │   ├── src/components/     # React components; *.module.scss alongside each
│   │   ├── messages/           # i18n translation JSON
│   │   └── public/
│   └── backend/     # Express + Mongoose API (TypeScript, CommonJS)
│       └── src/     # app.ts entrypoint, controllers/, models/, middleware/
├── docker-compose.yml     # production stack: mongo + backend + frontend
├── package.json           # root workspace scripts (pnpm dev orchestration)
├── pnpm-workspace.yaml    # workspace config + dependency version catalog
└── .env / .env.example    # single root env file feeds both apps and Docker
```

## Environments & workflows

- **Development (owner-run):** `pnpm dev` at the root starts the `mongo`
  Docker service and both apps natively in watch mode (frontend:
  `next dev --turbopack` on `$FRONTEND_PORT`, backend: `tsx watch` on
  `$BACKEND_PORT`), with the root `.env` injected via dotenv-cli. Agents do
  not run this — see ground rules.
- **Production:** `docker compose up -d` builds and runs the full stack.
  There is deliberately **one** docker-compose.yml — no override files, no
  duplicated dev/prod compose logic. Do not add `docker-compose.override.yml`
  or a second compose file.
- **Env vars:** one root `.env` (see `.env.example`). `MONGODB_URI` and
  URLs point at `localhost` for native dev; docker-compose overrides them
  in-container (e.g. `mongodb://mongo:27017`). Keep that split intact.

## Validation commands

Run these from the repo root after changes (all are agent-safe):

```bash
# TypeScript (per app; node_modules must be installed via `pnpm install`)
apps/frontend/node_modules/.bin/tsc --noEmit -p apps/frontend
apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend

# SCSS module compile check (fast sanity for a single stylesheet)
apps/frontend/node_modules/.bin/sass --no-source-map <file>.module.scss /dev/null

# Lint
pnpm --filter slatefolio-frontend lint
pnpm --filter slatefolio-backend lint

# Full production build (heavier; use when the change warrants it)
pnpm --filter slatefolio-frontend build
```

## Dependency discipline (critical for the prod pipeline)

- Both Dockerfiles install with `pnpm install --frozen-lockfile` and copy the
  **root `package.json`** plus `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
  **Any dependency change must be accompanied by a `pnpm install` that
  updates `pnpm-lock.yaml`**, or production image builds will fail.
- Shared/major dependency versions live in the `catalog:` section of
  `pnpm-workspace.yaml`; app package.json entries reference `"catalog:"`.
  Follow that convention when adding dependencies.
- Native-module build scripts are allowlisted under `allowBuilds` in
  `pnpm-workspace.yaml` (pnpm 11). Docker uses
  `--dangerously-allow-all-builds`.

## Frontend conventions

- **Components:** each lives in `src/components/<Name>/` with `<Name>.tsx`
  and `<Name>.module.scss`. Client components start with `'use client'`.
- **The Logo family (`Logo` … `Logo7`)** are full-viewport animated header
  artworks, rotated one per page load via the `logo-index` cookie
  (`Header/logoRotation.ts`, read by `[locale]/layout.tsx`). They are
  geometry-heavy (CSS 3D, clip-paths, keyframe choreography) and their
  source comments encode the math: hinge axes, transform-origin reasoning,
  z-fight offsets, timing invariants. **Maintain these comments when
  editing** — they are load-bearing documentation.
- **Cross-file timing/geometry invariants are explicit in comments** — e.g.
  Logo6's TSX column beat must stay exactly `3 * $swing` from its SCSS, and
  Logo6's `SCALE` constant must match the `.wall` transform. When a comment
  says "must match X", change both sides together.
- **Deterministic randomness:** per-tile/per-cube variation uses string-hash
  helpers (`jitter`/`rand01`) rather than `Math.random()`, so re-renders and
  window resizes don't reshuffle the artwork. Keep it that way.
- **Animation architecture gotchas** (documented in the components, honored
  repo-wide): no opacity/filter on elements inside a `preserve-3d` chain
  (grouping properties flatten it — fades live on leaf plates/pseudo-
  elements); keyframe from/to transforms share identical function lists so
  the browser interpolates angles instead of matrix-morphing; entrance
  animations are driven by per-element CSS custom properties (`--delay`,
  `--cell-delay`) instead of JS timers.
- **i18n:** routes are nested under `[locale]`; translations live in
  `apps/frontend/messages/`. Server-side fetches use `BACKEND_URL`, the
  browser uses `NEXT_PUBLIC_BACKEND_URL` (both with localhost fallbacks).

## Backend conventions

- `src/app.ts` wires all routes explicitly; controllers live in
  `src/controllers/`. Admin routes are guarded by `requireAuth`.
- CORS origin allowlist comes from `HOST_ALLOWLIST` (comma-separated, no
  spaces) in `.env` — the server crashes without it.
- Uploads go to `UPLOADS_DIR` (Docker volume in prod, `apps/backend/uploads`
  locally — gitignored).
- `apps/backend/scripts/` (populate/seed scripts) is gitignored on purpose;
  don't reference its contents from committed code.

## Git & housekeeping

- Don't commit or push unless asked. `.env` is gitignored; never commit
  secrets. Build outputs (`.next`, `dist`, local `uploads`) are gitignored.
- The owner frequently edits files mid-session; re-read files before edits
  that depend on surrounding content, and never revert changes you didn't
  make.
