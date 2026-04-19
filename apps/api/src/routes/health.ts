import { ArtifactKindSchema } from "@opendesign/contracts";
import type { FastifyPluginAsync } from "fastify";

type HealthRouteOptions = {
  diagnostics: {
    persistenceMode: "memory" | "postgres";
    assetStorageProvider: "memory" | "s3";
  };
  authBaseURL: string;
  authTrustedOrigins: string[];
};

export const registerHealthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  options
) => {
  app.get("/health", async () => ({
    service: "opendesign-api",
    artifactKinds: ArtifactKindSchema.options
  }));

  app.get("/ready", async () => ({
    service: "opendesign-api",
    ready: true,
    persistence: {
      mode: options.diagnostics.persistenceMode
    },
    assetStorage: {
      provider: options.diagnostics.assetStorageProvider
    }
  }));

  app.get("/diagnostics", async (request) => ({
    service: "opendesign-api",
    requestId: request.requestId,
    persistence: {
      mode: options.diagnostics.persistenceMode
    },
    assetStorage: {
      provider: options.diagnostics.assetStorageProvider
    },
    auth: {
      baseURL: options.authBaseURL,
      trustedOrigins: options.authTrustedOrigins
    }
  }));
};
