import {
  ArtifactCommentSchema,
  CommentAnchorSchema,
  type ArtifactComment,
  type ArtifactCommentStatus,
  type CommentAnchor
} from "@opendesign/contracts";

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ArtifactCommentRepository {
  listByArtifactId(artifactId: string): Promise<ArtifactComment[]>;
  create(input: {
    artifactId: string;
    body: string;
    anchor: CommentAnchor;
    status?: ArtifactCommentStatus;
  }): Promise<ArtifactComment>;
  resolve(artifactId: string, commentId: string): Promise<ArtifactComment | null>;
}

function toIsoTimestamp(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapCommentRecord(record: {
  id: string;
  artifact_id: string;
  body: string;
  status: ArtifactCommentStatus;
  anchor: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}): ArtifactComment {
  return ArtifactCommentSchema.parse({
    id: record.id,
    artifactId: record.artifact_id,
    body: record.body,
    status: record.status,
    anchor: CommentAnchorSchema.parse(record.anchor),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at)
  });
}

export class InMemoryArtifactCommentRepository implements ArtifactCommentRepository {
  private comments: ArtifactComment[] = [];

  async listByArtifactId(artifactId: string): Promise<ArtifactComment[]> {
    return this.comments.filter((comment) => comment.artifactId === artifactId);
  }

  async create(input: {
    artifactId: string;
    body: string;
    anchor: CommentAnchor;
    status?: ArtifactCommentStatus;
  }): Promise<ArtifactComment> {
    const timestamp = new Date().toISOString();
    const comment = ArtifactCommentSchema.parse({
      id: crypto.randomUUID(),
      artifactId: input.artifactId,
      body: input.body,
      status: input.status ?? "open",
      anchor: input.anchor,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    this.comments.unshift(comment);
    return comment;
  }

  async resolve(artifactId: string, commentId: string): Promise<ArtifactComment | null> {
    const index = this.comments.findIndex(
      (comment) => comment.artifactId === artifactId && comment.id === commentId
    );

    if (index === -1) {
      return null;
    }

    const updated = ArtifactCommentSchema.parse({
      ...this.comments[index],
      status: "resolved",
      updatedAt: new Date().toISOString()
    });

    this.comments[index] = updated;
    return updated;
  }
}

export class PostgresArtifactCommentRepository implements ArtifactCommentRepository {
  constructor(private readonly database: Queryable) {}

  async listByArtifactId(artifactId: string): Promise<ArtifactComment[]> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      body: string;
      status: ArtifactCommentStatus;
      anchor: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select id, artifact_id, body, status, anchor, created_at, updated_at
       from artifact_comments
       where artifact_id = $1
       order by created_at desc`,
      [artifactId]
    );

    return result.rows.map(mapCommentRecord);
  }

  async create(input: {
    artifactId: string;
    body: string;
    anchor: CommentAnchor;
    status?: ArtifactCommentStatus;
  }): Promise<ArtifactComment> {
    const commentId = crypto.randomUUID();
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      body: string;
      status: ArtifactCommentStatus;
      anchor: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `insert into artifact_comments (id, artifact_id, body, status, anchor)
       values ($1, $2, $3, $4, $5::jsonb)
       returning id, artifact_id, body, status, anchor, created_at, updated_at`,
      [
        commentId,
        input.artifactId,
        input.body,
        input.status ?? "open",
        JSON.stringify(input.anchor)
      ]
    );

    return mapCommentRecord(result.rows[0]!);
  }

  async resolve(artifactId: string, commentId: string): Promise<ArtifactComment | null> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      body: string;
      status: ArtifactCommentStatus;
      anchor: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `update artifact_comments
       set status = 'resolved',
           updated_at = now()
       where artifact_id = $1 and id = $2
       returning id, artifact_id, body, status, anchor, created_at, updated_at`,
      [artifactId, commentId]
    );

    const comment = result.rows[0];
    return comment ? mapCommentRecord(comment) : null;
  }
}
