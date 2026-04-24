import { afterEach, describe, expect, it, vi } from "vitest";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { buildApp } from "../src/app";
import { InMemoryArtifactVersionRepository } from "../src/repositories/artifact-versions";

const originalFetch = globalThis.fetch;
const originalLiteLLMApiBaseUrl = process.env.LITELLM_API_BASE_URL;
const originalGenerationModel = process.env.OPENDESIGN_GENERATION_MODEL;
const originalGenerationTimeoutMs = process.env.OPENDESIGN_GENERATION_TIMEOUT_MS;
const originalGenerationSessionTimeoutMs =
  process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS;
const originalGenerationMaxConcurrent =
  process.env.OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER;

function parseSseEvents(body: string) {
  return body
    .trim()
    .split(/\r?\n\r?\n/)
    .map((frame) =>
      frame
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
    )
    .filter((value) => value.length > 0)
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();

  if (originalLiteLLMApiBaseUrl === undefined) {
    delete process.env.LITELLM_API_BASE_URL;
  } else {
    process.env.LITELLM_API_BASE_URL = originalLiteLLMApiBaseUrl;
  }

  if (originalGenerationModel === undefined) {
    delete process.env.OPENDESIGN_GENERATION_MODEL;
  } else {
    process.env.OPENDESIGN_GENERATION_MODEL = originalGenerationModel;
  }

  if (originalGenerationTimeoutMs === undefined) {
    delete process.env.OPENDESIGN_GENERATION_TIMEOUT_MS;
  } else {
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = originalGenerationTimeoutMs;
  }

  if (originalGenerationSessionTimeoutMs === undefined) {
    delete process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS;
  } else {
    process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS =
      originalGenerationSessionTimeoutMs;
  }

  if (originalGenerationMaxConcurrent === undefined) {
    delete process.env.OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER;
  } else {
    process.env.OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER =
      originalGenerationMaxConcurrent;
  }
});

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
        code: "PROJECT_NOT_FOUND",
        recoverable: false
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
        code: "ARTIFACT_NOT_FOUND",
        recoverable: false
      });
    } finally {
      await app.close();
    }
  });

  it("creates and resolves a project share token", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Review Hub" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Review Site", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const shareCreateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/share-tokens`,
        payload: {
          role: "viewer"
        }
      });

      expect(shareCreateResponse.statusCode).toBe(201);
      const shareCreatePayload = shareCreateResponse.json();
      expect(shareCreatePayload.share.resourceType).toBe("project");
      expect(shareCreatePayload.share.role).toBe("viewer");
      expect(shareCreatePayload.sharePath).toMatch(/^\/share\//);

      const sharedReviewResponse = await app.inject({
        method: "GET",
        url: `/api/share/${shareCreatePayload.share.token}`
      });

      expect(sharedReviewResponse.statusCode).toBe(200);
      expect(sharedReviewResponse.json()).toMatchObject({
        resourceType: "project",
        project: {
          id: project.id,
          name: "Review Hub"
        },
        artifacts: [
          expect.objectContaining({
            id: artifact.id,
            kind: "website"
          })
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("creates and resolves an artifact share token with workspace review data", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Artifact Review" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Launch Deck", kind: "slides" }
      });
      const artifact = artifactResponse.json();

      await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      const shareCreateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/share-tokens`
      });

      expect(shareCreateResponse.statusCode).toBe(201);
      const shareCreatePayload = shareCreateResponse.json();
      expect(shareCreatePayload.share.resourceType).toBe("artifact");
      expect(shareCreatePayload.share.role).toBe("viewer");

      const sharedReviewResponse = await app.inject({
        method: "GET",
        url: `/api/share/${shareCreatePayload.share.token}`
      });

      expect(sharedReviewResponse.statusCode).toBe(200);
      expect(sharedReviewResponse.json()).toMatchObject({
        resourceType: "artifact",
        project: {
          id: project.id
        },
        artifact: {
          id: artifact.id,
          kind: "slides"
        },
        sceneNodes: [],
        comments: [],
        workspace: {
          sceneVersion: 1,
          versionCount: 1
        }
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 for a missing share token", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/share/missing-token"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Share token not found",
        code: "SHARE_TOKEN_NOT_FOUND",
        recoverable: false
      });
    } finally {
      await app.close();
    }
  });

  it("uploads artifact assets, exposes them in workspace payloads, and serves bytes", async () => {
    const app = await buildApp({
      assetStorage: {
        provider: "memory",
        uploadObject: vi.fn(async ({ objectKey, bytes, contentType }) => ({
          objectKey,
          sizeBytes: bytes.byteLength,
          contentType
        })),
        readObject: vi.fn(async ({ objectKey }) => ({
          bytes: Buffer.from(`stored:${objectKey}`),
          contentType: "image/png"
        }))
      }
    });

    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Asset Workspace" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Launch Site", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const uploadResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/assets`,
        payload: {
          filename: "hero-shot.png",
          contentType: "image/png",
          bytesBase64: Buffer.from("hero-image").toString("base64")
        }
      });

      expect(uploadResponse.statusCode).toBe(201);
      expect(uploadResponse.json()).toMatchObject({
        artifactId: artifact.id,
        kind: "artifact-upload",
        filename: "hero-shot.png",
        contentType: "image/png",
        sizeBytes: 10
      });

      const uploadedAsset = uploadResponse.json();

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json()).toMatchObject({
        assets: [
          expect.objectContaining({
            id: uploadedAsset.id,
            artifactId: artifact.id,
            filename: "hero-shot.png"
          })
        ]
      });

      const listResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/assets`
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toEqual([
        expect.objectContaining({
          id: uploadedAsset.id,
          artifactId: artifact.id,
          filename: "hero-shot.png"
        })
      ]);

      const readResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/assets/${uploadedAsset.id}`
      });

      expect(readResponse.statusCode).toBe(200);
      expect(readResponse.headers["content-type"]).toContain("image/png");
      expect(readResponse.body).toContain("stored:artifacts/");
    } finally {
      await app.close();
    }
  });

  it("returns 404 when reading an asset through the wrong artifact scope", async () => {
    const app = await buildApp({
      assetStorage: {
        provider: "memory",
        uploadObject: vi.fn(async ({ objectKey, bytes, contentType }) => ({
          objectKey,
          sizeBytes: bytes.byteLength,
          contentType
        })),
        readObject: vi.fn(async () => ({
          bytes: Buffer.from("hero-image"),
          contentType: "image/png"
        }))
      }
    });

    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Scoped Assets" }
      });
      const project = projectResponse.json();

      const [firstArtifactResponse, secondArtifactResponse] = await Promise.all([
        app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Artifact A", kind: "website" }
        }),
        app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Artifact B", kind: "website" }
        })
      ]);

      const firstArtifact = firstArtifactResponse.json();
      const secondArtifact = secondArtifactResponse.json();

      const uploadResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${firstArtifact.id}/assets`,
        payload: {
          filename: "hero-shot.png",
          contentType: "image/png",
          bytesBase64: Buffer.from("hero-image").toString("base64")
        }
      });

      const uploadedAsset = uploadResponse.json();
      const readResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${secondArtifact.id}/assets/${uploadedAsset.id}`
      });

      expect(readResponse.statusCode).toBe(404);
      expect(readResponse.json()).toMatchObject({
        code: "ARTIFACT_NOT_FOUND"
      });
    } finally {
      await app.close();
    }
  });

  it("blocks viewer links from commenting but allows commenter links", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Role Review" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Launch Site", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const viewerShareResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/share-tokens`,
        payload: {
          role: "viewer"
        }
      });
      const viewerShare = viewerShareResponse.json().share;

      const blockedCommentResponse = await app.inject({
        method: "POST",
        url: `/api/share/${viewerShare.token}/comments`,
        payload: {
          body: "Viewer should not be allowed to comment.",
          anchor: {
            elementId: "artifact-canvas",
            selectionPath: ["artifact-canvas"]
          }
        }
      });

      expect(blockedCommentResponse.statusCode).toBe(403);
      expect(blockedCommentResponse.json()).toMatchObject({
        code: "SHARE_ROLE_FORBIDDEN"
      });

      const commenterShareResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/share-tokens`,
        payload: {
          role: "commenter"
        }
      });
      const commenterShare = commenterShareResponse.json().share;

      const allowedCommentResponse = await app.inject({
        method: "POST",
        url: `/api/share/${commenterShare.token}/comments`,
        payload: {
          body: "Commenter feedback lands on the shared artifact.",
          anchor: {
            elementId: "hero_section",
            selectionPath: ["scene", "hero_section"]
          }
        }
      });

      expect(allowedCommentResponse.statusCode).toBe(201);
      expect(allowedCommentResponse.json()).toMatchObject({
        artifactId: artifact.id,
        body: "Commenter feedback lands on the shared artifact.",
        status: "open",
        anchor: {
          elementId: "hero_section",
          selectionPath: ["scene", "hero_section"]
        }
      });
    } finally {
      await app.close();
    }
  });

  it("lets editor links update scene nodes and resolve comments", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Editor Review" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Editor Prototype", kind: "prototype" }
      });
      const artifact = artifactResponse.json();

      await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      const editorShareResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/share-tokens`,
        payload: {
          role: "editor"
        }
      });
      const editorShare = editorShareResponse.json().share;

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/share/${editorShare.token}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendResponse.statusCode).toBe(201);

      const sharedStateResponse = await app.inject({
        method: "GET",
        url: `/api/share/${editorShare.token}`
      });
      const sharedState = sharedStateResponse.json();
      const appendedNodeId = sharedState.sceneNodes[0].id;

      const updateResponse = await app.inject({
        method: "POST",
        url: `/api/share/${editorShare.token}/scene/nodes/${appendedNodeId}`,
        payload: {
          name: "Edited Screen",
          headline: "Editor changed the shared prototype."
        }
      });

      expect(updateResponse.statusCode).toBe(200);

      const commentResponse = await app.inject({
        method: "POST",
        url: `/api/share/${editorShare.token}/comments`,
        payload: {
          body: "Resolve me from the editor link.",
          anchor: {
            elementId: appendedNodeId,
            selectionPath: ["scene", appendedNodeId]
          }
        }
      });
      const comment = commentResponse.json();
      expect(comment).toMatchObject({
        anchor: {
          elementId: appendedNodeId,
          selectionPath: ["scene", appendedNodeId]
        }
      });

      const resolveResponse = await app.inject({
        method: "POST",
        url: `/api/share/${editorShare.token}/comments/${comment.id}/resolve`
      });

      expect(resolveResponse.statusCode).toBe(200);
      expect(resolveResponse.json()).toMatchObject({
        id: comment.id,
        status: "resolved"
      });

      const refreshedSharedState = await app.inject({
        method: "GET",
        url: `/api/share/${editorShare.token}`
      });

      expect(refreshedSharedState.statusCode).toBe(200);
      expect(refreshedSharedState.json()).toMatchObject({
        share: {
          role: "editor"
        },
        sceneNodes: [
          expect.objectContaining({
            id: appendedNodeId,
            name: "Edited Screen"
          })
        ],
        comments: [
          expect.objectContaining({
            id: comment.id,
            status: "resolved"
          })
        ]
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

      const appendHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendHeroResponse.statusCode).toBe(201);
      expect(appendHeroResponse.json().appendedNode).toMatchObject({
        type: "section",
        name: "Hero Section"
      });
      const heroNodeId = appendHeroResponse.json().appendedNode.id;

      const updateHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${heroNodeId}`,
        payload: {
          name: "Updated Hero",
          headline: "Updated cinematic headline",
          body: "Updated artifact body copy"
        }
      });

      expect(updateHeroResponse.statusCode).toBe(200);
      expect(updateHeroResponse.json().workspace.sceneDocument).toMatchObject({
        version: 3
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
        openCommentCount: 0,
        sceneDocument: {
          version: 3
        }
      });
      expect(refreshedWorkspaceResponse.json().workspace.sceneDocument.nodes).toHaveLength(1);
      expect(
        refreshedWorkspaceResponse.json().workspace.sceneDocument.nodes[0]
      ).toMatchObject({
        name: "Updated Hero",
        props: {
          headline: "Updated cinematic headline",
          body: "Updated artifact body copy"
        }
      });
    } finally {
      await app.close();
    }
  });

  it("auto-syncs a scene-derived code workspace when scene sections are appended", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Auto Sync Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Auto Sync Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendResponse.statusCode).toBe(201);
      expect(appendResponse.json().workspace.codeWorkspace).toMatchObject({
        baseSceneVersion: 2
      });
      expect(
        appendResponse.json().workspace.codeWorkspace.files["/App.tsx"]
      ).toContain("Hero Section");
    } finally {
      await app.close();
    }
  });

  it("preserves a user-modified code workspace when later scene edits occur", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Preserve Code Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Preserve Code Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });
      const appendedNodeId = appendResponse.json().appendedNode.id as string;

      const saveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx":
              "export default function App() { return <main>custom preserved scaffold</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: rebeccapurple; }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"preserve-code","private":true}'
          },
          expectedUpdatedAt: appendResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      expect(saveResponse.statusCode).toBe(200);

      const updateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${appendedNodeId}`,
        payload: {
          headline: "Updated cinematic headline"
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(
        updateResponse.json().workspace.codeWorkspace.files["/App.tsx"]
      ).toContain("custom preserved scaffold");
      expect(updateResponse.json().workspace.codeWorkspace.baseSceneVersion).toBe(2);
    } finally {
      await app.close();
    }
  });

  it("syncs supported App.tsx section edits back into the scene on code save", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Code To Scene Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Code To Scene Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendResponse.statusCode).toBe(201);

      const generatedBundle = buildArtifactSourceBundle({
        artifactKind: "website",
        artifactName: artifact.name,
        prompt: appendResponse.json().workspace.intent,
        sceneNodes: appendResponse.json().workspace.sceneDocument.nodes
      });
      const currentHeroProps = appendResponse.json().workspace.sceneDocument.nodes[0].props as {
        headline: string;
        body: string;
      };

      const saveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            ...generatedBundle.files,
            "/opendesign.sync.json": "",
            "/App.tsx": generatedBundle.files["/App.tsx"]
              .replace(currentHeroProps.headline, "Code-driven headline")
              .replace(currentHeroProps.body, "Body copy updated from supported code sync.")
          },
          expectedUpdatedAt: appendResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().workspace.sceneDocument).toMatchObject({
        version: 3,
        nodes: [
          {
            props: {
              headline: "Code-driven headline",
              body: "Body copy updated from supported code sync."
            }
          }
        ]
      });
      expect(saveResponse.json().workspace.codeWorkspace).toMatchObject({
        baseSceneVersion: 3
      });
      expect(saveResponse.json().sceneSync).toMatchObject({
        status: "synced"
      });
    } finally {
      await app.close();
    }
  });

  it("syncs supported stable payload edits back into the scene on code save", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Sync Payload Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Sync Payload Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendResponse.statusCode).toBe(201);

      const generatedBundle = buildArtifactSourceBundle({
        artifactKind: "website",
        artifactName: artifact.name,
        prompt: appendResponse.json().workspace.intent,
        sceneNodes: appendResponse.json().workspace.sceneDocument.nodes
      });
      const syncPayload = JSON.parse(generatedBundle.files["/opendesign.sync.json"]!);
      syncPayload.sections[0].headline = "Payload-driven headline";
      syncPayload.sections[0].body = "Body copy updated from stable sync payload.";

      const saveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            ...generatedBundle.files,
            "/opendesign.sync.json": JSON.stringify(syncPayload, null, 2)
          },
          expectedUpdatedAt: appendResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().workspace.sceneDocument).toMatchObject({
        version: 3,
        nodes: [
          {
            props: {
              headline: "Payload-driven headline",
              body: "Body copy updated from stable sync payload."
            }
          }
        ]
      });
      expect(saveResponse.json().sceneSync).toMatchObject({
        status: "synced"
      });
    } finally {
      await app.close();
    }
  });

  it("treats prototype root nodes as screens and keeps version flows coherent without website code sync", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Prototype Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Prototype Artifact", kind: "prototype" }
      });
      const artifact = artifactResponse.json();

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace).toMatchObject({
        sceneDocument: {
          kind: "prototype",
          version: 1
        },
        codeWorkspace: null,
        syncPlan: {
          mode: "constrained",
          targetMode: "code-advanced"
        }
      });

      const appendHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendHeroResponse.statusCode).toBe(201);
      expect(appendHeroResponse.json().appendedNode).toMatchObject({
        type: "screen",
        name: "Hero Screen"
      });
      // SYNC-005: scene→code sync now emits a prototype scaffold for
      // non-website artifacts, so codeWorkspace is populated.
      expect(appendHeroResponse.json().workspace.codeWorkspace?.files["/App.tsx"]).toContain(
        "const screens ="
      );

      const appendCtaResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "cta"
        }
      });

      expect(appendCtaResponse.statusCode).toBe(201);
      expect(appendCtaResponse.json().appendedNode).toMatchObject({
        type: "screen-cta",
        name: "Action Screen"
      });
      const ctaNodeId = appendCtaResponse.json().appendedNode.id as string;

      const updateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${ctaNodeId}`,
        payload: {
          headline: "Confirm the selected plan.",
          body: "Guide the user into the final confirmation step."
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().workspace.codeWorkspace?.files["/App.tsx"]).toContain(
        "Confirm the selected plan."
      );
      expect(updateResponse.json().workspace.sceneDocument).toMatchObject({
        version: 4,
        nodes: [
          {
            type: "screen"
          },
          {
            type: "screen-cta",
            props: {
              headline: "Confirm the selected plan.",
              body: "Guide the user into the final confirmation step."
            }
          }
        ]
      });

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions`,
        payload: {
          label: "Prototype Review",
          summary: "Prototype checkpoint"
        }
      });

      expect(versionResponse.statusCode).toBe(201);
      const version = versionResponse.json();

      const htmlExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(htmlExportResponse.statusCode).toBe(200);
      expect(htmlExportResponse.body).toContain("Prototype Flow");
      expect(htmlExportResponse.body).toContain("Confirm the selected plan.");

      const sourceExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(sourceExportResponse.statusCode).toBe(200);
      expect(sourceExportResponse.json().files["/App.tsx"]).toContain("const screens =");
      expect(sourceExportResponse.json().files["/App.tsx"]).toContain("useState");

      const flowExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/prototype-flow`
      });

      expect(flowExportResponse.statusCode).toBe(200);
      expect(flowExportResponse.headers["content-disposition"]).toContain("-flow.json");
      expect(flowExportResponse.json()).toMatchObject({
        artifactKind: "prototype",
        startScreenId: appendHeroResponse.json().appendedNode.id,
        screens: [
          expect.objectContaining({
            id: appendHeroResponse.json().appendedNode.id,
            nodeType: "screen"
          })
        ],
        screenCtas: [
          expect.objectContaining({
            id: appendCtaResponse.json().appendedNode.id,
            nodeType: "screen-cta",
            headline: "Confirm the selected plan."
          })
        ]
      });

      const handoffExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/handoff-bundle`
      });

      expect(handoffExportResponse.statusCode).toBe(200);
      expect(handoffExportResponse.json()).toMatchObject({
        filenameBase: "prototype-artifact",
        manifest: {
          artifact: {
            kind: "prototype"
          },
          exports: {
            structured: {
              path: "/exports/prototype-flow.json",
              kind: "prototype-flow"
            }
          }
        },
        files: {
          "/exports/prototype-flow.json": expect.stringContaining(
            `"startScreenId": "${appendHeroResponse.json().appendedNode.id}"`
          )
        }
      });

      const driftResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions/${version.id}/diff`
      });

      expect(driftResponse.statusCode).toBe(200);
      expect(driftResponse.json().diff).toMatchObject({
        scene: {
          changedNodeCount: 0
        },
        code: {
          currentHasCodeWorkspace: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("treats slides root nodes as slides and keeps deck flows coherent without website code sync", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Slides Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Slides Artifact", kind: "slides" }
      });
      const artifact = artifactResponse.json();

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace).toMatchObject({
        sceneDocument: {
          kind: "slides",
          version: 1
        },
        codeWorkspace: null,
        syncPlan: {
          mode: "constrained",
          targetMode: "code-advanced"
        }
      });

      const appendHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      expect(appendHeroResponse.statusCode).toBe(201);
      expect(appendHeroResponse.json().appendedNode).toMatchObject({
        type: "slide-title",
        name: "Title Slide"
      });
      // SYNC-005: scene→code sync now emits a slides scaffold for
      // non-website artifacts, so codeWorkspace is populated.
      expect(appendHeroResponse.json().workspace.codeWorkspace?.files["/App.tsx"]).toContain(
        "const slides ="
      );

      const appendGridResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "feature-grid"
        }
      });

      expect(appendGridResponse.statusCode).toBe(201);
      expect(appendGridResponse.json().appendedNode).toMatchObject({
        type: "slide-content",
        name: "Content Slide"
      });
      const slideNodeId = appendGridResponse.json().appendedNode.id as string;

      const updateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${slideNodeId}`,
        payload: {
          title: "Operating system lanes",
          body: "Close on the board-level operating cadence."
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      // Scene update carries `title` into scene props — that field is
      // intentionally outside the slide-content scaffold allowlist, so
      // scene→code sync fails closed and codeWorkspace retains the prior
      // successful emission (still populated, just not mirroring the new
      // `title`). The scene itself reflects the update as asserted below.
      expect(updateResponse.json().workspace.codeWorkspace?.files["/App.tsx"]).toContain(
        "const slides ="
      );
      expect(updateResponse.json().workspace.sceneDocument).toMatchObject({
        version: 4,
        nodes: [
          {
            type: "slide-title"
          },
          {
            type: "slide-content",
            props: {
              title: "Operating system lanes",
              body: "Close on the board-level operating cadence."
            }
          }
        ]
      });

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions`,
        payload: {
          label: "Deck Review",
          summary: "Slides checkpoint"
        }
      });

      expect(versionResponse.statusCode).toBe(201);
      const version = versionResponse.json();

      const htmlExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(htmlExportResponse.statusCode).toBe(200);
      expect(htmlExportResponse.body).toContain("Slides Deck");
      expect(htmlExportResponse.body).toContain("Operating system lanes");

      const sourceExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(sourceExportResponse.statusCode).toBe(200);
      expect(sourceExportResponse.json().files["/App.tsx"]).toContain("const slides =");
      expect(sourceExportResponse.json().files["/App.tsx"]).toContain("Slides Deck");

      const deckExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/slides-deck`
      });

      expect(deckExportResponse.statusCode).toBe(200);
      expect(deckExportResponse.headers["content-disposition"]).toContain("-deck.json");
      expect(deckExportResponse.json()).toMatchObject({
        artifactKind: "slides",
        aspectRatio: "16:9",
        slides: [
          expect.objectContaining({
            id: appendHeroResponse.json().appendedNode.id,
            slideNumber: 1
          }),
          expect.objectContaining({
            id: appendGridResponse.json().appendedNode.id,
            slideNumber: 2
          })
        ]
      });

      const driftResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions/${version.id}/diff`
      });

      expect(driftResponse.statusCode).toBe(200);
      expect(driftResponse.json().diff).toMatchObject({
        scene: {
          changedNodeCount: 0
        },
        code: {
          currentHasCodeWorkspace: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("generates an artifact pass from a prompt and persists the resulting workspace", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Prompt Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Prompt Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const generateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: {
          prompt: "Create a launch page with a feature grid and a conversion CTA."
        }
      });

      expect(generateResponse.statusCode).toBe(201);
      expect(generateResponse.json()).toMatchObject({
        generation: {
          plan: {
            provider: "heuristic",
            sections: ["hero", "feature-grid", "cta"]
          },
          diagnostics: {
            provider: "heuristic",
            transport: "fallback",
            warning: expect.any(String)
          },
          scenePatch: {
            mode: "append-root-sections",
            appendedNodes: [
              expect.objectContaining({
                template: "hero"
              }),
              expect.objectContaining({
                template: "feature-grid"
              }),
              expect.objectContaining({
                template: "cta"
              })
            ]
          },
          codePatch: {
            mode: "synced",
            filesTouched: expect.arrayContaining(["/App.tsx"])
          },
          commentResolution: {
            mode: "none"
          }
        },
        version: {
          artifactId: artifact.id,
          source: "prompt"
        },
        workspace: {
          activeVersionId: generateResponse.json().version.id,
          codeWorkspace: {
            baseSceneVersion: 4
          }
        }
      });
      expect(generateResponse.json().generation.scenePatch.appendedNodes).toHaveLength(3);

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace).toMatchObject({
        intent:
          "Generate a website artifact for Prompt Artifact: Create a launch page with a feature grid and a conversion CTA.",
        activeVersionId: generateResponse.json().version.id,
        sceneDocument: {
          version: 4
        }
      });
      expect(workspaceResponse.json().workspace.sceneDocument.nodes).toHaveLength(3);
      expect(workspaceResponse.json().versions[0]).toMatchObject({
        source: "prompt"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects artifact-specific exports on the wrong artifact kind", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Wrong Export Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Website Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const prototypeExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/prototype-flow`
      });

      expect(prototypeExportResponse.statusCode).toBe(409);
      expect(prototypeExportResponse.json()).toMatchObject({
        code: "EXPORT_NOT_SUPPORTED"
      });

      const slidesExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/slides-deck`
      });

      expect(slidesExportResponse.statusCode).toBe(409);
      expect(slidesExportResponse.json()).toMatchObject({
        code: "EXPORT_NOT_SUPPORTED"
      });
    } finally {
      await app.close();
    }
  });

  it("attaches a design system pack to the workspace and grounds the next generation pass", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Grounded Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Grounded Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const importResponse = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/local",
        payload: {
          absolutePath: "/Users/leon/design-systems/atlas-ui",
          files: [
            {
              path: "tokens/theme.json",
              content: JSON.stringify({
                colors: {
                  primary: "#111827"
                },
                typography: {
                  display: {
                    fontSize: "72px"
                  }
                }
              })
            },
            {
              path: "components/button.tsx",
              content: "export function Button() { return <button />; }"
            }
          ]
        }
      });

      expect(importResponse.statusCode).toBe(201);
      const pack = importResponse.json().pack;

      const attachResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/design-system`,
        payload: {
          designSystemPackId: pack.id
        }
      });

      expect(attachResponse.statusCode).toBe(200);
      expect(attachResponse.json().workspace.sceneDocument.metadata).toMatchObject({
        designSystemPackId: pack.id
      });

      const generateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: {
          prompt: "Create a launch page with a feature grid and a conversion CTA."
        }
      });

      expect(generateResponse.statusCode).toBe(201);
      expect(generateResponse.json().generation.plan).toMatchObject({
        provider: "heuristic",
        designSystem: {
          id: pack.id,
          name: "atlas-ui"
        }
      });
      expect(generateResponse.json().workspace.sceneDocument.metadata).toMatchObject({
        designSystemPackId: pack.id
      });
      expect(generateResponse.json().workspace.sceneDocument.nodes[0]).toMatchObject({
        props: {
          eyebrow: "atlas-ui System",
          headline: "Grounded Artifact adopts atlas-ui hierarchy."
        }
      });
    } finally {
      await app.close();
    }
  });

  it("streams generation progress events when the client requests text/event-stream", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Stream Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Stream Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: {
          accept: "text/event-stream"
        },
        payload: {
          prompt: "Create a cinematic launch page with feature proof and a CTA."
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");

      const events = parseSseEvents(response.body);
      expect(events.map((event) => event.type)).toEqual([
        "started",
        "planning",
        "applying",
        "completed"
      ]);
      expect(events[3]).toMatchObject({
        type: "completed",
        result: {
          generation: {
            plan: {
              prompt: "Create a cinematic launch page with feature proof and a CTA."
            }
          }
        }
      });
    } finally {
      await app.close();
    }
  });

  it("returns a provider-specific timeout error for JSON generation requests", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = "5";

    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;

      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });

      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Timeout Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Timeout Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: {
          prompt: "Create a launch page with a hero and CTA."
        }
      });

      expect(response.statusCode).toBe(504);
      expect(response.json()).toMatchObject({
        code: "GENERATION_TIMEOUT",
        recoverable: true
      });
    } finally {
      await app.close();
    }
  });

  it("streams provider-specific failure events when generation cannot reach LiteLLM", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";

    globalThis.fetch = vi.fn(async () =>
      new Response("gateway failed", {
        status: 502,
        headers: {
          "content-type": "text/plain"
        }
      })
    ) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Failure Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Failure Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: {
          accept: "text/event-stream"
        },
        payload: {
          prompt: "Create a launch page with a hero and CTA."
        }
      });

      expect(response.statusCode).toBe(200);
      const events = parseSseEvents(response.body);
      expect(events.map((event) => event.type)).toEqual([
        "started",
        "planning",
        "failed"
      ]);
      expect(events[2]).toMatchObject({
        type: "failed",
        error: {
          code: "GENERATION_PROVIDER_FAILURE",
          recoverable: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("returns an invalid scene patch error when generation applies duplicate scene node ids", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "Build a cinematic launch surface for Atlas.",
                  rationale: "Use repeated hero sections to trigger a duplicate scene patch.",
                  sections: ["hero", "hero"],
                  provider: "heuristic"
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    ) as typeof globalThis.fetch;

    const randomUuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("11111111-1111-1111-1111-111111111111");

    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Invalid Patch Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Invalid Patch Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: {
          prompt: "Create a launch page with repeated hero sections."
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: "INVALID_SCENE_PATCH",
        recoverable: true,
        details: {
          stage: "apply-scene"
        }
      });
    } finally {
      randomUuidSpy.mockRestore();
      await app.close();
    }
  });

  it("streams invalid scene patch failures when apply-stage validation rejects generated nodes", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "Build a cinematic launch surface for Atlas.",
                  rationale: "Use repeated hero sections to trigger a duplicate scene patch.",
                  sections: ["hero", "hero"],
                  provider: "heuristic"
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    ) as typeof globalThis.fetch;

    const randomUuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("11111111-1111-1111-1111-111111111111");

    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Invalid Patch Stream Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Invalid Patch Stream Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: {
          accept: "text/event-stream"
        },
        payload: {
          prompt: "Create a launch page with repeated hero sections."
        }
      });

      expect(response.statusCode).toBe(200);
      const events = parseSseEvents(response.body);
      expect(events.map((event) => event.type)).toEqual([
        "started",
        "planning",
        "failed"
      ]);
      expect(events[2]).toMatchObject({
        type: "failed",
        error: {
          code: "INVALID_SCENE_PATCH",
          recoverable: true,
          details: {
            stage: "apply-scene"
          }
        }
      });
    } finally {
      randomUuidSpy.mockRestore();
      await app.close();
    }
  });

  it("updates feature-grid title and items", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Grid Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Grid Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendGridResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "feature-grid"
        }
      });

      expect(appendGridResponse.statusCode).toBe(201);
      const nodeId = appendGridResponse.json().appendedNode.id;

      const updateGridResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${nodeId}`,
        payload: {
          name: "Updated Feature Grid",
          title: "Updated Grid Title",
          items: [
            {
              label: "Scene Ops",
              body: "Scene edits stay structured and versioned."
            },
            {
              label: "Design Ops",
              body: "Design motifs remain portable across artifacts."
            },
            {
              label: "Export Ops",
              body: "Exports stay aligned with the live preview."
            }
          ]
        }
      });

      expect(updateGridResponse.statusCode).toBe(200);
      expect(updateGridResponse.json().workspace.sceneDocument).toMatchObject({
        version: 3
      });

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace.sceneDocument.nodes[0]).toMatchObject({
        name: "Updated Feature Grid",
        props: {
          title: "Updated Grid Title",
          items: [
            {
              label: "Scene Ops",
              body: "Scene edits stay structured and versioned."
            },
            {
              label: "Design Ops",
              body: "Design motifs remain portable across artifacts."
            },
            {
              label: "Export Ops",
              body: "Exports stay aligned with the live preview."
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });

  it("exports scene-backed html documents", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Export Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Export Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.headers["content-type"]).toContain("text/html");
      expect(exportResponse.headers["content-disposition"]).toContain(
        'attachment; filename="export-artifact.html"'
      );
      expect(exportResponse.body).toContain("<!doctype html>");
      expect(exportResponse.body).toContain("Export Artifact leads with cinematic hierarchy.");
    } finally {
      await app.close();
    }
  });

  it("exports seeded html documents when the scene is still empty", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Seed Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Seed Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.body).toContain("Seed Artifact is ready for the first scene section.");
      expect(exportResponse.body).toContain(
        "Build a cinematic website surface for Seed Artifact with bold typography, clear hierarchy, and export-ready structure."
      );
    } finally {
      await app.close();
    }
  });

  it("exports scene-backed source bundles", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Bundle Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Bundle Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "cta"
        }
      });

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.json()).toMatchObject({
        filenameBase: "bundle-artifact",
        files: {
          "/App.tsx": expect.stringContaining("Action Lane"),
          "/styles.css": expect.stringContaining(".cta"),
          "/package.json": expect.stringContaining('"vite"'),
          "/index.html": expect.stringContaining('<div id="root"></div>'),
          "/main.tsx": expect.stringContaining('import App from "./App"')
        }
      });
    } finally {
      await app.close();
    }
  });

  it("tracks export jobs for completed sync exports", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Export Jobs Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Tracked Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.json()).toMatchObject({
        files: expect.any(Object)
      });

      const jobsResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/export-jobs`
      });

      expect(jobsResponse.statusCode).toBe(200);
      expect(jobsResponse.json()).toEqual({
        jobs: [
          expect.objectContaining({
            artifactId: artifact.id,
            exportKind: "source-bundle",
            status: "completed",
            result: expect.objectContaining({
              filename: expect.stringMatching(/\.zip$/),
              contentType: "application/zip"
            })
          })
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("tracks failed export jobs when artifact-specific export is unsupported", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Failed Export Jobs Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Tracked Website", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/prototype-flow`
      });

      expect(exportResponse.statusCode).toBe(409);

      const jobsResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/export-jobs`
      });

      expect(jobsResponse.statusCode).toBe(200);
      expect(jobsResponse.json()).toEqual({
        jobs: [
          expect.objectContaining({
            artifactId: artifact.id,
            exportKind: "prototype-flow",
            status: "failed",
            error: expect.objectContaining({
              code: "EXPORT_NOT_SUPPORTED"
            })
          })
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("persists code workspaces and exports the saved scaffold", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Code Workspace Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Code Workspace Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const saveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx": "export default function App() { return <main>Saved scaffold</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: rgb(214, 255, 95); }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"saved-workspace","private":true}'
          }
        }
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().workspace.codeWorkspace).toMatchObject({
        baseSceneVersion: 1,
        files: {
          "/App.tsx": "export default function App() { return <main>Saved scaffold</main>; }"
        }
      });
      expect(saveResponse.json().previousCodeWorkspaceUpdatedAt).toBeNull();

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace.codeWorkspace).toMatchObject({
        baseSceneVersion: 1,
        files: {
          "/styles.css": "main { color: rgb(214, 255, 95); }"
        }
      });

      const exportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(exportResponse.statusCode).toBe(200);
      expect(exportResponse.json()).toMatchObject({
        filenameBase: "code-workspace-artifact",
        files: {
          "/App.tsx": "export default function App() { return <main>Saved scaffold</main>; }",
          "/styles.css": "main { color: rgb(214, 255, 95); }",
          "/package.json": '{"name":"saved-workspace","private":true}'
        }
      });

      const htmlExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(htmlExportResponse.statusCode).toBe(200);
      expect(htmlExportResponse.body).toContain(
        "Code Workspace Artifact is ready for the first scene section."
      );
      expect(htmlExportResponse.body).not.toContain("Saved scaffold");

      const handoffExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/handoff-bundle`
      });

      expect(handoffExportResponse.statusCode).toBe(200);
      expect(handoffExportResponse.json()).toMatchObject({
        filenameBase: "code-workspace-artifact",
        manifest: {
          artifact: {
            kind: "website"
          },
          workspace: {
            hasCodeWorkspace: true,
            codeFileCount: 5
          },
          exports: {
            html: {
              path: "/exports/code-workspace-artifact.html"
            },
            source: {
              rootPath: "/exports/source",
              fileCount: 5
            },
            structured: null
          }
        },
        files: {
          "/exports/source/App.tsx":
            "export default function App() { return <main>Saved scaffold</main>; }",
          "/workspace.json": expect.stringContaining('"fileCount": 5')
        }
      });
    } finally {
      await app.close();
    }
  });

  it("saves unsupported code workspaces without mutating the scene", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Unsupported Sync Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Unsupported Sync Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });

      const saveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx":
              "export default function App() { return <main>custom preserved scaffold</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: rgb(214, 255, 95); }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"saved-workspace","private":true}'
          },
          expectedUpdatedAt: appendResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().workspace.sceneDocument.version).toBe(2);
      expect(saveResponse.json().workspace.sceneDocument.nodes[0]).toMatchObject({
        props: {
          headline: "Unsupported Sync Artifact leads with cinematic hierarchy."
        }
      });
      expect(saveResponse.json().sceneSync).toMatchObject({
        status: "unchanged"
      });
      expect(saveResponse.json().workspace.codeWorkspace).toMatchObject({
        baseSceneVersion: 2
      });
    } finally {
      await app.close();
    }
  });

  it("rejects stale code workspace saves when the saved state already changed", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Conflict Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Conflict Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const firstSaveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx": "export default function App() { return <main>Initial</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: teal; }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"initial","private":true}'
          },
          expectedUpdatedAt: null
        }
      });

      expect(firstSaveResponse.statusCode).toBe(200);

      const staleSaveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx": "export default function App() { return <main>Stale</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: purple; }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"stale","private":true}'
          },
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z"
        }
      });

      expect(staleSaveResponse.statusCode).toBe(409);
      expect(staleSaveResponse.json()).toMatchObject({
        code: "CODE_WORKSPACE_CONFLICT",
        recoverable: true,
        details: {
          currentUpdatedAt: expect.any(String)
        }
      });

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace.codeWorkspace.files["/App.tsx"]).toContain(
        "Initial"
      );
      expect(workspaceResponse.json().workspace.codeWorkspace.files["/App.tsx"]).not.toContain(
        "Stale"
      );
    } finally {
      await app.close();
    }
  });

  it("summarizes scene and code drift against a saved version snapshot", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Diff Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Diff Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });
      expect(appendHeroResponse.statusCode).toBe(201);

      const initialFiles = {
        "/App.tsx": 'export default function App() { return <main>Version A</main>; }',
        "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
        "/styles.css": "main { color: teal; }",
        "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
        "/package.json": '{"name":"version-a","private":true}'
      };

      const firstSaveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: initialFiles,
          expectedUpdatedAt: appendHeroResponse.json().workspace.codeWorkspace.updatedAt
        }
      });
      expect(firstSaveResponse.statusCode).toBe(200);

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions`,
        payload: {
          label: "Review A",
          summary: "Hero baseline"
        }
      });
      expect(versionResponse.statusCode).toBe(201);
      const version = versionResponse.json();

      const appendCtaResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "cta"
        }
      });
      expect(appendCtaResponse.statusCode).toBe(201);

      const secondSaveResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            ...initialFiles,
            "/App.tsx": 'export default function App() { return <main>Version B</main>; }'
          },
          expectedUpdatedAt: appendCtaResponse.json().workspace.codeWorkspace.updatedAt
        }
      });
      expect(secondSaveResponse.statusCode).toBe(200);

      const diffResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions/${version.id}/diff`
      });

      expect(diffResponse.statusCode).toBe(200);
      expect(diffResponse.json()).toMatchObject({
        diff: {
          versionId: version.id,
          againstVersionId: version.id,
          scene: {
            addedNodeCount: 1,
            removedNodeCount: 0,
            changedNodeCount: 0,
            currentVersion: 3,
            comparedVersion: 2
          },
          code: {
            changedFileCount: 1,
            comparedHasCodeWorkspace: true,
            currentHasCodeWorkspace: true
          }
        }
      });
    } finally {
      await app.close();
    }
  });

  it("restores a version snapshot back into scene and saved code workspace", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Restore Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Restore Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const appendHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "hero"
        }
      });
      const heroNodeId = appendHeroResponse.json().appendedNode.id as string;

      const updateHeroResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes/${heroNodeId}`,
        payload: {
          headline: "Snapshot hero",
          body: "Snapshot body"
        }
      });

      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx": "export default function App() { return <main>Snapshot A</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: teal; }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"snapshot-a","private":true}'
          },
          expectedUpdatedAt: updateHeroResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions`,
        payload: {
          label: "Review A",
          summary: "Snapshot with hero and code"
        }
      });
      const version = versionResponse.json();
      expect(version).toMatchObject({
        label: "Review A",
        hasCodeWorkspaceSnapshot: true
      });

      const appendCtaResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/scene/nodes`,
        payload: {
          template: "cta"
        }
      });

      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/code-workspace`,
        payload: {
          files: {
            "/App.tsx": "export default function App() { return <main>Snapshot B</main>; }",
            "/main.tsx": 'import App from "./App";\nimport "./styles.css";',
            "/styles.css": "main { color: purple; }",
            "/index.html": '<!doctype html><html><body><div id="root"></div></body></html>',
            "/package.json": '{"name":"snapshot-b","private":true}'
          },
          expectedUpdatedAt: appendCtaResponse.json().workspace.codeWorkspace.updatedAt
        }
      });

      const restoreResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/versions/${version.id}/restore`
      });

      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json()).toMatchObject({
        restoredVersion: {
          id: version.id,
          label: "Review A"
        },
        workspace: {
          activeVersionId: version.id,
          sceneDocument: {
            version: 3
          },
          codeWorkspace: {
            baseSceneVersion: 3,
            files: {
              "/App.tsx":
                "export default function App() { return <main>Snapshot A</main>; }"
            }
          }
        }
      });

      const workspaceResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });

      expect(workspaceResponse.statusCode).toBe(200);
      expect(workspaceResponse.json().workspace).toMatchObject({
        activeVersionId: version.id,
        sceneDocument: {
          version: 3
        },
        codeWorkspace: {
          baseSceneVersion: 3
        }
      });
      expect(workspaceResponse.json().workspace.sceneDocument.nodes).toHaveLength(1);
      expect(
        workspaceResponse.json().workspace.sceneDocument.nodes[0]
      ).toMatchObject({
        props: {
          headline: "Snapshot hero",
          body: "Snapshot body"
        }
      });

      const sourceBundleResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/source-bundle`
      });

      expect(sourceBundleResponse.statusCode).toBe(200);
      expect(sourceBundleResponse.json().files["/App.tsx"]).toContain("Snapshot A");
      expect(sourceBundleResponse.json().files["/App.tsx"]).not.toContain("Snapshot B");

      const htmlExportResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/exports/html`
      });

      expect(htmlExportResponse.statusCode).toBe(200);
      expect(htmlExportResponse.body).toContain("Snapshot hero");
      expect(htmlExportResponse.body).not.toContain("Ready for the next review pass?");
    } finally {
      await app.close();
    }
  });

  it("leaves the workspace untouched when generation fails midway through its atomic commit", async () => {
    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Atomic Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Atomic Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      // Force the workspace to be seeded so we have a stable pre-generation
      // baseline (intent + scene document + V1 seed version snapshot).
      const baselineResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });
      expect(baselineResponse.statusCode).toBe(200);
      const baseline = baselineResponse.json();
      const baselineIntent = baseline.workspace.intent;
      const baselineSceneVersion = baseline.workspace.sceneDocument.version;
      const baselineNodeCount = baseline.workspace.sceneDocument.nodes.length;
      const baselineVersions = baseline.versions as Array<{ id: string }>;
      const baselineActiveVersionId = baseline.workspace.activeVersionId;
      expect(baselineVersions).toHaveLength(1);

      // Arrange: make the transactional version insert fail mid-commit. The
      // workspace repo's applyGenerationRun should revert the intent and scene
      // document so nothing is torn.
      const createSpy = vi
        .spyOn(InMemoryArtifactVersionRepository.prototype, "create")
        .mockImplementationOnce(async () => {
          throw new Error("forced-midway-failure");
        });

      const generateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: {
          prompt: "Create a torn-state launch page with hero and CTA."
        }
      });

      expect(generateResponse.statusCode).toBeGreaterThanOrEqual(500);
      expect(createSpy).toHaveBeenCalledTimes(1);

      const postFailureResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
      });
      expect(postFailureResponse.statusCode).toBe(200);
      const afterFailure = postFailureResponse.json();

      // Workspace intent, scene document, and version list must match the
      // pre-generation baseline — the failed run must not leave any partial
      // writes behind.
      expect(afterFailure.workspace.intent).toBe(baselineIntent);
      expect(afterFailure.workspace.sceneDocument.version).toBe(baselineSceneVersion);
      expect(afterFailure.workspace.sceneDocument.nodes).toHaveLength(baselineNodeCount);
      expect(afterFailure.workspace.activeVersionId).toBe(baselineActiveVersionId);
      expect(afterFailure.versions).toHaveLength(baselineVersions.length);
      expect(afterFailure.versions[0].id).toBe(baselineVersions[0].id);
    } finally {
      await app.close();
    }
  });

  it("emits a GENERATION_TIMEOUT failed event and closes the stream when the session deadline fires", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = "10000";
    process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS = "75";

    // Make the upstream LLM fetch hang until its own abort signal fires; the
    // session-level deadline should trip first and emit a failed event.
    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const projectResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: { name: "Session Timeout Project" }
      });
      const project = projectResponse.json();

      const artifactResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts`,
        payload: { name: "Session Timeout Artifact", kind: "website" }
      });
      const artifact = artifactResponse.json();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: {
          accept: "text/event-stream"
        },
        payload: {
          prompt: "Create a launch page with a hero and CTA."
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");

      const events = parseSseEvents(response.body);
      const types = events.map((event) => event.type);
      expect(types).toContain("failed");
      const failedEvent = events.find((event) => event.type === "failed");
      expect(failedEvent).toMatchObject({
        type: "failed",
        error: {
          code: "GENERATION_TIMEOUT",
          recoverable: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("cancels an in-flight generation without committing any workspace state", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = "60000";
    process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS = "60000";

    // The fetch hangs until the shared abort signal fires. The cancel route
    // flips that signal, which should surface as a GENERATION_CANCELLED
    // failed SSE event with a retryable payload.
    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const project = (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { name: "Cancel Project" }
        })
      ).json();
      const artifact = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Cancel Artifact", kind: "website" }
        })
      ).json();

      const baselineWorkspace = (
        await app.inject({
          method: "GET",
          url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
        })
      ).json();

      const streamPromise = app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: {
          accept: "text/event-stream"
        },
        payload: {
          prompt: "Create a launch page the client will cancel mid-flight."
        }
      });

      // Poll briefly until the run has registered in the activeGenerations
      // map — observable via the 409 from a second concurrent call — and
      // then fire the cancel.
      let cancelResponse: Awaited<ReturnType<typeof app.inject>> | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const candidate = await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate/cancel`
        });
        if (candidate.statusCode === 204) {
          cancelResponse = candidate;
          break;
        }
      }

      expect(cancelResponse?.statusCode).toBe(204);

      const stream = await streamPromise;
      expect(stream.statusCode).toBe(200);
      const events = parseSseEvents(stream.body);
      const failed = events.find((event) => event.type === "failed") as
        | { type: "failed"; error: { code: string }; retry?: { retryable: boolean; prompt?: string } }
        | undefined;
      expect(failed).toBeDefined();
      expect(failed?.error.code).toBe("GENERATION_CANCELLED");
      expect(failed?.retry).toMatchObject({
        retryable: true,
        prompt: "Create a launch page the client will cancel mid-flight."
      });

      // Workspace must be untouched: no new version, no intent drift.
      const afterWorkspace = (
        await app.inject({
          method: "GET",
          url: `/api/projects/${project.id}/artifacts/${artifact.id}/workspace`
        })
      ).json();
      expect(afterWorkspace.workspace.intent).toBe(baselineWorkspace.workspace.intent);
      expect(afterWorkspace.workspace.sceneDocument.version).toBe(
        baselineWorkspace.workspace.sceneDocument.version
      );
      expect(afterWorkspace.versions).toHaveLength(baselineWorkspace.versions.length);

      // Cancelling again must now 404 — the registry slot was cleared.
      const afterCancel = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate/cancel`
      });
      expect(afterCancel.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("rejects a second concurrent generation on the same artifact with GENERATION_ALREADY_RUNNING", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = "60000";
    process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS = "60000";

    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const project = (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { name: "Already Running Project" }
        })
      ).json();
      const artifact = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Already Running Artifact", kind: "website" }
        })
      ).json();

      const firstStream = app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        payload: { prompt: "First in-flight run." }
      });

      // Wait briefly for the first run to register.
      let secondResponse: Awaited<ReturnType<typeof app.inject>> | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        secondResponse = await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
          payload: { prompt: "Second attempt while first still running." }
        });
        if (secondResponse.statusCode === 409) {
          break;
        }
      }

      expect(secondResponse?.statusCode).toBe(409);
      expect(secondResponse?.json()).toMatchObject({
        code: "GENERATION_ALREADY_RUNNING",
        recoverable: false,
        details: {
          artifactId: artifact.id
        }
      });

      // Drain the first run by cancelling it so app.close() doesn't hang.
      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate/cancel`
      });
      await firstStream;
    } finally {
      await app.close();
    }
  });

  it("rejects a third simultaneous generation from the same user with GENERATION_QUOTA_EXCEEDED", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";
    process.env.OPENDESIGN_GENERATION_TIMEOUT_MS = "60000";
    process.env.OPENDESIGN_GENERATION_SESSION_TIMEOUT_MS = "60000";
    process.env.OPENDESIGN_GENERATION_MAX_CONCURRENT_PER_USER = "2";

    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const project = (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { name: "Quota Project" }
        })
      ).json();
      const artifactA = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Quota A", kind: "website" }
        })
      ).json();
      const artifactB = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Quota B", kind: "website" }
        })
      ).json();
      const artifactC = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Quota C", kind: "website" }
        })
      ).json();

      const runA = app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifactA.id}/generate`,
        payload: { prompt: "Run on A." }
      });
      const runB = app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifactB.id}/generate`,
        payload: { prompt: "Run on B." }
      });

      // Busy-wait until the first two runs are both registered.
      let runC: Awaited<ReturnType<typeof app.inject>> | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        runC = await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts/${artifactC.id}/generate`,
          payload: { prompt: "Run on C over quota." }
        });
        if (runC.statusCode === 429) {
          break;
        }
      }

      expect(runC?.statusCode).toBe(429);
      expect(runC?.headers["retry-after"]).toBe("5");
      expect(runC?.json()).toMatchObject({
        code: "GENERATION_QUOTA_EXCEEDED",
        recoverable: true,
        details: {
          running: 2,
          limit: 2,
          retryAfterSeconds: 5
        }
      });

      // Drain the two running slots.
      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifactA.id}/generate/cancel`
      });
      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifactB.id}/generate/cancel`
      });
      await Promise.all([runA, runB]);
    } finally {
      await app.close();
    }
  });

  it("surfaces a retryable payload with prompt on a recoverable provider failure", async () => {
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_GENERATION_MODEL = "openai/gpt-4.1-mini";

    globalThis.fetch = vi.fn(async () =>
      new Response("gateway failed", {
        status: 502,
        headers: {
          "content-type": "text/plain"
        }
      })
    ) as typeof globalThis.fetch;

    const app = await buildApp();
    try {
      const project = (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          payload: { name: "Retry Project" }
        })
      ).json();
      const artifact = (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/artifacts`,
          payload: { name: "Retry Artifact", kind: "website" }
        })
      ).json();

      // Ground the artifact in a design system so the retry payload echoes
      // the designSystemPackId back to the client.
      const importResponse = await app.inject({
        method: "POST",
        url: "/api/design-systems/import/local",
        payload: {
          absolutePath: "/Users/leon/design-systems/retry-ds",
          files: [
            {
              path: "tokens/theme.json",
              content: JSON.stringify({ colors: { primary: "#000" } })
            }
          ]
        }
      });
      const pack = importResponse.json().pack;
      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/design-system`,
        payload: { designSystemPackId: pack.id }
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/generate`,
        headers: { accept: "text/event-stream" },
        payload: { prompt: "Create a page that will trip the upstream." }
      });

      expect(response.statusCode).toBe(200);
      const events = parseSseEvents(response.body);
      const failed = events.find((event) => event.type === "failed") as
        | {
            type: "failed";
            error: { code: string };
            retry?: { retryable: boolean; prompt?: string; designSystemPackId?: string };
          }
        | undefined;
      expect(failed?.error.code).toBe("GENERATION_PROVIDER_FAILURE");
      expect(failed?.retry).toMatchObject({
        retryable: true,
        prompt: "Create a page that will trip the upstream.",
        designSystemPackId: pack.id
      });
    } finally {
      await app.close();
    }
  });

  it("returns a structured validation error payload for invalid request bodies", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Request validation failed",
        code: "VALIDATION_ERROR",
        recoverable: true,
        details: {
          issues: [
            {
              path: "name",
              message: expect.any(String)
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });
});
