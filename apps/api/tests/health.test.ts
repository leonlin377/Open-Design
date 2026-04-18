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
