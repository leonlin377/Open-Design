import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { AssetStorage } from "./asset-storage";
import {
  appendRequestIdToApiError,
  sendApiError
} from "./lib/api-errors";
import { createAppPersistence } from "./persistence";
import { registerRoutes } from "./routes/index";
import { captureSite, type SiteCaptureResult } from "./site-capture";

export interface AppOptions {
  logger?: boolean;
  assetStorage?: AssetStorage;
  siteCapture?: {
    captureSite(input: { url: string }): Promise<SiteCaptureResult>;
  };
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: true });
  const persistence = await createAppPersistence({
    env: process.env,
    assetStorage: options.assetStorage
  });

  app.decorateRequest("requestId", null);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);

  app.addHook("onRequest", async (request, reply) => {
    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
        ? requestIdHeader.trim()
        : randomUUID();

    request.requestId = requestId;
    reply.header("x-request-id", requestId);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn(
        {
          requestId: request.requestId,
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        "request validation failed"
      );

      return sendApiError(
        reply,
        400,
        appendRequestIdToApiError(
          {
            error: "Request validation failed",
            code: "VALIDATION_ERROR",
            recoverable: true,
            details: {
              issues: error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message
              }))
            }
          },
          request.requestId
        )
      );
    }

    throw error;
  });

  await app.register(registerRoutes, {
    prefix: "/api",
    projects: persistence.projects,
    artifacts: persistence.artifacts,
    workspaces: persistence.workspaces,
    versions: persistence.versions,
    comments: persistence.comments,
    designSystems: persistence.designSystems,
    shares: persistence.shares,
    assets: persistence.assets,
    assetStorage: persistence.assetStorage,
    auth: persistence.auth,
    authBaseURL: persistence.authBaseURL,
    authTrustedOrigins: persistence.authTrustedOrigins,
    diagnostics: {
      persistenceMode: persistence.mode,
      assetStorageProvider: persistence.assetStorage.provider
    },
    siteCapture: options.siteCapture ?? {
      captureSite
    }
  });

  app.addHook("onClose", async () => {
    await persistence.close();
  });

  return app;
}
