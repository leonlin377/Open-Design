import type { FastifyPluginAsync } from "fastify";
import type { OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { DesignSystemRepository } from "../repositories/design-systems";
import type { ProjectRepository } from "../repositories/projects";
import { registerAuthRoutes } from "./auth";
import { registerArtifactRoutes } from "./artifacts";
import { registerDesignSystemRoutes } from "./design-systems";
import { registerHealthRoutes } from "./health";
import { registerProjectRoutes } from "./projects";

export interface RouteDependencies {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  designSystems: DesignSystemRepository;
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
    workspaces: options.workspaces,
    versions: options.versions,
    comments: options.comments,
    designSystems: options.designSystems,
    auth: options.auth
  });
  await app.register(registerDesignSystemRoutes, {
    designSystems: options.designSystems,
    auth: options.auth
  });
  await app.register(registerAuthRoutes, {
    auth: options.auth,
    authBaseURL: options.authBaseURL
  });
};
