import type { FastifyPluginAsync } from "fastify";
import type { OpenDesignAuth } from "../auth/session";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { ProjectRepository } from "../repositories/projects";
import { registerAuthRoutes } from "./auth";
import { registerArtifactRoutes } from "./artifacts";
import { registerHealthRoutes } from "./health";
import { registerProjectRoutes } from "./projects";

export interface RouteDependencies {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  auth: OpenDesignAuth;
  authBaseURL: string;
}

export const registerRoutes: FastifyPluginAsync<RouteDependencies> = async (
  app,
  options
) => {
  await app.register(registerHealthRoutes);
  await app.register(registerProjectRoutes, {
    projects: options.projects,
    auth: options.auth
  });
  await app.register(registerArtifactRoutes, {
    artifacts: options.artifacts,
    projects: options.projects,
    auth: options.auth
  });
  await app.register(registerAuthRoutes, {
    auth: options.auth,
    authBaseURL: options.authBaseURL
  });
};
