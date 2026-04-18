import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

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
});
