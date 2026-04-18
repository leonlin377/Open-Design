import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendApiError } from "../lib/api-errors";
import { getRequestSession, type OpenDesignAuth } from "../auth/session";
import type { ProjectRepository } from "../repositories/projects";

const createProjectBodySchema = z.object({
  name: z.string().min(1)
});

const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export interface ProjectRouteOptions {
  projects: ProjectRepository;
  auth: OpenDesignAuth;
}

export const registerProjectRoutes: FastifyPluginAsync<ProjectRouteOptions> =
  async (app, options) => {
    app.get("/projects", async (request) => {
      const session = await getRequestSession(options.auth, request);

      return options.projects.list({
        ownerUserId: session?.user.id
      });
    });

    app.get("/projects/:projectId", async (request, reply) => {
      const params = projectParamsSchema.parse(request.params);
      const session = await getRequestSession(options.auth, request);
      const project = await options.projects.getById(params.projectId);

      if (!project) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      if (project.ownerUserId && project.ownerUserId !== session?.user.id) {
        return sendApiError(reply, 404, {
          error: "Project not found",
          code: "PROJECT_NOT_FOUND",
          recoverable: false
        });
      }

      return project;
    });

    app.post("/projects", async (request, reply) => {
      const body = createProjectBodySchema.parse(request.body);
      const session = await getRequestSession(options.auth, request);
      const project = await options.projects.create({
        ...body,
        ownerUserId: session?.user.id
      });
      return reply.code(201).send(project);
    });
  };
