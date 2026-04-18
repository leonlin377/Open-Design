import {
  ArtifactCodeWorkspaceSchema,
  ArtifactVersionSnapshotSchema,
  SceneDocumentSchema,
  type ArtifactCodeWorkspace,
  type ArtifactVersionSnapshot,
  type ArtifactVersionSource,
  type SceneDocument
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
    sceneDocument: SceneDocument;
    codeWorkspace: ArtifactCodeWorkspace | null;
  }): Promise<ArtifactVersionSnapshot>;
  getStateById(
    artifactId: string,
    versionId: string
  ): Promise<ArtifactVersionState | null>;
}

export interface ArtifactVersionState {
  snapshot: ArtifactVersionSnapshot;
  sceneDocument: SceneDocument;
  codeWorkspace: ArtifactCodeWorkspace | null;
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
  code_workspace_files?: unknown | null;
  created_at: string | Date;
}): ArtifactVersionSnapshot {
  return ArtifactVersionSnapshotSchema.parse({
    id: record.id,
    artifactId: record.artifact_id,
    label: record.label,
    summary: record.summary,
    source: record.source,
    sceneVersion: record.scene_version,
    hasCodeWorkspaceSnapshot: Boolean(record.code_workspace_files),
    createdAt: toIsoTimestamp(record.created_at)
  });
}

function mapVersionStateRecord(record: {
  id: string;
  artifact_id: string;
  label: string;
  summary: string;
  source: ArtifactVersionSource;
  scene_version: number;
  scene_document: unknown;
  code_workspace_files: unknown | null;
  code_workspace_updated_at: string | Date | null;
  created_at: string | Date;
}): ArtifactVersionState {
  return {
    snapshot: mapVersionRecord(record),
    sceneDocument: SceneDocumentSchema.parse(record.scene_document),
    codeWorkspace:
      record.code_workspace_files && record.code_workspace_updated_at
        ? ArtifactCodeWorkspaceSchema.parse({
            ...(record.code_workspace_files as Record<string, unknown>),
            updatedAt: toIsoTimestamp(record.code_workspace_updated_at)
          })
        : null
  };
}

export class InMemoryArtifactVersionRepository implements ArtifactVersionRepository {
  private versionStates: ArtifactVersionState[] = [];

  async listByArtifactId(artifactId: string): Promise<ArtifactVersionSnapshot[]> {
    return this.versionStates
      .filter((version) => version.snapshot.artifactId === artifactId)
      .map((version) => version.snapshot);
  }

  async create(input: {
    artifactId: string;
    label: string;
    summary: string;
    source: ArtifactVersionSource;
    sceneVersion: number;
    sceneDocument: SceneDocument;
    codeWorkspace: ArtifactCodeWorkspace | null;
  }): Promise<ArtifactVersionSnapshot> {
    const version = ArtifactVersionSnapshotSchema.parse({
      id: crypto.randomUUID(),
      artifactId: input.artifactId,
      label: input.label,
      summary: input.summary,
      source: input.source,
      sceneVersion: input.sceneVersion,
      hasCodeWorkspaceSnapshot: Boolean(input.codeWorkspace),
      createdAt: new Date().toISOString()
    });

    this.versionStates.unshift({
      snapshot: version,
      sceneDocument: input.sceneDocument,
      codeWorkspace: input.codeWorkspace
    });
    return version;
  }

  async getStateById(
    artifactId: string,
    versionId: string
  ): Promise<ArtifactVersionState | null> {
    return (
      this.versionStates.find(
        (version) =>
          version.snapshot.artifactId === artifactId && version.snapshot.id === versionId
      ) ?? null
    );
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
      code_workspace_files: unknown | null;
      created_at: string | Date;
    }>(
      `select id, artifact_id, label, summary, source, scene_version,
              code_workspace_files, created_at
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
    sceneDocument: SceneDocument;
    codeWorkspace: ArtifactCodeWorkspace | null;
  }): Promise<ArtifactVersionSnapshot> {
    const versionId = crypto.randomUUID();
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      label: string;
      summary: string;
      source: ArtifactVersionSource;
      scene_version: number;
      code_workspace_files: unknown | null;
      created_at: string | Date;
    }>(
      `insert into artifact_versions (
          id,
          artifact_id,
          label,
          summary,
          source,
          scene_version,
          scene_document,
          code_workspace_files,
          code_workspace_updated_at
        )
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       returning id, artifact_id, label, summary, source, scene_version,
                 code_workspace_files, created_at`,
      [
        versionId,
        input.artifactId,
        input.label,
        input.summary,
        input.source,
        input.sceneVersion,
        JSON.stringify(input.sceneDocument),
        input.codeWorkspace
          ? JSON.stringify({
              files: input.codeWorkspace.files,
              baseSceneVersion: input.codeWorkspace.baseSceneVersion
            })
          : null,
        input.codeWorkspace?.updatedAt ?? null
      ]
    );

    return mapVersionRecord(result.rows[0]!);
  }

  async getStateById(
    artifactId: string,
    versionId: string
  ): Promise<ArtifactVersionState | null> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      label: string;
      summary: string;
      source: ArtifactVersionSource;
      scene_version: number;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
    }>(
      `select id, artifact_id, label, summary, source, scene_version,
              scene_document, code_workspace_files, code_workspace_updated_at,
              created_at
       from artifact_versions
       where artifact_id = $1 and id = $2
       limit 1`,
      [artifactId, versionId]
    );

    const record = result.rows[0];
    return record ? mapVersionStateRecord(record) : null;
  }
}
