import {
  ArtifactVersionSnapshotSchema,
  type ArtifactVersionSnapshot,
  type ArtifactVersionSource
} from "@opendesign/contracts";

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ArtifactVersionRepository {
  listByArtifactId(artifactId: string): Promise<ArtifactVersionSnapshot[]>;
  create(input: {
    artifactId: string;
    label: string;
    summary: string;
    source: ArtifactVersionSource;
    sceneVersion: number;
  }): Promise<ArtifactVersionSnapshot>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapVersionRecord(record: {
  id: string;
  artifact_id: string;
  label: string;
  summary: string;
  source: ArtifactVersionSource;
  scene_version: number;
  created_at: string | Date;
}): ArtifactVersionSnapshot {
  return ArtifactVersionSnapshotSchema.parse({
    id: record.id,
    artifactId: record.artifact_id,
    label: record.label,
    summary: record.summary,
    source: record.source,
    sceneVersion: record.scene_version,
    createdAt: toIsoTimestamp(record.created_at)
  });
}

export class InMemoryArtifactVersionRepository implements ArtifactVersionRepository {
  private versions: ArtifactVersionSnapshot[] = [];

  async listByArtifactId(artifactId: string): Promise<ArtifactVersionSnapshot[]> {
    return this.versions.filter((version) => version.artifactId === artifactId);
  }

  async create(input: {
    artifactId: string;
    label: string;
    summary: string;
    source: ArtifactVersionSource;
    sceneVersion: number;
  }): Promise<ArtifactVersionSnapshot> {
    const version = ArtifactVersionSnapshotSchema.parse({
      id: crypto.randomUUID(),
      artifactId: input.artifactId,
      label: input.label,
      summary: input.summary,
      source: input.source,
      sceneVersion: input.sceneVersion,
      createdAt: new Date().toISOString()
    });

    this.versions.unshift(version);
    return version;
  }
}

export class PostgresArtifactVersionRepository implements ArtifactVersionRepository {
  constructor(private readonly database: Queryable) {}

  async listByArtifactId(artifactId: string): Promise<ArtifactVersionSnapshot[]> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      label: string;
      summary: string;
      source: ArtifactVersionSource;
      scene_version: number;
      created_at: string | Date;
    }>(
      `select id, artifact_id, label, summary, source, scene_version, created_at
       from artifact_versions
       where artifact_id = $1
       order by created_at desc`,
      [artifactId]
    );

    return result.rows.map(mapVersionRecord);
  }

  async create(input: {
    artifactId: string;
    label: string;
    summary: string;
    source: ArtifactVersionSource;
    sceneVersion: number;
  }): Promise<ArtifactVersionSnapshot> {
    const versionId = crypto.randomUUID();
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      label: string;
      summary: string;
      source: ArtifactVersionSource;
      scene_version: number;
      created_at: string | Date;
    }>(
      `insert into artifact_versions (id, artifact_id, label, summary, source, scene_version)
       values ($1, $2, $3, $4, $5, $6)
       returning id, artifact_id, label, summary, source, scene_version, created_at`,
      [
        versionId,
        input.artifactId,
        input.label,
        input.summary,
        input.source,
        input.sceneVersion
      ]
    );

    return mapVersionRecord(result.rows[0]!);
  }
}
