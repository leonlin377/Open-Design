import {
  ShareTokenSchema,
  type ShareResourceType,
  type ShareRole,
  type ShareToken
} from "@opendesign/contracts";

export interface ShareTokenRecord extends ShareToken {}

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ShareTokenRepository {
  create(input: {
    resourceType: ShareResourceType;
    role: ShareRole;
    resourceId: string;
    projectId: string;
    createdByUserId?: string | null;
    expiresAt?: string | null;
  }): Promise<ShareTokenRecord>;
  getByToken(token: string): Promise<ShareTokenRecord | null>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapShareTokenRecord(record: {
  id: string;
  token: string;
  resource_type: ShareResourceType;
  role: ShareRole;
  resource_id: string;
  project_id: string;
  created_by_user_id: string | null;
  created_at: string | Date;
  expires_at: string | Date | null;
}): ShareTokenRecord {
  return ShareTokenSchema.parse({
    id: record.id,
    token: record.token,
    resourceType: record.resource_type,
    role: record.role,
    resourceId: record.resource_id,
    projectId: record.project_id,
    createdByUserId: record.created_by_user_id,
    createdAt: toIsoTimestamp(record.created_at),
    expiresAt: record.expires_at ? toIsoTimestamp(record.expires_at) : null
  });
}

function createOpaqueToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export class InMemoryShareTokenRepository implements ShareTokenRepository {
  private tokens = new Map<string, ShareTokenRecord>();

  async create(input: {
    resourceType: ShareResourceType;
    role: ShareRole;
    resourceId: string;
    projectId: string;
    createdByUserId?: string | null;
    expiresAt?: string | null;
  }): Promise<ShareTokenRecord> {
    const timestamp = new Date().toISOString();
    const record = ShareTokenSchema.parse({
      id: crypto.randomUUID(),
      token: createOpaqueToken(),
      resourceType: input.resourceType,
      role: input.role,
      resourceId: input.resourceId,
      projectId: input.projectId,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: timestamp,
      expiresAt: input.expiresAt ?? null
    });

    this.tokens.set(record.token, record);
    return record;
  }

  async getByToken(token: string): Promise<ShareTokenRecord | null> {
    const record = this.tokens.get(token) ?? null;

    if (!record) {
      return null;
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    return record;
  }
}

export class PostgresShareTokenRepository implements ShareTokenRepository {
  constructor(private readonly database: Queryable) {}

  async create(input: {
    resourceType: ShareResourceType;
    role: ShareRole;
    resourceId: string;
    projectId: string;
    createdByUserId?: string | null;
    expiresAt?: string | null;
  }): Promise<ShareTokenRecord> {
    const result = await this.database.query<{
      id: string;
      token: string;
      resource_type: ShareResourceType;
      role: ShareRole;
      resource_id: string;
      project_id: string;
      created_by_user_id: string | null;
      created_at: string | Date;
      expires_at: string | Date | null;
    }>(
      `insert into share_tokens (
         id,
         token,
         resource_type,
         role,
         resource_id,
         project_id,
         created_by_user_id,
         expires_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning
         id,
         token,
         resource_type,
         role,
         resource_id,
         project_id,
         created_by_user_id,
         created_at,
         expires_at`,
      [
        crypto.randomUUID(),
        createOpaqueToken(),
        input.resourceType,
        input.role,
        input.resourceId,
        input.projectId,
        input.createdByUserId ?? null,
        input.expiresAt ?? null
      ]
    );

    return mapShareTokenRecord(result.rows[0]!);
  }

  async getByToken(token: string): Promise<ShareTokenRecord | null> {
    const result = await this.database.query<{
      id: string;
      token: string;
      resource_type: ShareResourceType;
      role: ShareRole;
      resource_id: string;
      project_id: string;
      created_by_user_id: string | null;
      created_at: string | Date;
      expires_at: string | Date | null;
    }>(
      `select
         id,
         token,
         resource_type,
         role,
         resource_id,
         project_id,
         created_by_user_id,
         created_at,
         expires_at
       from share_tokens
       where token = $1
         and (expires_at is null or expires_at > now())
       limit 1`,
      [token]
    );

    const record = result.rows[0];
    return record ? mapShareTokenRecord(record) : null;
  }
}
