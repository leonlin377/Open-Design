import {
  ArtifactAssetSchema,
  type ArtifactAsset
} from "@opendesign/contracts";
import {
  ImageGenerationRequestSchema,
  ImageGenerationResultSchema,
  ImageGenerationStreamEventSchema,
  type ImageGenerationError,
  type ImageGenerationResult,
  type ImageGenerationStreamEvent
} from "@opendesign/contracts/src/image-generation";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildAssetObjectKey, type AssetStorage } from "../asset-storage";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { AssetRepository } from "../repositories/assets";
import type { ProjectRepository } from "../repositories/projects";
import {
  ImageProviderError,
  type ImageProvider
} from "../image-provider";

export interface ArtifactImageRouteOptions {
  assets: AssetRepository;
  assetStorage: AssetStorage;
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  auth: OpenDesignAuth;
  imageProvider: ImageProvider;
}

const paramsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

function sendImageError(
  reply: FastifyReply,
  statusCode: number,
  error: ImageGenerationError
) {
  return reply.code(statusCode).send(error);
}

function buildImageError(input: ImageGenerationError): ImageGenerationError {
  return {
    error: input.error,
    code: input.code,
    recoverable: input.recoverable,
    ...(input.details ? { details: input.details } : {})
  };
}

function wantsEventStream(request: FastifyRequest): boolean {
  const accept = request.headers.accept ?? "";
  return accept.includes("text/event-stream");
}

interface ImageStreamSession {
  writeEvent(event: ImageGenerationStreamEvent): void;
  close(): void;
}

function beginImageStream(reply: FastifyReply): ImageStreamSession {
  reply.hijack();
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  if (typeof reply.raw.flushHeaders === "function") {
    reply.raw.flushHeaders();
  }

  let closed = false;
  reply.raw.on("close", () => {
    closed = true;
  });

  return {
    writeEvent(event) {
      if (closed) {
        return;
      }
      const parsed = ImageGenerationStreamEventSchema.parse(event);
      reply.raw.write(`data: ${JSON.stringify(parsed)}\n\n`);
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      reply.raw.end();
    }
  };
}

function mapArtifactAsset(record: {
  id: string;
  artifactId: string | null;
  ownerUserId: string | null;
  kind: "design-system-screenshot" | "artifact-upload";
  filename: string | null;
  storageProvider: "memory" | "s3";
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}): ArtifactAsset {
  return ArtifactAssetSchema.parse({
    id: record.id,
    artifactId: record.artifactId,
    ownerUserId: record.ownerUserId,
    kind: record.kind,
    filename: record.filename,
    storageProvider: record.storageProvider,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

function buildImageFilename(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `${slug || "image"}-${suffix}.png`;
}

export const registerArtifactImageRoutes: FastifyPluginAsync<ArtifactImageRouteOptions> =
  async (app, options) => {
    async function resolveAuthorizedArtifact(
      request: FastifyRequest,
      input: { projectId: string; artifactId: string }
    ) {
      const session = await getRequestSession(options.auth, request);
      const project = await options.projects.getById(input.projectId);

      if (!project) {
        return { session, project: null, artifact: null };
      }

      if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
        return { session, project: null, artifact: null };
      }

      const artifact = await options.artifacts.getById(
        input.projectId,
        input.artifactId
      );
      return { session, project, artifact };
    }

    async function runGeneration(input: {
      prompt: string;
      style?: string | undefined;
      size?: string | undefined;
      artifactId: string;
      ownerUserId: string | null;
      signal?: AbortSignal;
    }): Promise<ImageGenerationResult> {
      let providerResult;
      try {
        providerResult = await options.imageProvider.generate({
          prompt: input.prompt,
          ...(input.style !== undefined ? { style: input.style } : {}),
          ...(input.size !== undefined ? { size: input.size } : {}),
          ...(input.signal ? { signal: input.signal } : {})
        });
      } catch (error) {
        if (error instanceof ImageProviderError) {
          throw {
            error: error.message,
            code: "IMAGE_PROVIDER_FAILURE" as const,
            recoverable: true,
            details: { stage: "generate" }
          } satisfies ImageGenerationError;
        }
        throw error;
      }

      const filename = buildImageFilename(input.prompt);
      const objectKey = buildAssetObjectKey({
        scope: "artifacts",
        artifactId: input.artifactId,
        sourceRef: `${input.prompt}:${Date.now()}:${filename}`,
        contentType: providerResult.contentType
      });

      let uploaded;
      try {
        uploaded = await options.assetStorage.uploadObject({
          objectKey,
          bytes: providerResult.bytes,
          contentType: providerResult.contentType
        });
      } catch (error) {
        throw {
          error:
            error instanceof Error
              ? `Failed to persist generated image bytes: ${error.message}`
              : "Failed to persist generated image bytes.",
          code: "IMAGE_GENERATION_PERSIST_FAILURE" as const,
          recoverable: true,
          details: { stage: "upload" }
        } satisfies ImageGenerationError;
      }

      let created;
      try {
        created = await options.assets.create({
          ownerUserId: input.ownerUserId,
          artifactId: input.artifactId,
          kind: "artifact-upload",
          filename,
          storageProvider: options.assetStorage.provider,
          objectKey: uploaded.objectKey,
          contentType: uploaded.contentType,
          sizeBytes: uploaded.sizeBytes
        });
      } catch (error) {
        throw {
          error:
            error instanceof Error
              ? `Failed to persist generated image metadata: ${error.message}`
              : "Failed to persist generated image metadata.",
          code: "IMAGE_GENERATION_PERSIST_FAILURE" as const,
          recoverable: true,
          details: { stage: "metadata" }
        } satisfies ImageGenerationError;
      }

      const asset = mapArtifactAsset(created);

      return ImageGenerationResultSchema.parse({
        asset,
        provider: providerResult.provider,
        prompt: input.prompt,
        width: providerResult.width,
        height: providerResult.height,
        warning: providerResult.warning ?? null
      });
    }

    app.post(
      "/projects/:projectId/artifacts/:artifactId/images/generate",
      async (request, reply) => {
        const params = paramsSchema.parse(request.params);
        const body = ImageGenerationRequestSchema.parse(request.body);
        const { project, artifact, session } = await resolveAuthorizedArtifact(
          request,
          params
        );

        if (!project) {
          return sendImageError(reply, 404, {
            error: "Project not found",
            code: "IMAGE_GENERATION_VALIDATION",
            recoverable: false,
            details: { stage: "project-lookup" }
          });
        }

        if (!artifact) {
          return sendImageError(reply, 404, {
            error: "Artifact not found",
            code: "IMAGE_GENERATION_VALIDATION",
            recoverable: false,
            details: { stage: "artifact-lookup" }
          });
        }

        const ownerUserId = session?.user.id ?? null;

        if (wantsEventStream(request)) {
          const stream = beginImageStream(reply);
          try {
            stream.writeEvent({
              type: "started",
              message: "Image generation started."
            });
            stream.writeEvent({
              type: "generating",
              message: `Rendering image for prompt: ${body.prompt.slice(0, 80)}`
            });
            const result = await runGeneration({
              prompt: body.prompt,
              style: body.style,
              size: body.size,
              artifactId: artifact.id,
              ownerUserId
            });
            stream.writeEvent({
              type: "persisting",
              message: "Persisting generated asset bytes."
            });
            stream.writeEvent({
              type: "completed",
              message: "Image generation completed.",
              result
            });
          } catch (error) {
            const apiError = normalizeImageError(error);
            stream.writeEvent({
              type: "failed",
              message: apiError.error,
              error: apiError
            });
          } finally {
            stream.close();
          }
          return;
        }

        try {
          const result = await runGeneration({
            prompt: body.prompt,
            style: body.style,
            size: body.size,
            artifactId: artifact.id,
            ownerUserId
          });
          return reply.code(201).send(result);
        } catch (error) {
          const apiError = normalizeImageError(error);
          const statusCode = statusForImageError(apiError.code);
          return sendImageError(reply, statusCode, apiError);
        }
      }
    );
  };

function normalizeImageError(error: unknown): ImageGenerationError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "error" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return buildImageError(error as ImageGenerationError);
  }
  if (error instanceof ImageProviderError) {
    return buildImageError({
      error: error.message,
      code: "IMAGE_PROVIDER_FAILURE",
      recoverable: true
    });
  }
  return buildImageError({
    error:
      error instanceof Error ? error.message : "Unknown image generation failure",
    code: "IMAGE_PROVIDER_FAILURE",
    recoverable: true
  });
}

function statusForImageError(code: ImageGenerationError["code"]): number {
  switch (code) {
    case "IMAGE_PROVIDER_FAILURE":
      return 502;
    case "IMAGE_GENERATION_PERSIST_FAILURE":
      return 500;
    case "IMAGE_GENERATION_VALIDATION":
      return 404;
    default:
      return 500;
  }
}
