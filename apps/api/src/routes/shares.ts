import { ShareReviewPayloadSchema } from "@opendesign/contracts";
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

  app.post("/projects/:projectId/share-tokens", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
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
    const share = await options.shares.getByToken(params.token);

    if (!share) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    const project = await options.projects.getById(share.projectId);

    if (!project) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    if (share.resourceType === "project") {
      const artifacts = await options.artifacts.listByProject(project.id);

      return ShareReviewPayloadSchema.parse({
        resourceType: "project",
        share,
        project,
        artifacts
      });
    }

    const artifact = await options.artifacts.getById(project.id, share.resourceId);

    if (!artifact) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    const [workspace, versions, comments] = await Promise.all([
      options.workspaces.getByArtifactId(artifact.id),
      options.versions.listByArtifactId(artifact.id),
      options.comments.listByArtifactId(artifact.id)
    ]);

    if (!workspace) {
      return sendApiError(reply, 404, {
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    }

    return ShareReviewPayloadSchema.parse({
      resourceType: "artifact",
      share,
      project,
      artifact,
      workspace: {
        intent: workspace.intent,
        sceneVersion: workspace.sceneDocument.version,
        rootNodeCount: workspace.sceneDocument.nodes.length,
        activeVersionId: workspace.activeVersionId,
        openCommentCount: comments.filter((comment) => comment.status === "open").length,
        versionCount: versions.length,
        updatedAt: workspace.updatedAt
      },
      latestVersion: versions[0] ?? null
    });
  });
};
