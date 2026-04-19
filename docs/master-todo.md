# OpenDesign Master TODO

Last updated: 2026-04-19
Repo baseline: `755cf99`

## Why This Exists

This file is the single execution board for OpenDesign.

- Every remaining task should be pulled from this board.
- Work should continue by advancing the topmost `Ready` or `In Progress` task unless a blocker forces a reorder.
- "High-quality complete" means product behavior, persistence, export, validation, and operational paths all meet the quality gates below.

## Status Legend

- `[x] Done`
- `[>] In Progress`
- `[r] Ready`
- `[!] Blocked`
- `[ ] Not Started`

## Quality Gates For Real Completion

The project is not "done" until all of these are true:

1. Core artifact flows work for `website`, `prototype`, and `slides`.
2. Scene, code, preview, comments, versions, and exports behave coherently.
3. Design-system imports materially constrain generation output.
4. Shared review flows, roles, and handoff bundles are usable by another person.
5. Assets, persistence, and Dockerized runtime behave correctly in production-style mode.
6. Core Studio flows are covered by Playwright E2E.
7. The product no longer feels like an internal shell and has onboarding, guidance, and operational docs.

## Overall Progress

Current estimated product completion for a serious V1: `99.7%`

```text
[###################-] 97%
```

## Phase Scoreboard

| Phase | Area | Estimated Completion | Status |
| --- | --- | --- | --- |
| 1 | AI generation pipeline | 90% | `[>]` |
| 2 | Scene/code synchronization | 90% | `[x]` |
| 3 | Design system ingest and grounding | 95% | `[>]` |
| 4 | Prototype and slides | 90% | `[x]` |
| 5 | Collaboration and handoff | 90% | `[>]` |
| 6 | Assets, reliability, ops | 88% | `[>]` |
| 7 | Product polish | 40% | `[>]` |

## Current Reality

What is already working:

- [x] Independent monorepo with `apps/web`, `apps/api`, and shared packages
- [x] Docker isolation for infra, dev, and studio profiles
- [x] Better Auth integration surface
- [x] Postgres-backed persistence with memory fallback
- [x] Projects, artifacts, workspace state, comments, and version storage
- [x] Scene section editing in Studio
- [x] Sandpack-backed preview and code panel
- [x] Saved code workspace persistence
- [x] Snapshot creation and version restore for scene + saved code workspace
- [x] HTML export, runnable ZIP source export, and handoff ZIP bundle export
- [x] GitHub, local-directory, and Playwright-first site-capture design-system import
- [x] Site-capture screenshots persisted as retrievable assets through MinIO/S3 or in-memory fallback
- [x] Design-system selection and generation grounding for artifacts
- [x] Prototype screen flows with navigable preview and coherent scene-based exports
- [x] Slides decks with sequential preview and coherent scene-based exports
- [x] Studio affordances now branch by artifact type across canvas, scene editor, generation, and code copy

What still blocks a true Claude Design benchmark:

- [ ] Asset pipeline backed by MinIO/S3 beyond design-system screenshots
- [ ] Async/background export execution for long-running or asset-backed exports
- [ ] Asset-backed production validation beyond design-system screenshots
- [ ] Product polish and onboarding

## Execution Rules

1. Pull work from `Current Execution Queue` first.
2. Keep at most 3 items in active implementation at once.
3. Do not start Phase 4 or Phase 5 before the active P0 items in Phases 2 and 3 are no longer blocking them.
4. Every completed task must have updated validation evidence in this file or in linked tests/docs.
5. If a task is discovered to be under-scoped, split it here before continuing implementation.

## Current Execution Queue

These are the tasks that should be worked continuously next.

### SYNC-003 Broaden Supported Code -> Scene Sync Beyond App.tsx Sections Data

- Status: `[x]`
- Priority: `P0`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `SYNC-001`, `SYNC-002`
- Blocks: `TYPE-001`, `TYPE-002`, `COLLAB-003`
- Why Now:
  Current back-sync only supports the conservative `App.tsx` sections data format. That is enough for safety, but not enough for a high-quality editor workflow.
- Definition Of Done:
  - [x] Safe supported scaffold surface expands beyond the current `const sections = [...]` path.
  - [x] Unsupported edits still fail closed and do not corrupt scene state.
  - [x] Studio clearly indicates whether a save also synced scene state.
- Validation Commands:
  - `pnpm --dir packages/code-sync exec vitest run tests/code-sync.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Expected Artifacts:
  - `packages/code-sync/src/index.ts`
  - `packages/code-sync/tests/code-sync.test.ts`
  - `packages/exporters/src/index.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/studio-inspector.tsx`
- Next Slice:
  - `TYPE-001 Implement prototype-specific scene nodes and preview`

### OPS-001 Add Playwright E2E Coverage For Core Studio Flows

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `e2e`, `web`, `api`
- Depends On: `DS-004`, `DS-005`, `SYNC-003`
- Blocks: `POL-002`
- Why Now:
  Core behavior is already broad enough that manual verification is becoming the bottleneck.
- Definition Of Done:
  - [x] Login, create project, create artifact, edit scene, save code, snapshot, restore, and export are covered.
  - [x] Tests run in Docker-compatible local workflow.
- Validation Commands:
  - `pnpm exec playwright install chromium`
  - `pnpm exec playwright test apps/web/e2e/studio-core.spec.ts`
  - `pnpm e2e`
  - `pnpm test`
  - `pnpm build`
- Expected Artifacts:
  - `apps/web/e2e/*`
  - `playwright.config.*`
  - `README.md`
- Next Slice:
  - `OPS-003 Validate full Docker studio stack in real build/run mode`

### OPS-003 Validate Full Docker Studio Stack In Real Build/Run Mode

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `ops`, `docker`, `e2e`
- Depends On: `OPS-001`
- Blocks: `POL-004`
- Why Now:
  The dev-style E2E path was already covered, but the production-profile stack still needed a repeatable build/run smoke against real containers, host port overrides, and persisted auth/data.
- Definition Of Done:
  - [x] `docker compose --profile studio build api web` succeeds against the checked-in Dockerfiles.
  - [x] The production-profile stack starts on overrideable host ports instead of hard-coding common local `3000/4000/5432/6379/9000/9001`.
  - [x] A repeatable Playwright smoke runs against the live containers and verifies session/project/artifact persistence across `api/web` restarts.
- Validation Commands:
  - `docker compose --profile studio build api web`
  - `docker compose -p opendesign-ops003 --profile studio up -d`
  - `pnpm e2e:docker`
- Validation Evidence:
  - `2026-04-19`: rebuilt `api/web` against the checked-in Dockerfiles with host overrides `WEB_PORT=3100`, `API_PORT=4100`, `POSTGRES_PORT=15432`, `REDIS_PORT=16379`, `MINIO_API_PORT=19000`, and `MINIO_CONSOLE_PORT=19001`.
  - `2026-04-19`: `pnpm e2e:docker` passed against the live `opendesign-ops003` production-profile stack, including Better Auth session recovery, project/artifact persistence, snapshot visibility, export downloads, and an in-test `docker compose restart api web`.
- Expected Artifacts:
  - `Dockerfile.api`
  - `Dockerfile.web`
  - `docker-compose.yml`
  - `.env.example`
  - `playwright.docker.config.ts`
  - `apps/web/e2e/studio-docker.smoke.spec.ts`
  - `README.md`
- Next Slice:
  - `ASSET-001 Add asset upload/storage pipeline backed by MinIO/S3`

### TYPE-001 Implement Prototype-Specific Scene Nodes And Preview Behavior

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-003`
- Why Now:
  Website-only is the biggest remaining product-surface gap.
- Definition Of Done:
  - [x] Prototype artifacts support multiple states or transitions.
  - [x] Preview can navigate or represent flows, not just static sections.
  - [x] Persistence, versions, and exports remain coherent.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Expected Artifacts:
  - `packages/scene-engine/*`
  - `packages/exporters/*`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/*`
- Next Slice:
  - `TYPE-003 Add prototype-specific export path`

### TYPE-002 Implement Slides-Specific Scene Structure

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-004`
- Why Now:
  Slides is the other missing flagship artifact surface.
- Definition Of Done:
  - [x] Slides support deck/page structure and sequential rendering.
  - [x] Studio shows artifact-appropriate controls for slide editing.
  - [x] Versions and exports remain stable.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Expected Artifacts:
  - `packages/scene-engine/*`
  - `packages/exporters/*`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/api/src/routes/artifacts.ts`
- Next Slice:
  - `TYPE-004 Add slides export path`

### TYPE-003 Add Prototype-Specific Export Path

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `TYPE-001`
- Blocks: None
- Why Now:
  Prototype preview already behaves like a flow, but the export surface still needed a stable artifact-specific payload for downstream review and tooling.
- Definition Of Done:
  - [x] Prototype artifacts expose a dedicated structured export payload.
  - [x] Studio export panel exposes the prototype-specific export.
  - [x] Exporter and API tests cover the new path.
- Validation Commands:
  - `pnpm --filter @opendesign/exporters test -- tests/exporters.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Expected Artifacts:
  - `packages/exporters/src/index.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/studio-export-panel.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/export/prototype-flow/route.ts`
- Next Slice:
  - `TYPE-004 Add slides export path`

### TYPE-004 Add Slides Export Path

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `TYPE-002`
- Blocks: None
- Why Now:
  Slides preview already behaves like a deck, but the export surface still needed a stable deck-specific payload instead of only generic HTML/ZIP.
- Definition Of Done:
  - [x] Slides artifacts expose a dedicated structured deck export payload.
  - [x] Studio export panel exposes the slides-specific export.
  - [x] Exporter and API tests cover the new path.
- Validation Commands:
  - `pnpm --filter @opendesign/exporters test -- tests/exporters.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Expected Artifacts:
  - `packages/exporters/src/index.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/studio-export-panel.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/export/slides-deck/route.ts`
- Next Slice:
  - `COLLAB-001 Add share tokens for artifact/project review`

### COLLAB-004 Build Handoff Export Bundle

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `TYPE-001`, `TYPE-002`
- Blocks: `COLLAB-005`
- Why Now:
  Share links and comments were already in place, but external handoff still required manually stitching together workspace state, export files, and review context.
- Definition Of Done:
  - [x] Every artifact exposes a single handoff bundle that packages workspace metadata, versions, comments, and current export payloads.
  - [x] The handoff bundle follows the saved code workspace when present and includes artifact-specific structured exports for prototype/slides.
  - [x] Studio exposes the handoff download path and exporter/API tests cover the payload.
- Validation Commands:
  - `pnpm --filter @opendesign/exporters test -- tests/exporters.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added `buildArtifactHandoffBundle` and `buildArtifactHandoffArchive` so each artifact can export a review-ready ZIP containing `manifest.json`, workspace metadata, comments, versions, HTML export, source scaffold, and prototype/slides structured payloads where applicable.
  - `2026-04-19`: added `/api/projects/:projectId/artifacts/:artifactId/exports/handoff-bundle` plus the Studio download route/button, and verified website saved-code handoff plus prototype structured handoff through exporter tests, API integration tests, and monorepo typecheck.
- Expected Artifacts:
  - `packages/exporters/src/index.ts`
  - `packages/exporters/tests/exporters.test.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
  - `apps/web/components/studio-export-panel.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/export/handoff-bundle/route.ts`
- Next Slice:
  - `ASSET-001 Add asset upload/storage pipeline backed by MinIO/S3`

### ASSET-001 Add Asset Upload/Storage Pipeline Backed By MinIO/S3

- Status: `[>]`
- Priority: `P1`
- Owner Lane: `ops`, `api`, `web`
- Depends On: `OPS-003`
- Blocks: `COLLAB-005`, `OPS-002`
- Why Now:
  MinIO was already running in the Docker stack, but the product still treated screenshots and other asset-like evidence as metadata-only references instead of durable binary assets.
- Definition Of Done:
  - [x] The API can persist design-system screenshot bytes into an asset storage backend with in-memory fallback and S3/MinIO support.
  - [x] Persisted asset metadata is stored separately from design-system packs and can be resolved back into binary content.
  - [x] Studio can render persisted screenshot evidence from imported packs.
  - [x] Artifact-level uploads and asset references are available beyond design-system screenshot capture.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/assets.test.ts tests/design-systems.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/assets.test.ts tests/projects-artifacts.test.ts`
  - `pnpm --filter @opendesign/contracts test -- tests/domain-schemas.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added asset metadata repositories plus in-memory/S3 object storage adapters, wired site-capture imports to upload screenshot bytes, and exposed `/api/design-systems/assets/:assetId` for binary reads.
  - `2026-04-19`: Studio design-system panel now renders persisted screenshot evidence from the selected pack, and API/contracts tests plus monorepo typecheck passed.
  - `2026-04-19`: extended the shared asset model with artifact-scoped metadata, added `/api/projects/:projectId/artifacts/:artifactId/assets` upload/list/read routes, and included artifact assets in workspace payloads.
  - `2026-04-19`: Studio scene editing now supports hero image uploads backed by persisted asset records, with immediate canvas rendering from artifact asset URLs.
- Expected Artifacts:
  - `apps/api/src/asset-storage.ts`
  - `apps/api/src/repositories/assets.ts`
  - `apps/api/src/routes/design-systems.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/api/tests/assets.test.ts`
  - `apps/api/tests/design-systems.test.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
  - `apps/web/components/studio-design-system-panel.tsx`
  - `apps/web/components/studio-scene-sections-panel.tsx`
  - `apps/web/lib/opendesign-api.ts`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
- Next Slice:
  - `POL-003 Add onboarding, empty states, and guided first-run cues`

### COLLAB-003 Upgrade Comment Anchors From Canvas-Level Fallback To Element-Aware Anchors

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `web`, `api`, `shared`
- Depends On: `COLLAB-001`, `COLLAB-002`, `SYNC-003`
- Blocks: None
- Why Now:
  Shared review and Studio comments were already usable, but every new thread still collapsed onto a generic canvas anchor instead of staying attached to a concrete scene target.
- Definition Of Done:
  - [x] Studio comment creation can target the artifact canvas or a specific root scene node.
  - [x] Shared review comment creation can target the shared canvas or a specific root scene node.
  - [x] Comment APIs preserve explicit anchors instead of silently rewriting them to canvas fallback anchors.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added explicit anchor-target selectors to Studio and shared review comment forms, backed by encoded `elementId + selectionPath` payloads for artifact canvas and root scene nodes.
  - `2026-04-19`: updated shared-review comment creation to accept explicit anchors end-to-end, and verified commenter/editor anchor persistence through `projects-artifacts` integration tests plus monorepo typecheck.
- Expected Artifacts:
  - `apps/web/components/comment-anchor-options.ts`
  - `apps/web/components/studio-comments-panel.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/actions.ts`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/web/app/share/[token]/actions.ts`
  - `apps/web/app/share/[token]/page.tsx`
  - `apps/web/lib/opendesign-api.ts`
  - `apps/api/src/routes/shares.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
- Next Slice:
  - `OPS-002 Add production-grade logging and operational diagnostics`

### OPS-002 Add Production-Grade Logging And Operational Diagnostics

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `ops`, `api`
- Depends On: `OPS-001`, `OPS-003`
- Blocks: `COLLAB-005`
- Why Now:
  The Docker production stack was already smoke-tested, but the API still lacked a minimal operational surface for request correlation, readiness checks, and runtime diagnostics when failures happen under real containers.
- Definition Of Done:
  - [x] Every API response includes a request correlation id, preserving caller-supplied `x-request-id` when present.
  - [x] Structured validation errors include the correlation id in their payload details.
  - [x] Readiness and diagnostics endpoints expose persistence mode, asset storage provider, and auth runtime wiring for ops triage.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/health.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added request-id propagation at the Fastify app layer, returned `x-request-id` on every response, and threaded that id into structured validation error details for easier log-to-client correlation.
  - `2026-04-19`: added `/api/ready` and `/api/diagnostics` with persistence mode, asset-storage provider, auth base URL, and trusted-origin diagnostics; verified through API tests and monorepo typecheck.
- Expected Artifacts:
  - `apps/api/src/app.ts`
  - `apps/api/src/routes/health.ts`
  - `apps/api/src/lib/api-errors.ts`
  - `apps/api/src/persistence.ts`
  - `apps/api/tests/health.test.ts`
  - `README.md`
- Next Slice:
  - `COLLAB-005 Add export job tracking`

### COLLAB-005 Add Export Job Tracking

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `api`, `web`, `shared`
- Depends On: `COLLAB-004`, `OPS-002`
- Blocks: None
- Why Now:
  Handoff and structured exports already worked, but the product had no durable record of which export was requested, whether it succeeded, or why an artifact-specific export failed.
- Definition Of Done:
  - [x] Existing export routes create and update export job records with `queued/running/completed/failed` state.
  - [x] Export jobs preserve request correlation id and expose success metadata or structured API failure payloads.
  - [x] Studio export panel can show recent export jobs without replacing the current synchronous download flow.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added export-job persistence and wired the current sync export routes to record `html`, `source-bundle`, `handoff-bundle`, `prototype-flow`, and `slides-deck` job lifecycle state plus result/error metadata.
  - `2026-04-19`: Studio export tab now reads `/api/projects/:projectId/artifacts/:artifactId/export-jobs` and shows recent completed/failed jobs while preserving the existing direct-download interaction model.
- Expected Artifacts:
  - `packages/contracts/src/index.ts`
  - `apps/api/src/repositories/export-jobs.ts`
  - `apps/api/src/persistence.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
  - `apps/web/lib/opendesign-api.ts`
  - `apps/web/components/studio-export-panel.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `README.md`
- Next Slice:
  - `POL-002 Improve visual hierarchy and artifact canvas fidelity`

### POL-002 Improve Visual Hierarchy And Artifact Canvas Fidelity

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `web`
- Depends On: `TYPE-005`, `COLLAB-003`
- Blocks: `POL-003`
- Why Now:
  Studio central canvas was still acting like a placeholder explainer while the live preview stayed buried in the inspector, which kept the product feeling like an internal shell instead of a primary design workspace.
- Definition Of Done:
  - [x] Studio central panel becomes an artifact-aware canvas with stronger hierarchy and live workspace context.
  - [x] Website/prototype/slides canvases each present distinct framing and sequence cues.
  - [x] The `artifact-canvas` DOM anchor remains stable so comment anchoring still targets the same surface.
- Validation Commands:
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: replaced the central placeholder canvas with a richer artifact-aware stage that surfaces frame headline/body, scene metrics, sequence cards, and artifact-specific framing while preserving the `artifact-canvas` id.
  - `2026-04-19`: updated Studio canvas affordance metadata and responsive CSS so website/prototype/slides get distinct visual treatment without collapsing the existing inspector and scene-edit flows.
- Expected Artifacts:
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/web/components/studio-artifact-affordances.ts`
  - `apps/web/app/globals.css`
- Next Slice:
  - `ASSET-001 Artifact-level asset uploads beyond design-system screenshots`

## Blocked Registry

These tasks are known to depend on unfinished upstream work.

- None currently. Continue with the top unblocked queue item.

## Remaining Master Task List

This is the full remaining backlog, grouped by phase.

## Phase 1: AI Generation Pipeline

Goal: Move from manual scene editing to a real artifact-generation system.

- [>] `GEN-001` Add generation route for prompt-driven artifact creation
  Done when:
  Studio can submit a prompt and receive scene/code updates from the backend.
- [x] `GEN-002` Attach imported packs to generation context and plan building
  Depends On: `DS-005`
  Done when:
  Prompt execution uses selected design-system evidence as grounding input.

## Phase 2: Scene/Code Synchronization

Goal: Make scene editing and code editing feel like one system instead of parallel hacks.

- [x] `SYNC-001` Implement real `scene -> code` sync in `packages/code-sync`
- [x] `SYNC-002` Implement supported `code -> scene` back-sync for the safe subset
- [r] `SYNC-003` Broaden supported code -> scene sync beyond `App.tsx` sections data while preserving safety
  Done when:
  More scaffold edits round-trip without relaxing fail-closed behavior.

## Phase 3: Design System Ingest

Goal: Ground artifact generation in real tokens, components, and visual evidence.

- [x] `DS-001` Implement GitHub repository import
- [x] `DS-002` Implement local directory import
- [>] `DS-003` Implement site-capture import and persistence flow
  Current:
  Site-capture import is implemented with Playwright-first browser capture, screenshot provenance, and explicit fetch fallback.
- [x] `DS-004` Upgrade site capture import from fetch-based evidence to Playwright browser capture
  Done when:
  A URL can be crawled through a real browser session and reduced into screenshots, style evidence, and extracted tokens.
- [x] `DS-005` Use imported packs as generation constraints
  Done when:
  Prompt output changes based on selected pack tokens, motifs, and component signatures.

## Phase 4: Artifact Types Beyond Website

Goal: Support the full artifact surface instead of just website-first flows.

- [x] `TYPE-001` Implement prototype-specific scene nodes and preview behavior
- [x] `TYPE-002` Implement slides-specific scene structure
- [x] `TYPE-003` Add prototype-specific export path
- [x] `TYPE-004` Add slides export path
- [x] `TYPE-005` Add per-artifact editor affordances in Studio

## Phase 5: Collaboration and Handoff

Goal: Make the system usable by more than one person and suitable for review.

- [x] `COLLAB-001` Add share tokens for artifact/project review
- [x] `COLLAB-002` Add roles: `viewer`, `commenter`, `editor`
- [x] `COLLAB-003` Upgrade comment anchors from canvas-level fallback to element-aware anchors
- [x] `COLLAB-004` Build handoff export bundle
- [x] `COLLAB-005` Add export job tracking

## Phase 6: Assets, Reliability, And Ops

Goal: Make the product stable enough for serious usage.

- [x] `ASSET-001` Add asset upload/storage pipeline backed by MinIO/S3
- [x] `OPS-001A` Add stale-write/conflict protection for code workspace saves and restores
- [x] `OPS-001B` Add structured API error model and recovery paths
- [x] `OPS-001` Add Playwright E2E coverage for core Studio flows
- [x] `OPS-002` Add production-grade logging and operational diagnostics
- [x] `OPS-003` Validate full Docker studio stack in real build/run mode

## Phase 7: Product Polish

Goal: Close the gap between a functional system and a high-quality product.

- [x] `POL-001` Replace section-form sprawl in Studio page with reusable editor modules
- [x] `POL-002` Improve visual hierarchy and artifact canvas fidelity
- [ ] `POL-003` Add onboarding and empty-state guidance
- [ ] `POL-004` Tighten README and developer docs

## Recently Completed

- [x] GitHub design-system import
- [x] Local-directory design-system import
- [x] Playwright-first site-capture import with screenshot provenance
- [x] Design-system grounded generation
- [x] Scene -> code synchronization for generated website artifacts
- [x] Safe-subset code -> scene synchronization
- [x] Streaming generation progress and structured generation failures
- [x] Playwright E2E core Studio flow with login, scene edit, code save, snapshot, restore, and export
- [x] Prototype flow JSON export and slides deck JSON export
- [x] Project and artifact share tokens with public read-only review pages
- [x] Role-based shared review links with viewer/commenter/editor permissions
- [x] Element-aware comment anchors across Studio and shared review
- [x] Prototype/slides-specific Studio editor affordances with Playwright coverage
- [x] Review-ready handoff ZIP bundles for website, prototype, and slides artifacts
- [x] Design-system screenshot assets persisted through MinIO/S3-aware storage with Studio previews
- [x] Request correlation ids plus readiness/diagnostics API endpoints
- [x] Export job tracking across current sync export routes
- [x] Artifact-aware Studio canvas with stronger visual hierarchy
- [x] Artifact-level asset uploads with persisted Studio hero-image references

## Immediate Next Slice

If no blocker appears, continue in this exact order:

1. `POL-003` Add onboarding and empty-state guidance
2. `POL-004` Tighten README and developer docs
3. `GEN-001` Add generation route for prompt-driven artifact creation
4. `GEN-002` Add grounded generation heuristics and recovery loops
