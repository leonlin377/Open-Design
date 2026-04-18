import { ArtifactKindSchema } from "@opendesign/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ProjectRepository } from "../repositories/projects";

const artifactParamsSchema = z.object({
  projectId: z.string().min(1)
});

const createArtifactBodySchema = z.object({
  name: z.string().min(1),
  kind: ArtifactKindSchema
});

export interface ArtifactRouteOptions {
  artifacts: ArtifactRepository;
  projects: ProjectRepository;
  auth: OpenDesignAuth;
}

export const registerArtifactRoutes: FastifyPluginAsync<ArtifactRouteOptions> =
  async (app, options) => {
    app.get("/projects/:projectId/artifacts", async (request) => {
      const params = artifactParamsSchema.parse(request.params);
      const session = await getRequestSession(options.auth, request);
      const project = await options.projects.getById(params.projectId);

      if (!project) {
        return [];
      }

      if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
        return [];
      }

      return options.artifacts.listByProject(params.projectId);
    });

    app.post("/projects/:projectId/artifacts", async (request, reply) => {
      const params = artifactParamsSchema.parse(request.params);
      const body = createArtifactBodySchema.parse(request.body);
      const project = await options.projects.getById(params.projectId);
      const session = await getRequestSession(options.auth, request);

      if (!project) {
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
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
  };
