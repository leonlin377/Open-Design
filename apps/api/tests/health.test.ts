import { ArtifactKindSchema } from "@opendesign/contracts";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("GET /api/health", () => {
  it("returns service name and supported artifact kinds", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        service: "opendesign-api",
        artifactKinds: ArtifactKindSchema.options
      });
    } finally {
      await app.close();
    }
  });
});

describe("GET /api/ready", () => {
  it("returns readiness details including persistence and asset storage provider", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/api/ready" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        service: "opendesign-api",
        ready: true,
        persistence: {
          mode: "memory"
        },
        assetStorage: {
          provider: "memory"
        }
      });
    } finally {
      await app.close();
    }
  });
});

describe("GET /api/diagnostics", () => {
  it("returns request correlation data and runtime diagnostics", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/diagnostics",
        headers: {
          "x-request-id": "req_test_ops002"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-request-id"]).toBe("req_test_ops002");
      expect(response.json()).toMatchObject({
        service: "opendesign-api",
        requestId: "req_test_ops002",
        persistence: {
          mode: "memory"
        },
        assetStorage: {
          provider: "memory"
        },
        auth: {
          trustedOrigins: expect.any(Array)
        }
      });
    } finally {
      await app.close();
    }
  });
});

describe("request correlation", () => {
  it("attaches request ids to structured validation errors", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: {
          "x-request-id": "req_validation_ops002"
        },
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["x-request-id"]).toBe("req_validation_ops002");
      expect(response.json()).toMatchObject({
        code: "VALIDATION_ERROR",
        details: {
          requestId: "req_validation_ops002"
        }
      });
    } finally {
      await app.close();
    }
  });
});
