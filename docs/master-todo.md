# OpenDesign Master TODO

Last updated: 2026-04-20 (Round 3)
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

Current estimated product completion for a serious V1: `58%`

```text
[############--------] 58%
```

Note: the prior `95%` figure only measured data/API/export correctness — contract validity, round-trip fidelity, persistence, atomic generation commits, and operational probes. Once honest weight is added for product-feel dimensions (no real visual canvas, no desktop app, rough copy/typography, missing component library and theme system, and no real direct manipulation), the composite number is substantially lower. The 58% figure reflects that weighted view and is the number we will track against from Round 4 onward.

## Phase Scoreboard

| Phase | Area | Estimated Completion | Status |
| --- | --- | --- | --- |
| 1 | AI generation pipeline | 97% | `[>]` |
| 2 | Scene/code synchronization | 88% | `[>]` |
| 3 | Design system ingest and grounding | 95% | `[>]` |
| 4 | Prototype and slides | 92% | `[>]` |
| 5 | Collaboration and handoff | 90% | `[>]` |
| 6 | Assets, reliability, ops | 95% | `[>]` |
| 7 | Product polish | 60% | `[>]` |
| 8 | Visual design system and theme | 25% | `[>]` |
| 9 | Visual canvas and direct manipulation | 15% | `[>]` |
| 10 | Desktop shell | 10% | `[>]` |

## Honesty Log

- `2026-04-20`: reality check on the Round 3 `95%` claim. That number was a data/correctness measurement — contract validity, round-trip fidelity, export payload shape, persistence, atomic commits, CORS/ready probes — not a product-feel measurement. The user pointed out that the visual layer is far behind Claude Design: there is no real visual canvas (only an artifact-aware stage placeholder), no desktop app, typography and copy are rough, and direct-manipulation primitives (component library, theme system, drag-reposition, alignment guides, undo/redo) are absent. Revised composite estimate is `58%`, Phase 7 (Product polish) dropped from `85%` to `60%`, and three new phases (8 Visual design system and theme, 9 Visual canvas and direct manipulation, 10 Desktop shell) were added to the scoreboard so the gap is tracked explicitly rather than hidden inside "polish".

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

### DESKTOP-001 Ship Tauri 2 Desktop Shell (macOS First, Windows/Linux Config Included)

- Status: `[>]`
- Priority: `P0`
- Owner Lane: `desktop`
- Depends On: None
- Blocks: `DESKTOP-002`
- Why Now:
  Claude Design ships a real desktop app. The web-only shell makes OpenDesign feel like an internal tool instead of a product, and the user's 2026-04-20 reality check called this out explicitly.
- Definition Of Done:
  - [ ] Tauri 2 workspace wired into the monorepo with macOS as the first target and Windows/Linux configuration present.
  - [ ] `pnpm desktop:dev` runs a dev loop against the Studio web app.
  - [ ] `pnpm desktop:build` produces a signed-ready `.app` and `.dmg` for macOS.
  - [ ] Native menu bar with project/file/edit/view/window/help structure.
  - [ ] Code-signing configuration placeholder (entitlements, provisioning hooks) ready for a real signing identity.
  - [ ] README updated with desktop quickstart and build instructions.
- Expected Artifacts:
  - `apps/desktop/*`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `apps/desktop/src-tauri/Cargo.toml`
  - `package.json` (root scripts `desktop:dev`, `desktop:build`)
  - `README.md`
- Next Slice:
  - `UX-REBUILD-001 Design tokens, theme system, typography, copy polish across Studio`

### UX-REBUILD-001 Design Tokens, Theme System, Typography, Copy Polish Across Studio

- Status: `[>]`
- Priority: `P0`
- Owner Lane: `web`
- Depends On: None
- Blocks: `UX-REBUILD-002`
- Why Now:
  The 2026-04-20 reality check flagged rough copy and typography plus a missing theme system. Without a real token layer, every later canvas/motion pass will re-introduce the same visual drift.
- Definition Of Done:
  - [ ] Tokens file established (color, spacing, radius, shadow, motion, typography) consumed across Studio surfaces.
  - [ ] Light and dark themes implemented with a visible toggle in Studio chrome.
  - [ ] Inter (UI) and JetBrains Mono (code) wired as the canonical type stack.
  - [ ] `apps/web/app/globals.css` updated to consume tokens instead of hard-coded values.
  - [ ] At least one visible copy or layout improvement on each non-canvas Studio surface (projects list, artifact list, inspector tabs, export panel, comments panel, design-system panel, generate panel).
- Expected Artifacts:
  - `apps/web/lib/design-tokens.ts`
  - `apps/web/app/globals.css`
  - `apps/web/components/theme-toggle.tsx`
  - `apps/web/components/studio-*.tsx`
- Next Slice:
  - `CANVAS-001 Real visual canvas foundation (zoom/pan/select/inline-edit)`

### CANVAS-001 Real Visual Canvas Foundation (Zoom/Pan/Select/Inline-Edit)

- Status: `[>]`
- Priority: `P0`
- Owner Lane: `web`
- Depends On: None
- Blocks: `CANVAS-002`
- Why Now:
  The current Studio central panel is an artifact-aware stage, not a real canvas. The 2026-04-20 reality check called out that the absence of zoom/pan/select/inline-edit is the single biggest product-feel gap versus Claude Design.
- Definition Of Done:
  - [ ] `apps/web/components/canvas/` folder with a stage, node wrappers, and per-artifact-kind renderers.
  - [ ] Website renderer draws sections with real visual treatment (not explainer cards).
  - [ ] Prototype renderer draws screens with links and CTAs visible on the canvas.
  - [ ] Slides renderer draws a filmstrip.
  - [ ] Viewport (zoom + pan offset) persisted per artifact.
  - [ ] Inline text edit on selected nodes.
  - [ ] The `id=artifact-canvas` DOM anchor is preserved so existing comment anchoring continues to resolve.
  - [ ] Multi-select, drag-reposition, component library, alignment guides, and undo/redo are explicitly out of scope and carved out as `CANVAS-002`.
- Expected Artifacts:
  - `apps/web/components/canvas/stage.tsx`
  - `apps/web/components/canvas/node-wrapper.tsx`
  - `apps/web/components/canvas/renderers/website.tsx`
  - `apps/web/components/canvas/renderers/prototype.tsx`
  - `apps/web/components/canvas/renderers/slides.tsx`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
- Next Slice:
  - `CANVAS-002 Multi-select, drag-reposition, component library, alignment guides, undo/redo`

### UX-REBUILD-002 Copy + Motion + Keyboard Polish Pass

- Status: `[ ]`
- Priority: `P1`
- Owner Lane: `web`
- Depends On: `UX-REBUILD-001`, `CANVAS-001`
- Blocks: None
- Why Now:
  A second copy pass only pays off after the token layer and canvas foundation have landed; motion and keyboard shortcuts also need the canvas to exist before they can be applied meaningfully.
- Definition Of Done:
  - [ ] Second copy pass across Studio surfaces after canvas + tokens land.
  - [ ] Subtle motion (easing, duration, reduced-motion respect) applied to canvas interactions (select, focus, zoom, pan).
  - [ ] Full keyboard shortcut map (navigation, selection, zoom, pan, undo/redo, save, generate, comment) documented and wired.
- Expected Artifacts:
  - `apps/web/components/canvas/*`
  - `apps/web/lib/keyboard-shortcuts.ts`
  - `apps/web/components/studio-*.tsx`
- Next Slice:
  - `DESKTOP-002 Desktop-specific features`

### CANVAS-002 Multi-Select, Drag-Reposition, Component Library, Alignment Guides, Undo/Redo

- Status: `[ ]`
- Priority: `P1`
- Owner Lane: `web`
- Depends On: `CANVAS-001`
- Blocks: None
- Why Now:
  Direct manipulation parity with Claude Design requires the full set of canvas affordances. Carved out from `CANVAS-001` to keep the foundation shippable.
- Definition Of Done:
  - [ ] Multi-select with marquee and shift-click.
  - [ ] Drag-reposition persisted back into the scene document.
  - [ ] Component library panel with insertable primitives.
  - [ ] Alignment guides and snapping.
  - [ ] Undo/redo stack for canvas mutations.
- Expected Artifacts:
  - `apps/web/components/canvas/*`
  - `apps/web/components/canvas/component-library.tsx`
  - `apps/web/lib/canvas-history.ts`
- Next Slice:
  - `UX-REBUILD-002 Copy + motion + keyboard polish pass`

### DESKTOP-002 Desktop-Specific Features (System Tray, Auto-Update, Local File Drop, Native Notifications)

- Status: `[ ]`
- Priority: `P1`
- Owner Lane: `desktop`
- Depends On: `DESKTOP-001`
- Blocks: None
- Why Now:
  After the desktop shell exists, a handful of native-only affordances are what make the app feel like a real desktop product instead of a wrapped web view.
- Definition Of Done:
  - [ ] System tray icon with basic actions (open, quit).
  - [ ] Auto-update channel configured (Tauri updater).
  - [ ] Local file drop into the Studio canvas routed through the asset pipeline.
  - [ ] Native notifications for long-running generation and export jobs.
- Expected Artifacts:
  - `apps/desktop/src-tauri/src/*`
  - `apps/desktop/src-tauri/tauri.conf.json`
- Next Slice:
  - None

### SYNC-003 Broaden Supported Code -> Scene Sync Beyond App.tsx Sections Data

- Status: `[>]`
- Priority: `P0`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `SYNC-001`, `SYNC-002`
- Blocks: `TYPE-001`, `TYPE-002`, `COLLAB-003`, `SYNC-004`
- Why Now:
  Current back-sync only supports the conservative `App.tsx` sections data format. That is enough for safety, but not enough for a high-quality editor workflow.
- Reality Check:
  `packages/code-sync/src/index.ts` still pivots on a single `const sections = [...]` literal scaffold; any other file shape returns `applied:false`. Non-website artifact kinds (prototype, slides) also unconditionally return `applied:false`.
- Definition Of Done:
  - [x] The single `App.tsx` / `const sections = [...]` scaffold shape round-trips for the website kind.
  - [ ] Alternative `App.tsx` shapes (alternate export/bind patterns, multi-file scaffolds) round-trip safely.
  - [ ] Prototype and slides kinds have a defined code-sync surface instead of always returning `applied:false`.
  - [x] Unsupported edits still fail closed and do not corrupt scene state.
  - [x] Studio clearly indicates whether a save also synced scene state.
- Validation Commands:
  - `pnpm --dir packages/code-sync exec vitest run tests/code-sync.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: audit confirmed only the single `const sections = [...]` scaffold shape round-trips; all other shapes and artifact kinds fail closed. Downgraded to in-progress; follow-up work carved out as `SYNC-004`.
- Expected Artifacts:
  - `packages/code-sync/src/index.ts`
  - `packages/code-sync/tests/code-sync.test.ts`
  - `packages/exporters/src/index.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/studio-inspector.tsx`
- Next Slice:
  - `SYNC-004 Extend safe-subset code->scene sync to alternative App.tsx shapes and prototype/slides`

### SYNC-004 Extend Safe-Subset Code -> Scene Sync To Alternative App.tsx Shapes And Prototype/Slides

- Status: `[ ]`
- Priority: `P0`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `SYNC-003`
- Blocks: `TYPE-001`, `TYPE-002`
- Why Now:
  SYNC-003 only covers the single `const sections = [...]` scaffold; real editor flows need coverage for more website scaffold shapes and for prototype/slides artifact kinds without relaxing fail-closed behavior.
- Definition Of Done:
  - [ ] At least one alternative website `App.tsx` shape (beyond the single `const sections = [...]` literal) round-trips safely.
  - [ ] Prototype artifacts have a defined safe-subset back-sync path (or explicit documented no-op with a Studio-surfaced reason) instead of silently returning `applied:false`.
  - [ ] Slides artifacts have a defined safe-subset back-sync path (or explicit documented no-op with a Studio-surfaced reason) instead of silently returning `applied:false`.
  - [ ] All unsupported shapes continue to fail closed without corrupting scene state.
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
  - `TYPE-001 Real artifact-kind-typed scene nodes for prototype and slides`

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

- Status: `[>]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-003`, `SCENE-001`
- Why Now:
  Website-only is the biggest remaining product-surface gap. Prototype flows are currently distinguished only by a runtime flag on a generic scene node schema, not by real typed scene structure.
- Reality Check:
  `packages/contracts/src/index.ts` exposes a single generic `SceneNode` schema. `SceneTemplateKindSchema` lists only `hero | feature-grid | cta`. Prototype and slides have no distinct node kinds at the contract level; artifact-type branching is handled as a runtime flag on top of the same shape.
- Definition Of Done:
  - [ ] `SceneNode` / `SceneTemplateKind` (or an additive equivalent) express prototype-specific node kinds at the contract level, not just a runtime flag.
  - [x] Preview can navigate or represent flows, not just static sections.
  - [x] Persistence, versions, and exports remain coherent.
  - [ ] Typed prototype scene nodes round-trip through scene engine, exporters, and code-sync without falling back to generic section nodes.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Validation Evidence:
  - `2026-04-20`: audit identified the gap; remediation in progress. Prototype preview/export paths run but sit on top of a single generic `SceneNode` schema.
- Expected Artifacts:
  - `packages/contracts/src/index.ts`
  - `packages/scene-engine/*`
  - `packages/exporters/*`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/web/components/*`
- Next Slice:
  - `SCENE-001 Real artifact-kind-typed scene nodes for prototype and slides`

### TYPE-002 Implement Slides-Specific Scene Structure

- Status: `[>]`
- Priority: `P1`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `DS-005`, `SYNC-003`
- Blocks: `TYPE-004`, `SCENE-001`
- Why Now:
  Slides is the other missing flagship artifact surface. Today it is expressed as the same generic `SceneNode` shape the website kind uses, distinguished only by a runtime flag.
- Reality Check:
  `packages/contracts/src/index.ts` has no slides-specific node schema. `SceneTemplateKindSchema` lists only `hero | feature-grid | cta`. Deck/page structure exists only at the preview/export layer on top of a generic scene node.
- Definition Of Done:
  - [ ] `SceneNode` / `SceneTemplateKind` (or an additive equivalent) express slides-specific deck/page node kinds at the contract level, not just a runtime flag.
  - [x] Studio shows artifact-appropriate controls for slide editing.
  - [x] Versions and exports remain stable.
  - [ ] Typed slides scene nodes round-trip through scene engine, exporters, and code-sync without falling back to generic section nodes.
- Validation Commands:
  - `pnpm test`
  - `pnpm build`
- Validation Evidence:
  - `2026-04-20`: audit identified the gap; remediation in progress. Slides preview/export paths run but sit on top of a single generic `SceneNode` schema.
- Expected Artifacts:
  - `packages/contracts/src/index.ts`
  - `packages/scene-engine/*`
  - `packages/exporters/*`
  - `apps/web/app/studio/[projectId]/[artifactId]/page.tsx`
  - `apps/api/src/routes/artifacts.ts`
- Next Slice:
  - `SCENE-001 Real artifact-kind-typed scene nodes for prototype and slides`

### SCENE-001 Real Artifact-Kind-Typed Scene Nodes For Prototype And Slides

- Status: `[x]`
- Priority: `P0`
- Owner Lane: `shared`, `web`, `api`
- Depends On: `TYPE-001`, `TYPE-002`
- Blocks: `SYNC-004`
- Why Now:
  Prototype and slides are currently a runtime flag on top of a single generic `SceneNode`. Without real typed node kinds the contract cannot guarantee artifact-appropriate shape for scene engine, code-sync, and exporters.
- Definition Of Done:
  - [x] `packages/contracts/src/index.ts` gains (additive) prototype-frame and slide-page node schemas alongside the current section node kinds.
  - [x] `SceneTemplateKindSchema` (or an additive equivalent) enumerates prototype and slides template kinds, not only `hero | feature-grid | cta`.
  - [x] Scene engine, exporters, and code-sync handle the new node kinds end-to-end without collapsing back to the generic section shape.
  - [x] Migration path preserves existing persisted scenes.
- Validation Commands:
  - `pnpm --filter @opendesign/contracts test`
  - `pnpm test`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: `packages/contracts/src/index.ts` now exposes discriminated `WebsiteSceneNodeSchema`/`PrototypeSceneNodeSchema`/`SlidesSceneNodeSchema` plus kind-specific template enums and a `TypedSceneDocumentSchema` that rejects cross-kind nodes.
  - `2026-04-20`: `packages/scene-engine/src/index.ts` added typed factories (`buildPrototypeScreen`, `buildPrototypeScreenLink`, `buildPrototypeScreenCta`, `buildSlide`) and `validateSceneDocumentByKind`, verified by 15 vitest cases including cross-kind rejection.
  - `2026-04-20`: `packages/exporters/src/index.ts` reshaped `PrototypeFlowExport` and `SlidesDeckExport` around typed `nodeType` tags; exporter suite green (13/13) and `apps/api/src/generation.ts` + `apps/api/src/routes/artifacts.ts` now branch on `artifactKind` with legacy website template names mapped transparently.
- Expected Artifacts:
  - `packages/contracts/src/index.ts`
  - `packages/scene-engine/*`
  - `packages/exporters/*`
  - `packages/code-sync/src/index.ts`
- Next Slice:
  - `SYNC-004 Extend code->scene sync beyond the single App.tsx shape`

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

- Status: `[>]`
- Priority: `P1`
- Owner Lane: `ops`, `api`
- Depends On: `OPS-001`, `OPS-003`
- Blocks: `COLLAB-005`, `OPS-002B`
- Why Now:
  The Docker production stack was already smoke-tested, but the API still lacked a minimal operational surface for request correlation, readiness checks, and runtime diagnostics when failures happen under real containers. Recent audit found the readiness and CORS surfaces were not production-grade.
- Reality Check:
  `/api/ready` was hard-coded to return `ready:true` without probing Postgres or S3/MinIO. CORS was configured with `origin:true` and `credentials:true`, allowing credentialed cross-origin calls from any site.
- Definition Of Done:
  - [x] Every API response includes a request correlation id, preserving caller-supplied `x-request-id` when present.
  - [x] Structured validation errors include the correlation id in their payload details.
  - [x] Readiness and diagnostics endpoints expose persistence mode, asset storage provider, and auth runtime wiring for ops triage.
  - [ ] `/api/ready` actively probes persistence and asset storage instead of returning a hard-coded `ready:true`.
  - [ ] CORS is restricted to a trusted-origin allowlist; `credentials:true` is never paired with `origin:true`.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/health.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-19`: added request-id propagation at the Fastify app layer, returned `x-request-id` on every response, and threaded that id into structured validation error details for easier log-to-client correlation.
  - `2026-04-19`: added `/api/ready` and `/api/diagnostics` with persistence mode, asset-storage provider, auth base URL, and trusted-origin diagnostics; verified through API tests and monorepo typecheck.
  - `2026-04-20`: audit found `/api/ready` was hard-coded `ready:true` with no live DB/S3 probe, and CORS was `origin:true` + `credentials:true` — any site could make credentialed cross-origin calls. Reopened as in-progress; fix tracked under `OPS-002B`.
- Expected Artifacts:
  - `apps/api/src/app.ts`
  - `apps/api/src/routes/health.ts`
  - `apps/api/src/lib/api-errors.ts`
  - `apps/api/src/persistence.ts`
  - `apps/api/tests/health.test.ts`
  - `README.md`
- Next Slice:
  - `OPS-002B Real liveness probes in /api/ready + CORS trusted-origin allowlist`

### OPS-002B Real Liveness Probes In /api/ready And CORS Trusted-Origin Allowlist

- Status: `[x]`
- Priority: `P0`
- Owner Lane: `ops`, `api`
- Depends On: `OPS-002`
- Blocks: None
- Why Now:
  The audit found `/api/ready` returned a hard-coded `ready:true` and CORS allowed credentialed cross-origin calls from any site. Both are production-correctness gaps and are being actively remediated.
- Definition Of Done:
  - [x] `/api/ready` actively probes persistence (Postgres) and asset storage (S3/MinIO or in-memory fallback) and returns non-ready with structured detail when a dependency is unavailable.
  - [x] CORS is restricted to a trusted-origin allowlist derived from configuration; `credentials:true` is only honored for allowlisted origins.
  - [x] Regression tests cover both the ready probe failure modes and the CORS allowlist enforcement.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/health.test.ts`
  - `pnpm --filter @opendesign/api test -- tests/cors.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: audit flagged the hard-coded `/api/ready` payload and the permissive `origin:true` + `credentials:true` CORS pairing; remediation landed same day.
  - `2026-04-20`: `apps/api/src/routes/health.ts` now probes persistence (`ping()` → `SELECT 1`) and asset storage (`HeadBucketCommand` with 2s abort / in-memory no-op) in parallel with a 2.5s per-probe timeout, returning HTTP 503 + structured detail on failure while preserving `persistenceMode`/`assetStorageProvider` keys.
  - `2026-04-20`: `apps/api/src/app.ts` resolves CORS origin from `WEB_BASE_URL` + `OPENDESIGN_TRUSTED_ORIGINS` (fallback `http://127.0.0.1:${WEB_PORT ?? 3000}`), never reflects unknown origins, and `apps/api/tests/health.test.ts` covers probe-failure 503s, trusted/untrusted origin handling, and `WEB_PORT` fallback across 9 tests.
- Expected Artifacts:
  - `apps/api/src/app.ts`
  - `apps/api/src/routes/health.ts`
  - `apps/api/src/persistence.ts`
  - `apps/api/src/asset-storage.ts`
  - `apps/api/tests/health.test.ts`
  - `apps/api/tests/cors.test.ts`
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

### SYNC-005 Code-Sync Bidirectional Completion For Prototype And Slides

- Status: `[x]`
- Priority: `P0`
- Owner Lane: `shared`, `api`
- Depends On: `SCENE-001`
- Blocks: `SYNC-006`
- Why Now:
  Prototype and slides back-sync previously returned `applied:false`. Round 3 closes the bidirectional loop for typed prototype/slides scaffolds.
- Definition Of Done:
  - [x] `packages/code-sync/src/scaffolds.ts` accepts inline `type: "screen-link"` and `type: "screen-cta"` entries within `const screens = [...]`; ordering preserved via scene nodes as single source of truth.
  - [x] `packages/code-sync/src/scaffold-emit.ts` emits minimal deterministic Vite+React scaffolds (`buildPrototypeScaffoldFiles`, `buildSlidesScaffoldFiles`) whose literals use the exact typed vocabulary the parser accepts.
  - [x] `syncSceneToCodeWorkspace` dispatches on `artifactKind`; website keeps `buildArtifactSourceBundle`, prototype/slides use the new emitters.
  - [x] Unknown types / missing `from|to` / bad `trigger` / non-string props / non-string bullets / nested children / unsupported types fail closed with named `reason`.
  - [x] Full prototype and slides `scene → code → scene` round-trip equivalence covered.
- Validation Commands:
  - `pnpm --dir packages/code-sync exec vitest run`
  - `pnpm --filter @opendesign/api test`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: 34 → 48 code-sync tests (+14) green, including prototype/slides round-trip equivalence.
  - `2026-04-20`: API 99/99 green; `apps/api/tests/projects-artifacts.test.ts` prototype/slides append flows now assert `codeWorkspace.files["/App.tsx"]` contains `const screens =` / `const slides =` (replacing outdated `null` expectations); source-bundle assertions switched to stable markers (`const screens =`, `const slides =`, `Slides Deck`); `currentHasCodeWorkspace: true` for prototype/slides drift diff.
  - `2026-04-20`: `apps/api/src/repositories/assets.ts::InMemoryAssetRepository.create` now ensures strictly-monotonic `createdAt` so back-to-back creates within one ms still sort deterministically by insertion order; fixed pre-existing flaky test.
  - `2026-04-20`: `pnpm typecheck` 8/8 green; contracts/scene-engine/exporters all green.
- Expected Artifacts:
  - `packages/code-sync/src/scaffolds.ts`
  - `packages/code-sync/src/scaffold-emit.ts`
  - `packages/code-sync/src/index.ts`
  - `packages/code-sync/tests/code-sync.test.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
  - `apps/api/src/repositories/assets.ts`
- Next Slice:
  - `SYNC-006 Extend code-sync to multi-file scaffolds and non-string prop serialization`

### GEN-003 Generation Control And Operator Guidance

- Status: `[x]`
- Priority: `P1`
- Owner Lane: `shared`, `api`, `web`
- Depends On: `GEN-001`, `GEN-002`
- Blocks: `GEN-004`
- Why Now:
  Prompt-driven generation needed explicit cancel, overlap, quota, and retry affordances so operators and end users can recover from slow or failed runs instead of relying on timers and reloads.
- Definition Of Done:
  - [x] `packages/contracts` adds error codes `GENERATION_CANCELLED`, `GENERATION_ALREADY_RUNNING`, `GENERATION_QUOTA_EXCEEDED`, plus an optional `retry` discriminated union on the `failed` stream event (`{retryable:true, prompt, designSystemPackId?}` or `{retryable:false}`).
  - [x] `apps/api/src/routes/artifacts.ts` registers in-flight generations in a plugin-scoped `Map`; `POST /api/projects/:projectId/artifacts/:artifactId/generate/cancel` aborts upstream LiteLLM fetch via `AbortController`, emits `GENERATION_CANCELLED` failed event, and closes the SSE socket.
  - [x] Same-artifact overlap returns HTTP 409; per-user concurrency cap (default 2, override `OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER`) returns HTTP 429 with `retry-after: 5` and `details.{running, limit, retryAfterSeconds}`.
  - [x] `apps/api/src/generation.ts`: LiteLLM fetch honours external `AbortSignal`; distinguishes caller-cancel (`GENERATION_CANCELLED`) from timer-cancel (`GENERATION_TIMEOUT`).
  - [x] `apps/web/components/studio-generate-panel.tsx` wires client-side `AbortController`, Cancel button during pending, Retry button with stored retryable handle, and a "Cancelling" pill.
- Validation Commands:
  - `pnpm --filter @opendesign/api test -- tests/projects-artifacts.test.ts tests/generation.test.ts`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: `apps/api/tests/projects-artifacts.test.ts` + `generation.test.ts` cover cancel-mid-fetch (workspace untouched, retry payload populated), 409 overlap, 429 quota, retryable failure payload shape, and pre-aborted heuristic path; API 99/99 green.
  - `2026-04-20`: `pnpm typecheck` 8/8 green; web Cancel/Retry affordances cooperate with server cancel route.
- Expected Artifacts:
  - `packages/contracts/src/index.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/api/src/generation.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
  - `apps/api/tests/generation.test.ts`
  - `apps/web/components/studio-generate-panel.tsx`
- Next Slice:
  - `GEN-004 Add recovery loops for invalid/failed generation passes (auto-retry with clamped backoff)`

### OPS-002C Fold Trailing Writes Into The Atomic Generation Commit

- Status: `[x]`
- Priority: `P0`
- Owner Lane: `ops`, `api`
- Depends On: `GEN-001`, `OPS-002B`
- Blocks: None
- Why Now:
  Round 2 audit flagged that `performArtifactGeneration` still wrote `updateCodeWorkspace` + `updateActiveVersion` AFTER the `applyGenerationRun` transaction committed. A crash between those writes could leave the workspace with a stale `active_version_id` or mismatched code mirror.
- Definition Of Done:
  - [x] `ApplyGenerationRunInput` gains optional `codeWorkspace` and `activateNewVersion` (default true).
  - [x] Postgres path folds intent + scene + codeWorkspace + version + activeVersionId into one `BEGIN ... COMMIT`; in-memory path snapshots and reverts in lockstep.
  - [x] Non-transactional fallback (missing `connect`) emits a loud `console.warn` so a misconfigured pool is visible in logs instead of silently degrading.
  - [x] `performArtifactGeneration` replaces trailing `updateCodeWorkspace` + `updateActiveVersion` calls with a single `applyGenerationRun` call carrying the derived code workspace and activation flag.
- Validation Commands:
  - `pnpm --filter @opendesign/api test`
  - `pnpm typecheck`
- Validation Evidence:
  - `2026-04-20`: all 99 API tests pass unchanged; atomic commit now covers intent + scene + codeWorkspace + version + activeVersionId in one unit.
  - `2026-04-20`: non-transactional fallback emits loud `console.warn`; `pnpm typecheck` 8/8 green.
- Expected Artifacts:
  - `apps/api/src/repositories/artifact-workspaces.ts`
  - `apps/api/src/routes/artifacts.ts`
  - `apps/api/tests/projects-artifacts.test.ts`
- Next Slice:
  - `SYNC-006 Extend code-sync to multi-file scaffolds and non-string prop serialization`

## Blocked Registry

These tasks are known to depend on unfinished upstream work.

- None currently. Continue with the top unblocked queue item.

## Remaining Master Task List

This is the full remaining backlog, grouped by phase.

## Phase 1: AI Generation Pipeline

Goal: Move from manual scene editing to a real artifact-generation system.

- [x] `GEN-001` Add generation route for prompt-driven artifact creation
  Done when:
  Studio can submit a prompt and receive scene/code updates from the backend.
  Definition Of Done (additional):
  - [x] The generation three-write sequence is applied atomically (transaction or compensating rollback) so a mid-flight failure never leaves a torn workspace.
  - [x] The SSE generation session enforces a bounded timeout after `reply.hijack()` and cleans up the connection on client disconnect or timeout.
  Validation Evidence:
  - `2026-04-20`: audit flagged non-atomic scene patch and missing SSE session timeout; remediation landed same day.
  - `2026-04-20`: new `ArtifactWorkspaceRepository.applyGenerationRun` commits intent + scene + version in one unit (Postgres `BEGIN/COMMIT/ROLLBACK`, in-memory snapshot/revert), and `performArtifactGeneration` in `apps/api/src/routes/artifacts.ts` now calls the single atomic method.
  - `2026-04-20`: `beginGenerationEventStream` arms a session deadline (default `2 * OPENDESIGN_GENERATION_TIMEOUT_MS`, `OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS` override) that emits `failed` + `code: GENERATION_TIMEOUT` and closes the socket; `apps/api/tests/projects-artifacts.test.ts` adds mid-flight-failure-preserves-baseline and session-timeout tests, full API suite 93/93 green.
- [x] `GEN-002` Attach imported packs to generation context and plan building
  Depends On: `DS-005`
  Done when:
  Prompt execution uses selected design-system evidence as grounding input.
- [x] `GEN-003` Generation control and operator guidance
  Done when:
  Cancel, 409 overlap, 429 per-user quota, retryable failure payload, and client Cancel/Retry affordances are wired end-to-end; LiteLLM fetch honours external `AbortSignal`; caller-cancel vs timer-cancel are distinguished.

## Phase 2: Scene/Code Synchronization

Goal: Make scene editing and code editing feel like one system instead of parallel hacks.

- [x] `SYNC-001` Implement real `scene -> code` sync in `packages/code-sync`
- [x] `SYNC-002` Implement supported `code -> scene` back-sync for the safe subset
- [>] `SYNC-003` Broaden supported code -> scene sync beyond `App.tsx` sections data while preserving safety
  Done when:
  The single `App.tsx` / `const sections = [...]` scaffold shape round-trips; all other shapes and artifact kinds fail closed. Broader coverage is carved out as `SYNC-004`.
- [ ] `SYNC-004` Extend safe-subset code -> scene sync to alternative `App.tsx` shapes and prototype/slides
  Done when:
  At least one additional website scaffold shape round-trips safely, and prototype/slides either support a defined safe-subset back-sync or explicitly surface a documented no-op reason instead of silently returning `applied:false`.
- [x] `SYNC-005` Code-sync bidirectional completion for prototype and slides
  Done when:
  Prototype/slides `scene → code → scene` round-trip through typed scaffold emit + inline `screen-link` / `screen-cta` parsing; unsupported shapes fail closed with named reasons.

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

- [>] `TYPE-001` Implement prototype-specific scene nodes and preview behavior
  Done when:
  Prototype artifacts are backed by real typed scene nodes at the contract level, not just a runtime flag on a generic `SceneNode`.
- [>] `TYPE-002` Implement slides-specific scene structure
  Done when:
  Slides artifacts are backed by real typed deck/page scene nodes at the contract level, not just a runtime flag on a generic `SceneNode`.
- [x] `TYPE-003` Add prototype-specific export path
- [x] `TYPE-004` Add slides export path
- [x] `TYPE-005` Add per-artifact editor affordances in Studio
- [x] `SCENE-001` Real artifact-kind-typed scene nodes for prototype and slides
  Done when:
  The shared contract exposes prototype-frame and slide-page node kinds alongside section kinds, scene engine/exporters/code-sync handle them end-to-end, and existing persisted scenes migrate cleanly.

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
- [>] `OPS-002` Add production-grade logging and operational diagnostics
  Done when:
  Request correlation, readiness, and diagnostics endpoints are wired AND `/api/ready` actively probes persistence and asset storage AND CORS is restricted to a trusted-origin allowlist instead of `origin:true` + `credentials:true`.
- [x] `OPS-002B` Real liveness probes in `/api/ready` and CORS trusted-origin allowlist
  Done when:
  `/api/ready` actively probes Postgres and S3/MinIO and reports non-ready with structured detail on failure, and CORS only honors `credentials:true` for allowlisted origins.
- [x] `OPS-002C` Fold trailing writes into the atomic generation commit
  Done when:
  `applyGenerationRun` folds intent + scene + codeWorkspace + version + activeVersionId into a single Postgres `BEGIN ... COMMIT` (or in-memory snapshot/revert), `performArtifactGeneration` no longer writes workspace/version updates after commit, and the non-transactional fallback emits a loud warning.
- [x] `OPS-003` Validate full Docker studio stack in real build/run mode
- [ ] `E2E-001` Add prototype and slides Playwright coverage
  Done when:
  Playwright suites exercise prototype flow creation/navigation and slides deck authoring end-to-end against the Studio, at the depth of the existing website `studio-core` coverage, and run in the same Docker-compatible local workflow.

## Phase 7: Product Polish

Goal: Close the gap between a functional system and a high-quality product.

- [x] `POL-001` Replace section-form sprawl in Studio page with reusable editor modules
- [x] `POL-002` Improve visual hierarchy and artifact canvas fidelity
- [x] `POL-003` Add onboarding and empty-state guidance
- [x] `POL-004` Tighten README and developer docs
  Done when:
  Root `README.md` covers product surface, repo layout, local + Docker quickstarts, env config, generation pipeline, design-system ingest, asset storage, testing, operational diagnostics, scripts, and architecture notes.
  Validation Evidence:
  - `2026-04-20`: authored root `README.md` with full developer guide (product surface, monorepo layout, local + Docker studio quickstarts, env reference, generation pipeline, design-system ingest, asset storage, Vitest/Playwright test matrix, `/api/health` / `/api/ready` / `/api/diagnostics` diagnostics, scripts reference, architecture notes, and status pointer back to `docs/master-todo.md`).

## Phase 8: Visual Design System And Theme

Goal: Give Studio a real token layer, theme toggle, and polished typography/copy so every later visual pass compounds instead of drifting.

- [>] `UX-REBUILD-001` Design tokens, theme system, typography, copy polish across Studio
  Done when:
  Tokens file established, light/dark themes with toggle, Inter + JetBrains Mono wired, `globals.css` consuming tokens, and at least one visible improvement per non-canvas Studio surface.
- [ ] `UX-REBUILD-002` Copy + motion + keyboard polish pass
  Done when:
  Second copy pass after canvas + tokens land, subtle motion on canvas interactions, and a full keyboard shortcut map wired and documented.

## Phase 9: Visual Canvas And Direct Manipulation

Goal: Replace the artifact-aware stage placeholder with a real visual canvas that supports zoom/pan/select/inline-edit and eventually full direct manipulation.

- [>] `CANVAS-001` Real visual canvas foundation (zoom/pan/select/inline-edit)
  Done when:
  `canvas/` folder with stage, node wrappers, per-artifact-kind renderers (website sections, prototype screens + links + CTAs, slides filmstrip), viewport persistence per artifact, inline text edit, and a preserved `id=artifact-canvas` anchor.
- [ ] `CANVAS-002` Multi-select, drag-reposition, component library, alignment guides, undo/redo
  Done when:
  Multi-select (marquee + shift-click), drag-reposition persisted into the scene, insertable component library, alignment guides and snapping, and a canvas undo/redo stack are all wired.

## Phase 10: Desktop Shell

Goal: Ship a real desktop app so OpenDesign stops feeling like an internal web tool.

- [>] `DESKTOP-001` Ship Tauri 2 desktop shell (macOS first, Windows/Linux config included)
  Done when:
  Builds `.app` / `.dmg` via `pnpm desktop:build`, dev loop via `pnpm desktop:dev`, native menu, code-signing placeholder, and README updated.
- [ ] `DESKTOP-002` Desktop-specific features (system tray, auto-update, local file drop, native notifications)
  Done when:
  Tray icon with basic actions, Tauri auto-update channel configured, local file drop routed through the asset pipeline, and native notifications for long-running generation/export jobs.

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
- [x] Landing/projects/studio onboarding and empty-state guidance
- [x] Root `README.md` with full developer guide (local + Docker quickstarts, env reference, generation pipeline, ops diagnostics, architecture)
- [x] Atomic generation writes plus bounded SSE session timeout for prompt-driven artifact generation
- [x] Artifact-kind-typed scene nodes for prototype and slides, with typed factories, validators, and exporter payloads
- [x] Live `/api/ready` Postgres + asset-storage probes and trusted-origin CORS allowlist
- [x] Code-sync bidirectional completion for prototype and slides (typed scaffold emit + inline `screen-link` / `screen-cta` parsing; 48 code-sync tests)
- [x] Generation control and operator guidance: cancel route + 409 overlap + 429 per-user quota + retryable failure payload + client Cancel/Retry affordances
- [x] Atomic generation commit now folds codeWorkspace + activeVersionId alongside intent/scene/version; non-transactional fallback warns loudly
- [x] Test/assertion alignment: prototype/slides `const screens =` / `const slides =` assertions and monotonic in-memory asset `createdAt` ordering

## Immediate Next Slice

If no blocker appears, continue in this exact order:

1. `DESKTOP-001` Tauri desktop shell (in progress, same-day delivery)
2. `UX-REBUILD-001` Design system + copy polish (in progress, same-day delivery)
3. `CANVAS-001` Real visual canvas foundation (in progress, same-day delivery)
4. `CANVAS-002` Canvas direct manipulation and library
5. `UX-REBUILD-002` Motion and keyboard polish
6. `DESKTOP-002` Desktop-specific features

## Claude Design Parity Backlog

Source: [`docs/claude-design-parity.md`](./claude-design-parity.md) (full matrix, severity, slice sizing, and uncertainty notes). Items below are the top 20 parity gaps by impact. `[>]` marks the ones already in flight today per the Current Execution Queue. `[ ]` marks queued parity gaps not yet scheduled.

- [>] `DESKTOP-001` Tauri desktop shell (macOS first, Windows/Linux config included) — HIGH / L
- [>] `CANVAS-001` Real visual canvas foundation (zoom/pan/select/inline-edit) — HIGH / L
- [>] `UX-REBUILD-001` Design tokens, theme system, typography, copy polish across Studio — HIGH / L
- [>] `CHAT-001` Conversational chat transcript attached to artifact (multi-turn memory) — HIGH / L
- [>] `CMDK-001` Cmd-K command palette — HIGH / M
- [>] `RESPONSIVE-001` Mobile/tablet/desktop frame toggle on canvas — HIGH / M
- [>] `VARIATIONS-001` N-shot parallel variations generation — HIGH / L
- [>] `LIBRARY-001` Insertable section/hero/CTA component library panel — HIGH / L
- [>] `KBD-001` Baseline canvas keyboard shortcut map wired + documented — HIGH / M
- [>] `PALETTE-001` Artifact-scoped palette live swap — HIGH / L
- [>] `IMAGE-001` AI image generation (stub or real provider) — HIGH / L
- [>] `REMIX-001` Duplicate artifact inside a project with lineage — HIGH / S
- [ ] `REFINE-001` Per-element refinement prompt ("make this bolder") — HIGH / L
- [ ] `CHAT-002` Inline "ask about this element" per scene node — HIGH / M
- [ ] `CANVAS-002D` Undo/redo stack for canvas mutations — HIGH / M
- [ ] `CANVAS-002A` Multi-select (marquee + shift-click) — HIGH / M
- [ ] `CANVAS-002B` Drag-reposition persisted back into scene — HIGH / L
- [ ] `TEMPLATES-001` Starter templates on project create — HIGH / M
- [ ] `PROJECT-LANG-001` Shared palette across all artifacts in a project — HIGH / L
- [ ] `COLLAB-LIVE-001` Live presence (who is here) — HIGH / XL

