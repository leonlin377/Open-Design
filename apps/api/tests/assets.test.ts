import { describe, expect, it, vi } from "vitest";
import {
  buildAssetObjectKey,
  InMemoryAssetStorage
} from "../src/asset-storage";
import {
  InMemoryAssetRepository,
  PostgresAssetRepository,
  type AssetRecord
} from "../src/repositories/assets";

function createQueryMock<Row extends Record<string, unknown>>(rows: Row[]) {
  return vi.fn().mockResolvedValue({ rows });
}

describe("InMemoryAssetStorage", () => {
  it("stores and reads objects by key", async () => {
    const storage = new InMemoryAssetStorage();
    const bytes = Buffer.from("png-bytes");

    await storage.uploadObject({
      objectKey: "design-systems/abc.png",
      bytes,
      contentType: "image/png"
    });

    const stored = await storage.readObject({
      objectKey: "design-systems/abc.png"
    });

    expect(stored).toEqual({
      bytes,
      contentType: "image/png"
    });
  });
});

describe("buildAssetObjectKey", () => {
  it("generates stable object keys from source refs", () => {
    expect(
      buildAssetObjectKey({
        scope: "design-systems",
        sourceRef: "https://atlas.example.com#primary-viewport",
        contentType: "image/png"
      })
    ).toMatch(/^design-systems\/[a-f0-9]{16}\.png$/);
  });

  it("generates artifact-scoped object keys with artifact id and filename seed", () => {
    expect(
      buildAssetObjectKey({
        scope: "artifacts",
        artifactId: "artifact_123",
        sourceRef: "hero-shot.png",
        contentType: "image/png"
      })
    ).toMatch(/^artifacts\/artifact_123\/[a-f0-9]{16}\.png$/);
  });
});

describe("InMemoryAssetRepository", () => {
  it("creates and returns asset records", async () => {
    const repository = new InMemoryAssetRepository();
    const asset = await repository.create({
      ownerUserId: "user-1",
      artifactId: "artifact-1",
      kind: "design-system-screenshot",
      filename: "asset.png",
      storageProvider: "memory",
      objectKey: "design-systems/asset.png",
      contentType: "image/png",
      sizeBytes: 128
    });

    expect(asset).toMatchObject<Partial<AssetRecord>>({
      ownerUserId: "user-1",
      artifactId: "artifact-1",
      kind: "design-system-screenshot",
      filename: "asset.png",
      storageProvider: "memory",
      objectKey: "design-systems/asset.png",
      contentType: "image/png",
      sizeBytes: 128
    });
    await expect(repository.getById(asset.id)).resolves.toEqual(asset);
  });

  it("lists assets by artifact id in reverse creation order", async () => {
    const repository = new InMemoryAssetRepository();
    await repository.create({
      artifactId: "artifact-1",
      kind: "artifact-upload",
      filename: "older.png",
      storageProvider: "memory",
      objectKey: "artifacts/artifact-1/older.png",
      contentType: "image/png",
      sizeBytes: 64
    });
    const newer = await repository.create({
      artifactId: "artifact-1",
      kind: "artifact-upload",
      filename: "newer.png",
      storageProvider: "memory",
      objectKey: "artifacts/artifact-1/newer.png",
      contentType: "image/png",
      sizeBytes: 96
    });

    await repository.create({
      artifactId: "artifact-2",
      kind: "artifact-upload",
      filename: "other.png",
      storageProvider: "memory",
      objectKey: "artifacts/artifact-2/other.png",
      contentType: "image/png",
      sizeBytes: 96
    });

    await expect(repository.listByArtifactId("artifact-1")).resolves.toEqual([
      expect.objectContaining({ id: newer.id, artifactId: "artifact-1" }),
      expect.objectContaining({ filename: "older.png", artifactId: "artifact-1" })
    ]);
  });
});

describe("PostgresAssetRepository", () => {
  it("maps and returns created assets", async () => {
    const query = createQueryMock([
      {
        id: "asset-1",
        owner_user_id: "user-1",
        artifact_id: "artifact-1",
        kind: "design-system-screenshot",
        filename: "asset.png",
        storage_provider: "s3",
        object_key: "design-systems/asset.png",
        content_type: "image/png",
        size_bytes: 256,
        created_at: new Date("2026-04-19T10:00:00.000Z"),
        updated_at: new Date("2026-04-19T10:00:00.000Z")
      }
    ]);

    const repository = new PostgresAssetRepository({ query });
    const asset = await repository.create({
      ownerUserId: "user-1",
      artifactId: "artifact-1",
      kind: "design-system-screenshot",
      filename: "asset.png",
      storageProvider: "s3",
      objectKey: "design-systems/asset.png",
      contentType: "image/png",
      sizeBytes: 256
    });

    expect(asset).toEqual<AssetRecord>({
      id: "asset-1",
      ownerUserId: "user-1",
      artifactId: "artifact-1",
      kind: "design-system-screenshot",
      filename: "asset.png",
      storageProvider: "s3",
      objectKey: "design-systems/asset.png",
      contentType: "image/png",
      sizeBytes: 256,
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T10:00:00.000Z"
    });
  });

  it("lists artifact-scoped assets", async () => {
    const query = createQueryMock([
      {
        id: "asset-2",
        owner_user_id: null,
        artifact_id: "artifact-1",
        kind: "artifact-upload",
        filename: "hero-shot.png",
        storage_provider: "memory",
        object_key: "artifacts/artifact-1/hero-shot.png",
        content_type: "image/png",
        size_bytes: 512,
        created_at: new Date("2026-04-19T10:05:00.000Z"),
        updated_at: new Date("2026-04-19T10:05:00.000Z")
      }
    ]);

    const repository = new PostgresAssetRepository({ query });
    const listed = await repository.listByArtifactId("artifact-1");

    expect(listed).toEqual([
      {
        id: "asset-2",
        ownerUserId: null,
        artifactId: "artifact-1",
        kind: "artifact-upload",
        filename: "hero-shot.png",
        storageProvider: "memory",
        objectKey: "artifacts/artifact-1/hero-shot.png",
        contentType: "image/png",
        sizeBytes: 512,
        createdAt: "2026-04-19T10:05:00.000Z",
        updatedAt: "2026-04-19T10:05:00.000Z"
      }
    ]);
  });
});
