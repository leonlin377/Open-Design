import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
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

  await app.register(registerRoutes, {
    prefix: "/api",
    projects: persistence.projects,
    artifacts: persistence.artifacts,
    workspaces: persistence.workspaces,
    versions: persistence.versions,
    comments: persistence.comments,
    auth: persistence.auth,
    authBaseURL: persistence.authBaseURL
  });

  app.addHook("onClose", async () => {
    await persistence.close();
  });

  return app;
}
