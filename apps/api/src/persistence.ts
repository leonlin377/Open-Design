import { ArtifactKindSchema } from "@opendesign/contracts";
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import { createAuth, type OpenDesignAuth } from "./auth/session";
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

const { Pool } = pg;

export type PersistenceMode = "memory" | "postgres";

export interface AppPersistence {
  mode: PersistenceMode;
  auth: OpenDesignAuth;
  authBaseURL: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  close(): Promise<void>;
}

function buildArtifactKindConstraint() {
  return ArtifactKindSchema.options.map((kind) => `'${kind}'`).join(", ");
}

async function ensureApplicationTables(pool: InstanceType<typeof Pool>) {
  const validArtifactKinds = buildArtifactKindConstraint();

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
}

async function ensurePostgresPersistence(pool: InstanceType<typeof Pool>, auth: OpenDesignAuth) {
  await pool.query("select 1");

  const { runMigrations } = await getMigrations(
    auth.options as Parameters<typeof getMigrations>[0]
  );
  await runMigrations();
  await ensureApplicationTables(pool);
}

export async function createAppPersistence(
  env: NodeJS.ProcessEnv = process.env
): Promise<AppPersistence> {
  if (!env.DATABASE_URL) {
    const { auth, baseURL } = createAuth({ env });

    return {
      mode: "memory",
      auth,
      authBaseURL: baseURL,
      projects: new InMemoryProjectRepository(),
      artifacts: new InMemoryArtifactRepository(),
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
    projects: new PostgresProjectRepository(pool),
    artifacts: new PostgresArtifactRepository(pool),
    close: async () => {
      await pool.end();
    }
  };
}
