import { ArtifactKindSchema } from "@opendesign/contracts";
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import {
  createS3AssetStorage,
  InMemoryAssetStorage,
  type AssetStorage
} from "./asset-storage";
import { createAuth, type OpenDesignAuth } from "./auth/session";
import {
  InMemoryArtifactCommentRepository,
  PostgresArtifactCommentRepository,
  type ArtifactCommentRepository
} from "./repositories/artifact-comments";
import {
  InMemoryArtifactVersionRepository,
  PostgresArtifactVersionRepository,
  type ArtifactVersionRepository
} from "./repositories/artifact-versions";
import {
  InMemoryDesignSystemRepository,
  PostgresDesignSystemRepository,
  type DesignSystemRepository
} from "./repositories/design-systems";
import {
  InMemoryArtifactWorkspaceRepository,
  PostgresArtifactWorkspaceRepository,
  type ArtifactWorkspaceRepository
} from "./repositories/artifact-workspaces";
import {
  InMemoryArtifactRepository,
  PostgresArtifactRepository,
  type ArtifactRepository
} from "./repositories/artifacts";
import {
  InMemoryProjectRepository,
  PostgresProjectRepository,
  type ProjectRepository
} from "./repositories/projects";
import {
  InMemoryShareTokenRepository,
  PostgresShareTokenRepository,
  type ShareTokenRepository
} from "./repositories/share-tokens";
import {
  InMemoryAssetRepository,
  PostgresAssetRepository,
  type AssetRepository
} from "./repositories/assets";
import {
  InMemoryExportJobRepository,
  PostgresExportJobRepository,
  type ExportJobRepository
} from "./repositories/export-jobs";

const { Pool } = pg;

function readAuthTrustedOrigins(auth: OpenDesignAuth) {
  const options = auth.options as {
    trustedOrigins?: string[];
  };

  return options.trustedOrigins ?? [];
}

export type PersistenceMode = "memory" | "postgres";

export interface AppPersistence {
  mode: PersistenceMode;
  auth: OpenDesignAuth;
  authBaseURL: string;
  authTrustedOrigins: string[];
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  workspaces: ArtifactWorkspaceRepository;
  versions: ArtifactVersionRepository;
  comments: ArtifactCommentRepository;
  designSystems: DesignSystemRepository;
  shares: ShareTokenRepository;
  assets: AssetRepository;
  exportJobs: ExportJobRepository;
  assetStorage: AssetStorage;
  close(): Promise<void>;
}

function buildArtifactKindConstraint() {
  return ArtifactKindSchema.options.map((kind) => `'${kind}'`).join(", ");
}

function buildArtifactVersionSourceConstraint() {
  return ["seed", "prompt", "comment", "manual"].map((kind) => `'${kind}'`).join(", ");
}

function buildArtifactCommentStatusConstraint() {
  return ["open", "resolved"].map((status) => `'${status}'`).join(", ");
}

function buildShareResourceTypeConstraint() {
  return ["project", "artifact"].map((kind) => `'${kind}'`).join(", ");
}

function buildShareRoleConstraint() {
  return ["viewer", "commenter", "editor"].map((role) => `'${role}'`).join(", ");
}

function buildAssetKindConstraint() {
  return ["design-system-screenshot", "artifact-upload"]
    .map((kind) => `'${kind}'`)
    .join(", ");
}

function buildAssetStorageProviderConstraint() {
  return ["memory", "s3"].map((provider) => `'${provider}'`).join(", ");
}

function buildExportJobStatusConstraint() {
  return ["queued", "running", "completed", "failed"]
    .map((status) => `'${status}'`)
    .join(", ");
}

function buildExportKindConstraint() {
  return ["html", "source-bundle", "handoff-bundle", "prototype-flow", "slides-deck"]
    .map((kind) => `'${kind}'`)
    .join(", ");
}

async function ensureApplicationTables(pool: InstanceType<typeof Pool>) {
  const validArtifactKinds = buildArtifactKindConstraint();
  const validVersionSources = buildArtifactVersionSourceConstraint();
  const validCommentStatuses = buildArtifactCommentStatusConstraint();
  const validShareResourceTypes = buildShareResourceTypeConstraint();
  const validShareRoles = buildShareRoleConstraint();
  const validAssetKinds = buildAssetKindConstraint();
  const validAssetStorageProviders = buildAssetStorageProviderConstraint();
  const validExportJobStatuses = buildExportJobStatusConstraint();
  const validExportKinds = buildExportKindConstraint();

  await pool.query(
    `create table if not exists projects (
      id text primary key,
      name text not null,
      owner_user_id text references "user"(id) on delete cascade,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `alter table projects
     add column if not exists owner_user_id text`
  );

  await pool.query(
    `do $$
     begin
       alter table projects
       add constraint projects_owner_user_id_fkey
       foreign key (owner_user_id) references "user"(id) on delete cascade;
     exception
       when duplicate_object then null;
     end $$;`
  );

  await pool.query(
    `create table if not exists artifacts (
      id text primary key,
      project_id text not null references projects(id) on delete cascade,
      name text not null,
      kind text not null check (kind in (${validArtifactKinds})),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `create index if not exists artifacts_project_id_idx on artifacts(project_id)`
  );

  await pool.query(
    `create table if not exists artifact_versions (
      id text primary key,
      artifact_id text not null references artifacts(id) on delete cascade,
      label text not null,
      summary text not null,
      source text not null check (source in (${validVersionSources})),
      scene_version integer not null check (scene_version > 0),
      scene_document jsonb,
      code_workspace_files jsonb,
      code_workspace_updated_at timestamptz,
      created_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `alter table artifact_versions
     add column if not exists scene_document jsonb`
  );

  await pool.query(
    `alter table artifact_versions
     add column if not exists code_workspace_files jsonb`
  );

  await pool.query(
    `alter table artifact_versions
     add column if not exists code_workspace_updated_at timestamptz`
  );

  await pool.query(
    `create index if not exists artifact_versions_artifact_id_idx
     on artifact_versions(artifact_id, created_at desc)`
  );

  await pool.query(
    `create table if not exists artifact_workspaces (
      artifact_id text primary key references artifacts(id) on delete cascade,
      intent text not null,
      active_version_id text references artifact_versions(id) on delete set null,
      scene_document jsonb not null,
      code_workspace_files jsonb,
      code_workspace_updated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `alter table artifact_workspaces
     add column if not exists code_workspace_files jsonb`
  );

  await pool.query(
    `alter table artifact_workspaces
     add column if not exists code_workspace_updated_at timestamptz`
  );

  await pool.query(
    `create table if not exists artifact_comments (
      id text primary key,
      artifact_id text not null references artifacts(id) on delete cascade,
      body text not null,
      status text not null check (status in (${validCommentStatuses})),
      anchor jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `create index if not exists artifact_comments_artifact_id_idx
     on artifact_comments(artifact_id, created_at desc)`
  );

  await pool.query(
    `create table if not exists design_system_packs (
      id text primary key,
      owner_user_id text references "user"(id) on delete cascade,
      pack jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `create index if not exists design_system_packs_owner_user_id_idx
     on design_system_packs(owner_user_id, updated_at desc, created_at desc)`
  );

  await pool.query(
    `create table if not exists share_tokens (
      id text primary key,
      token text not null unique,
      resource_type text not null check (resource_type in (${validShareResourceTypes})),
      role text not null default 'viewer' check (role in (${validShareRoles})),
      resource_id text not null,
      project_id text not null references projects(id) on delete cascade,
      created_by_user_id text references "user"(id) on delete set null,
      expires_at timestamptz,
      created_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `create index if not exists share_tokens_project_id_idx
     on share_tokens(project_id, created_at desc)`
  );

  await pool.query(
    `alter table share_tokens
     add column if not exists role text not null default 'viewer'`
  );

  await pool.query(
    `create table if not exists assets (
      id text primary key,
      owner_user_id text references "user"(id) on delete set null,
      artifact_id text references artifacts(id) on delete cascade,
      kind text not null check (kind in (${validAssetKinds})),
      filename text,
      storage_provider text not null check (storage_provider in (${validAssetStorageProviders})),
      object_key text not null,
      content_type text not null,
      size_bytes integer not null check (size_bytes >= 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`
  );

  await pool.query(
    `create index if not exists assets_owner_user_id_idx
     on assets(owner_user_id, created_at desc)`
  );

  await pool.query(
    `alter table assets
     add column if not exists artifact_id text references artifacts(id) on delete cascade`
  );

  await pool.query(
    `alter table assets
     add column if not exists filename text`
  );

  await pool.query(
    `create index if not exists assets_artifact_id_idx
     on assets(artifact_id, created_at desc)`
  );

  await pool.query(
    `create table if not exists export_jobs (
      id text primary key,
      artifact_id text not null references artifacts(id) on delete cascade,
      export_kind text not null check (export_kind in (${validExportKinds})),
      status text not null check (status in (${validExportJobStatuses})),
      request_id text,
      result jsonb,
      error jsonb,
      requested_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz
    )`
  );

  await pool.query(
    `create index if not exists export_jobs_artifact_id_idx
     on export_jobs(artifact_id, requested_at desc)`
  );
}

async function ensurePostgresPersistence(pool: InstanceType<typeof Pool>, auth: OpenDesignAuth) {
  await pool.query("select 1");

  const { runMigrations } = await getMigrations(
    auth.options as Parameters<typeof getMigrations>[0]
  );
  await runMigrations();
  await ensureApplicationTables(pool);
}

export async function createAppPersistence(input: {
  env?: NodeJS.ProcessEnv;
  assetStorage?: AssetStorage;
} = {}): Promise<AppPersistence> {
  const env = input.env ?? process.env;
  const assetStorage = input.assetStorage ?? createS3AssetStorage(env) ?? new InMemoryAssetStorage();

  if (!env.DATABASE_URL) {
    const { auth, baseURL } = createAuth({ env });

    return {
      mode: "memory",
      auth,
      authBaseURL: baseURL,
      authTrustedOrigins: readAuthTrustedOrigins(auth),
      projects: new InMemoryProjectRepository(),
      artifacts: new InMemoryArtifactRepository(),
      workspaces: new InMemoryArtifactWorkspaceRepository(),
      versions: new InMemoryArtifactVersionRepository(),
      comments: new InMemoryArtifactCommentRepository(),
      designSystems: new InMemoryDesignSystemRepository(),
      shares: new InMemoryShareTokenRepository(),
      assets: new InMemoryAssetRepository(),
      exportJobs: new InMemoryExportJobRepository(),
      assetStorage,
      close: async () => {}
    };
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL
  });

  const { auth, baseURL } = createAuth({
    env,
    database: pool
  });

  await ensurePostgresPersistence(pool, auth);

  return {
    mode: "postgres",
    auth,
    authBaseURL: baseURL,
    authTrustedOrigins: readAuthTrustedOrigins(auth),
    projects: new PostgresProjectRepository(pool),
    artifacts: new PostgresArtifactRepository(pool),
    workspaces: new PostgresArtifactWorkspaceRepository(pool),
    versions: new PostgresArtifactVersionRepository(pool),
    comments: new PostgresArtifactCommentRepository(pool),
    designSystems: new PostgresDesignSystemRepository(pool),
    shares: new PostgresShareTokenRepository(pool),
    assets: new PostgresAssetRepository(pool),
    exportJobs: new PostgresExportJobRepository(pool),
    assetStorage,
    close: async () => {
      await pool.end();
    }
  };
}
