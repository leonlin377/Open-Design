import type { ArtifactKind } from "@opendesign/contracts";

export interface Artifact {
  id: string;
  projectId: string;
  name: string;
  kind: ArtifactKind;
  createdAt: string;
  updatedAt: string;
}

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ArtifactRepository {
  listByProject(projectId: string): Promise<Artifact[]>;
  getById(projectId: string, artifactId: string): Promise<Artifact | null>;
  create(input: {
    projectId: string;
    name: string;
    kind: ArtifactKind;
  }): Promise<Artifact>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapArtifactRecord(record: {
  id: string;
  project_id: string;
  name: string;
  kind: ArtifactKind;
  created_at: string | Date;
  updated_at: string | Date;
}): Artifact {
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    kind: record.kind,
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  };
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  private artifacts: Artifact[] = [];

  async listByProject(projectId: string): Promise<Artifact[]> {
    return this.artifacts.filter((artifact) => artifact.projectId === projectId);
  }

  async getById(projectId: string, artifactId: string): Promise<Artifact | null> {
    return (
      this.artifacts.find(
        (artifact) => artifact.projectId === projectId && artifact.id === artifactId
      ) ?? null
    );
  }

  async create(input: {
    projectId: string;
    name: string;
    kind: ArtifactKind;
  }): Promise<Artifact> {
    const timestamp = new Date().toISOString();
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      name: input.name,
      kind: input.kind,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.artifacts.push(artifact);
    return artifact;
  }
}

export class PostgresArtifactRepository implements ArtifactRepository {
  constructor(private readonly database: Queryable) {}

  async listByProject(projectId: string): Promise<Artifact[]> {
    const result = await this.database.query<{
      id: string;
      project_id: string;
      name: string;
      kind: ArtifactKind;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select id, project_id, name, kind, created_at, updated_at
       from artifacts
       where project_id = $1
       order by updated_at desc, created_at desc`,
      [projectId]
    );

    return result.rows.map(mapArtifactRecord);
  }

  async getById(projectId: string, artifactId: string): Promise<Artifact | null> {
    const result = await this.database.query<{
      id: string;
      project_id: string;
      name: string;
      kind: ArtifactKind;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select id, project_id, name, kind, created_at, updated_at
       from artifacts
       where project_id = $1 and id = $2
       limit 1`,
      [projectId, artifactId]
    );

    const artifact = result.rows[0];
    return artifact ? mapArtifactRecord(artifact) : null;
  }

  async create(input: {
    projectId: string;
    name: string;
    kind: ArtifactKind;
  }): Promise<Artifact> {
    const artifactId = crypto.randomUUID();

    const result = await this.database.query<{
      id: string;
      project_id: string;
      name: string;
      kind: ArtifactKind;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into artifacts (id, project_id, name, kind)
       values ($1, $2, $3, $4)
       returning id, project_id, name, kind, created_at, updated_at`,
      [artifactId, input.projectId, input.name, input.kind]
    );

    return mapArtifactRecord(result.rows[0]!);
  }
}
