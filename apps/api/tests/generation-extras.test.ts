import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";
import { createAuth } from "../src/auth/session";
import { sendApiError } from "../src/lib/api-errors";
import {
  registerGenerationExtrasRoutes,
  type ActiveGenerationSlot
} from "../src/routes/artifact-generation-extras";
import { InMemoryArtifactRepository } from "../src/repositories/artifacts";
import { InMemoryArtifactVersionRepository } from "../src/repositories/artifact-versions";
import { InMemoryArtifactWorkspaceRepository } from "../src/repositories/artifact-workspaces";
import { InMemoryDesignSystemRepository } from "../src/repositories/design-systems";
import { InMemoryProjectRepository } from "../src/repositories/projects";
import { createEmptySceneDocument } from "@opendesign/scene-engine";

const originalFetch = globalThis.fetch;
const originalRefineModel = process.env.OPENDESIGN_REFINE_MODEL;
const originalLiteLLMApiBaseUrl = process.env.LITELLM_API_BASE_URL;
const originalGenerationModel = process.env.OPENDESIGN_GENERATION_MODEL;

interface Fixture {
  app: FastifyInstance;
  projects: InMemoryProjectRepository;
  artifacts: InMemoryArtifactRepository;
  workspaces: InMemoryArtifactWorkspaceRepository;
  versions: InMemoryArtifactVersionRepository;
  designSystems: InMemoryDesignSystemRepository;
  activeGenerations: Map<string, ActiveGenerationSlot>;
  projectId: string;
  artifactId: string;
}

async function buildFixture(input: { artifactKind?: "website" | "prototype" | "slides" } = {}): Promise<Fixture> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendApiError(reply, 400, {
        error: "Request validation failed",
        code: "VALIDATION_ERROR",
        recoverable: true,
        details: { issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }
      });
    }
    throw error;
  });

  const projects = new InMemoryProjectRepository();
  const artifacts = new InMemoryArtifactRepository();
  const versions = new InMemoryArtifactVersionRepository();
  const workspaces = new InMemoryArtifactWorkspaceRepository();
  workspaces.setVersionRepository(versions);
  const designSystems = new InMemoryDesignSystemRepository();
  const activeGenerations = new Map<string, ActiveGenerationSlot>();

  const { auth } = createAuth({ env: { NODE_ENV: "test" } as NodeJS.ProcessEnv });

  await app.register(registerGenerationExtrasRoutes, {
    prefix: "/api",
    artifacts,
    projects,
    workspaces,
    versions,
    designSystems,
    auth,
    activeGenerations
  });

  const project = await projects.create({ name: "Extras Project" });
  const artifact = await artifacts.create({
    projectId: project.id,
    name: "Extras Artifact",
    kind: input.artifactKind ?? "website"
  });

  // Seed a workspace + initial version (mirrors ensureWorkspaceState).
  const sceneDocument = createEmptySceneDocument({
    id: `scene_${crypto.randomUUID()}`,
    artifactId: artifact.id,
    kind: artifact.kind
  });
  const seed = await versions.create({
    artifactId: artifact.id,
    label: "Seed",
    summary: "Seed version",
    source: "seed",
    sceneVersion: sceneDocument.version,
    sceneDocument,
    codeWorkspace: null
  });
  await workspaces.create({
    artifactId: artifact.id,
    intent: "Initial intent for extras.",
    activeVersionId: seed.id,
    sceneDocument
  });

  return {
    app,
    projects,
    artifacts,
    workspaces,
    versions,
    designSystems,
    activeGenerations,
    projectId: project.id,
    artifactId: artifact.id
  };
}

beforeEach(() => {
  delete process.env.OPENDESIGN_REFINE_MODEL;
  delete process.env.LITELLM_API_BASE_URL;
  delete process.env.OPENDESIGN_GENERATION_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  if (originalRefineModel === undefined) {
    delete process.env.OPENDESIGN_REFINE_MODEL;
  } else {
    process.env.OPENDESIGN_REFINE_MODEL = originalRefineModel;
  }
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
});

describe("generation-extras variations", () => {
  test("returns N heuristic variation previews without committing", async () => {
    const fixture = await buildFixture();
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/generate/variations`,
        payload: { prompt: "Launch page with hero and CTA.", count: 3 }
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.variations).toHaveLength(3);
      expect(payload.variations[0]).toMatchObject({
        plan: { provider: "heuristic" },
        diagnostics: { transport: "fallback" }
      });
      // Every variation must carry the full SceneDocument shape so the UI can
      // render a preview without another round-trip.
      expect(payload.variations[0].sceneDocument.kind).toBe("website");
      expect(payload.variations[0].appendedNodes.length).toBeGreaterThan(0);

      // Workspace must NOT have moved — previews are non-committing.
      const workspace = await fixture.workspaces.getByArtifactId(fixture.artifactId);
      expect(workspace?.sceneDocument.nodes).toHaveLength(0);
      expect(workspace?.sceneDocument.version).toBe(1);
      const versions = await fixture.versions.listByArtifactId(fixture.artifactId);
      expect(versions).toHaveLength(1);
    } finally {
      await fixture.app.close();
    }
  });

  test("defaults count to 3 and caps it at 5", async () => {
    const fixture = await buildFixture();
    try {
      const defaultResponse = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/generate/variations`,
        payload: { prompt: "Launch page." }
      });
      expect(defaultResponse.statusCode).toBe(200);
      expect(defaultResponse.json().variations).toHaveLength(3);

      const capResponse = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/generate/variations`,
        payload: { prompt: "Launch page.", count: 5 }
      });
      expect(capResponse.statusCode).toBe(200);
      expect(capResponse.json().variations).toHaveLength(5);
    } finally {
      await fixture.app.close();
    }
  });

  test("accept commits a previewed variation atomically", async () => {
    const fixture = await buildFixture();
    try {
      const previewResponse = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/generate/variations`,
        payload: { prompt: "Launch page with hero and CTA." }
      });
      expect(previewResponse.statusCode).toBe(200);
      const chosen = previewResponse.json().variations[0];

      const acceptResponse = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/variations/accept`,
        payload: { variationId: chosen.variationId }
      });
      expect(acceptResponse.statusCode).toBe(201);
      const committed = acceptResponse.json();
      expect(committed.workspace.sceneDocument.nodes.length).toBe(
        chosen.appendedNodes.length
      );
      expect(committed.generation.plan.intent).toBe(chosen.plan.intent);
      expect(committed.version.source).toBe("prompt");

      // The workspace must reflect the accepted variation.
      const workspace = await fixture.workspaces.getByArtifactId(fixture.artifactId);
      expect(workspace?.intent).toBe(chosen.plan.intent);
      expect(workspace?.activeVersionId).toBe(committed.version.id);
      expect(workspace?.sceneDocument.nodes.length).toBe(
        chosen.appendedNodes.length
      );

      const versions = await fixture.versions.listByArtifactId(fixture.artifactId);
      expect(versions).toHaveLength(2);

      // After accept the preview cache is flushed — a second accept 404s.
      const secondAccept = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/variations/accept`,
        payload: { variationId: chosen.variationId }
      });
      expect(secondAccept.statusCode).toBe(404);
    } finally {
      await fixture.app.close();
    }
  });

  test("honours the 409 semantics when an active generation is registered", async () => {
    const fixture = await buildFixture();
    try {
      fixture.activeGenerations.set(fixture.artifactId, {
        artifactId: fixture.artifactId,
        userKey: "__anonymous__",
        controller: new AbortController(),
        completed: false
      });

      const response = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/generate/variations`,
        payload: { prompt: "Blocked." }
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: "GENERATION_ALREADY_RUNNING",
        details: { artifactId: fixture.artifactId }
      });
    } finally {
      await fixture.app.close();
    }
  });
});

describe("generation-extras refine", () => {
  test("applies a heuristic prop delta atomically and commits a new version", async () => {
    const fixture = await buildFixture();
    try {
      // Seed the scene with a website hero node via the workspace repo so
      // refine has a concrete node to target.
      const workspace = await fixture.workspaces.getByArtifactId(fixture.artifactId);
      const scene = workspace!.sceneDocument;
      const heroNode = {
        id: "hero_seed",
        type: "hero" as const,
        name: "Hero Section",
        props: {
          template: "hero",
          eyebrow: "Launch Surface",
          headline: "Original headline",
          body: "Original body copy."
        },
        children: []
      };
      await fixture.workspaces.updateSceneDocument(fixture.artifactId, {
        ...scene,
        version: scene.version + 1,
        nodes: [heroNode]
      });

      const response = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/refine`,
        payload: { nodeId: "hero_seed", instruction: "Refine in a bolder tone" }
      });
      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.generation.diagnostics.provider).toBe("heuristic");
      expect(payload.generation.scenePatch.mode).toBe("no-op");

      const updated = await fixture.workspaces.getByArtifactId(fixture.artifactId);
      const refreshed = updated?.sceneDocument.nodes.find(
        (node) => node.id === "hero_seed"
      );
      expect(refreshed?.props.headline).toMatch(/bolder/);
      expect(refreshed?.props.body).toMatch(/bolder tone/);

      const versions = await fixture.versions.listByArtifactId(fixture.artifactId);
      // Seed version + the refine version.
      expect(versions).toHaveLength(2);
      expect(versions[0]!.source).toBe("prompt");
    } finally {
      await fixture.app.close();
    }
  });

  test("returns SCENE_NODE_NOT_FOUND when the target node id is unknown", async () => {
    const fixture = await buildFixture();
    try {
      const response = await fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/refine`,
        payload: { nodeId: "does_not_exist", instruction: "Make it bolder" }
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "SCENE_NODE_NOT_FOUND" });

      // No new version should have been created.
      const versions = await fixture.versions.listByArtifactId(fixture.artifactId);
      expect(versions).toHaveLength(1);
    } finally {
      await fixture.app.close();
    }
  });

  test("streams failed event with GENERATION_CANCELLED retry payload when cancelled mid-flight", async () => {
    // Force the refine provider into its fetch path so we have something to
    // abort upstream. The test seeds env vars so refineNode hits LiteLLM.
    process.env.LITELLM_API_BASE_URL = "http://127.0.0.1:4001";
    process.env.OPENDESIGN_REFINE_MODEL = "openai/gpt-4.1-mini";

    globalThis.fetch = vi.fn(async (_input, init) => {
      const signal = init?.signal;
      await new Promise((_, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      throw new Error("unreachable");
    }) as typeof globalThis.fetch;

    const fixture = await buildFixture();
    try {
      // Seed a node for the refine to target.
      const workspace = await fixture.workspaces.getByArtifactId(fixture.artifactId);
      const scene = workspace!.sceneDocument;
      await fixture.workspaces.updateSceneDocument(fixture.artifactId, {
        ...scene,
        version: scene.version + 1,
        nodes: [
          {
            id: "hero_seed",
            type: "hero",
            name: "Hero Section",
            props: {
              template: "hero",
              eyebrow: "Launch",
              headline: "Title",
              body: "Body"
            },
            children: []
          }
        ]
      });

      const streamPromise = fixture.app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/artifacts/${fixture.artifactId}/refine`,
        headers: { accept: "text/event-stream" },
        payload: { nodeId: "hero_seed", instruction: "Make it bolder" }
      });

      // Wait briefly for the fetch to register, then abort every active run.
      let aborted = false;
      for (let attempt = 0; attempt < 20 && !aborted; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        for (const slot of fixture.activeGenerations.values()) {
          slot.controller.abort();
          aborted = true;
        }
      }
      expect(aborted).toBe(true);

      const response = await streamPromise;
      expect(response.statusCode).toBe(200);
      const frames = response.body
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

      const failed = frames.find((f) => f.type === "failed") as
        | { type: "failed"; error: { code: string }; retry?: { retryable: boolean } }
        | undefined;
      expect(failed).toBeDefined();
      expect(failed?.error.code).toBe("GENERATION_CANCELLED");
      expect(failed?.retry).toMatchObject({
        retryable: true,
        nodeId: "hero_seed",
        instruction: "Make it bolder"
      });

      // Workspace must be untouched — no new version should have been added.
      const versions = await fixture.versions.listByArtifactId(fixture.artifactId);
      expect(versions).toHaveLength(1);
    } finally {
      await fixture.app.close();
    }
  });
});
