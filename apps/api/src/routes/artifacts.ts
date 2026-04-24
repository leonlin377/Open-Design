import {
  ArtifactAssetSchema,
  ArtifactCommentResolutionSchema,
  ArtifactCodePatchSchema,
  ArtifactGenerateResponseSchema,
  ArtifactGenerateStreamEventSchema,
  ArtifactGenerationRunSchema,
  ArtifactWorkspacePayloadSchema,
  ArtifactVersionDiffSummarySchema,
  ArtifactKindSchema,
  ArtifactGenerationPlanSchema,
  ArtifactScenePatchSchema,
  ArtifactVersionSourceSchema,
  CommentAnchorSchema,
  SceneTemplateKindSchema,
  type ArtifactComment,
  type ArtifactGenerateResponse,
  type ArtifactGenerateStreamEvent,
  type ArtifactSceneTemplateKind,
  type SceneNode,
  type ArtifactVersionSnapshot
} from "@opendesign/contracts";
import {
  buildFreeformCodeWorkspace,
  planSyncPatch,
  syncCodeToSceneDocument,
  syncSceneToCodeWorkspace
} from "@opendesign/code-sync";
import {
  buildArtifactHandoffBundle,
  buildArtifactHtmlExport,
  buildArtifactSourceBundle,
  buildPrototypeFlowExport,
  buildSlidesDeckExport
} from "@opendesign/exporters";
import {
  appendRootSceneNode,
  buildPrototypeScreen,
  buildPrototypeScreenCta,
  buildPrototypeScreenLink,
  buildSlide,
  buildWebsiteSection,
  createEmptySceneDocument,
  indexSceneNodesById,
  updateRootSceneNode
} from "@opendesign/scene-engine";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ArtifactGenerationError,
  generateArtifactPlan,
  generateFreeformCode,
  summarizeDesignSystemForGeneration,
  type FreeformCodeGenerationResult
} from "../generation";
import { buildAssetObjectKey, type AssetStorage } from "../asset-storage";
import { buildApiError, sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { AssetRepository } from "../repositories/assets";
import type { DesignSystemRepository } from "../repositories/design-systems";
import type { ExportJobRepository } from "../repositories/export-jobs";
import type { ProjectRepository } from "../repositories/projects";

const artifactParamsSchema = z.object({
  projectId: z.string().min(1)
});

const artifactDetailParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

const createArtifactBodySchema = z.object({
  name: z.string().min(1),
  kind: ArtifactKindSchema
});

const createArtifactVersionBodySchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1).optional(),
  source: ArtifactVersionSourceSchema.default("manual")
});

const createArtifactCommentBodySchema = z.object({
  body: z.string().min(1),
  anchor: CommentAnchorSchema
});

const generateArtifactBodySchema = z.object({
  prompt: z.string().min(1)
});

const appendSceneTemplateBodySchema = z.object({
  template: SceneTemplateKindSchema
});

const sceneNodeParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1),
  nodeId: z.string().min(1)
});

const updateSceneNodeBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    eyebrow: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    items: z
      .array(
        z.object({
          label: z.string().min(1),
          body: z.string().min(1)
        })
      )
      .optional(),
    primaryAction: z.string().min(1).optional(),
    secondaryAction: z.string().min(1).optional(),
    imageAssetId: z.string().min(1).optional(),
    imageAlt: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
  });

const saveCodeWorkspaceBodySchema = z.object({
  files: z.record(z.string(), z.string()),
  expectedUpdatedAt: z.string().min(1).nullable().optional()
});

const attachDesignSystemBodySchema = z.object({
  designSystemPackId: z.string().min(1).nullable()
});

const requiredCodeWorkspaceFiles = [
  "/App.tsx",
  "/main.tsx",
  "/styles.css",
  "/index.html",
  "/package.json"
] as const;

const artifactCommentParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1),
  commentId: z.string().min(1)
});

const artifactVersionParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1),
  versionId: z.string().min(1)
});

const artifactAssetParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1),
  assetId: z.string().min(1)
});

const createArtifactAssetBodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  bytesBase64: z.string().min(1),
  nodeId: z.string().min(1).optional(),
  alt: z.string().min(1).optional()
});

export interface ArtifactRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  designSystems: DesignSystemRepository;
  exportJobs: ExportJobRepository;
  assets: AssetRepository;
  assetStorage: AssetStorage;
  auth: OpenDesignAuth;
  /**
   * Optional shared in-flight registry. When supplied, the primary /generate
   * route persists its `InFlightGeneration` entries here instead of into a
   * plugin-local Map so sibling plugins (e.g. artifact-generation-extras)
   * can enforce the same per-artifact / per-user concurrency gates. When
   * absent (tests that only spin up this plugin), a local Map is used.
   */
  activeGenerations?: Map<string, unknown>;
}

// Per-process default for per-user concurrency cap. The env var is read at
// request time so tests can override it without rebuilding the app.
const DEFAULT_GENERATION_MAX_CONCURRENT_PER_USER = 2;

function readGenerationConcurrencyCap(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_GENERATION_MAX_CONCURRENT_PER_USER;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_GENERATION_MAX_CONCURRENT_PER_USER;
  }
  return Math.floor(value);
}

interface InFlightGeneration {
  artifactId: string;
  userKey: string;
  prompt: string;
  designSystemPackId: string | null;
  controller: AbortController;
  /** Marked true once the generation has committed durable state. */
  completed: boolean;
}

export const registerArtifactRoutes: FastifyPluginAsync<ArtifactRouteOptions> =
  async (app, options) => {
    // In-process generation registry. Keyed by artifactId — at most one
    // in-flight run per artifact. A second per-user counter is derived from
    // this map so we only need one source of truth. When the caller provides
    // a shared map (the production wiring does), we reuse it so the
    // generation-extras plugin can enforce the same quota/409 state.
    const activeGenerations = (options.activeGenerations ??
      new Map<string, InFlightGeneration>()) as Map<string, InFlightGeneration>;

    function countUserGenerations(userKey: string): number {
      let count = 0;
      for (const run of activeGenerations.values()) {
        if (run.userKey === userKey) {
          count += 1;
        }
      }
      return count;
    }

    function userKeyForSession(
      session: { user?: { id?: string | null } } | null | undefined
    ): string {
      return session?.user?.id ?? "__anonymous__";
    }

    function clearGenerationIfCurrent(artifactId: string, run: InFlightGeneration) {
      // Only drop the slot if the map still points at *our* run. This guards
      // against the race where a cancel arrives after we completed but before
      // we removed ourselves — the cancel handler already overwrote the entry
      // (or removed it), and we mustn't clobber a later run.
      const current = activeGenerations.get(artifactId);
      if (current === run) {
        activeGenerations.delete(artifactId);
      }
    }

    const exportKindToResult = {
      html: {
        filename: "artifact.html",
        contentType: "text/html; charset=utf-8"
      },
      "source-bundle": {
        filename: "artifact-source.zip",
        contentType: "application/zip"
      },
      "handoff-bundle": {
        filename: "artifact-handoff.zip",
        contentType: "application/zip"
      },
      "prototype-flow": {
        filename: "prototype-flow.json",
        contentType: "application/json; charset=utf-8"
      },
      "slides-deck": {
        filename: "slides-deck.json",
        contentType: "application/json; charset=utf-8"
      }
    } as const;

    async function createExportJob(input: {
      artifactId: string;
      exportKind: keyof typeof exportKindToResult;
      requestId?: string | null;
    }) {
      const created = await options.exportJobs.create({
        artifactId: input.artifactId,
        exportKind: input.exportKind,
        requestId: input.requestId ?? null
      });
      await options.exportJobs.markRunning(created.id);
      return created.id;
    }

    async function markExportJobCompleted(
      jobId: string,
      exportKind: keyof typeof exportKindToResult
    ) {
      await options.exportJobs.markCompleted(jobId, exportKindToResult[exportKind]);
    }

    async function markExportJobFailed(jobId: string, error: Parameters<typeof buildApiError>[0]) {
      await options.exportJobs.markFailed(jobId, buildApiError(error));
    }

    function mapArtifactAsset(record: Awaited<ReturnType<typeof options.assets.getById>>) {
      return ArtifactAssetSchema.parse({
        id: record!.id,
        artifactId: record!.artifactId,
        ownerUserId: record!.ownerUserId,
        kind: record!.kind,
        filename: record!.filename,
        storageProvider: record!.storageProvider,
        contentType: record!.contentType,
        sizeBytes: record!.sizeBytes,
        createdAt: record!.createdAt,
        updatedAt: record!.updatedAt
      });
    }

    async function listArtifactAssets(input: {
      artifactId: string;
      ownerUserId?: string | null;
    }) {
      const records = await options.assets.listByArtifactId(input.artifactId, {
        ownerUserId: input.ownerUserId ?? undefined
      });

      return records.map((record) =>
        ArtifactAssetSchema.parse({
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
        })
      );
    }

    type EnsuredWorkspace = NonNullable<
      Awaited<ReturnType<typeof ensureWorkspaceState>>["workspace"]
    >;

    function buildTemplateNode(input: {
      artifact: {
        id: string;
        kind: z.infer<typeof ArtifactKindSchema>;
        name: string;
      };
      intent: string;
      template: ArtifactSceneTemplateKind;
      designSystemName?: string | null;
      priorPrototypeScreenId?: string | null;
    }): SceneNode {
      const nodeId = `${input.template}_${crypto.randomUUID()}`;

      if (input.artifact.kind === "website") {
        if (
          input.template !== "hero" &&
          input.template !== "feature-grid" &&
          input.template !== "cta"
        ) {
          throw new Error(
            `Website artifacts cannot consume the "${input.template}" template.`
          );
        }

        if (input.template === "hero") {
          return buildWebsiteSection({
            id: nodeId,
            template: "hero",
            name: "Hero Section",
            props: {
              eyebrow: input.designSystemName
                ? `${input.designSystemName} System`
                : "Launch Surface",
              headline: input.designSystemName
                ? `${input.artifact.name} adopts ${input.designSystemName} hierarchy.`
                : `${input.artifact.name} leads with cinematic hierarchy.`,
              body: input.intent
            }
          });
        }

        if (input.template === "feature-grid") {
          return buildWebsiteSection({
            id: nodeId,
            template: "feature-grid",
            name: "Feature Grid",
            props: {
              title: input.designSystemName
                ? `${input.designSystemName} system lanes`
                : "Artifact system lanes",
              items: [
                {
                  label: "Scene",
                  body: "Sections stay versioned and ready for review snapshots."
                },
                {
                  label: "Design",
                  body: "Brand rhythm and layout motifs stay attached to the workspace."
                },
                {
                  label: "Export",
                  body: "Preview, handoff, and export flows derive from one source of truth."
                }
              ]
            }
          });
        }

        return buildWebsiteSection({
          id: nodeId,
          template: "cta",
          name: "Call To Action",
          props: {
            headline: input.designSystemName
              ? `Ready to ship ${input.designSystemName} fidelity?`
              : "Ready for the next review pass?",
            body: "Promote the current artifact into a snapshot, then push it toward export.",
            primaryAction: "Create Snapshot",
            secondaryAction: "Export Handoff"
          }
        });
      }

      // Backward-compat: legacy callers (append-template endpoint, web UI)
      // still send website template kinds for prototype/slides artifacts.
      // Map them transparently onto the typed node kinds so appended nodes
      // match the artifact-kind scene schema.
      const resolvedTemplate: ArtifactSceneTemplateKind =
        input.artifact.kind === "prototype" && input.template === "hero"
          ? "screen"
          : input.artifact.kind === "prototype" && input.template === "feature-grid"
            ? "screen"
            : input.artifact.kind === "prototype" && input.template === "cta"
              ? "screen-cta"
              : input.artifact.kind === "slides" && input.template === "hero"
                ? "slide-title"
                : input.artifact.kind === "slides" && input.template === "feature-grid"
                  ? "slide-content"
                  : input.artifact.kind === "slides" && input.template === "cta"
                    ? "slide-closing"
                    : input.template;

      if (input.artifact.kind === "prototype") {
        if (resolvedTemplate === "screen") {
          return buildPrototypeScreen({
            id: nodeId,
            name: "Hero Screen",
            eyebrow: input.designSystemName
              ? `${input.designSystemName} Flow`
              : "Flow Surface",
            headline: input.designSystemName
              ? `${input.artifact.name} adopts ${input.designSystemName} hierarchy.`
              : `${input.artifact.name} leads with a navigable opener.`,
            body: input.intent
          });
        }

        if (resolvedTemplate === "screen-link") {
          return buildPrototypeScreenLink({
            id: nodeId,
            from: input.priorPrototypeScreenId ?? "entry",
            to: `screen_target_${crypto.randomUUID().slice(0, 8)}`,
            trigger: "tap",
            name: "Flow Transition"
          });
        }

        if (resolvedTemplate === "screen-cta") {
          return buildPrototypeScreenCta({
            id: nodeId,
            name: "Action Screen",
            headline: input.designSystemName
              ? `Confirm the ${input.designSystemName} experience.`
              : "Confirm the next step.",
            primaryAction: "Continue",
            secondaryAction: "Back"
          });
        }

        throw new Error(
          `Prototype artifacts cannot consume the "${resolvedTemplate}" template.`
        );
      }

      // slides
      if (
        resolvedTemplate !== "slide-title" &&
        resolvedTemplate !== "slide-content" &&
        resolvedTemplate !== "slide-closing"
      ) {
        throw new Error(
          `Slides artifacts cannot consume the "${resolvedTemplate}" template.`
        );
      }

      const slideHeadline =
        resolvedTemplate === "slide-title"
          ? input.designSystemName
            ? `${input.artifact.name} — ${input.designSystemName} system`
            : `${input.artifact.name}`
          : resolvedTemplate === "slide-content"
            ? input.designSystemName
              ? `${input.designSystemName} system lanes`
              : "System lanes"
            : "Ready for the next review pass?";

      const slideBody =
        resolvedTemplate === "slide-title"
          ? input.intent
          : resolvedTemplate === "slide-content"
            ? "Scene, design, and export flows derive from one source of truth."
            : "Promote the current deck into a snapshot, then push it toward export.";

      return buildSlide({
        id: nodeId,
        role: resolvedTemplate,
        headline: slideHeadline,
        body: slideBody,
        ...(resolvedTemplate === "slide-content"
          ? {
              bullets: [
                "Sections stay versioned and ready for review snapshots.",
                "Brand rhythm and layout motifs stay attached to the workspace.",
                "Preview, handoff, and export flows derive from one source of truth."
              ]
            }
          : {})
      });
    }

    function buildSeedIntent(artifact: { kind: string; name: string }) {
      const lead =
        artifact.kind === "website"
          ? "Build a cinematic website surface"
          : artifact.kind === "prototype"
            ? "Build a navigable prototype flow"
            : "Build a narrative slide deck";

      return `${lead} for ${artifact.name} with bold typography, clear hierarchy, and export-ready structure.`;
    }

    function buildSeedVersionSummary(artifact: { kind: string; name: string }) {
      return `Seeded ${artifact.kind} workspace for ${artifact.name} from artifact metadata.`;
    }

    function attachDesignSystemMetadata(input: {
      sceneDocument: EnsuredWorkspace["sceneDocument"];
      designSystemPackId: string | null;
    }) {
      return {
        ...input.sceneDocument,
        metadata: {
          ...input.sceneDocument.metadata,
          ...(input.designSystemPackId
            ? {
                designSystemPackId: input.designSystemPackId
              }
            : {})
        }
      };
    }

    function clearDesignSystemMetadata(input: {
      sceneDocument: EnsuredWorkspace["sceneDocument"];
    }) {
      const { designSystemPackId: _ignored, ...metadata } = input.sceneDocument.metadata;

      return {
        ...input.sceneDocument,
        metadata
      };
    }

    async function resolveAuthorizedArtifact(
      request: FastifyRequest,
      input: {
        projectId: string;
        artifactId: string;
      }
    ) {
      const { project, session } = await resolveAuthorizedProject(request, input.projectId);

      if (!project) {
        return {
          session,
          project: null,
          artifact: null
        };
      }

      const artifact = await options.artifacts.getById(input.projectId, input.artifactId);

      return {
        session,
        project,
        artifact
      };
    }

    function wantsGenerationEventStream(request: FastifyRequest) {
      const accept = request.headers.accept ?? "";
      return accept.includes("text/event-stream");
    }

    interface GenerationEventStreamSession {
      writeEvent: (event: ArtifactGenerateStreamEvent) => void;
      close: () => void;
      isClosed: () => boolean;
      onTimeout: (handler: () => void) => void;
      clearDeadline: () => void;
    }

    function readGenerationReadTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
      const value = Number(env.OPENDESIGN_GENERATION_TIMEOUT_MS ?? "15000");
      return Number.isFinite(value) && value > 0 ? value : 15000;
    }

    function readGenerationSessionTimeoutMs(
      env: NodeJS.ProcessEnv = process.env
    ): number {
      const override = Number(env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS ?? "");
      if (Number.isFinite(override) && override > 0) {
        return override;
      }
      return readGenerationReadTimeoutMs(env) * 2;
    }

    function beginGenerationEventStream(
      reply: FastifyReply,
      request: FastifyRequest,
      options: { sessionTimeoutMs?: number } = {}
    ): GenerationEventStreamSession {
      reply.hijack();
      const origin = request.headers.origin;
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        ...(origin ? {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true"
        } : {})
      });

      if (typeof reply.raw.flushHeaders === "function") {
        reply.raw.flushHeaders();
      }

      let closed = false;
      let timeoutHandler: (() => void) | null = null;

      const writeEvent = (event: ArtifactGenerateStreamEvent) => {
        if (closed) {
          return;
        }
        reply.raw.write(
          `data: ${JSON.stringify(ArtifactGenerateStreamEventSchema.parse(event))}\n\n`
        );
      };

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (deadline) {
          clearTimeout(deadline);
          deadline = null;
        }
        reply.raw.end();
      };

      const sessionTimeoutMs = options.sessionTimeoutMs ?? readGenerationSessionTimeoutMs();
      let deadline: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        deadline = null;
        if (timeoutHandler) {
          timeoutHandler();
        }
      }, sessionTimeoutMs);

      // If the socket is closed by the client, stop writes and cancel the deadline.
      reply.raw.on("close", () => {
        closed = true;
        if (deadline) {
          clearTimeout(deadline);
          deadline = null;
        }
      });

      return {
        writeEvent,
        close,
        isClosed: () => closed,
        onTimeout: (handler) => {
          timeoutHandler = handler;
        },
        clearDeadline: () => {
          if (deadline) {
            clearTimeout(deadline);
            deadline = null;
          }
        }
      };
    }

    function generationStatusForCode(code: string): number {
      switch (code) {
        case "GENERATION_TIMEOUT":
          return 504;
        case "GENERATION_PROVIDER_FAILURE":
          return 502;
        case "INVALID_GENERATION_PLAN":
        case "INVALID_SCENE_PATCH":
          return 422;
        case "GENERATION_CANCELLED":
          // Cancels are client-driven — the request itself is unprocessable
          // in that no artifact change was made.
          return 422;
        case "GENERATION_ALREADY_RUNNING":
          return 409;
        case "GENERATION_QUOTA_EXCEEDED":
          return 429;
        default:
          return 500;
      }
    }

    function mapGenerationFailure(error: unknown) {
      if (error instanceof ArtifactGenerationError) {
        const apiError = buildApiError({
          error: error.message,
          code: error.code,
          recoverable: error.recoverable,
          ...(error.details
            ? {
                details: error.details
              }
            : {})
        });

        return {
          statusCode: generationStatusForCode(error.code),
          apiError
        };
      }

      if (error && typeof error === "object" && "code" in error && "error" in error) {
        const apiError = buildApiError(error as Parameters<typeof buildApiError>[0]);
        return {
          statusCode: generationStatusForCode(apiError.code),
          apiError
        };
      }

      return {
        statusCode: 500,
        apiError: buildApiError({
          error: "Artifact generation failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "generate"
          }
        })
      };
    }

    async function ensureWorkspaceState(artifact: {
      id: string;
      kind: z.infer<typeof ArtifactKindSchema>;
      name: string;
    }) {
      let workspace = await options.workspaces.getByArtifactId(artifact.id);
      let versions = await options.versions.listByArtifactId(artifact.id);

      if (!workspace) {
        const sceneDocument = createEmptySceneDocument({
          id: `scene_${crypto.randomUUID()}`,
          artifactId: artifact.id,
          kind: artifact.kind
        });
        const seedVersion = await options.versions.create({
          artifactId: artifact.id,
          label: "V1 Seed",
          summary: buildSeedVersionSummary(artifact),
          source: "seed",
          sceneVersion: sceneDocument.version,
          sceneDocument,
          codeWorkspace: null
        });

        workspace = await options.workspaces.create({
          artifactId: artifact.id,
          intent: buildSeedIntent(artifact),
          activeVersionId: seedVersion.id,
          sceneDocument
        });
        versions = [seedVersion];
      } else if (versions.length === 0) {
        const seedVersion = await options.versions.create({
          artifactId: artifact.id,
          label: "V1 Seed",
          summary: buildSeedVersionSummary(artifact),
          source: "seed",
          sceneVersion: workspace.sceneDocument.version,
          sceneDocument: workspace.sceneDocument,
          codeWorkspace: workspace.codeWorkspace
        });

        workspace =
          (await options.workspaces.updateActiveVersion(artifact.id, seedVersion.id)) ?? workspace;
        versions = [seedVersion];
      } else if (!workspace.activeVersionId) {
        workspace =
          (await options.workspaces.updateActiveVersion(artifact.id, versions[0]!.id)) ?? workspace;
      }

      const comments = await options.comments.listByArtifactId(artifact.id);
      return {
        workspace,
        versions,
        comments
      };
    }

    async function performArtifactGeneration(input: {
      artifact: {
        id: string;
        kind: z.infer<typeof ArtifactKindSchema>;
        name: string;
      };
      prompt: string;
      signal?: AbortSignal;
      onDesignSystemResolved?: (packId: string | null) => void;
      onProgress?: (
        event: Extract<ArtifactGenerateStreamEvent, { type: "planning" | "applying" }>
      ) => Promise<void> | void;
    }): Promise<ArtifactGenerateResponse> {
      const throwIfCancelled = () => {
        if (input.signal?.aborted) {
          throw new ArtifactGenerationError({
            message: "Generation was cancelled before it could commit.",
            code: "GENERATION_CANCELLED",
            details: {
              stage: "generate"
            }
          });
        }
      };

      const { workspace, versions, comments } = await ensureWorkspaceState(input.artifact);
      throwIfCancelled();
      const selectedDesignSystemPackId =
        workspace.sceneDocument.metadata.designSystemPackId ?? null;
      input.onDesignSystemResolved?.(selectedDesignSystemPackId);
      const selectedDesignSystem = selectedDesignSystemPackId
        ? await options.designSystems.getById(selectedDesignSystemPackId)
        : null;
      const generationDesignSystem = selectedDesignSystem
        ? summarizeDesignSystemForGeneration(selectedDesignSystem)
        : undefined;

      const generationMode = (process.env.OPENDESIGN_GENERATION_MODE ?? "freeform") as
        | "template"
        | "freeform";

      if (generationMode === "freeform") {
        await input.onProgress?.({
          type: "planning",
          message: generationDesignSystem
            ? `Generating freeform code with ${generationDesignSystem.name} grounding.`
            : "Generating freeform React + Tailwind code from the current prompt."
        });

        const freeformResult: FreeformCodeGenerationResult = await generateFreeformCode({
          artifactKind: input.artifact.kind,
          artifactName: input.artifact.name,
          prompt: input.prompt,
          designSystem: generationDesignSystem,
          signal: input.signal
        });
        throwIfCancelled();

        const freeformNodeId = `freeform_${crypto.randomUUID()}`;
        const freeformNode: SceneNode = {
          id: freeformNodeId,
          type: "freeform",
          name: "Freeform Component",
          props: { generationMode: "freeform" },
          children: []
        };
        const freeformSceneDocument = appendRootSceneNode(
          workspace.sceneDocument,
          freeformNode
        );

        await input.onProgress?.({
          type: "applying",
          message: "Applying freeform generated code and persisting a prompt snapshot."
        });

        const freeformWorkspace = buildFreeformCodeWorkspace({
          artifactName: input.artifact.name,
          freeformFiles: freeformResult.files,
          sceneVersion: freeformSceneDocument.version
        });

        throwIfCancelled();

        const freeformCodeWorkspace = {
          files: freeformWorkspace.files,
          baseSceneVersion: freeformWorkspace.baseSceneVersion,
          updatedAt: new Date().toISOString()
        };

        const freeformApplyResult = await options.workspaces.applyGenerationRun({
          artifactId: input.artifact.id,
          intent: freeformResult.intent,
          sceneDocument: freeformSceneDocument,
          codeWorkspace: freeformCodeWorkspace,
          activateNewVersion: true,
          version: {
            label: `Prompt ${versions.length + 1}`,
            summary: `Generated from prompt: ${input.prompt.slice(0, 120)}`,
            source: "prompt",
            sceneVersion: freeformSceneDocument.version,
            sceneDocument: freeformSceneDocument,
            codeWorkspace: freeformCodeWorkspace
          }
        });

        if (!freeformApplyResult) {
          throw buildApiError({
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: { stage: "generate" }
          });
        }

        const { workspace: activeFreeformWorkspace, version: freeformVersion } =
          freeformApplyResult;

        const freeformGenerationRun = ArtifactGenerationRunSchema.parse({
          plan: {
            prompt: input.prompt,
            intent: freeformResult.intent,
            rationale: freeformResult.rationale,
            mode: "freeform",
            provider: freeformResult.diagnostics.provider,
            ...(generationDesignSystem ? { designSystem: generationDesignSystem } : {})
          },
          diagnostics: freeformResult.diagnostics,
          scenePatch: ArtifactScenePatchSchema.parse({
            mode: "freeform-inject",
            rationale: "Injected a freeform placeholder node into the scene document.",
            appendedNodes: [
              {
                id: freeformNode.id,
                type: freeformNode.type,
                name: freeformNode.name,
                template: "freeform"
              }
            ]
          }),
          codePatch: ArtifactCodePatchSchema.parse({
            mode: "synced",
            rationale: "Code workspace created directly from LLM-generated freeform code.",
            filesTouched: Object.keys(freeformWorkspace.files).sort()
          }),
          commentResolution: ArtifactCommentResolutionSchema.parse({
            mode: "none",
            rationale: "Prompt generation does not resolve open review comments yet.",
            resolvedCommentIds: []
          })
        });

        return ArtifactGenerateResponseSchema.parse({
          generation: freeformGenerationRun,
          version: freeformVersion,
          workspace: buildWorkspacePayload({
            artifactKind: input.artifact.kind,
            workspace: activeFreeformWorkspace,
            versions: [freeformVersion, ...versions],
            comments
          })
        });
      }

      await input.onProgress?.({
        type: "planning",
        message: generationDesignSystem
          ? `Generating an artifact plan from the current prompt with ${generationDesignSystem.name} grounding.`
          : "Generating an artifact plan from the current prompt."
      });

      const generation = await generateArtifactPlan({
        artifactKind: input.artifact.kind,
        artifactName: input.artifact.name,
        prompt: input.prompt,
        designSystem: generationDesignSystem,
        signal: input.signal
      });
      throwIfCancelled();
      const plan = ArtifactGenerationPlanSchema.parse(generation.plan);

      let sceneDocument = workspace.sceneDocument;
      const appendedNodes: SceneNode[] = [];

      try {
        let priorPrototypeScreenId: string | null = null;
        for (const template of plan.sections ?? []) {
          const node = buildTemplateNode({
            artifact: input.artifact,
            intent: plan.intent,
            template,
            designSystemName: plan.designSystem?.name ?? null,
            priorPrototypeScreenId
          });
          sceneDocument = appendRootSceneNode(sceneDocument, node);
          appendedNodes.push(node);
          if (
            input.artifact.kind === "prototype" &&
            (node.type === "screen" || node.type === "screen-cta")
          ) {
            priorPrototypeScreenId = node.id;
          }
        }

        indexSceneNodesById(sceneDocument.nodes);
      } catch (error) {
        throw buildApiError({
          error: "Generation produced an invalid scene patch.",
          code: "INVALID_SCENE_PATCH",
          recoverable: true,
          details: {
            stage: "apply-scene",
            ...(error instanceof Error
              ? {
                  reason: error.message
                }
              : {})
          }
        });
      }

      await input.onProgress?.({
        type: "applying",
        message: `Applying ${appendedNodes.length} generated sections and persisting a prompt snapshot.`
      });

      // Pre-compute the scene-derived code sync decision so we can package the
      // resulting code workspace into a single atomic commit below.
      const codeSyncDecision = syncSceneToCodeWorkspace({
        artifactKind: input.artifact.kind,
        artifactName: input.artifact.name,
        previousIntent: workspace.intent,
        nextIntent: plan.intent,
        previousSceneDocument: workspace.sceneDocument,
        nextSceneDocument: sceneDocument,
        currentCodeWorkspace: workspace.codeWorkspace
      });

      const nextCodeWorkspace =
        codeSyncDecision.applied && codeSyncDecision.codeWorkspace
          ? {
              files: codeSyncDecision.codeWorkspace.files,
              baseSceneVersion: codeSyncDecision.codeWorkspace.baseSceneVersion,
              // updatedAt is assigned inside the atomic commit below.
              updatedAt: new Date().toISOString()
            }
          : workspace.codeWorkspace;

      // Last chance to bail before the atomic commit — a cancel that races
      // past this check still lets the commit run, but any post-commit work
      // (code-sync, activeVersion update) short-circuits on the same signal.
      throwIfCancelled();

      // Fold intent + scene + codeWorkspace + version + activeVersionId into
      // one atomic commit so a crash mid-generation cannot leave the workspace
      // in an observably torn state (intent updated without scene, scene
      // updated without matching active version, etc.).
      const applyResult = await options.workspaces.applyGenerationRun({
        artifactId: input.artifact.id,
        intent: plan.intent,
        sceneDocument,
        codeWorkspace:
          codeSyncDecision.applied && codeSyncDecision.codeWorkspace
            ? {
                files: codeSyncDecision.codeWorkspace.files,
                baseSceneVersion: codeSyncDecision.codeWorkspace.baseSceneVersion,
                updatedAt: new Date().toISOString()
              }
            : undefined,
        activateNewVersion: true,
        version: {
          label: `Prompt ${versions.length + 1}`,
          summary: `Generated from prompt: ${input.prompt.slice(0, 120)}`,
          source: "prompt",
          sceneVersion: sceneDocument.version,
          sceneDocument,
          codeWorkspace: nextCodeWorkspace
        }
      });

      if (!applyResult) {
        throw buildApiError({
          error: "Workspace update failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "generate"
          }
        });
      }

      const { workspace: activeWorkspace, version } = applyResult;

      const generationRun = ArtifactGenerationRunSchema.parse({
        plan,
        diagnostics: generation.diagnostics,
        scenePatch: ArtifactScenePatchSchema.parse({
          mode: appendedNodes.length > 0 ? "append-root-sections" : "no-op",
          rationale: "Append the generated section stack to the root scene document.",
          appendedNodes: appendedNodes.map((node) => {
            // Prototype / slides nodes encode their template kind in `node.type`.
            // Website sections carry the template kind in `node.props.template`.
            const typedKind =
              node.type === "screen" ||
              node.type === "screen-link" ||
              node.type === "screen-cta" ||
              node.type === "slide-title" ||
              node.type === "slide-content" ||
              node.type === "slide-closing"
                ? node.type
                : node.props.template === "feature-grid" ||
                    node.props.template === "cta" ||
                    node.props.template === "hero"
                  ? node.props.template
                  : "hero";
            return {
              id: node.id,
              type: node.type,
              name: node.name,
              template: typedKind
            };
          })
        }),
        codePatch: ArtifactCodePatchSchema.parse({
          mode: codeSyncDecision.applied ? "synced" : "unchanged",
          rationale: codeSyncDecision.reason,
          filesTouched: codeSyncDecision.filesTouched
        }),
        commentResolution: ArtifactCommentResolutionSchema.parse({
          mode: "none",
          rationale: "Prompt generation does not resolve open review comments yet.",
          resolvedCommentIds: []
        })
      });

      return ArtifactGenerateResponseSchema.parse({
        generation: generationRun,
        version,
        workspace: buildWorkspacePayload({
          artifactKind: input.artifact.kind,
          workspace: activeWorkspace,
          versions: [version, ...versions],
          comments
        })
      });
    }

    function buildWorkspacePayload(input: {
      artifactKind: z.infer<typeof ArtifactKindSchema>;
      workspace: EnsuredWorkspace;
      versions: ArtifactVersionSnapshot[];
      comments: ArtifactComment[];
    }) {
      const syncPlan = planSyncPatch({
        sourceMode: "scene",
        targetMode:
          input.artifactKind === "website" ? "code-supported" : "code-advanced",
        changeScope: "document"
      });

      return {
        artifactId: input.workspace.artifactId,
        intent: input.workspace.intent,
        activeVersionId: input.workspace.activeVersionId,
        sceneDocument: input.workspace.sceneDocument,
        codeWorkspace: input.workspace.codeWorkspace,
        syncPlan,
        versionCount: input.versions.length,
        openCommentCount: input.comments.filter((comment) => comment.status === "open").length,
        updatedAt: input.workspace.updatedAt
      };
    }

    function buildVersionDiffSummary(input: {
      versionId: string;
      comparedSceneDocument: {
        version: number;
        nodes: SceneNode[];
      };
      currentSceneDocument: {
        version: number;
        nodes: SceneNode[];
      };
      comparedCodeWorkspace: {
        files: Record<string, string>;
      } | null;
      currentCodeWorkspace: {
        files: Record<string, string>;
      } | null;
      againstVersionId: string | null;
    }) {
      const comparedNodes = indexSceneNodesById(input.comparedSceneDocument.nodes);
      const currentNodes = indexSceneNodesById(input.currentSceneDocument.nodes);

      let addedNodeCount = 0;
      let removedNodeCount = 0;
      let changedNodeCount = 0;

      for (const [nodeId, currentNode] of currentNodes) {
        const comparedNode = comparedNodes.get(nodeId);

        if (!comparedNode) {
          addedNodeCount += 1;
          continue;
        }

        if (
          currentNode.name !== comparedNode.name ||
          JSON.stringify(currentNode.props) !== JSON.stringify(comparedNode.props)
        ) {
          changedNodeCount += 1;
        }
      }

      for (const nodeId of comparedNodes.keys()) {
        if (!currentNodes.has(nodeId)) {
          removedNodeCount += 1;
        }
      }

      const comparedFiles = input.comparedCodeWorkspace?.files ?? {};
      const currentFiles = input.currentCodeWorkspace?.files ?? {};
      const allFilePaths = new Set([
        ...Object.keys(comparedFiles),
        ...Object.keys(currentFiles)
      ]);
      let changedFileCount = 0;

      for (const filePath of allFilePaths) {
        if ((comparedFiles[filePath] ?? null) !== (currentFiles[filePath] ?? null)) {
          changedFileCount += 1;
        }
      }

      return ArtifactVersionDiffSummarySchema.parse({
        versionId: input.versionId,
        againstVersionId: input.againstVersionId,
        scene: {
          addedNodeCount,
          removedNodeCount,
          changedNodeCount,
          currentVersion: input.currentSceneDocument.version,
          comparedVersion: input.comparedSceneDocument.version
        },
        code: {
          changedFileCount,
          comparedHasCodeWorkspace: Boolean(input.comparedCodeWorkspace),
          currentHasCodeWorkspace: Boolean(input.currentCodeWorkspace)
        }
      });
    }

    async function applySceneDerivedCodeWorkspaceSync(input: {
      artifact: {
        id: string;
        kind: z.infer<typeof ArtifactKindSchema>;
        name: string;
      };
      previousWorkspace: EnsuredWorkspace;
      nextIntent: string;
      nextSceneDocument: EnsuredWorkspace["sceneDocument"];
      stage: string;
    }) {
      const decision = syncSceneToCodeWorkspace({
        artifactKind: input.artifact.kind,
        artifactName: input.artifact.name,
        previousIntent: input.previousWorkspace.intent,
        nextIntent: input.nextIntent,
        previousSceneDocument: input.previousWorkspace.sceneDocument,
        nextSceneDocument: input.nextSceneDocument,
        currentCodeWorkspace: input.previousWorkspace.codeWorkspace
      });

      if (!decision.applied || !decision.codeWorkspace) {
        return {
          decision,
          workspace: null
        };
      }

      const updatedWorkspace = await options.workspaces.updateCodeWorkspace(
        input.artifact.id,
        decision.codeWorkspace
      );

      if (!updatedWorkspace) {
        throw buildApiError({
          error: "Workspace update failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: input.stage
          }
        });
      }

      return {
        decision,
        workspace: updatedWorkspace
      };
    }

    async function resolveAuthorizedProject(request: FastifyRequest, projectId: string) {
      const session = await getRequestSession(options.auth, request);
      const project = await options.projects.getById(projectId);

      if (!project) {
        return {
          session,
          project: null
        };
      }

      if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
        return {
          session,
          project: null
        };
      }

      return {
        session,
        project
      };
    }

    app.get("/projects/:projectId/artifacts", async (request) => {
      const params = artifactParamsSchema.parse(request.params);
      const { project } = await resolveAuthorizedProject(request, params.projectId);

      if (!project) {
        return [];
      }

      return options.artifacts.listByProject(params.projectId);
    });

    app.get("/projects/:projectId/artifacts/:artifactId", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const { project } = await resolveAuthorizedProject(request, params.projectId);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      const artifact = await options.artifacts.getById(params.projectId, params.artifactId);

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      return artifact;
    });

    app.get("/projects/:projectId/artifacts/:artifactId/workspace", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const { artifact, project, session } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const { workspace, versions, comments } = await ensureWorkspaceState(artifact);
      const assets = await listArtifactAssets({
        artifactId: artifact.id,
        ownerUserId: session?.user.id ?? undefined
      });

      return ArtifactWorkspacePayloadSchema.parse({
        artifact,
        workspace: buildWorkspacePayload({
          artifactKind: artifact.kind,
          workspace,
          versions,
          comments
        }),
        versions,
        comments,
        assets
      });
    });

    app.get("/projects/:projectId/artifacts/:artifactId/assets", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const { artifact, project, session } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      return listArtifactAssets({
        artifactId: artifact.id,
        ownerUserId: session?.user.id ?? undefined
      });
    });

    app.post("/projects/:projectId/artifacts/:artifactId/assets", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = createArtifactAssetBodySchema.parse(request.body);
      const { artifact, project, session } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const bytes = Buffer.from(body.bytesBase64, "base64");
      const objectKey = buildAssetObjectKey({
        scope: "artifacts",
        artifactId: artifact.id,
        sourceRef: body.filename,
        contentType: body.contentType
      });
      const uploaded = await options.assetStorage.uploadObject({
        objectKey,
        bytes,
        contentType: body.contentType
      });
      const created = await options.assets.create({
        ownerUserId: session?.user.id ?? null,
        artifactId: artifact.id,
        kind: "artifact-upload",
        filename: body.filename,
        storageProvider: options.assetStorage.provider,
        objectKey: uploaded.objectKey,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes
      });

      return reply.status(201).send(mapArtifactAsset(created));
    });

    app.get(
      "/projects/:projectId/artifacts/:artifactId/assets/:assetId",
      async (request, reply) => {
        const params = artifactAssetParamsSchema.parse(request.params);
        const { artifact, project, session } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const asset = await options.assets.getById(params.assetId, {
          ownerUserId: session?.user.id ?? undefined
        });

        if (!asset || asset.artifactId !== artifact.id) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const stored = await options.assetStorage.readObject({
          objectKey: asset.objectKey
        });

        if (!stored) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        reply.header("content-type", stored.contentType);
        return reply.send(Buffer.from(stored.bytes));
      }
    );

    app.post(
      "/projects/:projectId/artifacts/:artifactId/design-system",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const body = attachDesignSystemBodySchema.parse(request.body);
        const { artifact, project, session } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        if (body.designSystemPackId) {
          const pack = await options.designSystems.getById(body.designSystemPackId, {
            ownerUserId: session?.user.id ?? undefined
          });

          if (!pack) {
            return sendApiError(reply, 404, {
              error: "Design system pack not found",
              code: "DESIGN_SYSTEM_IMPORT_FAILED",
              recoverable: true
            });
          }
        }

        const { workspace, versions, comments } = await ensureWorkspaceState(artifact);
        const nextSceneDocument = body.designSystemPackId
          ? attachDesignSystemMetadata({
              sceneDocument: workspace.sceneDocument,
              designSystemPackId: body.designSystemPackId
            })
          : clearDesignSystemMetadata({
              sceneDocument: workspace.sceneDocument
            });
        const updatedWorkspace = await options.workspaces.updateSceneDocument(
          artifact.id,
          nextSceneDocument
        );

        if (!updatedWorkspace) {
          return sendApiError(reply, 422, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: {
              stage: "attach-design-system"
            }
          });
        }

        return reply.send({
          workspace: buildWorkspacePayload({
            artifactKind: artifact.kind,
            workspace: updatedWorkspace,
            versions,
            comments
          })
        });
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/exports/html",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const exportJobId = await createExportJob({
          artifactId: artifact.id,
          exportKind: "html",
          requestId: request.requestId
        });
        const { workspace } = await ensureWorkspaceState(artifact);
        const bundle = buildArtifactHtmlExport({
          artifactName: artifact.name,
          sceneDocument: workspace.sceneDocument,
          prompt: workspace.intent
        });
        await markExportJobCompleted(exportJobId, "html");

        reply.header("content-type", "text/html; charset=utf-8");
        reply.header(
          "content-disposition",
          `attachment; filename="${bundle.filename.replaceAll('"', "")}"`
        );

        return reply.send(bundle.html);
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/exports/source-bundle",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const exportJobId = await createExportJob({
          artifactId: artifact.id,
          exportKind: "source-bundle",
          requestId: request.requestId
        });
        const { workspace } = await ensureWorkspaceState(artifact);
        const generatedBundle = buildArtifactSourceBundle({
          artifactKind: artifact.kind,
          artifactName: artifact.name,
          prompt: workspace.intent,
          sceneNodes: workspace.sceneDocument.nodes
        });
        const bundle = workspace.codeWorkspace
          ? {
              ...generatedBundle,
              files: workspace.codeWorkspace.files
            }
          : generatedBundle;
        await markExportJobCompleted(exportJobId, "source-bundle");

        return reply.send(bundle);
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/exports/handoff-bundle",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const exportJobId = await createExportJob({
          artifactId: artifact.id,
          exportKind: "handoff-bundle",
          requestId: request.requestId
        });
        const { workspace, versions, comments } = await ensureWorkspaceState(artifact);
        const bundle = buildArtifactHandoffBundle({
          project,
          artifact,
          workspace: buildWorkspacePayload({
            artifactKind: artifact.kind,
            workspace,
            versions,
            comments
          }),
          versions,
          comments
        });
        await markExportJobCompleted(exportJobId, "handoff-bundle");

        return reply.send(bundle);
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/exports/prototype-flow",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const exportJobId = await createExportJob({
          artifactId: artifact.id,
          exportKind: "prototype-flow",
          requestId: request.requestId
        });
        if (artifact.kind !== "prototype") {
          await markExportJobFailed(exportJobId, {
            error: "Prototype flow export is only available for prototype artifacts",
            code: "EXPORT_NOT_SUPPORTED",
            recoverable: true
          });
          return sendApiError(reply, 409, {
            error: "Prototype flow export is only available for prototype artifacts",
            code: "EXPORT_NOT_SUPPORTED",
            recoverable: true
          });
        }

        const { workspace } = await ensureWorkspaceState(artifact);
        const bundle = buildPrototypeFlowExport({
          artifactName: artifact.name,
          sceneDocument: workspace.sceneDocument,
          prompt: workspace.intent
        });
        await markExportJobCompleted(exportJobId, "prototype-flow");

        reply.header("content-type", "application/json; charset=utf-8");
        reply.header(
          "content-disposition",
          `attachment; filename="${artifact.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "prototype"}-flow.json"`
        );

        return reply.send(bundle);
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/exports/slides-deck",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const exportJobId = await createExportJob({
          artifactId: artifact.id,
          exportKind: "slides-deck",
          requestId: request.requestId
        });
        if (artifact.kind !== "slides") {
          await markExportJobFailed(exportJobId, {
            error: "Slides deck export is only available for slides artifacts",
            code: "EXPORT_NOT_SUPPORTED",
            recoverable: true
          });
          return sendApiError(reply, 409, {
            error: "Slides deck export is only available for slides artifacts",
            code: "EXPORT_NOT_SUPPORTED",
            recoverable: true
          });
        }

        const { workspace } = await ensureWorkspaceState(artifact);
        const bundle = buildSlidesDeckExport({
          artifactName: artifact.name,
          sceneDocument: workspace.sceneDocument,
          prompt: workspace.intent
        });
        await markExportJobCompleted(exportJobId, "slides-deck");

        reply.header("content-type", "application/json; charset=utf-8");
        reply.header(
          "content-disposition",
          `attachment; filename="${artifact.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "slides"}-deck.json"`
        );

        return reply.send(bundle);
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/export-jobs",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const jobs = await options.exportJobs.listByArtifactId(artifact.id);
        return reply.send({ jobs });
      }
    );

    app.post("/projects/:projectId/artifacts", async (request, reply) => {
      const params = artifactParamsSchema.parse(request.params);
      const body = createArtifactBodySchema.parse(request.body);
      const { project } = await resolveAuthorizedProject(request, params.projectId);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      const artifact = await options.artifacts.create({
        projectId: params.projectId,
        name: body.name,
        kind: body.kind
      });
      return reply.code(201).send(artifact);
    });

    app.post("/projects/:projectId/artifacts/:artifactId/versions", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = createArtifactVersionBodySchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const { workspace } = await ensureWorkspaceState(artifact);
      const version = await options.versions.create({
        artifactId: artifact.id,
        label: body.label,
        summary: body.summary ?? `Snapshot created from ${artifact.name}.`,
        source: body.source,
        sceneVersion: workspace.sceneDocument.version,
        sceneDocument: workspace.sceneDocument,
        codeWorkspace: workspace.codeWorkspace
      });

      await options.workspaces.updateActiveVersion(artifact.id, version.id);
      return reply.code(201).send(version);
    });

    app.post("/projects/:projectId/artifacts/:artifactId/generate", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = generateArtifactBodySchema.parse(request.body);
      const { artifact, project, session: userSession } =
        await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const userKey = userKeyForSession(userSession);
      const concurrencyCap = readGenerationConcurrencyCap();

      // Gate 1: at most one active generation per artifact.
      if (activeGenerations.has(artifact.id)) {
        return sendApiError(reply, 409, {
          error: "A generation is already running for this artifact.",
          code: "GENERATION_ALREADY_RUNNING",
          recoverable: false,
          details: {
            artifactId: artifact.id
          }
        });
      }

      // Gate 2: per-user quota across all artifacts.
      const runningForUser = countUserGenerations(userKey);
      if (runningForUser >= concurrencyCap) {
        reply.header("retry-after", "5");
        return sendApiError(reply, 429, {
          error: `You already have ${runningForUser} of ${concurrencyCap} generations running.`,
          code: "GENERATION_QUOTA_EXCEEDED",
          recoverable: true,
          details: {
            running: runningForUser,
            limit: concurrencyCap,
            retryAfterSeconds: 5
          }
        });
      }

      // Register the in-flight run. The AbortController is shared with the
      // upstream LiteLLM fetch and with the `performArtifactGeneration` body
      // so a cancel interrupts both.
      const controller = new AbortController();
      const run: InFlightGeneration = {
        artifactId: artifact.id,
        userKey,
        prompt: body.prompt,
        // designSystemPackId is resolved lazily once we load the workspace,
        // so the cancel/retry payload can reflect the true pack the run was
        // bound to — not just whatever was attached at request time.
        designSystemPackId: null,
        controller,
        completed: false
      };
      activeGenerations.set(artifact.id, run);

      const buildRetryPayload = (code: string) => {
        // Explicit allow-list: only these failure codes invite a client
        // retry with the same inputs. GENERATION_ALREADY_RUNNING is
        // deliberately excluded — the client must wait, not retry.
        const retryable =
          code === "GENERATION_TIMEOUT" ||
          code === "GENERATION_CANCELLED" ||
          code === "GENERATION_PROVIDER_FAILURE" ||
          code === "INVALID_GENERATION_PLAN" ||
          code === "INVALID_SCENE_PATCH" ||
          code === "WORKSPACE_UPDATE_FAILED";

        if (!retryable) {
          return { retryable: false as const };
        }

        return {
          retryable: true as const,
          prompt: body.prompt,
          ...(run.designSystemPackId
            ? { designSystemPackId: run.designSystemPackId }
            : {})
        };
      };

      request.raw.on("close", () => {
        if (!run.completed) {
          controller.abort();
        }
      });

      if (wantsGenerationEventStream(request)) {
        const generationMode = (process.env.OPENDESIGN_GENERATION_MODE ?? "freeform") as
          | "template"
          | "freeform";
        const freeformSessionTimeoutMs = generationMode === "freeform" ? 240000 : undefined;
        const streamSession = beginGenerationEventStream(reply, request, {
          ...(freeformSessionTimeoutMs ? { sessionTimeoutMs: freeformSessionTimeoutMs } : {})
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          streamSession.onTimeout(() => {
            const timeoutError = new ArtifactGenerationError({
              message:
                "Generation session exceeded its deadline before the pipeline completed.",
              code: "GENERATION_TIMEOUT",
              details: {
                stage: "generate-session"
              }
            });
            reject(timeoutError);
          });
        });

        try {
          streamSession.writeEvent({
            type: "started",
            message: "Generation pass started."
          });

          const result = await Promise.race([
            performArtifactGeneration({
              artifact,
              prompt: body.prompt,
              signal: controller.signal,
              onDesignSystemResolved: (packId) => {
                run.designSystemPackId = packId;
              },
              onProgress: async (event) => {
                streamSession.writeEvent(event);
              }
            }),
            timeoutPromise
          ]);

          run.completed = true;
          streamSession.writeEvent({
            type: "completed",
            message: `Generated ${result.generation.scenePatch.appendedNodes.length} sections and refreshed the workspace.`,
            result
          });
        } catch (error) {
          const { apiError } = mapGenerationFailure(error);
          streamSession.writeEvent({
            type: "failed",
            message: apiError.error,
            error: apiError,
            retry: buildRetryPayload(apiError.code)
          });
        } finally {
          clearGenerationIfCurrent(artifact.id, run);
          streamSession.clearDeadline();
          streamSession.close();
        }

        return;
      }

      try {
        const result = await performArtifactGeneration({
          artifact,
          prompt: body.prompt,
          signal: controller.signal,
          onDesignSystemResolved: (packId) => {
            run.designSystemPackId = packId;
          }
        });
        run.completed = true;
        return reply.code(201).send(result);
      } catch (error) {
        const { statusCode, apiError } = mapGenerationFailure(error);
        return sendApiError(reply, statusCode, apiError);
      } finally {
        clearGenerationIfCurrent(artifact.id, run);
      }
    });

    app.post(
      "/projects/:projectId/artifacts/:artifactId/generate/cancel",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const { artifact, project, session: userSession } =
          await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const run = activeGenerations.get(artifact.id);
        if (!run) {
          return sendApiError(reply, 404, {
            error: "No active generation to cancel for this artifact.",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false,
            details: {
              artifactId: artifact.id,
              stage: "cancel"
            }
          });
        }

        // Authorisation: a cancel must come from the same user (or anonymous
        // caller) who started the run. Without this any session could cancel
        // anyone else's run on an artifact they can otherwise see.
        const callerKey = userKeyForSession(userSession);
        if (run.userKey !== callerKey) {
          return sendApiError(reply, 403, {
            error: "Only the initiating user may cancel this generation.",
            code: "SHARE_ROLE_FORBIDDEN",
            recoverable: false
          });
        }

        // Signal the run to abort. The run handler's `finally` clause will
        // clear the map slot; we don't delete here so the race where this
        // cancel arrives *after* the run already completed but before its
        // `clearGenerationIfCurrent` fired still only signals a no-op abort
        // on a controller nobody is listening to.
        run.controller.abort();

        return reply.code(204).send();
      }
    );

    app.post(
      "/projects/:projectId/artifacts/:artifactId/versions/:versionId/restore",
      async (request, reply) => {
        const params = artifactVersionParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const versionState = await options.versions.getStateById(
          artifact.id,
          params.versionId
        );

        if (!versionState) {
          return sendApiError(reply, 404, {
            error: "Version not found",
            code: "VERSION_NOT_FOUND",
            recoverable: false
          });
        }

        const sceneWorkspace = await options.workspaces.updateSceneDocument(
          artifact.id,
          versionState.sceneDocument
        );

        if (!sceneWorkspace) {
          return sendApiError(reply, 500, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: {
              stage: "restore-scene"
            }
          });
        }

        const codeWorkspace = await options.workspaces.updateCodeWorkspace(
          artifact.id,
          versionState.codeWorkspace
            ? {
                files: versionState.codeWorkspace.files,
                baseSceneVersion: versionState.codeWorkspace.baseSceneVersion
              }
            : null
        );

        if (!codeWorkspace) {
          return sendApiError(reply, 500, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: {
              stage: "restore-code-workspace"
            }
          });
        }

        const activeWorkspace =
          (await options.workspaces.updateActiveVersion(
            artifact.id,
            versionState.snapshot.id
          )) ?? codeWorkspace;
        const versions = await options.versions.listByArtifactId(artifact.id);
        const comments = await options.comments.listByArtifactId(artifact.id);

        return {
          workspace: buildWorkspacePayload({
            artifactKind: artifact.kind,
            workspace: activeWorkspace,
            versions,
            comments
          }),
          restoredVersion: versionState.snapshot
        };
      }
    );

    app.get(
      "/projects/:projectId/artifacts/:artifactId/versions/:versionId/diff",
      async (request, reply) => {
        const params = artifactVersionParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const versionState = await options.versions.getStateById(
          artifact.id,
          params.versionId
        );

        if (!versionState) {
          return sendApiError(reply, 404, {
            error: "Version not found",
            code: "VERSION_NOT_FOUND",
            recoverable: false
          });
        }

        const { workspace } = await ensureWorkspaceState(artifact);

        return {
          diff: buildVersionDiffSummary({
            versionId: versionState.snapshot.id,
            comparedSceneDocument: versionState.sceneDocument,
            currentSceneDocument: workspace.sceneDocument,
            comparedCodeWorkspace: versionState.codeWorkspace,
            currentCodeWorkspace: workspace.codeWorkspace,
            againstVersionId: workspace.activeVersionId
          })
        };
      }
    );

    app.post("/projects/:projectId/artifacts/:artifactId/scene/nodes", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = appendSceneTemplateBodySchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const { workspace, versions, comments } = await ensureWorkspaceState(artifact);
      const node = buildTemplateNode({
        artifact,
        intent: workspace.intent,
        template: body.template
      });
      const sceneDocument = appendRootSceneNode(workspace.sceneDocument, node);
      const updatedWorkspace = await options.workspaces.updateSceneDocument(
        artifact.id,
        sceneDocument
      );

      if (!updatedWorkspace) {
        return sendApiError(reply, 500, {
          error: "Workspace update failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "append-scene-template"
          }
        });
      }

      const { workspace: syncedWorkspace } = await applySceneDerivedCodeWorkspaceSync({
        artifact,
        previousWorkspace: workspace,
        nextIntent: workspace.intent,
        nextSceneDocument: updatedWorkspace.sceneDocument,
        stage: "append-scene-template-code-sync"
      });

      const persistedWorkspace = syncedWorkspace ?? updatedWorkspace;

      return reply.code(201).send({
        workspace: buildWorkspacePayload({
          artifactKind: artifact.kind,
          workspace: persistedWorkspace,
          versions,
          comments
        }),
        appendedNode: node
      });
    });

    app.post(
      "/projects/:projectId/artifacts/:artifactId/code-workspace",
      async (request, reply) => {
        const params = artifactDetailParamsSchema.parse(request.params);
        const body = saveCodeWorkspaceBodySchema.parse(request.body);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);
        const missingRequiredFiles = requiredCodeWorkspaceFiles.filter((filePath) => {
          const value = body.files[filePath];
          return typeof value !== "string" || value.trim().length === 0;
        });

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        if (missingRequiredFiles.length > 0) {
          return sendApiError(reply, 400, {
            error: `Code workspace is missing required scaffold files: ${missingRequiredFiles.join(", ")}`,
            code: "INVALID_CODE_WORKSPACE",
            recoverable: true,
            details: {
              missingRequiredFiles
            }
          });
        }

        const { workspace, versions, comments } = await ensureWorkspaceState(artifact);
        const expectedUpdatedAt = body.expectedUpdatedAt ?? null;
        const currentUpdatedAt = workspace.codeWorkspace?.updatedAt ?? null;

        if (expectedUpdatedAt !== currentUpdatedAt) {
          return sendApiError(reply, 409, {
            error:
              "Saved code workspace changed since this Studio session loaded. Reload the latest saved code before saving again.",
            code: "CODE_WORKSPACE_CONFLICT",
            recoverable: true,
            details: {
              currentUpdatedAt
            }
          });
        }

        const sceneSyncDecision = syncCodeToSceneDocument({
          artifactKind: artifact.kind,
          currentSceneDocument: workspace.sceneDocument,
          files: body.files
        });
        const sceneWorkspace =
          sceneSyncDecision.applied && sceneSyncDecision.sceneDocument
            ? await options.workspaces.updateSceneDocument(
                artifact.id,
                sceneSyncDecision.sceneDocument
              )
            : workspace;

        if (!sceneWorkspace) {
          return sendApiError(reply, 500, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: {
              stage: "save-code-workspace-scene-sync"
            }
          });
        }

        const updatedWorkspace = await options.workspaces.updateCodeWorkspace(
          artifact.id,
          {
            files: body.files,
            baseSceneVersion: sceneWorkspace.sceneDocument.version
          }
        );

        if (!updatedWorkspace) {
          return sendApiError(reply, 500, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: {
              stage: "save-code-workspace"
            }
          });
        }

        return {
          workspace: buildWorkspacePayload({
            artifactKind: artifact.kind,
            workspace: updatedWorkspace,
            versions,
            comments
          }),
          previousCodeWorkspaceUpdatedAt: workspace.codeWorkspace?.updatedAt ?? null,
          sceneSync: {
            status: sceneSyncDecision.applied ? "synced" : "unchanged",
            reason: sceneSyncDecision.reason
          }
        };
      }
    );

    app.post(
      "/projects/:projectId/artifacts/:artifactId/scene/nodes/:nodeId",
      async (request, reply) => {
        const params = sceneNodeParamsSchema.parse(request.params);
        const body = updateSceneNodeBodySchema.parse(request.body);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const { workspace, versions, comments } = await ensureWorkspaceState(artifact);

        try {
          const props = {
            ...Object.fromEntries(
              Object.entries({
                eyebrow: body.eyebrow,
                headline: body.headline,
              body: body.body,
              title: body.title,
              primaryAction: body.primaryAction,
              secondaryAction: body.secondaryAction,
              imageAssetId: body.imageAssetId,
              imageAlt: body.imageAlt
            }).filter(([, value]) => typeof value === "string" && value.length > 0)
          ),
            ...(body.items ? { items: body.items } : {})
          };

          const sceneDocument = updateRootSceneNode(workspace.sceneDocument, {
            nodeId: params.nodeId,
            ...(body.name ? { name: body.name } : {}),
            props
          });

          const updatedWorkspace = await options.workspaces.updateSceneDocument(
            artifact.id,
            sceneDocument
          );

          if (!updatedWorkspace) {
            return sendApiError(reply, 500, {
              error: "Workspace update failed",
              code: "WORKSPACE_UPDATE_FAILED",
              recoverable: true,
              details: {
                stage: "update-scene-node"
              }
            });
          }

          const { workspace: syncedWorkspace } = await applySceneDerivedCodeWorkspaceSync({
            artifact,
            previousWorkspace: workspace,
            nextIntent: workspace.intent,
            nextSceneDocument: updatedWorkspace.sceneDocument,
            stage: "update-scene-node-code-sync"
          });

          const persistedWorkspace = syncedWorkspace ?? updatedWorkspace;

          return {
            workspace: buildWorkspacePayload({
              artifactKind: artifact.kind,
              workspace: persistedWorkspace,
              versions,
              comments
            })
          };
        } catch (error) {
          if (error instanceof Error && /not found/i.test(error.message)) {
            return sendApiError(reply, 404, {
              error: "Scene node not found",
              code: "SCENE_NODE_NOT_FOUND",
              recoverable: false
            });
          }

          throw error;
        }
      }
    );

    app.post("/projects/:projectId/artifacts/:artifactId/comments", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = createArtifactCommentBodySchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (!artifact) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      await ensureWorkspaceState(artifact);
      const comment = await options.comments.create({
        artifactId: artifact.id,
        body: body.body,
        anchor: body.anchor
      });

      return reply.code(201).send(comment);
    });

    app.post(
      "/projects/:projectId/artifacts/:artifactId/comments/:commentId/resolve",
      async (request, reply) => {
        const params = artifactCommentParamsSchema.parse(request.params);
        const { artifact, project } = await resolveAuthorizedArtifact(request, params);

        if (!project) {
          return sendApiError(reply, 404, {
            error: "Project not found",
            code: "PROJECT_NOT_FOUND",
            recoverable: false
          });
        }

        if (!artifact) {
          return sendApiError(reply, 404, {
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND",
            recoverable: false
          });
        }

        const comment = await options.comments.resolve(artifact.id, params.commentId);

        if (!comment) {
          return sendApiError(reply, 404, {
            error: "Comment not found",
            code: "COMMENT_NOT_FOUND",
            recoverable: false
          });
        }

        return comment;
      }
    );
  };
