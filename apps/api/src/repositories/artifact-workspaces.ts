import {
  ArtifactCodeWorkspaceSchema,
  ArtifactVersionSnapshotSchema,
  SceneDocumentSchema,
  type ArtifactCodeWorkspace,
  type ArtifactVersionSnapshot,
  type ArtifactVersionSource,
  type ArtifactWorkspace,
  type SceneDocument
} from "@opendesign/contracts";
import type { InMemoryArtifactVersionRepository } from "./artifact-versions";

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

interface TransactionalPool extends Queryable {
  connect?(): Promise<PoolClient>;
}

interface PoolClient extends Queryable {
  release(): void;
}

export interface ApplyGenerationRunInput {
  artifactId: string;
  intent: string;
  sceneDocument: SceneDocument;
  /**
   * Optional trailing writes to fold into the same atomic commit as
   * intent/scene/version. When present, the workspace's `codeWorkspace`
   * column and `active_version_id` pointer are updated in the same Postgres
   * transaction (or snapshot+revert in the in-memory path) so the tuple
   * (intent, scene, version, codeWorkspace, activeVersionId) cannot observably
   * diverge on crash.
   */
  codeWorkspace?: ArtifactCodeWorkspace | null;
  /**
   * When true, `workspace.active_version_id` is set to the newly-created
   * version inside the same commit. Defaults to true; set to false to keep
   * the existing active version pointer (rare).
   */
  activateNewVersion?: boolean;
  version: {
    label: string;
    summary: string;
    source: ArtifactVersionSource;
    sceneVersion: number;
    sceneDocument: SceneDocument;
    codeWorkspace: ArtifactCodeWorkspace | null;
  };
}

export interface ApplyGenerationRunResult {
  workspace: ArtifactWorkspaceRecord;
  version: ArtifactVersionSnapshot;
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
  applyGenerationRun(
    input: ApplyGenerationRunInput
  ): Promise<ApplyGenerationRunResult | null>;
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
  private versions: InMemoryArtifactVersionRepository | null = null;

  setVersionRepository(versions: InMemoryArtifactVersionRepository): void {
    this.versions = versions;
  }

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

  async applyGenerationRun(
    input: ApplyGenerationRunInput
  ): Promise<ApplyGenerationRunResult | null> {
    if (!this.versions) {
      throw new Error(
        "InMemoryArtifactWorkspaceRepository requires a version repository for applyGenerationRun"
      );
    }

    const previousWorkspace = this.workspaces.get(input.artifactId);
    if (!previousWorkspace) {
      return null;
    }

    const versionSnapshot = this.versions._captureSnapshot();
    const workspaceSnapshot: ArtifactWorkspaceRecord = { ...previousWorkspace };

    try {
      const timestamp = new Date().toISOString();
      const nextCodeWorkspace =
        input.codeWorkspace === undefined
          ? previousWorkspace.codeWorkspace
          : input.codeWorkspace === null
            ? null
            : {
                files: input.codeWorkspace.files,
                baseSceneVersion: input.codeWorkspace.baseSceneVersion,
                updatedAt: timestamp
              };
      const intermediate: ArtifactWorkspaceRecord = {
        ...previousWorkspace,
        intent: input.intent,
        sceneDocument: input.sceneDocument,
        codeWorkspace: nextCodeWorkspace,
        updatedAt: timestamp
      };
      this.workspaces.set(input.artifactId, intermediate);

      const version = await this.versions.create({
        artifactId: input.artifactId,
        label: input.version.label,
        summary: input.version.summary,
        source: input.version.source,
        sceneVersion: input.version.sceneVersion,
        sceneDocument: input.version.sceneDocument,
        codeWorkspace: input.version.codeWorkspace
      });

      const finalWorkspace: ArtifactWorkspaceRecord =
        input.activateNewVersion === false
          ? intermediate
          : {
              ...intermediate,
              activeVersionId: version.id,
              updatedAt: new Date().toISOString()
            };
      this.workspaces.set(input.artifactId, finalWorkspace);

      return {
        workspace: finalWorkspace,
        version
      };
    } catch (error) {
      this.workspaces.set(input.artifactId, workspaceSnapshot);
      this.versions._restoreSnapshot(versionSnapshot);
      throw error;
    }
  }
}

export class PostgresArtifactWorkspaceRepository implements ArtifactWorkspaceRepository {
  constructor(private readonly database: TransactionalPool) {}

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

  async applyGenerationRun(
    input: ApplyGenerationRunInput
  ): Promise<ApplyGenerationRunResult | null> {
    const activateNewVersion = input.activateNewVersion !== false;
    const codeWorkspaceJson =
      input.codeWorkspace === undefined
        ? undefined // leave column unchanged
        : input.codeWorkspace === null
          ? null
          : JSON.stringify({
              files: input.codeWorkspace.files,
              baseSceneVersion: input.codeWorkspace.baseSceneVersion
            });

    const versionId = crypto.randomUUID();
    const versionInsertArgs = [
      versionId,
      input.artifactId,
      input.version.label,
      input.version.summary,
      input.version.source,
      input.version.sceneVersion,
      JSON.stringify(input.version.sceneDocument),
      input.version.codeWorkspace
        ? JSON.stringify({
            files: input.version.codeWorkspace.files,
            baseSceneVersion: input.version.codeWorkspace.baseSceneVersion
          })
        : null,
      input.version.codeWorkspace?.updatedAt ?? null
    ] as const;

    const runCommit = async (
      queryable: { query: TransactionalPool["query"] }
    ): Promise<ApplyGenerationRunResult | null> => {
      // Initial workspace update covers intent + scene; codeWorkspace is folded
      // in when the caller supplied it. activeVersionId is pinned in a second
      // UPDATE after the version row exists (same tx below).
      const updateArgs: unknown[] = [
        input.artifactId,
        input.intent,
        JSON.stringify(input.sceneDocument)
      ];
      let updateSql = `update artifact_workspaces
           set intent = $2,
               scene_document = $3::jsonb`;

      if (codeWorkspaceJson !== undefined) {
        updateArgs.push(codeWorkspaceJson === null ? "null" : codeWorkspaceJson);
        updateSql += `,
               code_workspace_files = $${updateArgs.length}::jsonb,
               code_workspace_updated_at = now()`;
      }
      updateSql += `,
               updated_at = now()
           where artifact_id = $1
           returning artifact_id, intent, active_version_id, scene_document,
                     code_workspace_files, code_workspace_updated_at,
                     created_at, updated_at`;

      const intentResult = await queryable.query<{
        artifact_id: string;
        intent: string;
        active_version_id: string | null;
        scene_document: unknown;
        code_workspace_files: unknown | null;
        code_workspace_updated_at: string | Date | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(updateSql, updateArgs);

      if (!intentResult.rows[0]) {
        return null;
      }

      const versionResult = await queryable.query<{
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
              id, artifact_id, label, summary, source,
              scene_version, scene_document, code_workspace_files,
              code_workspace_updated_at
            )
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
           returning id, artifact_id, label, summary, source, scene_version,
                     code_workspace_files, created_at`,
        [...versionInsertArgs]
      );

      let finalWorkspaceRow = intentResult.rows[0];
      if (activateNewVersion) {
        const activeResult = await queryable.query<typeof finalWorkspaceRow>(
          `update artifact_workspaces
              set active_version_id = $2,
                  updated_at = now()
            where artifact_id = $1
            returning artifact_id, intent, active_version_id, scene_document,
                      code_workspace_files, code_workspace_updated_at,
                      created_at, updated_at`,
          [input.artifactId, versionId]
        );
        if (activeResult.rows[0]) {
          finalWorkspaceRow = activeResult.rows[0];
        }
      }

      return {
        workspace: mapWorkspaceRecord(finalWorkspaceRow),
        version: ArtifactVersionSnapshotSchema.parse({
          id: versionResult.rows[0]!.id,
          artifactId: versionResult.rows[0]!.artifact_id,
          label: versionResult.rows[0]!.label,
          summary: versionResult.rows[0]!.summary,
          source: versionResult.rows[0]!.source,
          sceneVersion: versionResult.rows[0]!.scene_version,
          hasCodeWorkspaceSnapshot: Boolean(versionResult.rows[0]!.code_workspace_files),
          createdAt:
            versionResult.rows[0]!.created_at instanceof Date
              ? versionResult.rows[0]!.created_at.toISOString()
              : versionResult.rows[0]!.created_at
        })
      };
    };

    if (typeof this.database.connect !== "function") {
      // Fallback path — used by tests that wire a query-only mock. Atomicity
      // cannot be enforced without a connect()-capable pool; log a loud
      // warning so a real deployment wired with a non-transactional queryable
      // surface (e.g. PgBouncer session-less proxy) is visible in logs.
      // eslint-disable-next-line no-console
      console.warn(
        "[artifact-workspaces] applyGenerationRun executed without a transactional pool; intent/scene/version commits are NOT atomic. Fix the database wiring for production."
      );
      return runCommit({ query: this.database.query.bind(this.database) });
    }

    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const result = await runCommit({ query: client.query.bind(client) });
      if (!result) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback failure; underlying error rethrown below.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
