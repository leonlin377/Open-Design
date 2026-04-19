# OpenDesign

OpenDesign is an artifact-first AI design workspace for websites, prototypes, and slides.

Current artifact-specific export surfaces:

- `website`: handoff ZIP, standalone HTML, and runnable ZIP scaffold
- `prototype`: handoff ZIP, standalone HTML, runnable ZIP scaffold, and flow JSON manifest
- `slides`: handoff ZIP, standalone HTML, runnable ZIP scaffold, and deck JSON manifest

## Docker Isolation

Three Docker paths are checked in:

- `pnpm docker:infra` starts only the stateful dependencies (`postgres`, `redis`, `minio`) and leaves `web/api` on the host for the fastest iteration loop.
- `pnpm docker:dev` launches `postgres`, `redis`, `minio`, and the `web`/`api` dev servers inside containers. Sources are mounted so local edits propagate instantly, and `pnpm --filter` runs inside each container so the active toolchain stays containerized while retaining the fast-feedback loops of the dev commands.
- `pnpm docker:studio` builds and runs the production-profile stack (`web`, `api`, `postgres`, `redis`, `minio`). Add `pnpm docker:gateway` if you also want the optional LiteLLM gateway.

The full containerized path is the safest default for demos, shared environments, and parity checks because the browser-facing app and API stop depending on host Node/npm state.

When `DATABASE_URL` is present, the API now boots with Postgres-backed repositories and runs Better Auth plus application table migrations during startup. Without `DATABASE_URL`, it falls back to the in-memory repositories used by the lightweight test/dev path. The web app uses `OPENDESIGN_API_INTERNAL_URL` for server-side fetches and `NEXT_PUBLIC_API_ORIGIN` for browser-side auth calls.

The API now emits an `x-request-id` header on every response, preserves caller-supplied request IDs when present, attaches that correlation ID to structured validation errors, and exposes `/api/ready` plus `/api/diagnostics` for production-style readiness and runtime diagnostics. `/api/ready` reports persistence and asset-storage mode, while `/api/diagnostics` adds request correlation plus auth/runtime wiring details that are useful during Docker smoke validation and ops triage.

MinIO/S3 is now used by the API as the asset backing store when `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` are configured. Site-capture design-system imports persist screenshot bytes into object storage, store asset metadata in the application database when Postgres is enabled, and expose those persisted screenshots back through `/api/design-systems/assets/:assetId` so the Studio can render the captured evidence.

## Open-Source Stack

- Better Auth for self-hosted authentication without a hosted dependency.
- Sandpack for lightweight, in-browser code sandboxing and exportable artifacts.
- LiteLLM (optional) as a gateway to normalize model APIs and centralize keys/routing.
- Heavier editors are deferred to keep scope and infrastructure light while the artifact pipeline stabilizes.

## Optional LiteLLM Gateway

1. Start from the checked-in [`litellm-config.yaml`](/Users/leon/本地开发项目/opendesign/litellm-config.yaml) template and add your model list.
2. Set `LITELLM_MASTER_KEY`, `LITELLM_SALT_KEY`, and any provider keys you need in `.env`.
3. Start the gateway with `pnpm docker:gateway`.

The gateway listens on `LITELLM_PORT` (default `4001`) and maps to container port `4000`.

## Container Commands

- `pnpm docker:infra`
- `pnpm docker:dev`
- `pnpm docker:dev:down`
- `pnpm docker:studio`
- `pnpm docker:gateway`
- `pnpm docker:down`

Useful backend command:

- `pnpm --filter @opendesign/api db:migrate`

Before `pnpm docker:studio` or `pnpm docker:dev`, set `BETTER_AUTH_SECRET` in `.env`. Compose now derives the browser-facing auth/app URLs from `OPENDESIGN_PUBLIC_HOST`, `API_PORT`, and `WEB_PORT`, so those values should match the host and published ports you expect the browser to use.

If the host already uses common local ports, override `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT`, and `MINIO_CONSOLE_PORT` in `.env` before starting Compose. If the browser reaches Docker on something other than `127.0.0.1`, also set `OPENDESIGN_PUBLIC_HOST` before you build the `web` image so the baked `NEXT_PUBLIC_API_ORIGIN` matches the published API origin. When you override MinIO's host port, also update the host-facing `S3_ENDPOINT` in `.env` to match.

Site-capture imports now prefer a Playwright-driven browser capture path. In containers, `chromium` is installed and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is set automatically. On the host, you can set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` explicitly if your browser binary is not auto-discovered. Set `PLAYWRIGHT_SITE_CAPTURE_DISABLED=1` to force the older fetch-based capture path during debugging or deterministic test runs.

## Playwright E2E

- Install the browser once on the host with `pnpm exec playwright install chromium`.
- Run the core end-to-end suite with `pnpm e2e`.
- The checked-in config starts `apps/api` on `127.0.0.1:4100` and `apps/web` on `127.0.0.1:3100` so it does not collide with common local `3000/4000` processes.
- The E2E path uses in-memory persistence by default, signs up a fresh browser-scoped account, and covers project creation, artifact creation, scene editing, code workspace save, snapshot/restore, and HTML/ZIP export.

## Workspace

- `apps/web`: Next.js studio UI
- `apps/api`: Fastify API
- `packages/contracts`: shared schemas and domain types
- `packages/scene-engine`: scene document utilities
- `packages/code-sync`: scene/code sync interfaces
- `packages/design-ingest`: design system ingestion interfaces
- `packages/exporters`: export and handoff interfaces
- `packages/ui`: shared UI primitives

## Roadmap

- Master execution checklist: [docs/master-todo.md](/Users/leon/本地开发项目/opendesign/docs/master-todo.md)
