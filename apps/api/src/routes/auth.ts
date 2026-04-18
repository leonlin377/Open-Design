import type { FastifyPluginAsync } from "fastify";
import {
  buildAuthRequest,
  sendAuthResponse,
  sessionGuard,
  type OpenDesignAuth
} from "../auth/session";

export interface AuthRouteOptions {
  auth: OpenDesignAuth;
  authBaseURL: string;
}

export const registerAuthRoutes: FastifyPluginAsync<AuthRouteOptions> = async (
  app,
  options
) => {
  app.get("/auth/session", async (request) => ({
    session: await sessionGuard(options.auth, request)
  }));

  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    async handler(request, reply) {
      try {
        const response = await options.auth.handler(
          buildAuthRequest(request, options.authBaseURL)
        );
        return sendAuthResponse(reply, response);
      } catch (error) {
        request.log.error({ error }, "better-auth handler failed");
        return reply.code(500).send({
          error: "Better Auth handler failed",
          code: "AUTH_HANDLER_FAILURE"
        });
      }
    }
  });
};
