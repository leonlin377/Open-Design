import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";

const originalFetch = globalThis.fetch;
const originalLiteLLMApiBaseUrl = process.env.LITELLM_API_BASE_URL;
const originalGenerationModel = process.env.OPENDESIGN_GENERATION_MODEL;
const originalGenerationTimeoutMs = process.env.OPENDESIGN_GENERATION_TIMEOUT_MS;

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
