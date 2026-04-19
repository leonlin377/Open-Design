import {
  ApiErrorSchema,
  ExportJobSchema,
  type ApiError,
  type ExportJob,
  type ExportJobResult,
  type ExportJobStatus,
  type ExportKind
} from "@opendesign/contracts";

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface ExportJobRepository {
  listByArtifactId(artifactId: string): Promise<ExportJob[]>;
  create(input: {
    artifactId: string;
    exportKind: ExportKind;
    requestId?: string | null;
  }): Promise<ExportJob>;
  markRunning(jobId: string): Promise<ExportJob | null>;
  markCompleted(
    jobId: string,
    result: ExportJobResult
  ): Promise<ExportJob | null>;
  markFailed(jobId: string, error: ApiError): Promise<ExportJob | null>;
}

function toIsoTimestamp(value: string | Date | null) {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function mapExportJobRecord(record: {
  id: string;
  artifact_id: string;
  export_kind: ExportKind;
  status: ExportJobStatus;
  requested_at: string | Date;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  request_id: string | null;
  result: unknown | null;
  error: unknown | null;
}): ExportJob {
  return ExportJobSchema.parse({
    id: record.id,
    artifactId: record.artifact_id,
    exportKind: record.export_kind,
    status: record.status,
    requestedAt: toIsoTimestamp(record.requested_at),
    startedAt: toIsoTimestamp(record.started_at),
    completedAt: toIsoTimestamp(record.completed_at),
    requestId: record.request_id,
    result: record.result,
    error: record.error ? ApiErrorSchema.parse(record.error) : null
  });
}

export class InMemoryExportJobRepository implements ExportJobRepository {
  private readonly jobs: ExportJob[] = [];

  async listByArtifactId(artifactId: string): Promise<ExportJob[]> {
    return this.jobs.filter((job) => job.artifactId === artifactId);
  }

  async create(input: {
    artifactId: string;
    exportKind: ExportKind;
    requestId?: string | null;
  }): Promise<ExportJob> {
    const job = ExportJobSchema.parse({
      id: crypto.randomUUID(),
      artifactId: input.artifactId,
      exportKind: input.exportKind,
      status: "queued",
      requestedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      requestId: input.requestId ?? null,
      result: null,
      error: null
    });

    this.jobs.unshift(job);
    return job;
  }

  async markRunning(jobId: string): Promise<ExportJob | null> {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return null;
    }

    const updated = ExportJobSchema.parse({
      ...this.jobs[index],
      status: "running",
      startedAt: new Date().toISOString()
    });
    this.jobs[index] = updated;
    return updated;
  }

  async markCompleted(
    jobId: string,
    result: ExportJobResult
  ): Promise<ExportJob | null> {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return null;
    }

    const updated = ExportJobSchema.parse({
      ...this.jobs[index],
      status: "completed",
      completedAt: new Date().toISOString(),
      result,
      error: null
    });
    this.jobs[index] = updated;
    return updated;
  }

  async markFailed(jobId: string, error: ApiError): Promise<ExportJob | null> {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return null;
    }

    const updated = ExportJobSchema.parse({
      ...this.jobs[index],
      status: "failed",
      completedAt: new Date().toISOString(),
      error,
      result: null
    });
    this.jobs[index] = updated;
    return updated;
  }
}

export class PostgresExportJobRepository implements ExportJobRepository {
  constructor(private readonly database: Queryable) {}

  async listByArtifactId(artifactId: string): Promise<ExportJob[]> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      export_kind: ExportKind;
      status: ExportJobStatus;
      requested_at: string | Date;
      started_at: string | Date | null;
      completed_at: string | Date | null;
      request_id: string | null;
      result: unknown | null;
      error: unknown | null;
    }>(
      `select id, artifact_id, export_kind, status, requested_at, started_at,
              completed_at, request_id, result, error
       from export_jobs
       where artifact_id = $1
       order by requested_at desc`,
      [artifactId]
    );

    return result.rows.map(mapExportJobRecord);
  }

  async create(input: {
    artifactId: string;
    exportKind: ExportKind;
    requestId?: string | null;
  }): Promise<ExportJob> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      export_kind: ExportKind;
      status: ExportJobStatus;
      requested_at: string | Date;
      started_at: string | Date | null;
      completed_at: string | Date | null;
      request_id: string | null;
      result: unknown | null;
      error: unknown | null;
    }>(
      `insert into export_jobs (
          id,
          artifact_id,
          export_kind,
          status,
          request_id
        )
       values ($1, $2, $3, 'queued', $4)
       returning id, artifact_id, export_kind, status, requested_at, started_at,
                 completed_at, request_id, result, error`,
      [crypto.randomUUID(), input.artifactId, input.exportKind, input.requestId ?? null]
    );

    return mapExportJobRecord(result.rows[0]!);
  }

  async markRunning(jobId: string): Promise<ExportJob | null> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      export_kind: ExportKind;
      status: ExportJobStatus;
      requested_at: string | Date;
      started_at: string | Date | null;
      completed_at: string | Date | null;
      request_id: string | null;
      result: unknown | null;
      error: unknown | null;
    }>(
      `update export_jobs
       set status = 'running',
           started_at = coalesce(started_at, now())
       where id = $1
       returning id, artifact_id, export_kind, status, requested_at, started_at,
                 completed_at, request_id, result, error`,
      [jobId]
    );

    const record = result.rows[0];
    return record ? mapExportJobRecord(record) : null;
  }

  async markCompleted(
    jobId: string,
    resultPayload: ExportJobResult
  ): Promise<ExportJob | null> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      export_kind: ExportKind;
      status: ExportJobStatus;
      requested_at: string | Date;
      started_at: string | Date | null;
      completed_at: string | Date | null;
      request_id: string | null;
      result: unknown | null;
      error: unknown | null;
    }>(
      `update export_jobs
       set status = 'completed',
           completed_at = now(),
           result = $2::jsonb,
           error = null
       where id = $1
       returning id, artifact_id, export_kind, status, requested_at, started_at,
                 completed_at, request_id, result, error`,
      [jobId, JSON.stringify(resultPayload)]
    );

    const record = result.rows[0];
    return record ? mapExportJobRecord(record) : null;
  }

  async markFailed(jobId: string, error: ApiError): Promise<ExportJob | null> {
    const result = await this.database.query<{
      id: string;
      artifact_id: string;
      export_kind: ExportKind;
      status: ExportJobStatus;
      requested_at: string | Date;
      started_at: string | Date | null;
      completed_at: string | Date | null;
      request_id: string | null;
      result: unknown | null;
      error: unknown | null;
    }>(
      `update export_jobs
       set status = 'failed',
           completed_at = now(),
           result = null,
           error = $2::jsonb
       where id = $1
       returning id, artifact_id, export_kind, status, requested_at, started_at,
                 completed_at, request_id, result, error`,
      [jobId, JSON.stringify(error)]
    );

    const record = result.rows[0];
    return record ? mapExportJobRecord(record) : null;
  }
}

