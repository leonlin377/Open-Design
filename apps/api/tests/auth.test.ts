import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { registerAuthRoutes } from "../src/routes/auth";

describe("Auth routes", () => {
  it("returns a null session shape", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/session"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ session: null });
    } finally {
      await app.close();
    }
  });

  it("delegates unknown auth paths to Better Auth instead of the placeholder", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/unknown-endpoint"
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
      expect(response.body).not.toContain("Auth not configured");
    } finally {
      await app.close();
    }
  });

  it("returns a structured auth handler failure payload when Better Auth throws", async () => {
    const app = Fastify();

    try {
      await app.register(registerAuthRoutes, {
        auth: {
          handler: async () => {
            throw new Error("boom");
          }
        } as never,
        authBaseURL: "http://127.0.0.1:4000"
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/sign-in/email",
        payload: {
          email: "user@example.com",
          password: "password"
        }
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: "Better Auth handler failed",
        code: "AUTH_HANDLER_FAILURE",
        recoverable: true,
        details: {
          stage: "auth-handler"
        }
      });
    } finally {
      await app.close();
    }
  });
});
