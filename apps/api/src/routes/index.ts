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
import type { ChatRepository } from "../repositories/chat";
import type { ArtifactThemeRepository } from "../repositories/artifact-themes";
import type { ChatProvider } from "../chat-provider";
import type { ImageProvider } from "../image-provider";
import { registerAuthRoutes } from "./auth";
import { registerArtifactRoutes } from "./artifacts";
import { registerDesignSystemRoutes } from "./design-systems";
import { registerHealthRoutes } from "./health";
import { registerProjectRoutes } from "./projects";
import { registerShareRoutes } from "./shares";
import { registerChatRoutes } from "./chat";
import { registerArtifactThemeRoutes } from "./artifact-theme";
import { registerArtifactImageRoutes } from "./artifact-images";
import { registerExportExtrasRoutes } from "./artifact-export-extras";
import { registerArtifactRemixRoutes } from "./artifact-remix";
import { registerGenerationExtrasRoutes } from "./artifact-generation-extras";
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
  chat: ChatProvider;
  chatRepository: ChatRepository;
  themes: ArtifactThemeRepository;
  imageProvider: ImageProvider;
  /**
   * Shared in-process registry of currently-running generations. The main
   * artifacts plugin (primary /generate route) and the generation-extras
   * plugin (variations/refine) both consume this map so per-artifact and
   * per-user quota/409 state stays consistent across plugins.
   */
  activeGenerations: Map<string, unknown>;
  auth: OpenDesignAuth;
  authBaseURL: string;
  authTrustedOrigins: string[];
  persistenceProbe: { ping(): Promise<void> };
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
    authTrustedOrigins: options.authTrustedOrigins,
    persistence: options.persistenceProbe,
    assetStorage: options.assetStorage
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
    auth: options.auth,
    activeGenerations: options.activeGenerations
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
  // Round-4 plugins — registered after the primary artifact routes so their
  // path prefixes resolve last in the case of any overlap.
  await app.register(registerChatRoutes, {
    chat: options.chat,
    chatRepository: options.chatRepository,
    projects: options.projects,
    artifacts: options.artifacts,
    workspaces: options.workspaces,
    auth: options.auth
  });
  await app.register(registerArtifactThemeRoutes, {
    workspaces: options.workspaces,
    artifacts: options.artifacts,
    themes: options.themes,
    projects: options.projects,
    auth: options.auth
  });
  await app.register(registerArtifactImageRoutes, {
    assets: options.assets,
    assetStorage: options.assetStorage,
    artifacts: options.artifacts,
    projects: options.projects,
    auth: options.auth,
    imageProvider: options.imageProvider
  });
  await app.register(registerExportExtrasRoutes, {
    artifacts: options.artifacts,
    projects: options.projects,
    workspaces: options.workspaces,
    exportJobs: options.exportJobs,
    auth: options.auth
  });
  await app.register(registerArtifactRemixRoutes, {
    artifacts: options.artifacts,
    workspaces: options.workspaces,
    versions: options.versions,
    comments: options.comments,
    assets: options.assets,
    projects: options.projects,
    auth: options.auth
  });
  await app.register(registerGenerationExtrasRoutes, {
    artifacts: options.artifacts,
    projects: options.projects,
    workspaces: options.workspaces,
    versions: options.versions,
    designSystems: options.designSystems,
    auth: options.auth,
    // The extras plugin types this map as Map<string, ActiveGenerationSlot>;
    // the shared lifted map stores a compatible superset written by the
    // primary /generate route (see routes/artifacts.ts). Narrowing is safe
    // because ActiveGenerationSlot is a structural subset of InFlightGeneration.
    activeGenerations: options.activeGenerations as Map<
      string,
      import("./artifact-generation-extras").ActiveGenerationSlot
    >
  });
  await app.register(registerAuthRoutes, {
    auth: options.auth,
    authBaseURL: options.authBaseURL
  });
};
