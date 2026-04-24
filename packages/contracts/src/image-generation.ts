import { z } from "zod";
import { ArtifactAssetSchema, type ArtifactAsset } from "./index";

// See the note in `./remix.ts` — `./index` now re-exports this module via the
// barrel, so referencing `ArtifactAssetSchema` directly at module top level
// can race with the partial index evaluation. `z.lazy` defers the lookup
// until parse-time, by which point both modules are fully evaluated.
const LazyArtifactAssetSchema: z.ZodType<ArtifactAsset> = z.lazy(
  () => ArtifactAssetSchema
);

/**
 * Image-generation-specific error codes. Kept local to this file rather than
 * folded into the shared `ApiErrorCodeSchema` so the contracts barrel stays
 * stable for downstream consumers; callers that want a single union can merge
 * this with `ApiErrorCodeSchema` at the call site.
 */
export const ImageGenerationErrorCodeSchema = z.enum([
  "IMAGE_PROVIDER_FAILURE",
  "IMAGE_GENERATION_VALIDATION",
  "IMAGE_GENERATION_PERSIST_FAILURE"
]);

export const ImageGenerationErrorSchema = z.object({
  error: z.string().min(1),
  code: ImageGenerationErrorCodeSchema,
  recoverable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional()
});

export type ImageGenerationErrorCode = z.infer<typeof ImageGenerationErrorCodeSchema>;
export type ImageGenerationError = z.infer<typeof ImageGenerationErrorSchema>;

/**
 * Request payload for an artifact-scoped image generation pass. Consumed by
 * `POST /api/projects/:projectId/artifacts/:artifactId/images/generate` and by
 * the studio image picker client helpers.
 *
 * `style` is an optional free-form hint (e.g. "cinematic", "flat-illustration")
 * passed through to the upstream provider. `size` follows the OpenAI-style
 * `WIDTHxHEIGHT` convention; callers unaware of a concrete size should omit it
 * and let the server/default provider choose.
 */
export const ImageGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  style: z.string().min(1).optional(),
  size: z
    .string()
    .regex(/^\d{2,5}x\d{2,5}$/u, "size must be formatted as WIDTHxHEIGHT")
    .optional()
});

export const ImageGenerationProviderSchema = z.enum(["litellm", "heuristic"]);

/**
 * Result shape returned on successful image generation. The persisted
 * `ArtifactAsset` is the primary handle — scene nodes reference it by id via
 * the existing `imageAssetId` prop. `provider` lets clients distinguish a
 * real LiteLLM/OpenAI-compatible render from the deterministic heuristic
 * fallback that runs without any upstream provider configured.
 */
export const ImageGenerationResultSchema = z.object({
  asset: LazyArtifactAssetSchema,
  provider: ImageGenerationProviderSchema,
  prompt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  warning: z.string().min(1).nullable().default(null)
});

/**
 * SSE lifecycle events emitted by the streaming endpoint. Mirrors the shape of
 * `ArtifactGenerateStreamEventSchema` so clients can reuse their event-source
 * plumbing. Non-streaming callers simply read the terminal `completed` payload
 * as the JSON response body.
 */
export const ImageGenerationStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("generating"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("persisting"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("completed"),
    message: z.string().min(1),
    result: ImageGenerationResultSchema
  }),
  z.object({
    type: z.literal("failed"),
    message: z.string().min(1),
    error: ImageGenerationErrorSchema
  })
]);

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;
export type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;
export type ImageGenerationProvider = z.infer<typeof ImageGenerationProviderSchema>;
export type ImageGenerationStreamEvent = z.infer<
  typeof ImageGenerationStreamEventSchema
>;
