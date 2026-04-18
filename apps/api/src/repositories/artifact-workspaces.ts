import {
  ArtifactCodeWorkspaceSchema,
  SceneDocumentSchema,
  type ArtifactWorkspace,
  type SceneDocument
} from "@opendesign/contracts";

export interface ArtifactWorkspaceRecord
  extends Pick<
    ArtifactWorkspace,
    | "artifactId"
    | "intent"
    | "activeVersionId"
    | "sceneDocument"
    | "codeWorkspace"
    | "updatedAt"
  > {
  createdAt: string;
}

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ArtifactWorkspaceRepository {
  getByArtifactId(artifactId: string): Promise<ArtifactWorkspaceRecord | null>;
  create(input: {
    artifactId: string;
    intent: string;
    activeVersionId: string | null;
    sceneDocument: SceneDocument;
  }): Promise<ArtifactWorkspaceRecord>;
  updateActiveVersion(
    artifactId: string,
    activeVersionId: string | null
  ): Promise<ArtifactWorkspaceRecord | null>;
  updateIntent(
    artifactId: string,
    intent: string
  ): Promise<ArtifactWorkspaceRecord | null>;
  updateSceneDocument(
    artifactId: string,
    sceneDocument: SceneDocument
  ): Promise<ArtifactWorkspaceRecord | null>;
  updateCodeWorkspace(
    artifactId: string,
    input:
      | {
          files: Record<string, string>;
          baseSceneVersion: number;
        }
      | null
  ): Promise<ArtifactWorkspaceRecord | null>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapWorkspaceRecord(record: {
  artifact_id: string;
  intent: string;
  active_version_id: string | null;
  scene_document: unknown;
  code_workspace_files: unknown | null;
  code_workspace_updated_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}): ArtifactWorkspaceRecord {
  return {
    artifactId: record.artifact_id,
    intent: record.intent,
    activeVersionId: record.active_version_id,
    sceneDocument: SceneDocumentSchema.parse(record.scene_document),
    codeWorkspace:
      record.code_workspace_files && record.code_workspace_updated_at
        ? ArtifactCodeWorkspaceSchema.parse({
            ...(record.code_workspace_files as Record<string, unknown>),
            updatedAt: toIsoTimestamp(record.code_workspace_updated_at)
          })
        : null,
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  };
}

export class InMemoryArtifactWorkspaceRepository implements ArtifactWorkspaceRepository {
  private workspaces = new Map<string, ArtifactWorkspaceRecord>();

  async getByArtifactId(artifactId: string): Promise<ArtifactWorkspaceRecord | null> {
    return this.workspaces.get(artifactId) ?? null;
  }

  async create(input: {
    artifactId: string;
    intent: string;
    activeVersionId: string | null;
    sceneDocument: SceneDocument;
  }): Promise<ArtifactWorkspaceRecord> {
    const existing = this.workspaces.get(input.artifactId);
    if (existing) {
      return existing;
    }

    const timestamp = new Date().toISOString();
    const workspace: ArtifactWorkspaceRecord = {
      artifactId: input.artifactId,
      intent: input.intent,
      activeVersionId: input.activeVersionId,
      sceneDocument: input.sceneDocument,
      codeWorkspace: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.workspaces.set(input.artifactId, workspace);
    return workspace;
  }

  async updateActiveVersion(
    artifactId: string,
    activeVersionId: string | null
  ): Promise<ArtifactWorkspaceRecord | null> {
    const workspace = this.workspaces.get(artifactId);
    if (!workspace) {
      return null;
    }

    const updated: ArtifactWorkspaceRecord = {
      ...workspace,
      activeVersionId,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(artifactId, updated);
    return updated;
  }

  async updateIntent(
    artifactId: string,
    intent: string
  ): Promise<ArtifactWorkspaceRecord | null> {
    const workspace = this.workspaces.get(artifactId);
    if (!workspace) {
      return null;
    }

    const updated: ArtifactWorkspaceRecord = {
      ...workspace,
      intent,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(artifactId, updated);
    return updated;
  }

  async updateSceneDocument(
    artifactId: string,
    sceneDocument: SceneDocument
  ): Promise<ArtifactWorkspaceRecord | null> {
    const workspace = this.workspaces.get(artifactId);
    if (!workspace) {
      return null;
    }

    const updated: ArtifactWorkspaceRecord = {
      ...workspace,
      sceneDocument,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(artifactId, updated);
    return updated;
  }

  async updateCodeWorkspace(
    artifactId: string,
    input:
      | {
          files: Record<string, string>;
          baseSceneVersion: number;
        }
      | null
  ): Promise<ArtifactWorkspaceRecord | null> {
    const workspace = this.workspaces.get(artifactId);
    if (!workspace) {
      return null;
    }

    const timestamp = new Date().toISOString();
    const updated: ArtifactWorkspaceRecord = {
      ...workspace,
      codeWorkspace: input
        ? {
            files: input.files,
            baseSceneVersion: input.baseSceneVersion,
            updatedAt: timestamp
          }
        : null,
      updatedAt: timestamp
    };

    this.workspaces.set(artifactId, updated);
    return updated;
  }
}

export class PostgresArtifactWorkspaceRepository implements ArtifactWorkspaceRepository {
  constructor(private readonly database: Queryable) {}

  async getByArtifactId(artifactId: string): Promise<ArtifactWorkspaceRecord | null> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select artifact_id, intent, active_version_id, scene_document,
              code_workspace_files, code_workspace_updated_at,
              created_at, updated_at
       from artifact_workspaces
       where artifact_id = $1
       limit 1`,
      [artifactId]
    );

    const workspace = result.rows[0];
    return workspace ? mapWorkspaceRecord(workspace) : null;
  }

  async create(input: {
    artifactId: string;
    intent: string;
    activeVersionId: string | null;
    sceneDocument: SceneDocument;
  }): Promise<ArtifactWorkspaceRecord> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into artifact_workspaces (
          artifact_id,
          intent,
          active_version_id,
          scene_document,
          code_workspace_files,
          code_workspace_updated_at
        )
       values ($1, $2, $3, $4::jsonb, null, null)
       on conflict (artifact_id) do update
       set intent = artifact_workspaces.intent
       returning artifact_id, intent, active_version_id, scene_document,
                 code_workspace_files, code_workspace_updated_at,
                 created_at, updated_at`,
      [
        input.artifactId,
        input.intent,
        input.activeVersionId,
        JSON.stringify(input.sceneDocument)
      ]
    );

    return mapWorkspaceRecord(result.rows[0]!);
  }

  async updateActiveVersion(
    artifactId: string,
    activeVersionId: string | null
  ): Promise<ArtifactWorkspaceRecord | null> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `update artifact_workspaces
       set active_version_id = $2,
           updated_at = now()
       where artifact_id = $1
       returning artifact_id, intent, active_version_id, scene_document,
                 code_workspace_files, code_workspace_updated_at,
                 created_at, updated_at`,
      [artifactId, activeVersionId]
    );

    const workspace = result.rows[0];
    return workspace ? mapWorkspaceRecord(workspace) : null;
  }

  async updateIntent(
    artifactId: string,
    intent: string
  ): Promise<ArtifactWorkspaceRecord | null> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `update artifact_workspaces
       set intent = $2,
           updated_at = now()
       where artifact_id = $1
       returning artifact_id, intent, active_version_id, scene_document,
                 code_workspace_files, code_workspace_updated_at,
                 created_at, updated_at`,
      [artifactId, intent]
    );

    const workspace = result.rows[0];
    return workspace ? mapWorkspaceRecord(workspace) : null;
  }

  async updateSceneDocument(
    artifactId: string,
    sceneDocument: SceneDocument
  ): Promise<ArtifactWorkspaceRecord | null> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `update artifact_workspaces
       set scene_document = $2::jsonb,
           updated_at = now()
       where artifact_id = $1
       returning artifact_id, intent, active_version_id, scene_document,
                 code_workspace_files, code_workspace_updated_at,
                 created_at, updated_at`,
      [artifactId, JSON.stringify(sceneDocument)]
    );

    const workspace = result.rows[0];
    return workspace ? mapWorkspaceRecord(workspace) : null;
  }

  async updateCodeWorkspace(
    artifactId: string,
    input:
      | {
          files: Record<string, string>;
          baseSceneVersion: number;
        }
      | null
  ): Promise<ArtifactWorkspaceRecord | null> {
    const result = await this.database.query<{
      artifact_id: string;
      intent: string;
      active_version_id: string | null;
      scene_document: unknown;
      code_workspace_files: unknown | null;
      code_workspace_updated_at: string | Date | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `update artifact_workspaces
       set code_workspace_files = $2::jsonb,
           code_workspace_updated_at = case when $2::jsonb is null then null else now() end,
           updated_at = now()
       where artifact_id = $1
       returning artifact_id, intent, active_version_id, scene_document,
                 code_workspace_files, code_workspace_updated_at,
                 created_at, updated_at`,
      [
        artifactId,
        input
          ? JSON.stringify({
              files: input.files,
              baseSceneVersion: input.baseSceneVersion
            })
          : "null"
      ]
    );

    const workspace = result.rows[0];
    return workspace ? mapWorkspaceRecord(workspace) : null;
  }
}
