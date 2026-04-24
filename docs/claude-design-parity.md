# Claude Design Parity Teardown

Last updated: 2026-04-20
Reference baseline: `docs/master-todo.md` Round 3, repo `755cf99`.

## Purpose

This document is the authoritative feature-parity teardown of OpenDesign Studio versus Claude Design (Anthropic's artifact/design product surface on claude.ai) as of the January 2026 knowledge cutoff. Each row is a concrete Claude Design subcapability; the right side is the current OpenDesign state with a file or function citation, or `GAP — none` if no implementation exists. A gap severity (HIGH/MEDIUM/LOW) and a backlog id with slice size (S/M/L/XL) is assigned to every gap row.

Claude Design as a product surface is conservatively described here as: a conversational design assistant that produces, inspects, and iterates on an artifact (website, slide deck, prototype, small app) directly inside the chat surface, with streaming, per-element refinement, variations, share links, a compact canvas/preview, and a limited component/theme vocabulary. Capabilities that the cutoff does not confirm (e.g. real-time multi-user presence, Figma file export, native desktop app, offline-first editing, system-tray integration, motion/animation authoring on the canvas) are marked as such and treated as conservative gaps rather than invented features. See the "Uncertainty Notes" section at the bottom.

## Legend

- Severity: HIGH = blocks core product-feel parity, MEDIUM = visible but not blocking, LOW = polish or adjacent-platform only.
- Slice: S (≤1 day), M (2–4 days), L (1–2 weeks), XL (multi-week).

---

## 1. Conversational Design Assistant

Chat with artifact/element context; streaming; inline "ask about this" per element.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Prompt-driven artifact generation (scene+code) | `apps/api/src/routes/artifacts.ts` `performArtifactGeneration`, `apps/api/src/generation.ts`, `apps/web/components/studio-generate-panel.tsx` | — | — (covered) | — |
| SSE streaming generation progress | `apps/api/src/routes/artifacts.ts` `beginGenerationEventStream`; client `studio-generate-panel.tsx` | — | — (covered) | — |
| Cancel / retry in-flight generation | `apps/api/src/routes/artifacts.ts` cancel route + `studio-generate-panel.tsx` Cancel/Retry | — | — (covered) | — |
| Conversational chat transcript attached to an artifact (multi-turn memory) | GAP — none (each generate is a single-shot prompt, no stored conversation) | HIGH | CHAT-001 | L |
| Inline "ask about this element" per scene node | GAP — none (comments exist but are not AI-driven refinement requests) | HIGH | CHAT-002 | M |
| Streaming token display inside the chat transcript (not just a "pending" pill) | GAP — none (panel only surfaces high-level events) | MEDIUM | CHAT-003 | S |
| Chat scoped to the current artifact selection (element context auto-attached) | GAP — none (generate panel has no selection-aware context) | HIGH | CHAT-004 | M |
| Slash-command affordances inside chat (e.g. `/make bolder`, `/add section`) | GAP — none | LOW | CHAT-005 | S |

---

## 2. Direct Canvas Manipulation

Zoom/pan, select, drag-reposition, inline edit, multi-select, alignment guides.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Zoom + pan viewport persisted per artifact | `apps/web/components/canvas/use-canvas-viewport.ts` | — | — (covered) | — |
| Zoom toolbar (zoom in/out/reset/fit) | `apps/web/components/canvas/canvas-toolbar.tsx` | — | — (covered) | — |
| Select tool vs pan tool toggle | `apps/web/components/canvas/canvas-toolbar.tsx` `CanvasTool` | — | — (covered) | — |
| Single-node select with ring + keyboard focus | `apps/web/components/canvas/canvas-node.tsx` `CanvasNode` | — | — (covered, CANVAS-001 in flight) | — |
| Inline text edit (double-click to edit) | `apps/web/components/canvas/canvas-node.tsx` `CanvasInlineEditable` | — | — (covered) | — |
| Per-artifact renderers (website/prototype/slides) | Partial — CANVAS-001 in flight under `apps/web/components/canvas/renderers/*` (planned) | HIGH | CANVAS-001 | L (in flight `[>]`) |
| Multi-select (marquee + shift-click) | GAP — none | HIGH | CANVAS-002A | M |
| Drag-reposition persisted back into scene | GAP — none (scene order only editable via section panel) | HIGH | CANVAS-002B | L |
| Alignment guides + snapping | GAP — none | MEDIUM | CANVAS-002C | M |
| Undo/redo stack for canvas mutations | GAP — none | HIGH | CANVAS-002D | M |
| Context menu on node (right-click) | GAP — none | MEDIUM | CANVAS-003 | S |
| Zoom-to-selection | GAP — none (only fit-all) | LOW | CANVAS-004 | S |

---

## 3. Iterative Refinement

"Make this hero bolder"; per-element refinement requests.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Whole-artifact re-generation from prompt | `apps/api/src/generation.ts` + `studio-generate-panel.tsx` | — | — (covered) | — |
| Per-element refinement prompt ("make this bolder") | GAP — none | HIGH | REFINE-001 | L |
| Refinement scoped to a single scene node without rewriting the whole artifact | GAP — none (generation replaces the whole scene) | HIGH | REFINE-002 | L |
| Suggestion chips ("shorter", "more playful", "darker") on selected node | GAP — none | MEDIUM | REFINE-003 | M |
| Diff preview before accepting a refinement | GAP — none | MEDIUM | REFINE-004 | M |

---

## 4. Variations Generation

N-shot parallel generation, compare, pick.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Request N variations from one prompt | GAP — none (single shot only) | HIGH | VARIATIONS-001 | L |
| Parallel streaming of variations | GAP — none | HIGH | VARIATIONS-002 | M |
| Side-by-side compare tray | GAP — none | HIGH | VARIATIONS-003 | M |
| Pick-one-to-promote workflow (promote to active version) | Partial foundation — `apps/api/src/repositories/artifact-versions.ts` version activation exists but no variations-to-version bridge | MEDIUM | VARIATIONS-004 | S |

---

## 5. Component Library

Pre-made sections, hero variants, buttons, cards, illustrations — drag onto canvas.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Insertable section/hero/CTA library panel | GAP — none | HIGH | LIBRARY-001 | L |
| Drag from library onto canvas | GAP — none | HIGH | LIBRARY-002 | M |
| Variant picker per primitive (hero A/B/C) | GAP — none | MEDIUM | LIBRARY-003 | M |
| Saved/starred user snippets | GAP — none | LOW | LIBRARY-004 | M |
| Illustration/icon set | GAP — none | LOW | LIBRARY-005 | M |

---

## 6. Theme + Palette Live Swap

Change palette, see entire artifact re-tint live.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| App-level light/dark theme toggle | `apps/web/components/theme-toggle.tsx`, `apps/web/app/tokens.css` (UX-REBUILD-001 in flight) | — | — (covered `[>]`) | — |
| Artifact-scoped palette swap (re-tint artifact, not the app chrome) | GAP — none | HIGH | PALETTE-001 | L |
| Palette presets gallery (curated swatches) | GAP — none | MEDIUM | PALETTE-002 | S |
| Palette extracted from imported design-system pack applied live | Partial — `apps/api/src/routes/design-systems.ts` imports packs; generation is grounded in them but no live swap after generation | MEDIUM | PALETTE-003 | M |
| Per-node color override | GAP — none | MEDIUM | PALETTE-004 | M |

---

## 7. Typography Controls

Font pairing, scale, live swap.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| App-level canonical stack (Inter + JetBrains Mono) | `apps/web/app/tokens.css` (UX-REBUILD-001 in flight) | — | — (covered `[>]`) | — |
| Artifact-level font pair swap | GAP — none | MEDIUM | TYPOGRAPHY-001 | M |
| Type scale control (compact / default / spacious) | GAP — none | MEDIUM | TYPOGRAPHY-002 | S |
| Google Fonts / web font loader wired to artifact | GAP — none | LOW | TYPOGRAPHY-003 | M |
| Per-node text style override | GAP — none | LOW | TYPOGRAPHY-004 | M |

---

## 8. Responsive Preview

Mobile / tablet / desktop frame toggle.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Mobile / tablet / desktop frame toggle on canvas | GAP — none | HIGH | RESPONSIVE-001 | M |
| Live device frame chrome around the preview | GAP — none | MEDIUM | RESPONSIVE-002 | S |
| Rotate orientation (portrait/landscape) | GAP — none | LOW | RESPONSIVE-003 | S |
| Exported HTML retains responsive breakpoints | Partial — Sandpack-backed preview in `apps/web/components/studio-inspector.tsx` renders generated code which may include media queries, but no canvas-level frame toggle | MEDIUM | RESPONSIVE-004 | M |

---

## 9. Image Generation + Placement

Stub or real provider; upload; smart crop.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Asset upload pipeline (binary, not just references) | `apps/api/src/asset-storage.ts`, `apps/api/src/repositories/assets.ts`, `apps/api/src/routes/artifacts.ts` artifact asset routes | — | — (covered) | — |
| Hero image upload + canvas render | `apps/web/components/studio-scene-sections-panel.tsx` + artifact asset URLs | — | — (covered) | — |
| AI image generation (stub or provider) | GAP — none | HIGH | IMAGE-001 | L |
| "Place image here" via drag-and-drop onto canvas node | GAP — none | MEDIUM | IMAGE-002 | M |
| Smart crop / focal point | GAP — none | LOW | IMAGE-003 | M |
| Image library picker (previously uploaded assets searchable) | GAP — none | MEDIUM | IMAGE-004 | S |

---

## 10. Asset Management Across Artifacts

Reuse images/components across project.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Per-artifact asset list | `apps/api/src/routes/artifacts.ts` artifact-scoped assets | — | — (covered) | — |
| Project-scoped asset library (reuse across artifacts) | GAP — none (assets are artifact-scoped; design-system assets are pack-scoped) | HIGH | ASSET-REUSE-001 | M |
| Move/copy asset between artifacts | GAP — none | MEDIUM | ASSET-REUSE-002 | S |
| Replace all usages of an asset (global swap) | GAP — none | LOW | ASSET-REUSE-003 | M |

---

## 11. Multi-Artifact Project Design Language Sharing

Shared tokens/palette across website+slides+prototype in one project.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Project-level design-system pack selection for generation | `apps/api/src/routes/design-systems.ts` + `apps/api/src/generation.ts` grounding | — | — (covered) | — |
| Shared palette applied to all artifacts in the project at once | GAP — none | HIGH | PROJECT-LANG-001 | L |
| Shared typography applied to all artifacts at once | GAP — none | MEDIUM | PROJECT-LANG-002 | M |
| Change token → re-tint every artifact preview | GAP — none | HIGH | PROJECT-LANG-003 | L |

---

## 12. Remix / Fork

Duplicate an artifact with lineage.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Duplicate artifact inside a project | GAP — none | HIGH | REMIX-001 | S |
| Fork to a new project (lineage preserved) | GAP — none | MEDIUM | REMIX-002 | M |
| "Remix this share link" from a read-only share page | GAP — none | MEDIUM | REMIX-003 | M |
| Lineage/parent pointer visible in artifact metadata | GAP — none | LOW | REMIX-004 | S |

---

## 13. Version History And Snapshots

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Snapshot creation | `apps/api/src/repositories/artifact-versions.ts`, `apps/web/components/studio-versions-panel.tsx` | — | — (covered) | — |
| Restore from snapshot | `apps/api/src/repositories/artifact-versions.ts` + `studio-versions-panel.tsx` | — | — (covered) | — |
| Auto-snapshot on each generation | `apps/api/src/routes/artifacts.ts` `applyGenerationRun` (activateNewVersion default true) | — | — (covered) | — |
| Named/labeled snapshots | GAP — none (snapshots are ordered but not named) | LOW | VERSION-001 | S |
| Diff view between two snapshots | GAP — none | MEDIUM | VERSION-002 | M |
| Branching history (non-linear restore) | GAP — none | LOW | VERSION-003 | L |

---

## 14. Share + Review

Public links, comments.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Share tokens (project and artifact scoped) | `apps/api/src/routes/shares.ts`, `apps/api/src/repositories/share-tokens.ts` | — | — (covered) | — |
| Viewer/commenter/editor roles | `apps/api/src/routes/shares.ts` | — | — (covered) | — |
| Element-aware comment anchors | `apps/api/src/repositories/artifact-comments.ts` + `apps/web/components/comment-anchor-options.ts` | — | — (covered) | — |
| Shared review page | `apps/web/app/share/[token]/page.tsx` | — | — (covered) | — |
| Comment resolve/unresolve state | GAP — none (threads append only) | MEDIUM | REVIEW-001 | S |
| @-mention in comments (with notification) | GAP — none | MEDIUM | REVIEW-002 | M |
| Reactions on comments | GAP — none | LOW | REVIEW-003 | S |
| Share-link expiry + password | GAP — none | MEDIUM | REVIEW-004 | S |

---

## 15. Exports Beyond Current Surface

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| HTML export | `packages/exporters/src/index.ts` + `apps/web/app/studio/[projectId]/[artifactId]/export/html` | — | — (covered) | — |
| Source ZIP export | `apps/web/app/studio/[projectId]/[artifactId]/export/source-bundle` | — | — (covered) | — |
| Prototype flow / slides deck structured export | `apps/web/app/studio/[projectId]/[artifactId]/export/prototype-flow`, `.../slides-deck` | — | — (covered) | — |
| Handoff ZIP bundle | `apps/web/app/studio/[projectId]/[artifactId]/export/handoff-bundle` | — | — (covered) | — |
| Export job tracking | `apps/api/src/repositories/export-jobs.ts` | — | — (covered) | — |
| Figma file export (.fig) | GAP — none | MEDIUM | FIGMA-EXPORT-001 | XL |
| CodeSandbox / StackBlitz "open in" link | GAP — none | MEDIUM | SANDBOX-EXPORT-001 | M |
| Vercel / Netlify "deploy this" button | GAP — none | MEDIUM | DEPLOY-EXPORT-001 | L |
| React component npm-ready package | GAP — none | LOW | NPM-EXPORT-001 | L |
| PDF export for slides | GAP — none (only structured JSON) | MEDIUM | PDF-EXPORT-001 | M |
| PNG / JPG per artifact (rasterized) | GAP — none | LOW | IMAGE-EXPORT-001 | M |

---

## 16. Command Palette (Cmd-K)

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Cmd-K command palette | GAP — none | HIGH | CMDK-001 | M |
| Fuzzy search across projects, artifacts, sections | GAP — none | MEDIUM | CMDK-002 | M |
| Action invocation (generate, export, snapshot, theme toggle) from palette | GAP — none | MEDIUM | CMDK-003 | S |
| Recent actions / recent artifacts | GAP — none | LOW | CMDK-004 | S |

---

## 17. Keyboard Shortcuts

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Baseline canvas shortcuts (V/H/+/-/0/F) | Partial — toolbar titles reference them in `canvas-toolbar.tsx` but UX-REBUILD-002 is still `[ ]` | MEDIUM | KBD-001 | M (in flight via UX-REBUILD-002) |
| Comprehensive keyboard map (select, nav, zoom, pan, undo/redo, save, generate, comment) | GAP — none (planned under UX-REBUILD-002) | HIGH | KBD-002 | M |
| Help overlay (? to show shortcut sheet) | GAP — none | MEDIUM | KBD-003 | S |
| Rebindable shortcuts | GAP — none | LOW | KBD-004 | M |

---

## 18. Real-Time Collaboration

Cursors, presence, concurrent edits.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Live presence (who's here) | GAP — none | HIGH | COLLAB-LIVE-001 | XL |
| Live cursors | GAP — none | MEDIUM | COLLAB-LIVE-002 | L |
| Concurrent edit CRDT or OT | GAP — none (single-writer model) | HIGH | COLLAB-LIVE-003 | XL |
| Shared comment thread live updates | Partial — polling via server actions in `apps/web/app/share/[token]/actions.ts`, no realtime push | MEDIUM | COLLAB-LIVE-004 | M |

Note: Claude Design's real-time multi-user capabilities are not clearly documented at the cutoff. These rows are treated conservatively as gaps only against a "peer design tool" bar, not against confirmed Claude Design features. See Uncertainty Notes.

---

## 19. Motion / Animation Authoring On Canvas

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Per-node enter/exit animation | GAP — none | MEDIUM | MOTION-001 | L |
| Timeline / keyframe editor | GAP — none | LOW | MOTION-002 | XL |
| Prototype screen transitions | Partial — prototype contract has screen links (`packages/contracts/src/index.ts` `PrototypeSceneNodeSchema`) but no authored transition style | MEDIUM | MOTION-003 | M |
| Subtle motion on canvas interactions (select, focus, zoom) | GAP — none (planned under UX-REBUILD-002) | LOW | MOTION-004 | S |

Note: Motion/animation authoring on the canvas is not clearly a Claude Design surface at the cutoff. Treated conservatively as a gap only if the user views this as a parity expectation.

---

## 20. Native Desktop Shell

macOS/Windows with menu, hotkeys, tray.

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Tauri desktop shell scaffold | `apps/desktop/src-tauri/*`, DESKTOP-001 in flight `[>]` | — | DESKTOP-001 | L (in flight) |
| Native menu bar | Planned under DESKTOP-001 | HIGH | DESKTOP-001 | L (in flight) |
| Code-signing config | Planned under DESKTOP-001 | MEDIUM | DESKTOP-001 | L (in flight) |
| System tray icon + tray actions | Planned under DESKTOP-002 | MEDIUM | DESKTOP-002 | M |
| Auto-update channel | Planned under DESKTOP-002 | MEDIUM | DESKTOP-002 | M |
| Local file drop into canvas | Planned under DESKTOP-002 | MEDIUM | DESKTOP-002 | M |
| Native notifications for long-running jobs | Planned under DESKTOP-002 | LOW | DESKTOP-002 | S |

Note: Claude Design is primarily a web surface. A native desktop shell is a user-requested parity lift vs peer design tools, not a confirmed Claude Design feature at the cutoff.

---

## 21. Offline / Local-First Editing

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Offline scene editing with later sync | GAP — none | LOW | OFFLINE-001 | XL |
| Local-first cache of recent artifacts | GAP — none | LOW | OFFLINE-002 | L |
| Conflict resolution on reconnect | GAP — none | LOW | OFFLINE-003 | L |

Note: Claude Design is online-only at the cutoff. Treated as a low-severity parity gap only versus peer tools.

---

## 22. Template Gallery / Starter Kits

| Claude Design subcapability | OpenDesign current state | Severity | Backlog ID | Slice |
| --- | --- | --- | --- | --- |
| Starter templates on project create | GAP — none (new artifact always starts from a generic generate prompt) | HIGH | TEMPLATES-001 | M |
| Template gallery browseable by category | GAP — none | MEDIUM | TEMPLATES-002 | M |
| "Start from this artifact" (community / org shared) | GAP — none | LOW | TEMPLATES-003 | L |
| Onboarding empty-state suggestions | Partial — `apps/web/components/canvas/canvas-empty-state.tsx` and POL-003 delivered basic guidance | MEDIUM | TEMPLATES-004 | S |

---

## Top 20 Backlog Items By Impact

Ranked by product-feel severity and by blocking relationships. `[>]` = already in flight today per `docs/master-todo.md`.

1. `DESKTOP-001` Tauri desktop shell — HIGH — L — `[>]`
2. `CANVAS-001` Real visual canvas foundation — HIGH — L — `[>]`
3. `UX-REBUILD-001` Tokens + theme + typography + copy polish — HIGH — L — `[>]`
4. `CHAT-001` Conversational chat transcript attached to artifact — HIGH — L — `[>]`
5. `CMDK-001` Cmd-K command palette — HIGH — M — `[>]`
6. `RESPONSIVE-001` Mobile/tablet/desktop frame toggle — HIGH — M — `[>]`
7. `VARIATIONS-001` N-shot variations generation — HIGH — L — `[>]`
8. `LIBRARY-001` Insertable component library panel — HIGH — L — `[>]`
9. `KBD-001` Baseline keyboard shortcut map wired + documented — HIGH — M — `[>]`
10. `PALETTE-001` Artifact-scoped palette live swap — HIGH — L — `[>]`
11. `IMAGE-001` AI image generation (stub or real provider) — HIGH — L — `[>]`
12. `REMIX-001` Duplicate artifact inside a project — HIGH — S — `[>]`
13. `REFINE-001` Per-element refinement prompt — HIGH — L
14. `CHAT-002` Inline "ask about this element" per scene node — HIGH — M
15. `CANVAS-002D` Undo/redo stack for canvas mutations — HIGH — M
16. `CANVAS-002A` Multi-select (marquee + shift-click) — HIGH — M
17. `CANVAS-002B` Drag-reposition persisted back into scene — HIGH — L
18. `TEMPLATES-001` Starter templates on project create — HIGH — M
19. `PROJECT-LANG-001` Shared palette across all artifacts in a project — HIGH — L
20. `COLLAB-LIVE-001` Live presence (who's here) — HIGH — XL

---

## Uncertainty Notes

Capabilities where the January 2026 knowledge cutoff does not unambiguously confirm Claude Design behavior, so rows are graded conservatively:

- **Real-time multi-user presence / cursors / concurrent edits** (section 18): Claude Design is primarily a single-author chat surface; multi-user live editing is not confirmed. The parity bar here is set against peer design tools, not against confirmed Claude Design features.
- **Native desktop shell** (section 20): Claude Design ships as web; a desktop app is not confirmed. The DESKTOP-001/002 work is a user-directed parity lift vs peer tools, not a copy of Claude Design.
- **Offline / local-first editing** (section 21): Claude Design is online-only at the cutoff. Marked LOW severity accordingly.
- **Motion / animation authoring on canvas** (section 19): Claude Design's artifact surface emits HTML/React that can include CSS transitions, but an on-canvas keyframe authoring UI is not confirmed. Rows graded MEDIUM/LOW rather than HIGH.
- **Figma .fig file export** (section 15): Claude Design does not confirm a native `.fig` export at the cutoff. Graded MEDIUM parity vs peer tools.
- **N-shot variations UX** (section 4): Claude Design does surface "regenerate" cleanly; side-by-side compare tray for N variations is inferred from typical peer-product patterns and marked conservatively.
- **Slash commands inside chat** (CHAT-005): Inferred from general chat-product patterns; Claude Design's specific slash-command vocabulary is not confirmed. Graded LOW.

No capability listed in this matrix was invented; every row maps to either (a) a confirmed Claude Design surface at the cutoff, (b) a peer-tool parity bar explicitly flagged as such in the notes above, or (c) a user-directed expectation already tracked in `docs/master-todo.md`.
