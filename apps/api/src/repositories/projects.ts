export interface Project {
  id: string;
  name: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ProjectRepository {
  list(input?: { ownerUserId?: string | null }): Promise<Project[]>;
  getById(projectId: string): Promise<Project | null>;
  create(input: { name: string; ownerUserId?: string | null }): Promise<Project>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapProjectRecord(record: {
  id: string;
  name: string;
  owner_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): Project {
  return {
    id: record.id,
    name: record.name,
    ownerUserId: record.owner_user_id,
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  };
}

export class InMemoryProjectRepository implements ProjectRepository {
  private projects = new Map<string, Project>();

  async list(input?: { ownerUserId?: string | null }): Promise<Project[]> {
    if (input?.ownerUserId) {
      return Array.from(this.projects.values()).filter(
        (project) => project.ownerUserId === input.ownerUserId
      );
    }

    return Array.from(this.projects.values());
  }

  async getById(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }

  async create(input: { name: string; ownerUserId?: string | null }): Promise<Project> {
    const timestamp = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name,
      ownerUserId: input.ownerUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.projects.set(project.id, project);
    return project;
  }
}

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly database: Queryable) {}

  async list(input?: { ownerUserId?: string | null }): Promise<Project[]> {
    const result = await this.database.query<{
      id: string;
      name: string;
      owner_user_id: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      input?.ownerUserId
        ? `select id, name, owner_user_id, created_at, updated_at
           from projects
           where owner_user_id = $1
           order by updated_at desc, created_at desc`
        : `select id, name, owner_user_id, created_at, updated_at
           from projects
           order by updated_at desc, created_at desc`,
      input?.ownerUserId ? [input.ownerUserId] : []
    );

    return result.rows.map(mapProjectRecord);
  }

  async getById(projectId: string): Promise<Project | null> {
    const result = await this.database.query<{
      id: string;
      name: string;
      owner_user_id: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select id, name, owner_user_id, created_at, updated_at
       from projects
       where id = $1
       limit 1`,
      [projectId]
    );

    const project = result.rows[0];
    return project ? mapProjectRecord(project) : null;
  }

  async create(input: { name: string; ownerUserId?: string | null }): Promise<Project> {
    const projectId = crypto.randomUUID();

    const result = await this.database.query<{
      id: string;
      name: string;
      owner_user_id: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into projects (id, name, owner_user_id)
       values ($1, $2, $3)
       returning id, name, owner_user_id, created_at, updated_at`,
      [projectId, input.name, input.ownerUserId ?? null]
    );

    return mapProjectRecord(result.rows[0]!);
  }
}
