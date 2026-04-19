import type { FastifyPluginAsync } from "fastify";
import type { OpenDesignAuth } from "../auth/session";
import type { ArtifactCommentRepository } from "../repositories/artifact-comments";
import type { ArtifactVersionRepository } from "../repositories/artifact-versions";
import type { ArtifactWorkspaceRepository } from "../repositories/artifact-workspaces";
import type { ArtifactRepository } from "../repositories/artifacts";
import type { DesignSystemRepository } from "../repositories/design-systems";
import type { ProjectRepository } from "../repositories/projects";
import type { ShareTokenRepository } from "../repositories/share-tokens";
import type { AssetRepository } from "../repositories/assets";
import type { ExportJobRepository } from "../repositories/export-jobs";
import { registerAuthRoutes } from "./auth";
import { registerArtifactRoutes } from "./artifacts";
import { registerDesignSystemRoutes } from "./design-systems";
import { registerHealthRoutes } from "./health";
import { registerProjectRoutes } from "./projects";
import { registerShareRoutes } from "./shares";
import type { AssetStorage } from "../asset-storage";
import type { SiteCaptureResult } from "../site-capture";

export interface RouteDependencies {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  designSystems: DesignSystemRepository;
  shares: ShareTokenRepository;
  assets: AssetRepository;
  exportJobs: ExportJobRepository;
  assetStorage: AssetStorage;
  auth: OpenDesignAuth;
  authBaseURL: string;
  authTrustedOrigins: string[];
  diagnostics: {
    persistenceMode: "memory" | "postgres";
    assetStorageProvider: "memory" | "s3";
  };
  siteCapture: {
    captureSite(input: { url: string }): Promise<SiteCaptureResult>;
  };
}

export const registerRoutes: FastifyPluginAsync<RouteDependencies> = async (
  app,
  options
) => {
  await app.register(registerHealthRoutes, {
    diagnostics: options.diagnostics,
    authBaseURL: options.authBaseURL,
    authTrustedOrigins: options.authTrustedOrigins
  });
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
    exportJobs: options.exportJobs,
    assets: options.assets,
    assetStorage: options.assetStorage,
    auth: options.auth
  });
  await app.register(registerDesignSystemRoutes, {
    designSystems: options.designSystems,
    assets: options.assets,
    assetStorage: options.assetStorage,
    auth: options.auth,
    siteCapture: options.siteCapture
  });
  await app.register(registerShareRoutes, {
    projects: options.projects,
    artifacts: options.artifacts,
    workspaces: options.workspaces,
    versions: options.versions,
    comments: options.comments,
    shares: options.shares,
    auth: options.auth
  });
  await app.register(registerAuthRoutes, {
    auth: options.auth,
    authBaseURL: options.authBaseURL
  });
};
