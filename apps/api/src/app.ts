import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { sendApiError } from "./lib/api-errors";
import { createAppPersistence } from "./persistence";
import { registerRoutes } from "./routes/index";

export interface AppOptions {
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: true });
  const persistence = await createAppPersistence();

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn(
        {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        "request validation failed"
      );

      return sendApiError(reply, 400, {
        error: "Request validation failed",
        code: "VALIDATION_ERROR",
        recoverable: true,
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      });
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
    auth: persistence.auth,
    authBaseURL: persistence.authBaseURL
  });

  app.addHook("onClose", async () => {
    await persistence.close();
  });

  return app;
}
