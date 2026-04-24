import { ArtifactKindSchema } from "@opendesign/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
}

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
          mode: "memory",
          status: "ok"
        },
        assetStorage: {
          provider: "memory",
          status: "ok"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("returns 503 with failure detail when an asset storage probe throws", async () => {
    const failingStorage = {
      provider: "memory" as const,
      uploadObject: vi.fn(async () => ({
        objectKey: "",
        sizeBytes: 0,
        contentType: "application/octet-stream"
      })),
      readObject: vi.fn(async () => null),
      ping: vi.fn(async () => {
        throw new Error("bucket unreachable");
      })
    };

    const app = await buildApp({ assetStorage: failingStorage });
    try {
      const response = await app.inject({ method: "GET", url: "/api/ready" });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        service: "opendesign-api",
        ready: false,
        persistence: {
          mode: "memory",
          status: "ok"
        },
        assetStorage: {
          provider: "memory",
          status: "error",
          message: "bucket unreachable"
        }
      });
      expect(failingStorage.ping).toHaveBeenCalled();
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

describe("CORS trusted-origin allowlist", () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("reflects the configured web origin when requested", async () => {
    process.env.WEB_BASE_URL = "http://127.0.0.1:3100";
    delete process.env.OPENDESIGN_TRUSTED_ORIGINS;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/health",
        headers: {
          origin: "http://127.0.0.1:3100",
          "access-control-request-method": "GET"
        }
      });

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:3100"
      );
      expect(response.headers["access-control-allow-credentials"]).toBe(
        "true"
      );
    } finally {
      await app.close();
    }
  });

  it("does not reflect unknown origins (no CORS bypass)", async () => {
    process.env.WEB_BASE_URL = "http://127.0.0.1:3100";
    delete process.env.OPENDESIGN_TRUSTED_ORIGINS;

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/health",
        headers: {
          origin: "https://evil.example.com",
          "access-control-request-method": "GET"
        }
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(
        response.headers["access-control-allow-credentials"]
      ).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("allows additional origins from OPENDESIGN_TRUSTED_ORIGINS", async () => {
    process.env.WEB_BASE_URL = "http://127.0.0.1:3100";
    process.env.OPENDESIGN_TRUSTED_ORIGINS =
      "https://app.opendesign.dev, https://staging.opendesign.dev";

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/health",
        headers: {
          origin: "https://staging.opendesign.dev",
          "access-control-request-method": "GET"
        }
      });

      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://staging.opendesign.dev"
      );
    } finally {
      await app.close();
    }
  });

  it("falls back to 127.0.0.1:${WEB_PORT} when no origins are configured", async () => {
    delete process.env.WEB_BASE_URL;
    delete process.env.OPENDESIGN_TRUSTED_ORIGINS;
    process.env.WEB_PORT = "3333";

    const app = await buildApp();
    try {
      const allowed = await app.inject({
        method: "OPTIONS",
        url: "/api/health",
        headers: {
          origin: "http://127.0.0.1:3333",
          "access-control-request-method": "GET"
        }
      });

      expect(allowed.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:3333"
      );
    } finally {
      await app.close();
    }
  });
});
