import { z } from "zod";
import { ArtifactSummarySchema, type ArtifactSummary } from "./index";

// Guarded lazy reference — `./index` also re-exports this module (by the
// barrel additions in Round 4), so the initial evaluation of `z.object(...)`
// below can race with `ArtifactSummarySchema` still being undefined on the
// partially-evaluated index. Wrapping the reference in `z.lazy` defers the
// lookup until `.parse()` is called, by which time both modules are fully
// evaluated. The explicit type annotation keeps the inferred shape stable.
const LazyArtifactSummarySchema: z.ZodType<ArtifactSummary> = z.lazy(
  () => ArtifactSummarySchema
);

// -----------------------------------------------------------------------------
// Artifact Remix / Fork — duplicate an artifact with lineage tracking.
//
// A remix creates a fully independent artifact that reuses the source's
// workspace (intent, scene, code workspace), version history (re-stamped with
// new ids), comments (imported as resolved-at-fork) and asset references
// (linked by reference — the underlying bytes are NOT duplicated).
//
// The resulting artifact carries an `ArtifactLineage` that remembers which
// artifact + project it was forked from so the UI can surface a breadcrumb
// and callers can follow the fork tree.
// -----------------------------------------------------------------------------

export const ArtifactRemixRequestSchema = z.object({
  /** Optional target project. Defaults to the source artifact's project. */
  targetProjectId: z.string().min(1).optional(),
  /** Optional replacement name for the forked artifact. */
  nameOverride: z.string().min(1).optional()
});

export const ArtifactLineageSchema = z.object({
  sourceArtifactId: z.string().min(1),
  sourceProjectId: z.string().min(1),
  forkedAt: z.string().min(1)
});

export const ArtifactRemixResponseSchema = z.object({
  artifact: LazyArtifactSummarySchema,
  lineage: ArtifactLineageSchema
});

export type ArtifactRemixRequest = z.infer<typeof ArtifactRemixRequestSchema>;
export type ArtifactLineage = z.infer<typeof ArtifactLineageSchema>;
export type ArtifactRemixResponse = z.infer<typeof ArtifactRemixResponseSchema>;
