# OpenDesign

An open, self-hostable AI design workspace for building websites, prototypes, and slide decks. Prompt-driven artifact generation is grounded in your own design systems (GitHub repos, local directories, or Playwright site captures), with scene/code round-trip, element-aware review comments, versions, structured exports, and a review-ready handoff bundle.

Target: a Claude Design–class product surface that runs entirely on your own infrastructure.

## Table of Contents

- [Product Surface](#product-surface)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start — Local Development](#quick-start--local-development)
- [Quick Start — Full Docker Studio](#quick-start--full-docker-studio)
- [Environment Variables](#environment-variables)
- [Generation Pipeline](#generation-pipeline)
- [Design-System Ingest](#design-system-ingest)
- [Asset Storage](#asset-storage)
- [Testing](#testing)
- [Operational Diagnostics](#operational-diagnostics)
- [Scripts Reference](#scripts-reference)
- [Architecture Notes](#architecture-notes)
- [Project Status](#project-status)

## Product Surface

| Capability | What it does |
| --- | --- |
| Artifact types | `website`, `prototype` (navigable flows), `slides` (deck/page) |
| Scene engine | Structured scene document, element-aware anchors |
| Code sync | `scene → code` + safe-subset `code → scene` back-sync |
| Preview | Sandpack-backed live preview and code panel |
| Generation | Prompt-driven, streaming, LiteLLM gateway with heuristic fallback |
| Design systems | GitHub repo / local directory / Playwright site capture |
| Grounding | Selected pack tokens, motifs, and component signatures feed generation |
| Collaboration | Share tokens, roles (`viewer` / `commenter` / `editor`), element-aware comments |
| Versions | Snapshot + restore of scene and saved code workspace |
| Exports | HTML, runnable source ZIP, prototype flow JSON, slides deck JSON, handoff bundle ZIP |
| Export jobs | Every export writes a tracked job (`queued` / `running` / `completed` / `failed`) |
| Assets | MinIO/S3 uploads for screenshots and artifact hero images, in-memory fallback |
| Ops | Request correlation ids, structured API errors, `/api/ready`, `/api/diagnostics` |

## Repository Layout

Monorepo managed by `pnpm` + `turbo`.

```
apps/
  api/        Fastify API, Better Auth, Postgres persistence with memory fallback
  web/        Next.js 16 Studio UI (React 19, Sandpack)
packages/
  contracts/      Zod-backed domain schemas shared across API and Web
  scene-engine/   Scene document model (website / prototype / slides)
  code-sync/      scene ↔ code synchronization (fail-closed safe subset)
  design-ingest/  GitHub, local-directory, and Playwright site-capture import
  exporters/      HTML, source-bundle, prototype-flow, slides-deck, handoff ZIP
  ui/             Shared UI primitives (Surface, Button, etc.)
docs/
  master-todo.md   Single execution board, always kept current
docker-compose.yml, docker-compose.dev.yml, Dockerfile.*
playwright.config.ts, playwright.docker.config.ts
```

## Prerequisites

- Node.js 20+
- `pnpm` 10.15+ (see `packageManager` in `package.json`)
- Docker + Docker Compose v2
- (Optional for site-capture and E2E) Playwright Chromium — installed via `pnpm exec playwright install chromium`

## Quick Start — Local Development

Bring up Postgres / Redis / MinIO in Docker, run API and Web locally.

```bash
cp .env.example .env                                    # review values, set BETTER_AUTH_SECRET
cp apps/web/.env.local.example apps/web/.env.local      # REQUIRED: web compile-time vars (NEXT_PUBLIC_*)
pnpm install
pnpm docker:infra                                       # postgres + redis + minio
pnpm --filter @opendesign/api db:migrate
pnpm dev                                                # turbo: api on :4000, web on :3000
```

> **Note — `apps/web/.env.local` is gitignored and must be created on every new machine.**
> It holds `NEXT_PUBLIC_*` variables that Next.js bakes in at compile time. Without it the
> V3 Studio layout will not activate, even if the code is up to date.

Open http://127.0.0.1:3000, create an account, create a project, open Studio.

If `DATABASE_URL` is unreachable the API automatically falls back to an in-memory persistence mode — useful for quick demos, but no data survives restart. Check `/api/diagnostics` to confirm which mode is active.

## Quick Start — Full Docker Studio

Production-profile build and run with overrideable host ports:

```bash
cp .env.example .env
# Optionally override host ports:
# WEB_PORT=3100 API_PORT=4100 POSTGRES_PORT=15432 REDIS_PORT=16379 \
# MINIO_API_PORT=19000 MINIO_CONSOLE_PORT=19001
docker compose --profile studio build api web
docker compose --profile studio up -d
```

Tear down:

```bash
docker compose --profile studio down
```

A dev-style full-stack alternative lives in `docker-compose.dev.yml` (`pnpm docker:dev`) — it rebuilds sources on change and is the target for fast iteration against real containers.

## Environment Variables

See `.env.example` for the canonical list. Most impactful:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Required. Signing secret for Better Auth sessions. |
| `BETTER_AUTH_URL`, `WEB_BASE_URL` | Public-facing URLs used for auth callbacks and CSRF/trusted-origin checks. |
| `DATABASE_URL` | Postgres connection. Absent or unreachable → in-memory fallback. |
| `REDIS_URL` | Redis connection for future background work. |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_REGION` | Asset storage. Defaults point at the bundled MinIO. |
| `LITELLM_API_BASE_URL`, `OPENDESIGN_GENERATION_MODEL` | Generation gateway. Both must be set to leave the heuristic fallback. |
| `LITELLM_MASTER_KEY` / `OPENAI_API_KEY` / `LITELLM_API_KEY` | Bearer key sent to the gateway. |
| `OPENDESIGN_GENERATION_TIMEOUT_MS` | Generation hard timeout (default 15000). |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Override browser binary for site-capture and E2E. |
| `PLAYWRIGHT_SITE_CAPTURE_DISABLED` | Force the fetch-based site-capture fallback. |
| `OPENDESIGN_PUBLIC_HOST`, `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | Host bindings for the Docker studio profile. |

## Generation Pipeline

- Route: `POST /api/projects/:projectId/artifacts/:artifactId/generate`
- Transport: Server-Sent Events with `planning` / `applying` / `completed` / `failed` frames
- Provider: OpenAI-compatible chat-completions through LiteLLM; falls back to the local heuristic planner when the gateway or model is unconfigured
- Scene patch is applied atomically, then a prompt snapshot is written so the run is always restorable
- Fail-closed: invalid model output raises `INVALID_GENERATION_PLAN`; timeouts raise `GENERATION_TIMEOUT`; all errors include the request correlation id

Point generation at any OpenAI-compatible gateway by setting `LITELLM_API_BASE_URL` and `OPENDESIGN_GENERATION_MODEL`. A sample LiteLLM config ships at `./litellm-config.yaml`; start it with `pnpm docker:gateway`.

## Design-System Ingest

Three import sources resolve into the same `DesignSystemPack` shape (tokens, motifs, components, evidence):

- **GitHub** — token / component extraction from public or token-authorized repos
- **Local directory** — walk a checked-out design system on disk
- **Site capture** — Playwright-first browser session that records screenshots + style evidence; explicit fetch fallback when Playwright is unavailable

Screenshots are persisted through the asset pipeline (MinIO/S3 when configured, in-memory otherwise) and rendered inside the Studio design-system panel as evidence. Selected packs flow into the generation request as grounding context.

## Asset Storage

- API: `apps/api/src/asset-storage.ts` exposes an adapter that is either `s3` (when `S3_*` env is set) or `memory`.
- Artifact-level uploads: `POST /api/projects/:projectId/artifacts/:artifactId/assets` — returns metadata resolvable via `GET .../assets/:assetId`.
- Design-system screenshots are read via `GET /api/design-systems/assets/:assetId`.
- Current asset provider shows up in `/api/diagnostics` under `assetStorage.provider`.

## Testing

Every package ships its own Vitest suite. The monorepo runs them via Turbo.

```bash
pnpm test                  # all unit tests
pnpm typecheck             # tsc --noEmit across the monorepo
pnpm build                 # Turbo build

# Focused runs
pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts
pnpm --filter @opendesign/exporters test -- tests/exporters.test.ts
pnpm --dir packages/code-sync exec vitest run tests/code-sync.test.ts
```

End-to-end (Playwright):

```bash
pnpm exec playwright install chromium
pnpm e2e                   # core Studio flows against local dev
pnpm e2e:docker            # smoke against the live Dockerized studio profile
```

The Docker smoke config (`playwright.docker.config.ts`) verifies Better Auth session recovery, project/artifact persistence, snapshot visibility, export downloads, and in-test `docker compose restart api web`.

## Operational Diagnostics

The API exposes three operational endpoints and request-id propagation:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness probe. |
| `GET /api/ready` | Readiness — checks persistence, asset storage, and auth wiring. |
| `GET /api/diagnostics` | Structured runtime profile — persistence mode, asset provider, auth base URL, trusted origins. |

- Every response returns an `x-request-id` header. Caller-supplied values are preserved.
- Structured validation errors carry the same id under `details.requestId`.
- Export job records (`/api/projects/:projectId/artifacts/:artifactId/export-jobs`) include the correlation id for log-to-client triage.

## Scripts Reference

Root `package.json`:

| Script | Effect |
| --- | --- |
| `pnpm dev` | Turbo dev across `apps/*` (api + web) |
| `pnpm build` | Turbo build |
| `pnpm test` | Turbo test (unit suites) |
| `pnpm typecheck` | Turbo typecheck |
| `pnpm e2e` | Playwright against local dev |
| `pnpm e2e:docker` | Playwright smoke against Docker studio profile |
| `pnpm docker:infra` | Bring up Postgres + Redis + MinIO only |
| `pnpm docker:gateway` | Start the LiteLLM gateway container |
| `pnpm docker:studio` | Build + run the full studio profile (api + web + infra) |
| `pnpm docker:dev` | Run the dev-style full-stack compose file |
| `pnpm docker:dev:down` | Stop and clear volumes for the dev stack |
| `pnpm docker:down` | Stop the studio + gateway profiles |

API-local:

| Script | Effect |
| --- | --- |
| `pnpm --filter @opendesign/api db:migrate` | Apply Postgres migrations |
| `pnpm --filter @opendesign/api dev` | Run the API standalone (`tsx watch`) |

## Architecture Notes

- **`packages/contracts`** is the single source of truth for domain types. API handlers, web client, and exporters all validate against the same Zod schemas.
- **`packages/scene-engine`** models three artifact kinds with distinct node types and preview semantics. Studio's artifact-aware canvas and affordances key off the artifact `kind`.
- **`packages/code-sync`** runs fail-closed: anything outside the supported `App.tsx` / declared sections scaffold surface rejects the save rather than corrupting scene state. Studio surfaces whether a save also synced scene.
- **`packages/exporters`** assembles HTML, source bundle, prototype flow JSON, slides deck JSON, and the handoff ZIP (manifest, versions, comments, workspace snapshot, artifact-specific payload).
- **Better Auth** is the session layer. Trusted origins are driven by `WEB_BASE_URL` and are inspected in `/api/diagnostics`.
- **Persistence fallback**: every repository has a Postgres implementation and a parallel in-memory implementation, swapped at startup based on `DATABASE_URL` reachability.

## Project Status

Execution tracking lives in [`docs/master-todo.md`](docs/master-todo.md). Highlights:

- All artifact types (website, prototype, slides) have dedicated scene nodes, previews, and structured exports.
- Collaboration surface: share tokens + roles + element-aware comments + handoff bundles.
- Ops surface: Playwright core flows + Docker production smoke + correlation ids + diagnostics.
- Remaining polish and generation-loop refinements are tracked in the `Immediate Next Slice` section of the master TODO.

Contributions should land against the `master-todo.md` board: pick the topmost `Ready` task, satisfy its Definition Of Done, run its Validation Commands, and record Validation Evidence in the same file.
