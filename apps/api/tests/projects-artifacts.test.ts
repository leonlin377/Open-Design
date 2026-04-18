import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("Projects and artifacts", () => {
  it("creates a project and artifact and lists artifacts", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Demo Project" }
      });

      expect(projectResponse.statusCode).toBe(201);
      const project = projectResponse.json();
      expect(project).toMatchObject({ name: "Demo Project" });
      expect(project.id).toBeTypeOf("string");

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Homepage", kind: "website" }
      });

      expect(artifactResponse.statusCode).toBe(201);
      const artifact = artifactResponse.json();
      expect(artifact).toMatchObject({
        projectId: project.id,
        name: "Homepage",
        kind: "website"
      });
      expect(artifact.id).toBeTypeOf("string");

      const listResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts`
      });

      expect(listResponse.statusCode).toBe(200);
      const artifacts = listResponse.json();
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        id: artifact.id,
        projectId: project.id,
        kind: "website"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when creating an artifact for a missing project", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects/missing-project/artifacts",
        payload: { name: "Homepage", kind: "website" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Project not found",
        code: "PROJECT_NOT_FOUND"
      });
    } finally {
      await app.close();
    }
  });
});
