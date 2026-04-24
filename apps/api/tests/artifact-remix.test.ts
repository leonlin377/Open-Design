import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { SceneDocument } from "@opendesign/contracts";
import { createAuth } from "../src/auth/session";
import { InMemoryArtifactCommentRepository } from "../src/repositories/artifact-comments";
import { InMemoryArtifactVersionRepository } from "../src/repositories/artifact-versions";
import { InMemoryArtifactWorkspaceRepository } from "../src/repositories/artifact-workspaces";
import { InMemoryArtifactRepository } from "../src/repositories/artifacts";
import { InMemoryAssetRepository } from "../src/repositories/assets";
import { InMemoryProjectRepository } from "../src/repositories/projects";
import { registerArtifactRemixRoutes } from "../src/routes/artifact-remix";
import { sendApiError } from "../src/lib/api-errors";

interface Harness {
  app: FastifyInstance;
  projects: InMemoryProjectRepository;
  artifacts: InMemoryArtifactRepository;
  workspaces: InMemoryArtifactWorkspaceRepository;
  versions: InMemoryArtifactVersionRepository;
  comments: InMemoryArtifactCommentRepository;
  assets: InMemoryAssetRepository;
  projectA: string;
  projectB: string;
  seededArtifactId: string;
}

// Seed the source artifact with a non-trivial workspace so the fork copies a
// real scene document, a saved code workspace, a versioned history and an
// asset link — exercising every copy branch in a single happy-path setup.
async function seedSourceArtifact(h: Omit<Harness, "seededArtifactId" | "app">) {
  const artifact = await h.artifacts.create({
    projectId: h.projectA,
    name: "Launch Homepage",
    kind: "website"
  });

  const sceneDocument: SceneDocument = {
    id: "scene_source",
    artifactId: artifact.id,
    kind: "website",
    version: 3,
    nodes: [
      {
        id: "hero_root",
        type: "hero",
        name: "Hero",
        props: {
          template: "hero",
          headline: "Original Headline",
          body: "Source body copy",
          eyebrow: "Source"
        },
        children: []
      }
    ],
    metadata: {
      designSystemPackId: "pack-grounding-123"
    }
  };

  await h.workspaces.create({
    artifactId: artifact.id,
    intent: "Build a launch homepage with cinematic hierarchy.",
    activeVersionId: null,
    sceneDocument
  });

  // Two versions: the older "seed" and a newer "prompt" pass. Order matters
  // because the fork must re-stamp both while preserving their summaries.
  const v1 = await h.versions.create({
    artifactId: artifact.id,
    label: "V1 Seed",
    summary: "Seeded workspace",
    source: "seed",
    sceneVersion: 1,
    sceneDocument: { ...sceneDocument, version: 1 },
    codeWorkspace: null
  });
  const v2 = await h.versions.create({
    artifactId: artifact.id,
    label: "Prompt 2",
    summary: "Added hero section",
    source: "prompt",
    sceneVersion: 3,
    sceneDocument,
    codeWorkspace: {
      files: { "/App.tsx": "export default function App() { return null; }" },
      baseSceneVersion: 3,
      updatedAt: new Date().toISOString()
    }
  });

  await h.workspaces.updateCodeWorkspace(artifact.id, {
    files: { "/App.tsx": "export default function App() { return null; }" },
    baseSceneVersion: 3
  });
  await h.workspaces.updateActiveVersion(artifact.id, v2.id);

  await h.comments.create({
    artifactId: artifact.id,
    body: "Consider a darker hero background",
    anchor: { selectionPath: ["hero_root"] }
  });

  await h.assets.create({
    ownerUserId: null,
    artifactId: artifact.id,
    kind: "artifact-upload",
    filename: "hero.png",
    storageProvider: "memory",
    objectKey: "artifacts/source-hero.png",
    contentType: "image/png",
    sizeBytes: 2048
  });

  return { artifact, versionIds: [v1.id, v2.id] };
}

async function buildHarness(): Promise<Harness> {
  const projects = new InMemoryProjectRepository();
  const artifacts = new InMemoryArtifactRepository();
  const workspaces = new InMemoryArtifactWorkspaceRepository();
  const versions = new InMemoryArtifactVersionRepository();
  workspaces.setVersionRepository(versions);
  const comments = new InMemoryArtifactCommentRepository();
  const assets = new InMemoryAssetRepository();
  const { auth } = createAuth({ env: { ...process.env, NODE_ENV: "test" } });

  const projectA = await projects.create({ name: "Origin Project" });
  const projectB = await projects.create({ name: "Destination Project" });

  const seeded = await seedSourceArtifact({
    projects,
    artifacts,
    workspaces,
    versions,
    comments,
    assets,
    projectA: projectA.id,
    projectB: projectB.id
  });

  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendApiError(reply, 400, {
        error: "Request validation failed",
        code: "VALIDATION_ERROR",
        recoverable: true,
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      });
    }
    throw error;
  });

  await app.register(registerArtifactRemixRoutes, {
    prefix: "/api",
    artifacts,
    workspaces,
    versions,
    comments,
    assets,
    projects,
    auth
  });

  return {
    app,
    projects,
    artifacts,
    workspaces,
    versions,
    comments,
    assets,
    projectA: projectA.id,
    projectB: projectB.id,
    seededArtifactId: seeded.artifact.id
  };
}

let harness: Harness;

beforeEach(async () => {
  harness = await buildHarness();
});

afterEach(async () => {
  await harness.app.close();
});

describe("Artifact remix routes", () => {
  it("forks into the same project creating an independent artifact with preserved scene, code and versions", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectA}/artifacts/${harness.seededArtifactId}/remix`,
      payload: { nameOverride: "Launch Homepage (fork)" }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.artifact).toMatchObject({
      projectId: harness.projectA,
      name: "Launch Homepage (fork)",
      kind: "website"
    });
    expect(body.artifact.id).not.toEqual(harness.seededArtifactId);

    // --- Workspace was deep-copied -------------------------------------
    const forkedWorkspace = await harness.workspaces.getByArtifactId(
      body.artifact.id
    );
    expect(forkedWorkspace).not.toBeNull();
    expect(forkedWorkspace!.intent).toBe(
      "Build a launch homepage with cinematic hierarchy."
    );
    expect(forkedWorkspace!.sceneDocument.artifactId).toBe(body.artifact.id);
    // Preserve the grounding pack id so design-system lookups keep working.
    expect(forkedWorkspace!.sceneDocument.metadata.designSystemPackId).toBe(
      "pack-grounding-123"
    );
    expect(forkedWorkspace!.sceneDocument.nodes[0]).toMatchObject({
      id: "hero_root",
      props: { headline: "Original Headline" }
    });
    expect(forkedWorkspace!.codeWorkspace?.files["/App.tsx"]).toContain(
      "export default function App"
    );

    // --- Independence: editing the source does not affect the fork ------
    await harness.workspaces.updateSceneDocument(harness.seededArtifactId, {
      ...forkedWorkspace!.sceneDocument,
      artifactId: harness.seededArtifactId,
      nodes: [
        {
          ...forkedWorkspace!.sceneDocument.nodes[0]!,
          props: {
            ...forkedWorkspace!.sceneDocument.nodes[0]!.props,
            headline: "Source Mutated"
          }
        }
      ]
    });
    const forkedAfterMutation = await harness.workspaces.getByArtifactId(
      body.artifact.id
    );
    expect(
      forkedAfterMutation!.sceneDocument.nodes[0]!.props.headline
    ).toBe("Original Headline");

    // --- Versions re-stamped against the new artifact -------------------
    const forkedVersions = await harness.versions.listByArtifactId(
      body.artifact.id
    );
    // The fork seeds an extra "Forked from …" version in addition to the two
    // prior versions it copied over.
    expect(forkedVersions.length).toBe(3);
    expect(forkedVersions.every((v) => v.artifactId === body.artifact.id)).toBe(
      true
    );
    expect(
      forkedVersions.some((v) => v.label.startsWith("Forked from "))
    ).toBe(true);
    // Labels from the source history survive the fork.
    expect(forkedVersions.map((v) => v.label)).toEqual(
      expect.arrayContaining(["V1 Seed", "Prompt 2"])
    );

    // --- Comments imported as resolved-at-fork --------------------------
    const forkedComments = await harness.comments.listByArtifactId(
      body.artifact.id
    );
    expect(forkedComments).toHaveLength(1);
    expect(forkedComments[0]!.status).toBe("resolved");
    expect(forkedComments[0]!.artifactId).toBe(body.artifact.id);

    // --- Assets linked by reference (same objectKey, new record) --------
    const forkedAssets = await harness.assets.listByArtifactId(body.artifact.id);
    expect(forkedAssets).toHaveLength(1);
    expect(forkedAssets[0]!.objectKey).toBe("artifacts/source-hero.png");
    expect(forkedAssets[0]!.artifactId).toBe(body.artifact.id);
  });

  it("forks into a different project when targetProjectId is supplied", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectA}/artifacts/${harness.seededArtifactId}/remix`,
      payload: { targetProjectId: harness.projectB }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.artifact.projectId).toBe(harness.projectB);
    expect(body.artifact.name).toBe("Launch Homepage");

    const artifactsInDestination = await harness.artifacts.listByProject(
      harness.projectB
    );
    expect(artifactsInDestination.map((a) => a.id)).toContain(body.artifact.id);
    const artifactsInSource = await harness.artifacts.listByProject(
      harness.projectA
    );
    expect(artifactsInSource.map((a) => a.id)).not.toContain(body.artifact.id);
  });

  it("returns lineage metadata pointing at the source artifact and project", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectA}/artifacts/${harness.seededArtifactId}/remix`,
      payload: {}
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.lineage).toMatchObject({
      sourceArtifactId: harness.seededArtifactId,
      sourceProjectId: harness.projectA
    });
    expect(typeof body.lineage.forkedAt).toBe("string");
    expect(Number.isFinite(Date.parse(body.lineage.forkedAt))).toBe(true);
  });

  it("returns 404 when the source artifact does not exist", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectA}/artifacts/missing-artifact/remix`,
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("ARTIFACT_NOT_FOUND");
  });

  it("returns 404 when the target project does not exist", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectA}/artifacts/${harness.seededArtifactId}/remix`,
      payload: { targetProjectId: "missing-project" }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("PROJECT_NOT_FOUND");
  });
});
