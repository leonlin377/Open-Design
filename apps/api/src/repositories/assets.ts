export interface AssetRecord {
  id: string;
  ownerUserId: string | null;
  artifactId: string | null;
  kind: "design-system-screenshot" | "artifact-upload";
  filename: string | null;
  storageProvider: "memory" | "s3";
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface AssetRepository {
  create(input: {
    ownerUserId?: string | null;
    artifactId?: string | null;
    kind: AssetRecord["kind"];
    filename?: string | null;
    storageProvider: AssetRecord["storageProvider"];
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AssetRecord>;
  getById(id: string, input?: { ownerUserId?: string | null }): Promise<AssetRecord | null>;
  listByArtifactId(
    artifactId: string,
    input?: { ownerUserId?: string | null }
  ): Promise<AssetRecord[]>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapAssetRecord(record: {
  id: string;
  owner_user_id: string | null;
  artifact_id: string | null;
  kind: AssetRecord["kind"];
  filename: string | null;
  storage_provider: AssetRecord["storageProvider"];
  object_key: string;
  content_type: string;
  size_bytes: number;
  created_at: string | Date;
  updated_at: string | Date;
}): AssetRecord {
  return {
    id: record.id,
    ownerUserId: record.owner_user_id,
    artifactId: record.artifact_id,
    kind: record.kind,
    filename: record.filename,
    storageProvider: record.storage_provider,
    objectKey: record.object_key,
    contentType: record.content_type,
    sizeBytes: record.size_bytes,
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  };
}

export class InMemoryAssetRepository implements AssetRepository {
  private assets = new Map<string, AssetRecord>();

  async create(input: {
    ownerUserId?: string | null;
    artifactId?: string | null;
    kind: AssetRecord["kind"];
    filename?: string | null;
    storageProvider: AssetRecord["storageProvider"];
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AssetRecord> {
    const timestamp = new Date().toISOString();
    const record: AssetRecord = {
      id: crypto.randomUUID(),
      ownerUserId: input.ownerUserId ?? null,
      artifactId: input.artifactId ?? null,
      kind: input.kind,
      filename: input.filename ?? null,
      storageProvider: input.storageProvider,
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.assets.set(record.id, record);
    return record;
  }

  async getById(id: string, input?: { ownerUserId?: string | null }): Promise<AssetRecord | null> {
    const record = this.assets.get(id) ?? null;

    if (!record) {
      return null;
    }

    if (input?.ownerUserId && record.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return record;
  }

  async listByArtifactId(
    artifactId: string,
    input?: { ownerUserId?: string | null }
  ): Promise<AssetRecord[]> {
    return [...this.assets.values()]
      .filter((record) => record.artifactId === artifactId)
      .filter((record) =>
        input?.ownerUserId ? record.ownerUserId === input.ownerUserId : true
      )
      .sort((left, right) => {
        const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
        return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
      });
  }
}

export class PostgresAssetRepository implements AssetRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: {
    ownerUserId?: string | null;
    artifactId?: string | null;
    kind: AssetRecord["kind"];
    filename?: string | null;
    storageProvider: AssetRecord["storageProvider"];
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AssetRecord> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      artifact_id: string | null;
      kind: AssetRecord["kind"];
      filename: string | null;
      storage_provider: AssetRecord["storageProvider"];
      object_key: string;
      content_type: string;
      size_bytes: number;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into assets (
         id,
         owner_user_id,
         kind,
         storage_provider,
         object_key,
         content_type,
         size_bytes
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       returning
         id,
         owner_user_id,
         artifact_id,
         kind,
         filename,
         storage_provider,
         object_key,
         content_type,
         size_bytes,
         created_at,
         updated_at`,
      [
        crypto.randomUUID(),
        input.ownerUserId ?? null,
        input.artifactId ?? null,
        input.kind,
        input.filename ?? null,
        input.storageProvider,
        input.objectKey,
        input.contentType,
        input.sizeBytes
      ]
    );

    return mapAssetRecord(result.rows[0]!);
  }

  async getById(id: string, input?: { ownerUserId?: string | null }): Promise<AssetRecord | null> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      artifact_id: string | null;
      kind: AssetRecord["kind"];
      filename: string | null;
      storage_provider: AssetRecord["storageProvider"];
      object_key: string;
      content_type: string;
      size_bytes: number;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      input?.ownerUserId
        ? `select
             id,
             owner_user_id,
             artifact_id,
             kind,
             filename,
             storage_provider,
             object_key,
             content_type,
             size_bytes,
             created_at,
             updated_at
           from assets
           where id = $1 and owner_user_id = $2
           limit 1`
        : `select
             id,
             owner_user_id,
             artifact_id,
             kind,
             filename,
             storage_provider,
             object_key,
             content_type,
             size_bytes,
             created_at,
             updated_at
           from assets
           where id = $1
           limit 1`,
      input?.ownerUserId ? [id, input.ownerUserId] : [id]
    );

    const record = result.rows[0];
    return record ? mapAssetRecord(record) : null;
  }

  async listByArtifactId(
    artifactId: string,
    input?: { ownerUserId?: string | null }
  ): Promise<AssetRecord[]> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      artifact_id: string | null;
      kind: AssetRecord["kind"];
      filename: string | null;
      storage_provider: AssetRecord["storageProvider"];
      object_key: string;
      content_type: string;
      size_bytes: number;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      input?.ownerUserId
        ? `select
             id,
             owner_user_id,
             artifact_id,
             kind,
             filename,
             storage_provider,
             object_key,
             content_type,
             size_bytes,
             created_at,
             updated_at
           from assets
           where artifact_id = $1 and owner_user_id = $2
           order by created_at desc`
        : `select
             id,
             owner_user_id,
             artifact_id,
             kind,
             filename,
             storage_provider,
             object_key,
             content_type,
             size_bytes,
             created_at,
             updated_at
           from assets
           where artifact_id = $1
           order by created_at desc`,
      input?.ownerUserId ? [artifactId, input.ownerUserId] : [artifactId]
    );

    return result.rows.map(mapAssetRecord);
  }
}
