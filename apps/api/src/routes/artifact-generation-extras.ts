import {
  ArtifactCodePatchSchema,
  ArtifactCommentResolutionSchema,
  ArtifactGenerateResponseSchema,
  ArtifactGenerationRunSchema,
  ArtifactKindSchema,
  ArtifactScenePatchSchema,
  SceneDocumentSchema,
  type ArtifactGenerateResponse,
  type SceneDocument,
  type SceneNode
} from "@opendesign/contracts";
import {
  ArtifactGenerationVariationSchema,
  ArtifactGenerationVariationsRequestSchema,
  ArtifactGenerationVariationsResponseSchema,
  ArtifactRefineRequestSchema,
  ArtifactRefineStreamEventSchema,
  ArtifactVariationAcceptRequestSchema,
  type ArtifactGenerationVariation,
  type ArtifactRefineStreamEvent
} from "@opendesign/contracts/src/generation-extras";
import {
  appendRootSceneNode,
  buildPrototypeScreen,
  buildPrototypeScreenCta,
  buildPrototypeScreenLink,
  buildSlide,
  buildWebsiteSection,
  indexSceneNodesById,
  updateRootSceneNode
} from "@opendesign/scene-engine";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildApiError, sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import {
  ArtifactGenerationError,
  summarizeDesignSystemForGeneration
} from "../generation";
import { generateVariationPlans } from "../generation-variations";
import { refineNode } from "../generation-refine";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { DesignSystemRepository } from "../repositories/design-systems";
import type { ProjectRepository } from "../repositories/projects";

const artifactDetailParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

/**
 * Shape of the per-artifact in-flight generation registry the /generate route
 * keeps. The extras plugin only needs a tiny slice of the full InFlightGeneration
 * contract — we accept anything with these fields so the caller can share
 * its existing Map without coupling to the private type.
 */
export interface ActiveGenerationSlot {
  artifactId: string;
  userKey: string;
  controller: AbortController;
  completed: boolean;
}

export interface GenerationExtrasRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  designSystems: DesignSystemRepository;
  auth: OpenDesignAuth;
  /**
   * Optional shared registry from the main /generate plugin. When provided
   * we honour the same 409 (already-running) and 429 (per-user quota) gates
   * so variations/refine cannot bypass the rate limits the main generate
   * route enforces. Tests wire their own Map here.
   */
  activeGenerations?: Map<string, ActiveGenerationSlot>;
}

const DEFAULT_VARIATION_COUNT = 3;
const MAX_VARIATION_COUNT = 5;
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

function readRefineSessionTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const override = Number(env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS ?? "");
  if (Number.isFinite(override) && override > 0) {
    return override;
  }
  const base = Number(env.OPENDESIGN_GENERATION_TIMEOUT_MS ?? "15000");
  return Number.isFinite(base) && base > 0 ? base * 2 : 30000;
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
      return 422;
    case "GENERATION_ALREADY_RUNNING":
      return 409;
    case "GENERATION_QUOTA_EXCEEDED":
      return 429;
    case "SCENE_NODE_NOT_FOUND":
    case "ARTIFACT_NOT_FOUND":
    case "PROJECT_NOT_FOUND":
      return 404;
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
      ...(error.details ? { details: error.details } : {})
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
      details: { stage: "generate-extras" }
    })
  };
}

export const registerGenerationExtrasRoutes: FastifyPluginAsync<
  GenerationExtrasRouteOptions
> = async (app, options) => {
  const activeGenerations = options.activeGenerations;

  /**
   * Variation previews are held in-process keyed by `artifactId:variationId`
   * until the caller accepts one. Entries TTL out after 10 minutes so a
   * forgotten preview does not leak memory. Tests short-circuit TTL by
   * immediately calling the accept path.
   */
  const VARIATION_TTL_MS = 10 * 60 * 1000;
  interface StoredVariation {
    variation: ArtifactGenerationVariation;
    storedAt: number;
    /** The scene document after applying this variation's appended nodes. */
    nextSceneDocument: SceneDocument;
    /** The appended node objects (for the scene patch record on accept). */
    appendedNodes: SceneNode[];
    /** The prompt that produced this variation (reused for the version label). */
    prompt: string;
  }
  const variationStore = new Map<string, StoredVariation>();

  function variationKey(artifactId: string, variationId: string): string {
    return `${artifactId}:${variationId}`;
  }

  function pruneExpiredVariations(): void {
    const cutoff = Date.now() - VARIATION_TTL_MS;
    for (const [key, entry] of variationStore) {
      if (entry.storedAt < cutoff) {
        variationStore.delete(key);
      }
    }
  }

  function userKeyForSession(
    session: { user?: { id?: string | null } } | null | undefined
  ): string {
    return session?.user?.id ?? "__anonymous__";
  }

  function countUserGenerations(userKey: string): number {
    if (!activeGenerations) {
      return 0;
    }
    let count = 0;
    for (const run of activeGenerations.values()) {
      if (run.userKey === userKey) {
        count += 1;
      }
    }
    return count;
  }

  function clearGenerationIfCurrent(
    artifactId: string,
    run: ActiveGenerationSlot
  ) {
    if (!activeGenerations) {
      return;
    }
    const current = activeGenerations.get(artifactId);
    if (current === run) {
      activeGenerations.delete(artifactId);
    }
  }

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

  function buildTemplateNode(input: {
    artifact: {
      id: string;
      kind: z.infer<typeof ArtifactKindSchema>;
      name: string;
    };
    intent: string;
    template: string;
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

    if (input.artifact.kind === "prototype") {
      if (input.template === "screen" || input.template === "hero") {
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
      if (input.template === "screen-link") {
        return buildPrototypeScreenLink({
          id: nodeId,
          from: input.priorPrototypeScreenId ?? "entry",
          to: `screen_target_${crypto.randomUUID().slice(0, 8)}`,
          trigger: "tap",
          name: "Flow Transition"
        });
      }
      if (input.template === "screen-cta" || input.template === "cta") {
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
        `Prototype artifacts cannot consume the "${input.template}" template.`
      );
    }

    // slides
    const resolved =
      input.template === "hero"
        ? "slide-title"
        : input.template === "feature-grid"
          ? "slide-content"
          : input.template === "cta"
            ? "slide-closing"
            : input.template;

    if (
      resolved !== "slide-title" &&
      resolved !== "slide-content" &&
      resolved !== "slide-closing"
    ) {
      throw new Error(
        `Slides artifacts cannot consume the "${input.template}" template.`
      );
    }

    const headline =
      resolved === "slide-title"
        ? input.designSystemName
          ? `${input.artifact.name} — ${input.designSystemName} system`
          : `${input.artifact.name}`
        : resolved === "slide-content"
          ? input.designSystemName
            ? `${input.designSystemName} system lanes`
            : "System lanes"
          : "Ready for the next review pass?";
    const body =
      resolved === "slide-title"
        ? input.intent
        : resolved === "slide-content"
          ? "Scene, design, and export flows derive from one source of truth."
          : "Promote the current deck into a snapshot, then push it toward export.";

    return buildSlide({
      id: nodeId,
      role: resolved as "slide-title" | "slide-content" | "slide-closing",
      headline,
      body,
      ...(resolved === "slide-content"
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

  async function getWorkspaceState(artifactId: string) {
    const workspace = await options.workspaces.getByArtifactId(artifactId);
    if (!workspace) {
      return null;
    }
    const versions = await options.versions.listByArtifactId(artifactId);
    return { workspace, versions };
  }

  // ---------------------------------------------------------------------------
  // POST /variations — runs N parallel heuristic + gateway passes and returns
  // JSON previews without committing anything to the workspace.
  // ---------------------------------------------------------------------------
  app.post(
    "/projects/:projectId/artifacts/:artifactId/generate/variations",
    async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = ArtifactGenerationVariationsRequestSchema.parse(request.body);
      const { artifact, project, session } = await resolveAuthorizedArtifact(
        request,
        params
      );

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

      const userKey = userKeyForSession(session);
      if (activeGenerations) {
        if (activeGenerations.has(artifact.id)) {
          return sendApiError(reply, 409, {
            error: "A generation is already running for this artifact.",
            code: "GENERATION_ALREADY_RUNNING",
            recoverable: false,
            details: { artifactId: artifact.id }
          });
        }
        const cap = readGenerationConcurrencyCap();
        const running = countUserGenerations(userKey);
        if (running >= cap) {
          reply.header("retry-after", "5");
          return sendApiError(reply, 429, {
            error: `You already have ${running} of ${cap} generations running.`,
            code: "GENERATION_QUOTA_EXCEEDED",
            recoverable: true,
            details: {
              running,
              limit: cap,
              retryAfterSeconds: 5
            }
          });
        }
      }

      const state = await getWorkspaceState(artifact.id);
      if (!state) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      const { workspace } = state;
      const packId = workspace.sceneDocument.metadata.designSystemPackId ?? null;
      const pack = packId ? await options.designSystems.getById(packId) : null;
      const designSystem = pack
        ? summarizeDesignSystemForGeneration(pack)
        : undefined;

      const controller = new AbortController();
      const slot: ActiveGenerationSlot = {
        artifactId: artifact.id,
        userKey,
        controller,
        completed: false
      };
      if (activeGenerations) {
        activeGenerations.set(artifact.id, slot);
      }

      try {
        const count = body.count ?? DEFAULT_VARIATION_COUNT;
        const plans = await generateVariationPlans({
          artifactKind: artifact.kind,
          artifactName: artifact.name,
          prompt: body.prompt,
          count: Math.min(count, MAX_VARIATION_COUNT),
          ...(designSystem ? { designSystem } : {}),
          signal: controller.signal
        });

        // Prune before inserting so repeated calls don't accumulate forever.
        pruneExpiredVariations();

        const variations: ArtifactGenerationVariation[] = [];
        for (const entry of plans) {
          const variationId = `var_${crypto.randomUUID()}`;
          let sceneDocument = workspace.sceneDocument;
          const appendedNodes: SceneNode[] = [];
          let priorScreenId: string | null = null;
          for (const template of entry.result.plan.sections ?? []) {
            const node = buildTemplateNode({
              artifact,
              intent: entry.result.plan.intent,
              template,
              designSystemName: entry.result.plan.designSystem?.name ?? null,
              priorPrototypeScreenId: priorScreenId
            });
            sceneDocument = appendRootSceneNode(sceneDocument, node);
            appendedNodes.push(node);
            if (
              artifact.kind === "prototype" &&
              (node.type === "screen" || node.type === "screen-cta")
            ) {
              priorScreenId = node.id;
            }
          }
          indexSceneNodesById(sceneDocument.nodes);

          const variation: ArtifactGenerationVariation =
            ArtifactGenerationVariationSchema.parse({
              variationId,
              label: entry.label,
              tone: entry.tone,
              plan: entry.result.plan,
              diagnostics: entry.result.diagnostics,
              sceneDocument: SceneDocumentSchema.parse(sceneDocument),
              appendedNodes
            });

          variationStore.set(variationKey(artifact.id, variationId), {
            variation,
            storedAt: Date.now(),
            nextSceneDocument: sceneDocument,
            appendedNodes,
            prompt: body.prompt
          });
          variations.push(variation);
        }

        slot.completed = true;
        return reply.code(200).send(
          ArtifactGenerationVariationsResponseSchema.parse({
            variations,
            diagnostics: variations[0]!.diagnostics
          })
        );
      } catch (error) {
        const { statusCode, apiError } = mapGenerationFailure(error);
        return sendApiError(reply, statusCode, apiError);
      } finally {
        clearGenerationIfCurrent(artifact.id, slot);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /variations/accept — commits a previously-previewed variation via the
  // existing `applyGenerationRun` atomic path.
  // ---------------------------------------------------------------------------
  app.post(
    "/projects/:projectId/artifacts/:artifactId/variations/accept",
    async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = ArtifactVariationAcceptRequestSchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(
        request,
        params
      );

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

      pruneExpiredVariations();
      const key = variationKey(artifact.id, body.variationId);
      const stored = variationStore.get(key);
      if (!stored) {
        return sendApiError(reply, 404, {
          error: "Variation preview not found or expired.",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: true,
          details: { stage: "accept-variation", variationId: body.variationId }
        });
      }

      const state = await getWorkspaceState(artifact.id);
      if (!state) {
        return sendApiError(reply, 404, {
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND",
          recoverable: false
        });
      }

      try {
        const applyResult = await options.workspaces.applyGenerationRun({
          artifactId: artifact.id,
          intent: stored.variation.plan.intent,
          sceneDocument: stored.nextSceneDocument,
          codeWorkspace: undefined,
          activateNewVersion: true,
          version: {
            label: `Variation ${state.versions.length + 1}`,
            summary: `Accepted variation: ${stored.variation.label}`,
            source: "prompt",
            sceneVersion: stored.nextSceneDocument.version,
            sceneDocument: stored.nextSceneDocument,
            codeWorkspace: state.workspace.codeWorkspace
          }
        });

        if (!applyResult) {
          return sendApiError(reply, 500, {
            error: "Workspace update failed",
            code: "WORKSPACE_UPDATE_FAILED",
            recoverable: true,
            details: { stage: "accept-variation" }
          });
        }

        const generationRun = ArtifactGenerationRunSchema.parse({
          plan: stored.variation.plan,
          diagnostics: stored.variation.diagnostics,
          scenePatch: ArtifactScenePatchSchema.parse({
            mode:
              stored.appendedNodes.length > 0
                ? "append-root-sections"
                : "no-op",
            rationale: "Apply the accepted variation's section stack.",
            appendedNodes: stored.appendedNodes.map((node) => {
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
            mode: "unchanged",
            rationale: "Variation accept preserves the current code workspace.",
            filesTouched: []
          }),
          commentResolution: ArtifactCommentResolutionSchema.parse({
            mode: "none",
            rationale: "Variation accept does not resolve open comments.",
            resolvedCommentIds: []
          })
        });

        const response: ArtifactGenerateResponse =
          ArtifactGenerateResponseSchema.parse({
            generation: generationRun,
            version: applyResult.version,
            workspace: {
              artifactId: applyResult.workspace.artifactId,
              intent: applyResult.workspace.intent,
              activeVersionId: applyResult.workspace.activeVersionId,
              sceneDocument: applyResult.workspace.sceneDocument,
              codeWorkspace: applyResult.workspace.codeWorkspace,
              syncPlan: {
                mode: "constrained" as const,
                reason:
                  "Variation accept reuses the existing sync plan baseline.",
                sourceMode: "scene" as const,
                targetMode:
                  artifact.kind === "website"
                    ? ("code-supported" as const)
                    : ("code-advanced" as const),
                changeScope: "document" as const
              },
              versionCount: state.versions.length + 1,
              openCommentCount: 0,
              updatedAt: applyResult.workspace.updatedAt
            }
          });

        // One-shot: drop every preview for this artifact so stale entries do
        // not linger after a commit.
        for (const existing of variationStore.keys()) {
          if (existing.startsWith(`${artifact.id}:`)) {
            variationStore.delete(existing);
          }
        }

        return reply.code(201).send(response);
      } catch (error) {
        const { statusCode, apiError } = mapGenerationFailure(error);
        return sendApiError(reply, statusCode, apiError);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /refine — streams SSE and commits a node-scoped prop delta.
  // ---------------------------------------------------------------------------
  function wantsEventStream(request: FastifyRequest) {
    const accept = request.headers.accept ?? "";
    return accept.includes("text/event-stream");
  }

  interface RefineStreamSession {
    writeEvent: (event: ArtifactRefineStreamEvent) => void;
    close: () => void;
    isClosed: () => boolean;
    onTimeout: (handler: () => void) => void;
    clearDeadline: () => void;
  }

  function beginRefineStream(
    reply: FastifyReply,
    config: { sessionTimeoutMs: number }
  ): RefineStreamSession {
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
    let timeoutHandler: (() => void) | null = null;

    const writeEvent = (event: ArtifactRefineStreamEvent) => {
      if (closed) {
        return;
      }
      reply.raw.write(
        `data: ${JSON.stringify(ArtifactRefineStreamEventSchema.parse(event))}\n\n`
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
    let deadline: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      deadline = null;
      if (timeoutHandler) {
        timeoutHandler();
      }
    }, config.sessionTimeoutMs);
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

  async function performRefine(input: {
    artifact: { id: string; kind: z.infer<typeof ArtifactKindSchema>; name: string };
    nodeId: string;
    instruction: string;
    signal: AbortSignal;
    onProgress?: (
      event: Extract<ArtifactRefineStreamEvent, { type: "planning" | "applying" }>
    ) => Promise<void> | void;
  }): Promise<ArtifactGenerateResponse> {
    const throwIfCancelled = () => {
      if (input.signal.aborted) {
        throw new ArtifactGenerationError({
          message: "Refine was cancelled before it could commit.",
          code: "GENERATION_CANCELLED",
          details: { stage: "refine" }
        });
      }
    };

    const state = await getWorkspaceState(input.artifact.id);
    if (!state) {
      throw buildApiError({
        error: "Artifact not found",
        code: "ARTIFACT_NOT_FOUND",
        recoverable: false
      });
    }
    throwIfCancelled();

    const targetIndex = state.workspace.sceneDocument.nodes.findIndex(
      (node) => node.id === input.nodeId
    );
    if (targetIndex === -1) {
      throw buildApiError({
        error: "Scene node not found",
        code: "SCENE_NODE_NOT_FOUND",
        recoverable: false
      });
    }
    const targetNode = state.workspace.sceneDocument.nodes[targetIndex]!;

    await input.onProgress?.({
      type: "planning",
      message: `Refining node ${targetNode.name}.`
    });

    const refineResult = await refineNode({
      node: targetNode,
      instruction: input.instruction,
      signal: input.signal
    });
    throwIfCancelled();

    await input.onProgress?.({
      type: "applying",
      message: "Applying refined props and committing the update."
    });

    let sceneDocument: SceneDocument;
    try {
      sceneDocument = updateRootSceneNode(state.workspace.sceneDocument, {
        nodeId: input.nodeId,
        ...(refineResult.name ? { name: refineResult.name } : {}),
        props: refineResult.propDelta
      });
    } catch (error) {
      throw buildApiError({
        error: "Refine produced an invalid scene patch.",
        code: "INVALID_SCENE_PATCH",
        recoverable: true,
        details: {
          stage: "refine",
          ...(error instanceof Error ? { reason: error.message } : {})
        }
      });
    }

    throwIfCancelled();

    const applyResult = await options.workspaces.applyGenerationRun({
      artifactId: input.artifact.id,
      intent: state.workspace.intent,
      sceneDocument,
      codeWorkspace: undefined,
      activateNewVersion: true,
      version: {
        label: `Refine ${state.versions.length + 1}`,
        summary: `Refined ${targetNode.name}: ${input.instruction.slice(0, 120)}`,
        source: "prompt",
        sceneVersion: sceneDocument.version,
        sceneDocument,
        codeWorkspace: state.workspace.codeWorkspace
      }
    });

    if (!applyResult) {
      throw buildApiError({
        error: "Workspace update failed",
        code: "WORKSPACE_UPDATE_FAILED",
        recoverable: true,
        details: { stage: "refine" }
      });
    }

    const refreshedNode = applyResult.workspace.sceneDocument.nodes.find(
      (node) => node.id === input.nodeId
    );

    const generationRun = ArtifactGenerationRunSchema.parse({
      plan: {
        prompt: input.instruction,
        intent: `Refine ${targetNode.name}: ${input.instruction}`,
        rationale: refineResult.rationale,
        sections: ["hero"],
        provider: refineResult.provider
      },
      diagnostics: {
        provider: refineResult.provider,
        transport: refineResult.provider === "litellm" ? "json" : "fallback",
        warning: refineResult.warning
      },
      scenePatch: ArtifactScenePatchSchema.parse({
        mode: "no-op",
        rationale: `Refined props on node ${refreshedNode?.name ?? targetNode.name}.`,
        appendedNodes: []
      }),
      codePatch: ArtifactCodePatchSchema.parse({
        mode: "unchanged",
        rationale: "Refine is node-scoped and does not touch the code workspace.",
        filesTouched: []
      }),
      commentResolution: ArtifactCommentResolutionSchema.parse({
        mode: "none",
        rationale: "Refine does not resolve comments.",
        resolvedCommentIds: []
      })
    });

    return ArtifactGenerateResponseSchema.parse({
      generation: generationRun,
      version: applyResult.version,
      workspace: {
        artifactId: applyResult.workspace.artifactId,
        intent: applyResult.workspace.intent,
        activeVersionId: applyResult.workspace.activeVersionId,
        sceneDocument: applyResult.workspace.sceneDocument,
        codeWorkspace: applyResult.workspace.codeWorkspace,
        syncPlan: {
          mode: "constrained" as const,
          reason: "Refine preserves the current sync plan baseline.",
          sourceMode: "scene" as const,
          targetMode:
            input.artifact.kind === "website"
              ? ("code-supported" as const)
              : ("code-advanced" as const),
          changeScope: "node" as const
        },
        versionCount: state.versions.length + 1,
        openCommentCount: 0,
        updatedAt: applyResult.workspace.updatedAt
      }
    });
  }

  app.post(
    "/projects/:projectId/artifacts/:artifactId/refine",
    async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = ArtifactRefineRequestSchema.parse(request.body);
      const { artifact, project, session } = await resolveAuthorizedArtifact(
        request,
        params
      );

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

      const userKey = userKeyForSession(session);
      if (activeGenerations) {
        if (activeGenerations.has(artifact.id)) {
          return sendApiError(reply, 409, {
            error: "A generation is already running for this artifact.",
            code: "GENERATION_ALREADY_RUNNING",
            recoverable: false,
            details: { artifactId: artifact.id }
          });
        }
        const cap = readGenerationConcurrencyCap();
        const running = countUserGenerations(userKey);
        if (running >= cap) {
          reply.header("retry-after", "5");
          return sendApiError(reply, 429, {
            error: `You already have ${running} of ${cap} generations running.`,
            code: "GENERATION_QUOTA_EXCEEDED",
            recoverable: true,
            details: {
              running,
              limit: cap,
              retryAfterSeconds: 5
            }
          });
        }
      }

      const controller = new AbortController();
      const slot: ActiveGenerationSlot = {
        artifactId: artifact.id,
        userKey,
        controller,
        completed: false
      };
      if (activeGenerations) {
        activeGenerations.set(artifact.id, slot);
      }

      const buildRetryPayload = (code: string) => {
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
          nodeId: body.nodeId,
          instruction: body.instruction
        };
      };

      if (wantsEventStream(request)) {
        const stream = beginRefineStream(reply, {
          sessionTimeoutMs: readRefineSessionTimeoutMs()
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          stream.onTimeout(() => {
            reject(
              new ArtifactGenerationError({
                message:
                  "Refine session exceeded its deadline before the pipeline completed.",
                code: "GENERATION_TIMEOUT",
                details: { stage: "refine-session" }
              })
            );
          });
        });

        try {
          stream.writeEvent({
            type: "started",
            message: "Refine pass started."
          });
          const result = await Promise.race([
            performRefine({
              artifact,
              nodeId: body.nodeId,
              instruction: body.instruction,
              signal: controller.signal,
              onProgress: async (event) => {
                stream.writeEvent(event as ArtifactRefineStreamEvent);
              }
            }),
            timeoutPromise
          ]);
          slot.completed = true;
          stream.writeEvent({
            type: "completed",
            message: "Refine committed.",
            result
          });
        } catch (error) {
          const { apiError } = mapGenerationFailure(error);
          stream.writeEvent({
            type: "failed",
            message: apiError.error,
            error: apiError,
            retry: buildRetryPayload(apiError.code)
          });
        } finally {
          clearGenerationIfCurrent(artifact.id, slot);
          stream.clearDeadline();
          stream.close();
        }
        return;
      }

      try {
        const result = await performRefine({
          artifact,
          nodeId: body.nodeId,
          instruction: body.instruction,
          signal: controller.signal
        });
        slot.completed = true;
        return reply.code(201).send(result);
      } catch (error) {
        const { statusCode, apiError } = mapGenerationFailure(error);
        return sendApiError(reply, statusCode, apiError);
      } finally {
        clearGenerationIfCurrent(artifact.id, slot);
      }
    }
  );

};
