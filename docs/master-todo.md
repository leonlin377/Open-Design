# OpenDesign Master TODO

Last updated: 2026-04-19
Repo baseline: `5e126dd`

## Status Legend

- `[x]` Done
- `[~]` In Progress
- `[ ]` Not Started
- `Blocker` High-risk dependency or prerequisite

## Overall Progress

Current estimated product completion for a serious V1: `77%`

```
[################----] 77%
```

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

What is still missing from a true Claude Design benchmark:

- [ ] Real AI generation pipeline
- [~] Real scene/code synchronization
- [~] Design system ingestion and grounding
- [ ] Prototype mode
- [ ] Slides mode
- [ ] Sharing, roles, and collaboration flows
- [ ] Rich asset pipeline
- [ ] Handoff-grade export bundles
- [ ] End-to-end quality and operational hardening

## Execution Order

The order below is the build order I will keep following unless a lower-level blocker forces a change.

1. AI generation and artifact pipeline
2. Scene/code synchronization and Studio editing quality
3. Design system ingest and grounded generation
4. Prototype and slides surfaces
5. Collaboration, sharing, and handoff/export polish
6. Reliability, security, E2E coverage, and ops hardening

## Phase 1: AI Generation Pipeline

Goal: Move from manual scene editing to a real artifact-generation system.

- [x] Wire LiteLLM into the actual artifact generation flow
  Done when:
  API routes can call a configured gateway and receive streamed responses.
- [x] Define generation contracts for `artifact-plan`, `scene-patch`, `code-patch`, and `comment-resolution`
  Done when:
  Shared contracts exist and API handlers validate them before applying patches.
- [~] Add generation route for prompt-driven artifact creation
  Done when:
  Studio can submit a prompt and receive scene/code updates from the backend.
- [x] Add streaming status/events for generation progress
  Done when:
  Web UI can show generation states without refresh.
- [x] Add failure handling for invalid patches, timeout, and provider errors
  Done when:
  The UI surfaces explicit error states and the workspace remains recoverable.

## Phase 2: Scene/Code Synchronization

Goal: Make scene editing and code editing feel like one system instead of parallel hacks.

- [x] Implement real `scene -> code` sync in `packages/code-sync`
  Done when:
  Scene edits regenerate a stable scaffold without losing supported code edits.
- [x] Implement supported `code -> scene` back-sync for the safe subset
  Done when:
  Edits to supported files can update scene nodes or sections.
- [x] Show saved code workspace boundaries clearly in Studio
  Current:
  Saved code state, scene drift warning, dirty-state, reset-to-saved, and restore-aware messaging are implemented.
- [x] Add session draft dirty-state detection in the code editor
  Done when:
  Studio clearly shows when current code differs from saved code workspace.
- [x] Add reset-to-saved action for the code editor
  Done when:
  Users can discard local draft edits and return to the saved scaffold instantly.
- [x] Add explicit generation, save, restore, and export feedback states in UI
  Done when:
  Users always know what changed and what the current source of truth is.
- [x] Add scene/code diff support in the Versions lane
  Done when:
  Restores are previewable and users can inspect what changed before switching.

## Phase 3: Design System Ingest

Goal: Ground artifact generation in real tokens, components, and visual evidence.

- [x] Implement GitHub repository import
  Done when:
  A repository path can be parsed into tokens, motifs, and evidence records.
- [x] Implement local directory import
  Done when:
  Studio can ingest a local component/token directory and persist a pack.
- [ ] Implement site capture import with Playwright
  Done when:
  A URL can be crawled and reduced into screenshots, style evidence, and extracted tokens.
- [x] Persist `DesignSystemPack` records in the backend
  Done when:
  Packs are stored, listed, and attachable to artifacts.
- [ ] Use imported packs as generation constraints
  Done when:
  Prompt output changes based on selected pack tokens and motifs.

## Phase 4: Artifact Types Beyond Website

Goal: Support the full artifact surface instead of just website-first flows.

- [ ] Implement prototype-specific scene nodes and preview behavior
  Done when:
  Prototype artifacts support multiple states or flow transitions in preview.
- [ ] Implement slides-specific scene structure
  Done when:
  Slide/page stacks, deck-level layout, and sequential rendering exist.
- [ ] Add prototype-specific export path
  Done when:
  Prototype artifacts can export runnable review bundles.
- [ ] Add slides export path
  Done when:
  Slides can export at least PDF and a deck-oriented source package.
- [ ] Add per-artifact editor affordances in Studio
  Done when:
  Website, prototype, and slides each expose context-appropriate controls.

## Phase 5: Collaboration and Handoff

Goal: Make the system usable by more than one person and suitable for review.

- [ ] Add share tokens for artifact/project review
  Done when:
  A non-owner can open a shared artifact view by secure link.
- [ ] Add roles: `viewer`, `commenter`, `editor`
  Done when:
  Access checks work in API and UI.
- [ ] Upgrade comment anchors from canvas-level fallback to element-aware anchors
  Done when:
  Comments can stay attached to specific nodes or sections through edits.
- [ ] Build handoff export bundle
  Done when:
  Export includes scene state, code state, assets, and machine-readable manifest files.
- [ ] Add export job tracking
  Done when:
  Large exports can run asynchronously with status and retry behavior.

## Phase 6: Assets, Reliability, and Ops

Goal: Make the product stable enough for serious usage.

- [ ] Add asset upload/storage pipeline backed by MinIO/S3
  Done when:
  Images, fonts, and attachments are stored and referenced from workspaces and exports.
- [x] Add stale-write/conflict protection for code workspace saves and restores
  Done when:
  Users do not silently overwrite newer saved state.
- [x] Add structured API error model and recovery paths
  Done when:
  The UI can distinguish auth, validation, conflict, and provider failures.
- [ ] Add Playwright E2E coverage for core Studio flows
  Done when:
  Login, create project, edit scene, save code, snapshot, restore, and export are covered.
- [ ] Add production-grade logging and operational diagnostics
  Done when:
  Failed exports, failed auth flows, and failed generation calls are inspectable.
- [ ] Validate full Docker studio stack in real build/run mode
  Done when:
  `web`, `api`, `postgres`, `redis`, and `minio` run together successfully in containerized mode.

## Phase 7: Product Polish

Goal: Close the gap between a functional system and a high-quality product.

- [x] Replace section-form sprawl in Studio page with reusable editor modules
  Done when:
  Scene inspector logic is no longer concentrated in one large page file.
- [ ] Improve visual hierarchy and artifact canvas fidelity
  Done when:
  Studio feels like an intentional product, not an internal tool shell.
- [ ] Add onboarding and empty-state guidance
  Done when:
  First-time users can create and understand an artifact without repo knowledge.
- [ ] Tighten README and developer docs
  Done when:
  Another engineer can boot, inspect, and extend the project without guesswork.

## Active Next Slice

This is the immediate build sequence I should continue with next:

- [x] Add scene/code diff preview in Versions lane
- [x] Harden generation route from fallback-only into streamed LiteLLM execution
- [x] Add generation status and failure UI in Chat Rail
- [x] Move section editing out of the Studio page into reusable editor components
- [x] Add structured API error model and recovery paths
- [x] Add streaming status/events for generation progress
- [x] Add provider-specific generation failure states in Chat Rail
- [x] Add apply-stage generation failure handling for invalid scene/code patches
- [x] Implement real scene -> code synchronization for generated website artifacts
- [x] Start supported `code -> scene` back-sync for the safe website subset
- [ ] Broaden supported code -> scene sync beyond `App.tsx` sections data while preserving safety
- [x] Implement local-directory design-system import and persistence flow
- [ ] Implement site-capture design-system import and persistence flow
