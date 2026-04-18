# OpenDesign Master TODO

Last updated: 2026-04-19
Repo baseline: `4f41dac`

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

Current estimated product completion for a serious V1: `79%`

```text
[################----] 79%
```

## Phase Scoreboard

| Phase | Area | Estimated Completion | Status |
| --- | --- | --- | --- |
| 1 | AI generation pipeline | 86% | `[>]` |
| 2 | Scene/code synchronization | 82% | `[>]` |
| 3 | Design system ingest and grounding | 72% | `[>]` |
| 4 | Prototype and slides | 0% | `[ ]` |
| 5 | Collaboration and handoff | 0% | `[ ]` |
| 6 | Assets, reliability, ops | 35% | `[>]` |
| 7 | Product polish | 25% | `[>]` |

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
- [x] HTML export and runnable ZIP source export
- [x] GitHub, local-directory, and fetch-based site-capture design-system import

What still blocks a true Claude Design benchmark:

- [ ] Browser-grade site capture with screenshots and richer style evidence
- [ ] Design-system-constrained generation
- [ ] Broader safe `code -> scene` synchronization
- [ ] Prototype artifact type
- [ ] Slides artifact type
- [ ] Sharing, roles, and collaboration flows
- [ ] Asset pipeline backed by MinIO/S3
- [ ] Handoff export bundles and async export jobs
- [ ] Playwright E2E and production-grade operational validation
- [ ] Product polish and onboarding

## Execution Rules

1. Pull work from `Current Execution Queue` first.
2. Keep at most 3 items in active implementation at once.
3. Do not start Phase 4 or Phase 5 before the active P0 items in Phases 2 and 3 are no longer blocking them.
4. Every completed task must have updated validation evidence in this file or in linked tests/docs.
5. If a task is discovered to be under-scoped, split it here before continuing implementation.

## Current Execution Queue

These are the tasks that should be worked continuously next.

### DS-004 Upgrade Site Capture To Playwright Browser Capture

- Status: `[r]`
- Priority: `P0`
- Owner Lane: `api`, `shared`, `infra`
- Depends On: `DS-001`, `DS-002`, `DS-003`
- Blocks: `DS-005`
- Why Now:
  Current site capture is fetch-based HTML/CSS evidence only. It is the main gap between the current ingest flow and a high-quality grounded design import.
- Definition Of Done:
  - A URL is captured through Playwright in a browser context.
  - Import stores screenshot evidence plus richer DOM/style evidence.
  - Existing `/api/design-systems/import/site-capture` remains stable for callers.
  - Failure modes are explicit and recoverable.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/design-systems.test.ts`
  - `pnpm --dir packages/design-ingest exec vitest run tests/design-ingest.test.ts`
  - `pnpm typecheck`
- Expected Artifacts:
  - `apps/api/src/routes/design-systems.ts`
  - `packages/design-ingest/src/index.ts`
  - `apps/api/tests/design-systems.test.ts`
  - `packages/design-ingest/tests/design-ingest.test.ts`
- Next Slice:
  - `DS-005 Use imported packs as generation constraints`

### DS-005 Use Imported Packs As Generation Constraints

- Status: `[r]`
- Priority: `P0`
- Owner Lane: `api`, `shared`, `web`
- Depends On: `DS-004`, `GEN-001`
- Blocks: `TYPE-001`, `TYPE-002`
- Why Now:
  Imported packs exist, but they do not yet materially change output. Without grounding, the design-system phase is not actually complete.
- Definition Of Done:
  - Artifact generation accepts an attached pack or pack reference.
  - Generation plan/prompt/context includes tokens, motifs, and component signatures.
  - Generated scene/code visibly changes based on selected packs.
  - Tests cover at least one grounded generation path.
- Validation Commands:
  - `pnpm --filter @opendesign/api test`
  - `pnpm --filter @opendesign/contracts test`
  - `pnpm typecheck`
- Expected Artifacts:
  - `apps/api/src/generation.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `packages/contracts/src/index.ts`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
- Next Slice:
  - `SYNC-003 Broaden supported code -> scene sync`

### SYNC-003 Broaden Supported Code -> Scene Sync Beyond App.tsx Sections Data

- Status: `[r]`
- Priority: `P0`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `SYNC-001`, `SYNC-002`
- Blocks: `TYPE-001`, `TYPE-002`, `COLLAB-003`
- Why Now:
  Current back-sync only supports the conservative `App.tsx` sections data format. That is enough for safety, but not enough for a high-quality editor workflow.
- Definition Of Done:
  - Safe supported scaffold surface expands beyond the current `const sections = [...]` path.
  - Unsupported edits still fail closed and do not corrupt scene state.
  - Studio clearly indicates whether a save also synced scene state.
- Validation Commands:
  - `pnpm --dir packages/code-sync exec vitest run tests/code-sync.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Expected Artifacts:
  - `packages/code-sync/src/index.ts`
  - `packages/code-sync/tests/code-sync.test.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/studio-inspector.tsx`
- Next Slice:
  - `TYPE-001 Implement prototype-specific scene nodes and preview`

### OPS-001 Add Playwright E2E Coverage For Core Studio Flows

- Status: `[r]`
- Priority: `P1`
- Owner Lane: `e2e`, `web`, `api`
- Depends On: `DS-004`, `DS-005`, `SYNC-003`
- Blocks: `OPS-003`, `POL-002`
- Why Now:
  Core behavior is already broad enough that manual verification is becoming the bottleneck.
- Definition Of Done:
  - Login, create project, create artifact, edit scene, save code, snapshot, restore, and export are covered.
  - Tests run in Docker-compatible local workflow.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
  - `pnpm exec playwright test`
- Expected Artifacts:
  - `apps/web/e2e/*`
  - `playwright.config.*`
  - `README.md`
- Next Slice:
  - `OPS-003 Validate full Docker studio stack in real build/run mode`

### TYPE-001 Implement Prototype-Specific Scene Nodes And Preview Behavior

- Status: `[ ]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-003`, `COLLAB-004`
- Why Now:
  Website-only is the biggest remaining product-surface gap.
- Definition Of Done:
  - Prototype artifacts support multiple states or transitions.
  - Preview can navigate or represent flows, not just static sections.
  - Persistence, versions, and exports remain coherent.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Expected Artifacts:
  - `packages/scene-engine/*`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/*`
- Next Slice:
  - `TYPE-003 Add prototype-specific export path`

### TYPE-002 Implement Slides-Specific Scene Structure

- Status: `[ ]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-004`
- Why Now:
  Slides is the other missing flagship artifact surface.
- Definition Of Done:
  - Slides support deck/page structure and sequential rendering.
  - Studio shows artifact-appropriate controls for slide editing.
  - Versions and exports remain stable.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Expected Artifacts:
  - `packages/scene-engine/*`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/api/src/routes/artifacts.ts`
- Next Slice:
  - `TYPE-004 Add slides export path`

## Blocked Registry

These tasks are known to depend on unfinished upstream work.

- `[!] TYPE-003 Add prototype-specific export path`
  Blocked by: `TYPE-001`
- `[!] TYPE-004 Add slides export path`
  Blocked by: `TYPE-002`
- `[!] COLLAB-001 Add share tokens for artifact/project review`
  Blocked by: `OPS-001`
- `[!] COLLAB-002 Add roles: viewer/commenter/editor`
  Blocked by: `COLLAB-001`
- `[!] COLLAB-003 Upgrade comment anchors to element-aware anchors`
  Blocked by: `SYNC-003`
- `[!] COLLAB-004 Build handoff export bundle`
  Blocked by: `TYPE-001`, `TYPE-002`, `ASSET-001`
- `[!] OPS-003 Validate full Docker studio stack in real build/run mode`
  Blocked by: `OPS-001`, `ASSET-001`

## Remaining Master Task List

This is the full remaining backlog, grouped by phase.

## Phase 1: AI Generation Pipeline

Goal: Move from manual scene editing to a real artifact-generation system.

- [>] `GEN-001` Add generation route for prompt-driven artifact creation
  Done when:
  Studio can submit a prompt and receive scene/code updates from the backend.
- [r] `GEN-002` Attach imported packs to generation context and plan building
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
  Fetch-based HTML/CSS/DOM evidence capture is implemented and tested.
- [r] `DS-004` Upgrade site capture import from fetch-based evidence to Playwright browser capture
  Done when:
  A URL can be crawled through a real browser session and reduced into screenshots, style evidence, and extracted tokens.
- [r] `DS-005` Use imported packs as generation constraints
  Done when:
  Prompt output changes based on selected pack tokens, motifs, and component signatures.

## Phase 4: Artifact Types Beyond Website

Goal: Support the full artifact surface instead of just website-first flows.

- [ ] `TYPE-001` Implement prototype-specific scene nodes and preview behavior
- [ ] `TYPE-002` Implement slides-specific scene structure
- [ ] `TYPE-003` Add prototype-specific export path
- [ ] `TYPE-004` Add slides export path
- [ ] `TYPE-005` Add per-artifact editor affordances in Studio

## Phase 5: Collaboration and Handoff

Goal: Make the system usable by more than one person and suitable for review.

- [ ] `COLLAB-001` Add share tokens for artifact/project review
- [ ] `COLLAB-002` Add roles: `viewer`, `commenter`, `editor`
- [ ] `COLLAB-003` Upgrade comment anchors from canvas-level fallback to element-aware anchors
- [ ] `COLLAB-004` Build handoff export bundle
- [ ] `COLLAB-005` Add export job tracking

## Phase 6: Assets, Reliability, And Ops

Goal: Make the product stable enough for serious usage.

- [ ] `ASSET-001` Add asset upload/storage pipeline backed by MinIO/S3
- [x] `OPS-001A` Add stale-write/conflict protection for code workspace saves and restores
- [x] `OPS-001B` Add structured API error model and recovery paths
- [r] `OPS-001` Add Playwright E2E coverage for core Studio flows
- [ ] `OPS-002` Add production-grade logging and operational diagnostics
- [ ] `OPS-003` Validate full Docker studio stack in real build/run mode

## Phase 7: Product Polish

Goal: Close the gap between a functional system and a high-quality product.

- [x] `POL-001` Replace section-form sprawl in Studio page with reusable editor modules
- [ ] `POL-002` Improve visual hierarchy and artifact canvas fidelity
- [ ] `POL-003` Add onboarding and empty-state guidance
- [ ] `POL-004` Tighten README and developer docs

## Recently Completed

- [x] GitHub design-system import
- [x] Local-directory design-system import
- [x] Fetch-based site-capture import
- [x] Scene -> code synchronization for generated website artifacts
- [x] Safe-subset code -> scene synchronization
- [x] Streaming generation progress and structured generation failures

## Immediate Next Slice

If no blocker appears, continue in this exact order:

1. `DS-004` Upgrade site capture to Playwright browser capture
2. `DS-005` Use imported packs as generation constraints
3. `SYNC-003` Broaden supported code -> scene sync safely
4. `OPS-001` Add Playwright E2E coverage for core Studio flows
5. `TYPE-001` Prototype-specific scene and preview
6. `TYPE-002` Slides-specific scene structure
