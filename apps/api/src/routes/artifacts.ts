import {
  ArtifactCommentResolutionSchema,
  ArtifactCodePatchSchema,
  ArtifactGenerateResponseSchema,
  ArtifactGenerateStreamEventSchema,
  ArtifactGenerationRunSchema,
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
  type SceneNode,
  type ArtifactVersionSnapshot
} from "@opendesign/contracts";
import {
  planSyncPatch,
  syncCodeToSceneDocument,
  syncSceneToCodeWorkspace
} from "@opendesign/code-sync";
import {
  buildArtifactHtmlExport,
  buildArtifactSourceBundle
} from "@opendesign/exporters";
import {
  appendRootSceneNode,
  createEmptySceneDocument,
  indexSceneNodesById,
  updateRootSceneNode
} from "@opendesign/scene-engine";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ArtifactGenerationError,
  generateArtifactPlan,
  summarizeDesignSystemForGeneration
} from "../generation";
import { buildApiError, sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { DesignSystemRepository } from "../repositories/design-systems";
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
    secondaryAction: z.string().min(1).optional()
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

export interface ArtifactRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  designSystems: DesignSystemRepository;
  auth: OpenDesignAuth;
}

export const registerArtifactRoutes: FastifyPluginAsync<ArtifactRouteOptions> =
  async (app, options) => {
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
      template: z.infer<typeof SceneTemplateKindSchema>;
      designSystemName?: string | null;
    }): SceneNode {
      const nodeId = `${input.template}_${crypto.randomUUID()}`;

      if (input.template === "hero") {
        return {
          id: nodeId,
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero",
            eyebrow:
              input.designSystemName
                ? `${input.designSystemName} System`
                : input.artifact.kind === "slides"
                ? "Deck Surface"
                : input.artifact.kind === "prototype"
                  ? "Flow Surface"
                  : "Launch Surface",
            headline: input.designSystemName
              ? `${input.artifact.name} adopts ${input.designSystemName} hierarchy.`
              : `${input.artifact.name} leads with cinematic hierarchy.`,
            body: input.intent
          },
          children: []
        };
      }

      if (input.template === "feature-grid") {
        return {
          id: nodeId,
          type: "section",
          name: "Feature Grid",
          props: {
            template: "feature-grid",
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
          },
          children: []
        };
      }

      return {
        id: nodeId,
        type: "section",
        name: "Call To Action",
        props: {
          template: "cta",
          headline: input.designSystemName
            ? `Ready to ship ${input.designSystemName} fidelity?`
            : "Ready for the next review pass?",
          body: "Promote the current artifact into a snapshot, then push it toward export.",
          primaryAction: "Create Snapshot",
          secondaryAction: "Export Handoff"
        },
        children: []
      };
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

    function beginGenerationEventStream(reply: FastifyReply) {
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      });

      if (typeof reply.raw.flushHeaders === "function") {
        reply.raw.flushHeaders();
      }
    }

    function writeGenerationEvent(
      reply: FastifyReply,
      event: ArtifactGenerateStreamEvent
    ) {
      reply.raw.write(
        `data: ${JSON.stringify(ArtifactGenerateStreamEventSchema.parse(event))}\n\n`
      );
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

        const statusCode =
          error.code === "GENERATION_TIMEOUT"
            ? 504
            : error.code === "GENERATION_PROVIDER_FAILURE"
              ? 502
              : error.code === "INVALID_GENERATION_PLAN" ||
                  error.code === "INVALID_SCENE_PATCH"
                ? 422
              : 422;

        return {
          statusCode,
          apiError
        };
      }

      if (error && typeof error === "object" && "code" in error && "error" in error) {
        const apiError = buildApiError(error as Parameters<typeof buildApiError>[0]);
        const statusCode =
          apiError.code === "GENERATION_TIMEOUT"
            ? 504
            : apiError.code === "GENERATION_PROVIDER_FAILURE"
              ? 502
              : apiError.code === "INVALID_GENERATION_PLAN" ||
                  apiError.code === "INVALID_SCENE_PATCH"
                ? 422
                : 500;

        return {
          statusCode,
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
      onProgress?: (
        event: Extract<ArtifactGenerateStreamEvent, { type: "planning" | "applying" }>
      ) => Promise<void> | void;
    }): Promise<ArtifactGenerateResponse> {
      const { workspace, versions, comments } = await ensureWorkspaceState(input.artifact);
      const selectedDesignSystemPackId =
        workspace.sceneDocument.metadata.designSystemPackId ?? null;
      const selectedDesignSystem = selectedDesignSystemPackId
        ? await options.designSystems.getById(selectedDesignSystemPackId)
        : null;
      const generationDesignSystem = selectedDesignSystem
        ? summarizeDesignSystemForGeneration(selectedDesignSystem)
        : undefined;

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
        designSystem: generationDesignSystem
      });
      const plan = ArtifactGenerationPlanSchema.parse(generation.plan);

      let sceneDocument = workspace.sceneDocument;
      const appendedNodes: SceneNode[] = [];

      try {
        for (const template of plan.sections) {
          const node = buildTemplateNode({
            artifact: input.artifact,
            intent: plan.intent,
            template,
            designSystemName: plan.designSystem?.name ?? null
          });
          sceneDocument = appendRootSceneNode(sceneDocument, node);
          appendedNodes.push(node);
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

      const intentWorkspace = await options.workspaces.updateIntent(input.artifact.id, plan.intent);
      const sceneWorkspace = await options.workspaces.updateSceneDocument(
        input.artifact.id,
        sceneDocument
      );

      if (!intentWorkspace || !sceneWorkspace) {
        throw buildApiError({
          error: "Workspace update failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "generate"
          }
        });
      }

      const { workspace: syncedWorkspace, decision: codeSyncDecision } =
        await applySceneDerivedCodeWorkspaceSync({
          artifact: input.artifact,
          previousWorkspace: workspace,
          nextIntent: plan.intent,
          nextSceneDocument: sceneWorkspace.sceneDocument,
          stage: "generate-code-sync"
        });

      const persistedWorkspace = syncedWorkspace ?? sceneWorkspace;

      const version = await options.versions.create({
        artifactId: input.artifact.id,
        label: `Prompt ${versions.length + 1}`,
        summary: `Generated from prompt: ${input.prompt.slice(0, 120)}`,
        source: "prompt",
        sceneVersion: persistedWorkspace.sceneDocument.version,
        sceneDocument: persistedWorkspace.sceneDocument,
        codeWorkspace: persistedWorkspace.codeWorkspace
      });

      const activeWorkspace =
        (await options.workspaces.updateActiveVersion(input.artifact.id, version.id)) ??
        persistedWorkspace;

      const generationRun = ArtifactGenerationRunSchema.parse({
        plan,
        diagnostics: generation.diagnostics,
        scenePatch: ArtifactScenePatchSchema.parse({
          mode: appendedNodes.length > 0 ? "append-root-sections" : "no-op",
          rationale: "Append the generated section stack to the root scene document.",
          appendedNodes: appendedNodes.map((node) => ({
            id: node.id,
            type: node.type,
            name: node.name,
            template:
              node.props.template === "feature-grid" ||
              node.props.template === "cta" ||
              node.props.template === "hero"
                ? node.props.template
                : "hero"
          }))
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
          workspace: activeWorkspace,
          versions: [version, ...versions],
          comments
        })
      });
    }

    function buildWorkspacePayload(input: {
      workspace: EnsuredWorkspace;
      versions: ArtifactVersionSnapshot[];
      comments: ArtifactComment[];
    }) {
      const syncPlan = planSyncPatch({
        sourceMode: "scene",
        targetMode: "code-supported",
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

      return {
        artifact,
        workspace: buildWorkspacePayload({
          workspace,
          versions,
          comments
        }),
        versions,
        comments
      };
    });

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

        const { workspace } = await ensureWorkspaceState(artifact);
        const bundle = buildArtifactHtmlExport({
          artifactName: artifact.name,
          sceneDocument: workspace.sceneDocument,
          prompt: workspace.intent
        });

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

        return reply.send(bundle);
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

      if (wantsGenerationEventStream(request)) {
        beginGenerationEventStream(reply);

        try {
          writeGenerationEvent(reply, {
            type: "started",
            message: "Generation pass started."
          });

          const result = await performArtifactGeneration({
            artifact,
            prompt: body.prompt,
            onProgress: async (event) => {
              writeGenerationEvent(reply, event);
            }
          });

          writeGenerationEvent(reply, {
            type: "completed",
            message: `Generated ${result.generation.scenePatch.appendedNodes.length} sections and refreshed the workspace.`,
            result
          });
        } catch (error) {
          const { apiError } = mapGenerationFailure(error);

          writeGenerationEvent(reply, {
            type: "failed",
            message: apiError.error,
            error: apiError
          });
        } finally {
          reply.raw.end();
        }

        return;
      }

      try {
        const result = await performArtifactGeneration({
          artifact,
          prompt: body.prompt
        });

        return reply.code(201).send(result);
      } catch (error) {
        const { statusCode, apiError } = mapGenerationFailure(error);
        return sendApiError(reply, statusCode, apiError);
      }
    });

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
                secondaryAction: body.secondaryAction
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
