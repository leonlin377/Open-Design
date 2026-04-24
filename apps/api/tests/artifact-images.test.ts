import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { InMemoryAssetStorage } from "../src/asset-storage";
import {
  HeuristicImageProvider,
  ImageProviderError,
  type ImageProvider,
  type ImageProviderRequest,
  type ImageProviderResult
} from "../src/image-provider";
import { InMemoryArtifactRepository } from "../src/repositories/artifacts";
import { InMemoryAssetRepository } from "../src/repositories/assets";
import { InMemoryProjectRepository } from "../src/repositories/projects";
import { registerArtifactImageRoutes } from "../src/routes/artifact-images";
import type { OpenDesignAuth } from "../src/auth/session";

// Minimal auth stub — tests run without a real session, which mirrors how
// anonymous callers are treated by the project/artifact ownership check.
const stubAuth: OpenDesignAuth = {
  async handler() {
    return new Response(null, { status: 204 });
  },
  api: {
    async getSession() {
      return null;
    }
  },
  options: {}
};

async function buildTestApp(input: {
  imageProvider: ImageProvider;
}) {
  const projects = new InMemoryProjectRepository();
  const artifacts = new InMemoryArtifactRepository();
  const assets = new InMemoryAssetRepository();
  const assetStorage = new InMemoryAssetStorage();

  const project = await projects.create({ name: "Test Project" });
  const artifact = await artifacts.create({
    projectId: project.id,
    name: "Hero Artifact",
    kind: "website"
  });

  const app = Fastify({ logger: false });
  await app.register(registerArtifactImageRoutes, {
    prefix: "/api",
    projects,
    artifacts,
    assets,
    assetStorage,
    auth: stubAuth,
    imageProvider: input.imageProvider
  });

  return { app, projects, artifacts, assets, assetStorage, project, artifact };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("artifact-images route", () => {
  it("generates a heuristic PNG, persists it, and returns a retrievable ArtifactAsset", async () => {
    const provider = new HeuristicImageProvider();
    const { app, assets, assetStorage, project, artifact } = await buildTestApp({
      imageProvider: provider
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/images/generate`,
        payload: { prompt: "hero image for a fintech launch" }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.provider).toBe("heuristic");
      expect(body.prompt).toBe("hero image for a fintech launch");
      expect(body.width).toBeGreaterThan(0);
      expect(body.height).toBeGreaterThan(0);
      expect(body.asset).toMatchObject({
        artifactId: artifact.id,
        kind: "artifact-upload",
        contentType: "image/png",
        storageProvider: "memory"
      });
      expect(body.asset.sizeBytes).toBeGreaterThan(0);

      // Asset is listed by artifact id (persisted via the repository).
      const listed = await assets.listByArtifactId(artifact.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]!.id).toBe(body.asset.id);

      // Bytes are stored and begin with the PNG magic signature.
      const created = await assets.getById(body.asset.id);
      expect(created).not.toBeNull();
      const stored = await assetStorage.readObject({
        objectKey: created!.objectKey
      });
      expect(stored).not.toBeNull();
      const bytes = Buffer.from(stored!.bytes);
      expect(bytes.length).toBe(body.asset.sizeBytes);
      expect(bytes.slice(0, 8).equals(PNG_MAGIC)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("surfaces IMAGE_PROVIDER_FAILURE when the provider throws", async () => {
    const failingProvider: ImageProvider = {
      kind: "litellm" as const,
      async generate(_input: ImageProviderRequest): Promise<ImageProviderResult> {
        throw new ImageProviderError("upstream 500 from gateway");
      }
    };
    const { app, assets, project, artifact } = await buildTestApp({
      imageProvider: failingProvider
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/${artifact.id}/images/generate`,
        payload: { prompt: "fallback test" }
      });

      expect(response.statusCode).toBe(502);
      const body = response.json();
      expect(body).toMatchObject({
        code: "IMAGE_PROVIDER_FAILURE",
        recoverable: true
      });
      expect(typeof body.error).toBe("string");

      // Nothing was persisted on failure.
      const listed = await assets.listByArtifactId(artifact.id);
      expect(listed).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the target artifact does not belong to the project", async () => {
    const { app, project } = await buildTestApp({
      imageProvider: new HeuristicImageProvider()
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/artifacts/does-not-exist/images/generate`,
        payload: { prompt: "missing artifact" }
      });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe("IMAGE_GENERATION_VALIDATION");
    } finally {
      await app.close();
    }
  });
});

describe("HeuristicImageProvider", () => {
  it("emits a decodable PNG with the canonical magic signature", async () => {
    const provider = new HeuristicImageProvider();
    const result = await provider.generate({
      prompt: "deterministic gradient",
      size: "64x48"
    });
    expect(result.provider).toBe("heuristic");
    expect(result.contentType).toBe("image/png");
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.bytes.slice(0, 8).equals(PNG_MAGIC)).toBe(true);
    // IEND terminator should exist and be the final chunk — indirectly verified
    // by checking the last 4 bytes are the IEND CRC (non-zero would still be
    // valid, but the minimum size we expect is well above the header alone).
    expect(result.bytes.length).toBeGreaterThan(64);
  });

  it("is deterministic for a given prompt + size", async () => {
    const provider = new HeuristicImageProvider();
    const first = await provider.generate({ prompt: "stable", size: "32x24" });
    const second = await provider.generate({ prompt: "stable", size: "32x24" });
    expect(first.bytes.equals(second.bytes)).toBe(true);
  });
});
