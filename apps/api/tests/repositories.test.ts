import { describe, expect, it, vi } from "vitest";
import {
  PostgresArtifactRepository,
  type Artifact
} from "../src/repositories/artifacts";
import {
  PostgresProjectRepository,
  type Project
} from "../src/repositories/projects";

function createQueryMock<Row extends Record<string, unknown>>(rows: Row[]) {
  return vi.fn().mockResolvedValue({ rows });
}

describe("PostgresProjectRepository", () => {
  it("maps and returns a created project", async () => {
    const query = createQueryMock([
      {
        id: "project-1",
        name: "Studio",
        owner_user_id: "user-1",
        created_at: new Date("2026-04-18T08:00:00.000Z"),
        updated_at: new Date("2026-04-18T08:05:00.000Z")
      }
    ]);

    const repository = new PostgresProjectRepository({ query });
    const project = await repository.create({ name: "Studio" });

    expect(project).toEqual<Project>({
      id: "project-1",
      name: "Studio",
      ownerUserId: "user-1",
      createdAt: "2026-04-18T08:00:00.000Z",
      updatedAt: "2026-04-18T08:05:00.000Z"
    });
    expect(query).toHaveBeenCalledOnce();
  });

  it("returns null when a project is missing", async () => {
    const repository = new PostgresProjectRepository({
      query: createQueryMock([])
    });

    await expect(repository.getById("missing")).resolves.toBeNull();
  });

  it("filters list queries by owner when provided", async () => {
    const query = createQueryMock([
      {
        id: "project-1",
        name: "Studio",
        owner_user_id: "user-1",
        created_at: new Date("2026-04-18T08:00:00.000Z"),
        updated_at: new Date("2026-04-18T08:05:00.000Z")
      }
    ]);

    const repository = new PostgresProjectRepository({ query });
    const projects = await repository.list({ ownerUserId: "user-1" });

    expect(projects).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("where owner_user_id = $1"), [
      "user-1"
    ]);
  });
});

describe("PostgresArtifactRepository", () => {
  it("maps artifact rows for a project", async () => {
    const query = createQueryMock([
      {
        id: "artifact-1",
        project_id: "project-1",
        name: "Homepage",
        kind: "website",
        created_at: new Date("2026-04-18T08:10:00.000Z"),
        updated_at: new Date("2026-04-18T08:20:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactRepository({ query });
    const artifacts = await repository.listByProject("project-1");

    expect(artifacts).toEqual<Artifact[]>([
      {
        id: "artifact-1",
        projectId: "project-1",
        name: "Homepage",
        kind: "website",
        createdAt: "2026-04-18T08:10:00.000Z",
        updatedAt: "2026-04-18T08:20:00.000Z"
      }
    ]);
  });
});
