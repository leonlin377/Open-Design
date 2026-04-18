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

      const getProjectResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}`
      });

      expect(getProjectResponse.statusCode).toBe(200);
      expect(getProjectResponse.json()).toMatchObject({
        id: project.id,
        name: "Demo Project"
      });

      const getArtifactResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}`
      });

      expect(getArtifactResponse.statusCode).toBe(200);
      expect(getArtifactResponse.json()).toMatchObject({
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

  it("returns 404 for missing project or artifact detail routes", async () => {
    const app = await buildApp();
    try {
      const missingProject = await app.inject({
        method: "GET",
        url: "/api/projects/missing-project"
      });

      expect(missingProject.statusCode).toBe(404);

      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Demo Project" }
      });

      const project = projectResponse.json();
      const missingArtifact = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/missing-artifact`
      });

      expect(missingArtifact.statusCode).toBe(404);
      expect(missingArtifact.json()).toEqual({
        error: "Artifact not found",
        code: "ARTIFACT_NOT_FOUND"
      });
    } finally {
      await app.close();
    }
  });

  it("seeds workspace state, creates snapshots, and resolves comments", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Atlas Commerce" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Launch Site", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      const workspacePayload = workspaceResponse.json();
      expect(workspacePayload.workspace).toMatchObject({
        artifactId: artifact.id,
        versionCount: 1,
        openCommentCount: 0
      });
      expect(workspacePayload.versions).toHaveLength(1);

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions`,
        payload: {
          label: "V2 Review",
          summary: "Review-ready snapshot"
        }
      });

      expect(versionResponse.statusCode).toBe(201);
      expect(versionResponse.json()).toMatchObject({
        artifactId: artifact.id,
        label: "V2 Review",
        source: "manual"
      });

      const commentResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/comments`,
        payload: {
          body: "Tighten the left rail spacing.",
          anchor: {
            elementId: "hero",
            selectionPath: ["root", "hero"]
          }
        }
      });

      expect(commentResponse.statusCode).toBe(201);
      const comment = commentResponse.json();
      expect(comment).toMatchObject({
        artifactId: artifact.id,
        status: "open"
      });

      const resolveCommentResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/comments/${comment.id}/resolve`
      });

      expect(resolveCommentResponse.statusCode).toBe(200);
      expect(resolveCommentResponse.json()).toMatchObject({
        id: comment.id,
        status: "resolved"
      });

      const refreshedWorkspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(refreshedWorkspaceResponse.statusCode).toBe(200);
      expect(refreshedWorkspaceResponse.json().workspace).toMatchObject({
        versionCount: 2,
        openCommentCount: 0
      });
    } finally {
      await app.close();
    }
  });
});
