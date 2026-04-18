# OpenDesign

OpenDesign is an artifact-first AI design workspace for websites, prototypes, and slides.

## Docker Isolation

Three Docker paths are checked in:

- `pnpm docker:infra` starts only the stateful dependencies (`postgres`, `redis`, `minio`) and leaves `web/api` on the host for the fastest iteration loop.
- `pnpm docker:dev` launches `postgres`, `redis`, `minio`, and the `web`/`api` dev servers inside containers. Sources are mounted so local edits propagate instantly, and `pnpm --filter` runs inside each container so the active toolchain stays containerized while retaining the fast-feedback loops of the dev commands.
- `pnpm docker:studio` builds and runs the production-profile stack (`web`, `api`, `postgres`, `redis`, `minio`). Add `pnpm docker:gateway` if you also want the optional LiteLLM gateway.

The full containerized path is the safest default for demos, shared environments, and parity checks because the browser-facing app and API stop depending on host Node/npm state.

When `DATABASE_URL` is present, the API now boots with Postgres-backed repositories and runs Better Auth plus application table migrations during startup. Without `DATABASE_URL`, it falls back to the in-memory repositories used by the lightweight test/dev path. The web app uses `OPENDESIGN_API_INTERNAL_URL` for server-side fetches and `NEXT_PUBLIC_API_ORIGIN` for browser-side auth calls.

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

Before `pnpm docker:studio` or `pnpm docker:dev`, set `BETTER_AUTH_SECRET` in `.env`. `BETTER_AUTH_URL` and `WEB_BASE_URL` should stay browser-reachable values such as `http://127.0.0.1:4000` and `http://127.0.0.1:3000`.

## Workspace

- `apps/web`: Next.js studio UI
- `apps/api`: Fastify API
- `packages/contracts`: shared schemas and domain types
- `packages/scene-engine`: scene document utilities
- `packages/code-sync`: scene/code sync interfaces
- `packages/design-ingest`: design system ingestion interfaces
- `packages/exporters`: export and handoff interfaces
- `packages/ui`: shared UI primitives
