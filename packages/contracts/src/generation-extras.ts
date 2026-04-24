import { z } from "zod";
import {
  ApiErrorSchema,
  ArtifactGenerationDiagnosticsSchema,
  ArtifactGenerationPlanSchema,
  ArtifactGenerateResponseSchema,
  SceneDocumentSchema,
  SceneNodeSchema,
  type ApiError,
  type ArtifactGenerateResponse,
  type ArtifactGenerationDiagnostics,
  type ArtifactGenerationPlan,
  type SceneDocument,
  type SceneNode
} from "./index";

// See the note in `./remix.ts` — `./index` now re-exports this module via the
// barrel, so referencing these schemas directly at module top level can race
// with the partially-evaluated index. Defer with `z.lazy` so the ordering of
// re-exports cannot break schema initialisation.
const LazyApiErrorSchema: z.ZodType<ApiError> = z.lazy(() => ApiErrorSchema);
const LazyArtifactGenerationDiagnosticsSchema: z.ZodType<ArtifactGenerationDiagnostics> =
  z.lazy(() => ArtifactGenerationDiagnosticsSchema);
const LazyArtifactGenerationPlanSchema: z.ZodType<ArtifactGenerationPlan> = z.lazy(
  () => ArtifactGenerationPlanSchema
);
const LazyArtifactGenerateResponseSchema: z.ZodType<ArtifactGenerateResponse> =
  z.lazy(() => ArtifactGenerateResponseSchema);
const LazySceneDocumentSchema: z.ZodType<SceneDocument> = z.lazy(
  () => SceneDocumentSchema
);
const LazySceneNodeSchema: z.ZodType<SceneNode> = z.lazy(() => SceneNodeSchema);

/**
 * A single proposed variation returned by the `/generate/variations` endpoint.
 * The backend holds the candidate SceneDocument in-memory keyed by
 * `variationId` until the caller accepts it — the preview response itself
 * carries the full SceneDocument shape so the UI can render the 3-up cards
 * without a second round-trip.
 */
export const ArtifactGenerationVariationSchema = z.object({
  variationId: z.string().min(1),
  label: z.string().min(1),
  tone: z.string().min(1),
  plan: LazyArtifactGenerationPlanSchema,
  diagnostics: LazyArtifactGenerationDiagnosticsSchema,
  sceneDocument: LazySceneDocumentSchema,
  appendedNodes: z.array(LazySceneNodeSchema)
});

export const ArtifactGenerationVariationsRequestSchema = z.object({
  prompt: z.string().min(1),
  count: z.number().int().min(1).max(5).optional()
});

export const ArtifactGenerationVariationsResponseSchema = z.object({
  variations: z.array(ArtifactGenerationVariationSchema).min(1).max(5),
  diagnostics: LazyArtifactGenerationDiagnosticsSchema
});

export const ArtifactVariationAcceptRequestSchema = z.object({
  variationId: z.string().min(1)
});

/** The accept path reuses the exact `/generate` response shape. */
export const ArtifactVariationAcceptResponseSchema = LazyArtifactGenerateResponseSchema;

export const ArtifactRefineRequestSchema = z.object({
  nodeId: z.string().min(1),
  instruction: z.string().min(1)
});

/**
 * The refine endpoint streams SSE using the same event shape reused from
 * `ArtifactGenerateStreamEventSchema`: started / planning / applying /
 * completed / failed. We re-export ArtifactGenerateStreamEventSchema directly
 * rather than minting new kinds — the "completed" event's `result` carries the
 * refreshed workspace so the client can render the post-commit state in one
 * round-trip.
 */
export const ArtifactRefineResponseSchema = LazyArtifactGenerateResponseSchema;

export const ArtifactRefineStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("planning"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("applying"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("completed"),
    message: z.string().min(1),
    result: LazyArtifactGenerateResponseSchema
  }),
  z.object({
    type: z.literal("failed"),
    message: z.string().min(1),
    error: LazyApiErrorSchema,
    retry: z
      .discriminatedUnion("retryable", [
        z.object({
          retryable: z.literal(true),
          nodeId: z.string().min(1),
          instruction: z.string().min(1)
        }),
        z.object({
          retryable: z.literal(false)
        })
      ])
      .optional()
  })
]);

export type ArtifactGenerationVariation = z.infer<
  typeof ArtifactGenerationVariationSchema
>;
export type ArtifactGenerationVariationsRequest = z.infer<
  typeof ArtifactGenerationVariationsRequestSchema
>;
export type ArtifactGenerationVariationsResponse = z.infer<
  typeof ArtifactGenerationVariationsResponseSchema
>;
export type ArtifactVariationAcceptRequest = z.infer<
  typeof ArtifactVariationAcceptRequestSchema
>;
export type ArtifactVariationAcceptResponse = z.infer<
  typeof ArtifactVariationAcceptResponseSchema
>;
export type ArtifactRefineRequest = z.infer<typeof ArtifactRefineRequestSchema>;
export type ArtifactRefineResponse = z.infer<typeof ArtifactRefineResponseSchema>;
export type ArtifactRefineStreamEvent = z.infer<
  typeof ArtifactRefineStreamEventSchema
>;
