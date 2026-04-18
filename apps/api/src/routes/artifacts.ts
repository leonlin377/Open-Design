import {
  ArtifactKindSchema,
  ArtifactVersionSourceSchema,
  CommentAnchorSchema,
  type ArtifactComment,
  type ArtifactVersionSnapshot
} from "@opendesign/contracts";
import { planSyncPatch } from "@opendesign/code-sync";
import { createEmptySceneDocument } from "@opendesign/scene-engine";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
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

const artifactCommentParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1),
  commentId: z.string().min(1)
});

export interface ArtifactRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  auth: OpenDesignAuth;
}

export const registerArtifactRoutes: FastifyPluginAsync<ArtifactRouteOptions> =
  async (app, options) => {
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

    async function resolveAuthorizedArtifact(
      request: FastifyRequest,
      input: {
        projectId: string;
        artifactId: string;
      }
    ) {
      const { project } = await resolveAuthorizedProject(request, input.projectId);

      if (!project) {
        return {
          project: null,
          artifact: null
        };
      }

      const artifact = await options.artifacts.getById(input.projectId, input.artifactId);

      return {
        project,
        artifact
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
          sceneVersion: sceneDocument.version
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
          sceneVersion: workspace.sceneDocument.version
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

    function buildWorkspacePayload(input: {
      workspace: NonNullable<Awaited<ReturnType<typeof ensureWorkspaceState>>["workspace"]>;
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
        syncPlan,
        versionCount: input.versions.length,
        openCommentCount: input.comments.filter((comment) => comment.status === "open").length,
        updatedAt: input.workspace.updatedAt
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
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      const artifact = await options.artifacts.getById(params.projectId, params.artifactId);

      if (!artifact) {
        return reply.code(404).send({
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND"
        });
      }

      return artifact;
    });

    app.get("/projects/:projectId/artifacts/:artifactId/workspace", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      if (!artifact) {
        return reply.code(404).send({
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND"
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

    app.post("/projects/:projectId/artifacts", async (request, reply) => {
      const params = artifactParamsSchema.parse(request.params);
      const body = createArtifactBodySchema.parse(request.body);
      const { project } = await resolveAuthorizedProject(request, params.projectId);

      if (!project) {
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
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
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      if (!artifact) {
        return reply.code(404).send({
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND"
        });
      }

      const { workspace } = await ensureWorkspaceState(artifact);
      const version = await options.versions.create({
        artifactId: artifact.id,
        label: body.label,
        summary: body.summary ?? `Snapshot created from ${artifact.name}.`,
        source: body.source,
        sceneVersion: workspace.sceneDocument.version
      });

      await options.workspaces.updateActiveVersion(artifact.id, version.id);
      return reply.code(201).send(version);
    });

    app.post("/projects/:projectId/artifacts/:artifactId/comments", async (request, reply) => {
      const params = artifactDetailParamsSchema.parse(request.params);
      const body = createArtifactCommentBodySchema.parse(request.body);
      const { artifact, project } = await resolveAuthorizedArtifact(request, params);

      if (!project) {
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      if (!artifact) {
        return reply.code(404).send({
          error: "Artifact not found",
          code: "ARTIFACT_NOT_FOUND"
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
          return reply.code(404).send({
            error: "Project not found",
            code: "PROJECT_NOT_FOUND"
          });
        }

        if (!artifact) {
          return reply.code(404).send({
            error: "Artifact not found",
            code: "ARTIFACT_NOT_FOUND"
          });
        }

        const comment = await options.comments.resolve(artifact.id, params.commentId);

        if (!comment) {
          return reply.code(404).send({
            error: "Comment not found",
            code: "COMMENT_NOT_FOUND"
          });
        }

        return comment;
      }
    );
  };
