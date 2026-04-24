import {
  ArtifactThemeSchema,
  DEFAULT_ARTIFACT_THEME,
  type ArtifactTheme
} from "@opendesign/contracts/src/artifact-theme";

export interface ArtifactThemeRecord {
  artifactId: string;
  theme: ArtifactTheme;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactThemeRepository {
  /**
   * Returns the persisted theme for the artifact, or `null` when none has
   * been saved yet. Callers apply {@link DEFAULT_ARTIFACT_THEME} in that case.
   */
  getByArtifactId(artifactId: string): Promise<ArtifactThemeRecord | null>;
  upsert(input: {
    artifactId: string;
    theme: ArtifactTheme;
  }): Promise<ArtifactThemeRecord>;
}

export class InMemoryArtifactThemeRepository implements ArtifactThemeRepository {
  private readonly themes = new Map<string, ArtifactThemeRecord>();

  async getByArtifactId(artifactId: string): Promise<ArtifactThemeRecord | null> {
    return this.themes.get(artifactId) ?? null;
  }

  async upsert(input: {
    artifactId: string;
    theme: ArtifactTheme;
  }): Promise<ArtifactThemeRecord> {
    // Re-parse defensively so a malformed payload bubbles up as a ZodError at
    // the repository boundary — the route layer converts that to a 400.
    const theme = ArtifactThemeSchema.parse(input.theme);
    const timestamp = new Date().toISOString();
    const existing = this.themes.get(input.artifactId);
    const record: ArtifactThemeRecord = {
      artifactId: input.artifactId,
      theme,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    this.themes.set(input.artifactId, record);
    return record;
  }
}

/*
 * Postgres sketch — kept as comments because the in-memory implementation is
 * the shipping default until a migration wires the table up. The migration
 * lives outside this file; when it lands, switch `AppPersistence` to use a
 * `PostgresArtifactThemeRepository` class with the same `ArtifactThemeRepository`
 * contract.
 *
 * -- migration:
 * -- create table artifact_themes (
 * --   artifact_id text primary key references artifacts(id) on delete cascade,
 * --   theme       jsonb        not null,
 * --   created_at  timestamptz  not null default now(),
 * --   updated_at  timestamptz  not null default now()
 * -- );
 *
 * -- getByArtifactId:
 * --   select artifact_id, theme, created_at, updated_at
 * --   from artifact_themes where artifact_id = $1 limit 1;
 *
 * -- upsert:
 * --   insert into artifact_themes (artifact_id, theme, created_at, updated_at)
 * --   values ($1, $2::jsonb, now(), now())
 * --   on conflict (artifact_id) do update
 * --     set theme = excluded.theme,
 * --         updated_at = now()
 * --   returning artifact_id, theme, created_at, updated_at;
 */
