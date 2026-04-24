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
import { defaultChatProvider } from "./chat-provider";
import { createImageProviderFromEnv } from "./image-provider";

export interface AppOptions {
  logger?: boolean;
  assetStorage?: AssetStorage;
  siteCapture?: {
    captureSite(input: { url: string }): Promise<SiteCaptureResult>;
  };
}

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function resolveTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set<string>();

  const webBase = normalizeOrigin(env.WEB_BASE_URL);
  if (webBase) {
    origins.add(webBase);
  }

  const extra = env.OPENDESIGN_TRUSTED_ORIGINS;
  if (typeof extra === "string" && extra.trim().length > 0) {
    for (const entry of extra.split(",")) {
      const origin = normalizeOrigin(entry);
      if (origin) {
        origins.add(origin);
      }
    }
  }

  if (origins.size === 0) {
    const port = env.WEB_PORT ?? "3000";
    const fallback = normalizeOrigin(`http://127.0.0.1:${port}`);
    if (fallback) {
      origins.add(fallback);
    }
  }

  return Array.from(origins);
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: true });
  const persistence = await createAppPersistence({
    env: process.env,
    assetStorage: options.assetStorage
  });

  app.decorateRequest("requestId", null);

  const trustedOrigins = resolveTrustedOrigins(process.env);
  const trustedOriginSet = new Set(trustedOrigins);

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin / non-browser requests (no Origin header) are allowed
      // through without emitting CORS headers.
      if (!origin) {
        callback(null, false);
        return;
      }

      if (trustedOriginSet.has(origin)) {
        callback(null, true);
        return;
      }

      // Reject unknown origins by simply not reflecting them — Fastify's cors
      // plugin omits `Access-Control-Allow-Origin` when the callback returns
      // `false`, which is what we want (no CORS bypass).
      callback(null, false);
    }
  });
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

  // The chat provider reads LITELLM_* + OPENDESIGN_CHAT_MODEL at call time,
  // so we can use the default singleton here. Image provider is constructed
  // once from the current environment — same contract as generation.ts.
  const chat = defaultChatProvider;
  const imageProvider = createImageProviderFromEnv(process.env);
  // Shared concurrency registry lifted from routes/artifacts.ts — both the
  // primary /generate route and the generation-extras plugin read/write this
  // map so 409 (already-running) / 429 (per-user quota) gates stay coherent.
  const activeGenerations = new Map<string, unknown>();

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
    exportJobs: persistence.exportJobs,
    assetStorage: persistence.assetStorage,
    chat,
    chatRepository: persistence.chat,
    themes: persistence.themes,
    imageProvider,
    activeGenerations,
    auth: persistence.auth,
    authBaseURL: persistence.authBaseURL,
    authTrustedOrigins: persistence.authTrustedOrigins,
    persistenceProbe: { ping: () => persistence.ping() },
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
