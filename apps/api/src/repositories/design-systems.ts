import { DesignSystemPackSchema, type DesignSystemPack } from "@opendesign/contracts";

export interface DesignSystemPackRecord extends DesignSystemPack {
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

export interface DesignSystemRepository {
  list(input?: { ownerUserId?: string | null }): Promise<DesignSystemPackRecord[]>;
  getById(id: string, input?: { ownerUserId?: string | null }): Promise<DesignSystemPackRecord | null>;
  create(input: {
    ownerUserId?: string | null;
    pack: DesignSystemPack;
  }): Promise<DesignSystemPackRecord>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapDesignSystemRecord(record: {
  id: string;
  owner_user_id: string | null;
  pack: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}): DesignSystemPackRecord {
  return {
    ...DesignSystemPackSchema.parse(record.pack),
    ownerUserId: record.owner_user_id,
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  };
}

export class InMemoryDesignSystemRepository implements DesignSystemRepository {
  private packs = new Map<string, DesignSystemPackRecord>();

  async list(input?: { ownerUserId?: string | null }): Promise<DesignSystemPackRecord[]> {
    const packs = [...this.packs.values()];

    if (input?.ownerUserId) {
      return packs.filter((pack) => pack.ownerUserId === input.ownerUserId);
    }

    return packs;
  }

  async getById(
    id: string,
    input?: { ownerUserId?: string | null }
  ): Promise<DesignSystemPackRecord | null> {
    const record = this.packs.get(id) ?? null;

    if (!record) {
      return null;
    }

    if (input?.ownerUserId && record.ownerUserId !== input.ownerUserId) {
      return null;
    }

    return record;
  }

  async create(input: {
    ownerUserId?: string | null;
    pack: DesignSystemPack;
  }): Promise<DesignSystemPackRecord> {
    const timestamp = new Date().toISOString();
    const record: DesignSystemPackRecord = {
      ...input.pack,
      ownerUserId: input.ownerUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.packs.set(record.id, record);
    return record;
  }
}

export class PostgresDesignSystemRepository implements DesignSystemRepository {
  constructor(private readonly database: Queryable) {}

  async list(input?: { ownerUserId?: string | null }): Promise<DesignSystemPackRecord[]> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      pack: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      input?.ownerUserId
        ? `select id, owner_user_id, pack, created_at, updated_at
           from design_system_packs
           where owner_user_id = $1
           order by updated_at desc, created_at desc`
        : `select id, owner_user_id, pack, created_at, updated_at
           from design_system_packs
           order by updated_at desc, created_at desc`,
      input?.ownerUserId ? [input.ownerUserId] : []
    );

    return result.rows.map(mapDesignSystemRecord);
  }

  async getById(
    id: string,
    input?: { ownerUserId?: string | null }
  ): Promise<DesignSystemPackRecord | null> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      pack: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      input?.ownerUserId
        ? `select id, owner_user_id, pack, created_at, updated_at
           from design_system_packs
           where id = $1 and owner_user_id = $2
           limit 1`
        : `select id, owner_user_id, pack, created_at, updated_at
           from design_system_packs
           where id = $1
           limit 1`,
      input?.ownerUserId ? [id, input.ownerUserId] : [id]
    );

    const record = result.rows[0];
    return record ? mapDesignSystemRecord(record) : null;
  }

  async create(input: {
    ownerUserId?: string | null;
    pack: DesignSystemPack;
  }): Promise<DesignSystemPackRecord> {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string | null;
      pack: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into design_system_packs (id, owner_user_id, pack)
       values ($1, $2, $3::jsonb)
       returning id, owner_user_id, pack, created_at, updated_at`,
      [input.pack.id, input.ownerUserId ?? null, JSON.stringify(input.pack)]
    );

    return mapDesignSystemRecord(result.rows[0]!);
  }
}
