import {
  ArtifactThemeSchema,
  DEFAULT_ARTIFACT_THEME,
  type ArtifactTheme
} from "@opendesign/contracts/src/artifact-theme";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import { sendApiError } from "../lib/api-errors";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ArtifactThemeRepository } from "../repositories/artifact-themes";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ProjectRepository } from "../repositories/projects";

const themeParamsSchema = z.object({
  projectId: z.string().min(1),
  artifactId: z.string().min(1)
});

export interface ArtifactThemeRouteOptions {
  /**
   * Workspace repository is accepted for symmetry with neighbouring plugins —
   * themes don't currently mutate the workspace, but future wiring (e.g.
   * syncing theme tokens into the generated code workspace) will need it.
   */
  workspaces: ArtifactWorkspaceRepository;
  artifacts: ArtifactRepository;
  themes: ArtifactThemeRepository;
  projects: ProjectRepository;
  auth: OpenDesignAuth;
}

interface AuthorizedArtifactInput {
  projectId: string;
  artifactId: string;
}

export const registerArtifactThemeRoutes: FastifyPluginAsync<
  ArtifactThemeRouteOptions
> = async (app, options) => {
  async function resolveAuthorizedArtifact(
    request: FastifyRequest,
    input: AuthorizedArtifactInput
  ) {
    const session = await getRequestSession(options.auth, request);
    const project = await options.projects.getById(input.projectId);

    if (!project) {
      return { session, project: null, artifact: null };
    }

    if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
      // Owned projects must match the caller. Anonymous projects remain
      // readable/writable by anyone — consistent with the rest of the API.
      return { session, project: null, artifact: null };
    }

    const artifact = await options.artifacts.getById(input.projectId, input.artifactId);
    return { session, project, artifact };
  }

  app.get(
    "/projects/:projectId/artifacts/:artifactId/theme",
    async (request, reply) => {
      const params = themeParamsSchema.parse(request.params);
      const { project, artifact } = await resolveAuthorizedArtifact(request, params);

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

      const record = await options.themes.getByArtifactId(artifact.id);
      const theme: ArtifactTheme = record?.theme ?? DEFAULT_ARTIFACT_THEME;

      return {
        artifactId: artifact.id,
        theme,
        isDefault: record === null,
        updatedAt: record?.updatedAt ?? null
      };
    }
  );

  app.post(
    "/projects/:projectId/artifacts/:artifactId/theme",
    async (request, reply) => {
      const params = themeParamsSchema.parse(request.params);
      const body = z.object({ theme: ArtifactThemeSchema }).parse(request.body);
      const { project, artifact } = await resolveAuthorizedArtifact(request, params);

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

      const record = await options.themes.upsert({
        artifactId: artifact.id,
        theme: body.theme
      });

      return reply.code(200).send({
        artifactId: record.artifactId,
        theme: record.theme,
        isDefault: false,
        updatedAt: record.updatedAt
      });
    }
  );
};
