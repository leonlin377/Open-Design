import { ShareRoleSchema, ShareReviewPayloadSchema, type SceneNode } from "@opendesign/contracts";
import { syncSceneToCodeWorkspace } from "@opendesign/code-sync";
import {
  appendRootSceneNode,
  createEmptySceneDocument,
  updateRootSceneNode
} from "@opendesign/scene-engine";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import { sendApiError } from "../lib/api-errors";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ProjectRepository } from "../repositories/projects";
import type { ShareTokenRepository } from "../repositories/share-tokens";

const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

const artifactParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

const shareTokenParamsSchema = z.object({
  token: z.string().min(1)
});

const shareTokenCommentParamsSchema = z.object({
  token: z.string().min(1),
  commentId: z.string().min(1)
});

const shareRoleBodySchema = z.object({
  role: ShareRoleSchema.default("viewer")
});

const appendSceneTemplateBodySchema = z.object({
  template: z.enum(["hero", "feature-grid", "cta"])
});

const createSharedCommentBodySchema = z.object({
  body: z.string().min(1)
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

const sceneNodeParamsSchema = z.object({
  token: z.string().min(1),
  nodeId: z.string().min(1)
});

export interface ShareRouteOptions {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  shares: ShareTokenRepository;
  auth: OpenDesignAuth;
}

export const registerShareRoutes: FastifyPluginAsync<ShareRouteOptions> = async (
  app,
  options
) => {
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

  async function resolveAuthorizedArtifact(
    request: FastifyRequest,
    input: {
      projectId: string;
      artifactId: string;
    }
  ) {
    const { session, project } = await resolveAuthorizedProject(request, input.projectId);

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

  function buildTemplateNode(input: {
    artifact: {
      id: string;
      kind: "website" | "prototype" | "slides";
      name: string;
    };
    intent: string;
    template: "hero" | "feature-grid" | "cta";
  }): SceneNode {
    const nodeId = `${input.template}_${crypto.randomUUID()}`;
    const nodeType =
      input.artifact.kind === "prototype"
        ? "screen"
        : input.artifact.kind === "slides"
          ? "slide"
          : "section";

    if (input.template === "hero") {
      return {
        id: nodeId,
        type: nodeType,
        name:
          input.artifact.kind === "prototype"
            ? "Hero Screen"
            : input.artifact.kind === "slides"
              ? "Title Slide"
              : "Hero Section",
        props: {
          template: "hero",
          eyebrow:
            input.artifact.kind === "slides"
              ? "Deck Surface"
              : input.artifact.kind === "prototype"
                ? "Flow Surface"
                : "Launch Surface",
          headline: `${input.artifact.name} leads with cinematic hierarchy.`,
          body: input.intent
        },
        children: []
      };
    }

    if (input.template === "feature-grid") {
      return {
        id: nodeId,
        type: nodeType,
        name:
          input.artifact.kind === "prototype"
            ? "Feature Screen"
            : input.artifact.kind === "slides"
              ? "System Slide"
              : "Feature Grid",
        props: {
          template: "feature-grid",
          title: "Artifact system lanes",
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
      type: nodeType,
      name:
        input.artifact.kind === "prototype"
          ? "Action Screen"
          : input.artifact.kind === "slides"
            ? "Closing Slide"
            : "Call To Action",
      props: {
        template: "cta",
        headline: "Ready for the next review pass?",
        body: "Promote the current artifact into a snapshot, then push it toward export.",
        primaryAction: "Create Snapshot",
        secondaryAction: "Export Handoff"
      },
      children: []
    };
  }

  async function ensureWorkspaceState(artifact: {
    id: string;
    kind: "website" | "prototype" | "slides";
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

  async function applySceneDerivedCodeWorkspaceSync(input: {
    artifact: {
      id: string;
      kind: "website" | "prototype" | "slides";
      name: string;
    };
    previousWorkspace: Awaited<ReturnType<typeof ensureWorkspaceState>>["workspace"];
    nextIntent: string;
    nextSceneDocument: Awaited<ReturnType<typeof ensureWorkspaceState>>["workspace"]["sceneDocument"];
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
      return;
    }

    await options.workspaces.updateCodeWorkspace(input.artifact.id, decision.codeWorkspace);
  }

  function canComment(role: z.infer<typeof ShareRoleSchema>) {
    return role === "commenter" || role === "editor";
  }

  function canEdit(role: z.infer<typeof ShareRoleSchema>) {
    return role === "editor";
  }

  async function resolveShareState(token: string) {
    const share = await options.shares.getByToken(token);

    if (!share) {
      return null;
    }

    const project = await options.projects.getById(share.projectId);

    if (!project) {
      return null;
    }

    if (share.resourceType === "project") {
      const artifacts = await options.artifacts.listByProject(project.id);

      return {
        share,
        project,
        artifacts
      } as const;
    }

    const artifact = await options.artifacts.getById(project.id, share.resourceId);

    if (!artifact) {
      return null;
    }

    const { workspace, versions, comments } = await ensureWorkspaceState(artifact);

    return {
      share,
      project,
      artifact,
      workspace,
      versions,
      comments
    } as const;
  }

  app.post("/projects/:projectId/share-tokens", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = shareRoleBodySchema.parse(request.body ?? {});
    const { session, project } = await resolveAuthorizedProject(request, params.projectId);

    if (!project) {
      return sendApiError(reply, 404, {
        error: "Project not found",
        code: "PROJECT_NOT_FOUND",
        recoverable: false
      });
    }

    const share = await options.shares.create({
      resourceType: "project",
      role: body.role,
      resourceId: project.id,
      projectId: project.id,
      createdByUserId: session?.user.id ?? null
    });

    return reply.code(201).send({
      share,
      sharePath: `/share/${share.token}`
    });
  });

  app.post("/projects/:projectId/artifacts/:artifactId/share-tokens", async (request, reply) => {
    const params = artifactParamsSchema.parse(request.params);
    const body = shareRoleBodySchema.parse(request.body ?? {});
    const { session, project, artifact } = await resolveAuthorizedArtifact(request, params);

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

    const share = await options.shares.create({
      resourceType: "artifact",
      role: body.role,
      resourceId: artifact.id,
      projectId: project.id,
      createdByUserId: session?.user.id ?? null
    });

    return reply.code(201).send({
      share,
      sharePath: `/share/${share.token}`
    });
  });

  app.get("/share/:token", async (request, reply) => {
    const params = shareTokenParamsSchema.parse(request.params);
    const state = await resolveShareState(params.token);

    if (!state) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if ("artifacts" in state) {
      return ShareReviewPayloadSchema.parse({
        resourceType: "project",
        share: state.share,
        project: state.project,
        artifacts: state.artifacts
      });
    }

    return ShareReviewPayloadSchema.parse({
      resourceType: "artifact",
      share: state.share,
      project: state.project,
      artifact: state.artifact,
      sceneNodes: state.workspace.sceneDocument.nodes,
      comments: state.comments,
      workspace: {
        intent: state.workspace.intent,
        sceneVersion: state.workspace.sceneDocument.version,
        rootNodeCount: state.workspace.sceneDocument.nodes.length,
        activeVersionId: state.workspace.activeVersionId,
        openCommentCount: state.comments.filter((comment) => comment.status === "open").length,
        versionCount: state.versions.length,
        updatedAt: state.workspace.updatedAt
      },
      latestVersion: state.versions[0] ?? null
    });
  });

  app.post("/share/:token/comments", async (request, reply) => {
    const params = shareTokenParamsSchema.parse(request.params);
    const body = createSharedCommentBodySchema.parse(request.body);
    const state = await resolveShareState(params.token);

    if (!state || "artifacts" in state) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if (!canComment(state.share.role)) {
      return sendApiError(reply, 403, {
        error: "This share link does not allow commenting.",
        code: "SHARE_ROLE_FORBIDDEN",
        recoverable: false
      });
    }

    const comment = await options.comments.create({
      artifactId: state.artifact.id,
      body: body.body,
      anchor: {
        elementId: "artifact-canvas",
        selectionPath: ["shared-review", state.share.token]
      }
    });

    return reply.code(201).send(comment);
  });

  app.post("/share/:token/comments/:commentId/resolve", async (request, reply) => {
    const params = shareTokenCommentParamsSchema.parse(request.params);
    const state = await resolveShareState(params.token);

    if (!state || "artifacts" in state) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if (!canEdit(state.share.role)) {
      return sendApiError(reply, 403, {
        error: "This share link does not allow editing.",
        code: "SHARE_ROLE_FORBIDDEN",
        recoverable: false
      });
    }

    const comment = await options.comments.resolve(state.artifact.id, params.commentId);

    if (!comment) {
      return sendApiError(reply, 404, {
        error: "Comment not found",
        code: "COMMENT_NOT_FOUND",
        recoverable: false
      });
    }

    return comment;
  });

  app.post("/share/:token/scene/nodes", async (request, reply) => {
    const params = shareTokenParamsSchema.parse(request.params);
    const body = appendSceneTemplateBodySchema.parse(request.body);
    const state = await resolveShareState(params.token);

    if (!state || "artifacts" in state) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if (!canEdit(state.share.role)) {
      return sendApiError(reply, 403, {
        error: "This share link does not allow editing.",
        code: "SHARE_ROLE_FORBIDDEN",
        recoverable: false
      });
    }

    const node = buildTemplateNode({
      artifact: state.artifact,
      intent: state.workspace.intent,
      template: body.template
    });
    const sceneDocument = appendRootSceneNode(state.workspace.sceneDocument, node);
    const updatedWorkspace = await options.workspaces.updateSceneDocument(
      state.artifact.id,
      sceneDocument
    );

    if (!updatedWorkspace) {
      return sendApiError(reply, 500, {
        error: "Workspace update failed",
        code: "WORKSPACE_UPDATE_FAILED",
        recoverable: true,
        details: {
          stage: "share-append-scene-template"
        }
      });
    }

    await applySceneDerivedCodeWorkspaceSync({
      artifact: state.artifact,
      previousWorkspace: state.workspace,
      nextIntent: state.workspace.intent,
      nextSceneDocument: updatedWorkspace.sceneDocument
    });

    return reply.code(201).send({
      appendedNodeId: node.id
    });
  });

  app.post("/share/:token/scene/nodes/:nodeId", async (request, reply) => {
    const params = sceneNodeParamsSchema.parse(request.params);
    const body = updateSceneNodeBodySchema.parse(request.body);
    const state = await resolveShareState(params.token);

    if (!state || "artifacts" in state) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if (!canEdit(state.share.role)) {
      return sendApiError(reply, 403, {
        error: "This share link does not allow editing.",
        code: "SHARE_ROLE_FORBIDDEN",
        recoverable: false
      });
    }

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

      const sceneDocument = updateRootSceneNode(state.workspace.sceneDocument, {
        nodeId: params.nodeId,
        ...(body.name ? { name: body.name } : {}),
        props
      });

      const updatedWorkspace = await options.workspaces.updateSceneDocument(
        state.artifact.id,
        sceneDocument
      );

      if (!updatedWorkspace) {
        return sendApiError(reply, 500, {
          error: "Workspace update failed",
          code: "WORKSPACE_UPDATE_FAILED",
          recoverable: true,
          details: {
            stage: "share-update-scene-node"
          }
        });
      }

      await applySceneDerivedCodeWorkspaceSync({
        artifact: state.artifact,
        previousWorkspace: state.workspace,
        nextIntent: state.workspace.intent,
        nextSceneDocument: updatedWorkspace.sceneDocument
      });

      return {
        ok: true
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
  });
};
