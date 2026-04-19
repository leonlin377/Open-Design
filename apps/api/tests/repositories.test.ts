import { describe, expect, it, vi } from "vitest";
import type { ArtifactComment, ArtifactVersionSnapshot } from "@opendesign/contracts";
import {
  PostgresArtifactCommentRepository
} from "../src/repositories/artifact-comments";
import {
  PostgresArtifactVersionRepository
} from "../src/repositories/artifact-versions";
import {
  PostgresArtifactWorkspaceRepository,
  type ArtifactWorkspaceRecord
} from "../src/repositories/artifact-workspaces";
import {
  PostgresArtifactRepository,
  type Artifact
} from "../src/repositories/artifacts";
import {
  PostgresDesignSystemRepository,
  type DesignSystemPackRecord
} from "../src/repositories/design-systems";
import {
  PostgresProjectRepository,
  type Project
} from "../src/repositories/projects";
import {
  PostgresShareTokenRepository,
  type ShareTokenRecord
} from "../src/repositories/share-tokens";

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

describe("PostgresArtifactWorkspaceRepository", () => {
  it("maps workspace rows with parsed scene documents", async () => {
    const query = createQueryMock([
      {
        artifact_id: "artifact-1",
        intent: "Build a cinematic hero.",
        active_version_id: "version-1",
        scene_document: {
          id: "scene-1",
          artifactId: "artifact-1",
          kind: "website",
          version: 1,
          nodes: [],
          metadata: {}
        },
        code_workspace_files: null,
        code_workspace_updated_at: null,
        created_at: new Date("2026-04-18T08:30:00.000Z"),
        updated_at: new Date("2026-04-18T08:35:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactWorkspaceRepository({ query });
    const workspace = await repository.getByArtifactId("artifact-1");

    expect(workspace).toEqual<ArtifactWorkspaceRecord>({
      artifactId: "artifact-1",
      intent: "Build a cinematic hero.",
      activeVersionId: "version-1",
      sceneDocument: {
        id: "scene-1",
        artifactId: "artifact-1",
        kind: "website",
        version: 1,
        nodes: [],
        metadata: {}
      },
      codeWorkspace: null,
      createdAt: "2026-04-18T08:30:00.000Z",
      updatedAt: "2026-04-18T08:35:00.000Z"
    });
  });

  it("updates scene documents and returns the persisted workspace", async () => {
    const query = createQueryMock([
      {
        artifact_id: "artifact-1",
        intent: "Build a cinematic hero.",
        active_version_id: "version-1",
        scene_document: {
          id: "scene-1",
          artifactId: "artifact-1",
          kind: "website",
          version: 2,
          nodes: [
            {
              id: "hero-1",
              type: "section",
              name: "Hero Section",
              props: {
                template: "hero"
              },
              children: []
            }
          ],
          metadata: {}
        },
        code_workspace_files: null,
        code_workspace_updated_at: null,
        created_at: new Date("2026-04-18T08:30:00.000Z"),
        updated_at: new Date("2026-04-18T08:36:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactWorkspaceRepository({ query });
    const workspace = await repository.updateSceneDocument("artifact-1", {
      id: "scene-1",
      artifactId: "artifact-1",
      kind: "website",
      version: 2,
      nodes: [
        {
          id: "hero-1",
          type: "section",
          name: "Hero Section",
          props: {
            template: "hero"
          },
          children: []
        }
      ],
      metadata: {}
    });

    expect(workspace?.sceneDocument.version).toBe(2);
    expect(workspace?.sceneDocument.nodes).toHaveLength(1);
  });

  it("updates workspace intent and returns the persisted workspace", async () => {
    const query = createQueryMock([
      {
        artifact_id: "artifact-1",
        intent: "Generate a launch surface for Atlas Commerce.",
        active_version_id: "version-1",
        scene_document: {
          id: "scene-1",
          artifactId: "artifact-1",
          kind: "website",
          version: 2,
          nodes: [],
          metadata: {}
        },
        code_workspace_files: null,
        code_workspace_updated_at: null,
        created_at: new Date("2026-04-18T08:30:00.000Z"),
        updated_at: new Date("2026-04-18T08:36:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactWorkspaceRepository({ query });
    const workspace = await repository.updateIntent(
      "artifact-1",
      "Generate a launch surface for Atlas Commerce."
    );

    expect(workspace?.intent).toBe("Generate a launch surface for Atlas Commerce.");
  });

  it("updates code workspace files and returns the persisted workspace", async () => {
    const query = createQueryMock([
      {
        artifact_id: "artifact-1",
        intent: "Build a cinematic hero.",
        active_version_id: "version-1",
        scene_document: {
          id: "scene-1",
          artifactId: "artifact-1",
          kind: "website",
          version: 2,
          nodes: [],
          metadata: {}
        },
        code_workspace_files: {
          files: {
            "/App.tsx": "export default function App() { return <div>Saved</div>; }",
            "/main.tsx": 'import App from "./App";',
            "/styles.css": "body { color: white; }",
            "/index.html": '<div id="root"></div>',
            "/package.json": '{"name":"saved-workspace"}'
          },
          baseSceneVersion: 2
        },
        code_workspace_updated_at: new Date("2026-04-18T08:37:00.000Z"),
        created_at: new Date("2026-04-18T08:30:00.000Z"),
        updated_at: new Date("2026-04-18T08:37:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactWorkspaceRepository({ query });
    const workspace = await repository.updateCodeWorkspace("artifact-1", {
      files: {
        "/App.tsx": "export default function App() { return <div>Saved</div>; }",
        "/main.tsx": 'import App from "./App";',
        "/styles.css": "body { color: white; }",
        "/index.html": '<div id="root"></div>',
        "/package.json": '{"name":"saved-workspace"}'
      },
      baseSceneVersion: 2
    });

    expect(workspace?.codeWorkspace).toEqual({
      files: {
        "/App.tsx": "export default function App() { return <div>Saved</div>; }",
        "/main.tsx": 'import App from "./App";',
        "/styles.css": "body { color: white; }",
        "/index.html": '<div id="root"></div>',
        "/package.json": '{"name":"saved-workspace"}'
      },
      baseSceneVersion: 2,
      updatedAt: "2026-04-18T08:37:00.000Z"
    });
  });
});

describe("PostgresArtifactVersionRepository", () => {
  it("maps version rows for an artifact", async () => {
    const query = createQueryMock([
      {
        id: "version-1",
        artifact_id: "artifact-1",
        label: "V1 Seed",
        summary: "Initial seeded snapshot",
        source: "seed",
        scene_version: 1,
        code_workspace_files: {
          files: {
            "/App.tsx": "export default function App() { return null; }"
          },
          baseSceneVersion: 1
        },
        created_at: new Date("2026-04-18T08:40:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactVersionRepository({ query });
    const versions = await repository.listByArtifactId("artifact-1");

    expect(versions).toEqual<ArtifactVersionSnapshot[]>([
      {
        id: "version-1",
        artifactId: "artifact-1",
        label: "V1 Seed",
        summary: "Initial seeded snapshot",
        source: "seed",
        sceneVersion: 1,
        hasCodeWorkspaceSnapshot: true,
        createdAt: "2026-04-18T08:40:00.000Z"
      }
    ]);
  });

  it("loads a version state for restore flows", async () => {
    const query = createQueryMock([
      {
        id: "version-1",
        artifact_id: "artifact-1",
        label: "V1 Seed",
        summary: "Initial seeded snapshot",
        source: "seed",
        scene_version: 1,
        scene_document: {
          id: "scene-1",
          artifactId: "artifact-1",
          kind: "website",
          version: 1,
          nodes: [],
          metadata: {}
        },
        code_workspace_files: {
          files: {
            "/App.tsx": "export default function App() { return null; }"
          },
          baseSceneVersion: 1
        },
        code_workspace_updated_at: new Date("2026-04-18T08:39:00.000Z"),
        created_at: new Date("2026-04-18T08:40:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactVersionRepository({ query });
    const versionState = await repository.getStateById("artifact-1", "version-1");

    expect(versionState).toMatchObject({
      snapshot: {
        id: "version-1",
        artifactId: "artifact-1",
        sceneVersion: 1,
        hasCodeWorkspaceSnapshot: true
      },
      sceneDocument: {
        id: "scene-1",
        artifactId: "artifact-1",
        version: 1
      },
      codeWorkspace: {
        files: {
          "/App.tsx": "export default function App() { return null; }"
        },
        baseSceneVersion: 1,
        updatedAt: "2026-04-18T08:39:00.000Z"
      }
    });
  });
});

describe("PostgresArtifactCommentRepository", () => {
  it("maps anchored comment rows", async () => {
    const query = createQueryMock([
      {
        id: "comment-1",
        artifact_id: "artifact-1",
        body: "Increase contrast on the label.",
        status: "open",
        anchor: {
          elementId: "hero",
          selectionPath: ["root", "hero"]
        },
        created_at: new Date("2026-04-18T08:50:00.000Z"),
        updated_at: new Date("2026-04-18T08:51:00.000Z")
      }
    ]);

    const repository = new PostgresArtifactCommentRepository({ query });
    const comments = await repository.listByArtifactId("artifact-1");

    expect(comments).toEqual<ArtifactComment[]>([
      {
        id: "comment-1",
        artifactId: "artifact-1",
        body: "Increase contrast on the label.",
        status: "open",
        anchor: {
          elementId: "hero",
          selectionPath: ["root", "hero"]
        },
        createdAt: "2026-04-18T08:50:00.000Z",
        updatedAt: "2026-04-18T08:51:00.000Z"
      }
    ]);
  });
});

describe("PostgresDesignSystemRepository", () => {
  it("maps and returns a persisted design system pack", async () => {
    const query = createQueryMock([
      {
        id: "pack-1",
        owner_user_id: "user-1",
        pack: {
          id: "pack-1",
          name: "acme/design-system",
          source: "github",
          tokens: {
            colors: {
              primary: "#0f172a"
            },
            typography: {}
          },
          components: [],
          motifs: [],
          provenance: []
        },
        created_at: new Date("2026-04-19T09:00:00.000Z"),
        updated_at: new Date("2026-04-19T09:05:00.000Z")
      }
    ]);

    const repository = new PostgresDesignSystemRepository({ query });
    const pack = await repository.create({
      ownerUserId: "user-1",
      pack: {
        id: "pack-1",
        name: "acme/design-system",
        source: "github",
        tokens: {
          colors: {
            primary: "#0f172a"
          },
          typography: {}
        },
        components: [],
        motifs: [],
        provenance: []
      }
    });

    expect(pack).toEqual<DesignSystemPackRecord>({
      id: "pack-1",
      name: "acme/design-system",
      source: "github",
      tokens: {
        colors: {
          primary: "#0f172a"
        },
        typography: {}
      },
      components: [],
      motifs: [],
      provenance: [],
      ownerUserId: "user-1",
      createdAt: "2026-04-19T09:00:00.000Z",
      updatedAt: "2026-04-19T09:05:00.000Z"
    });
  });

  it("returns a persisted design system pack by id", async () => {
    const query = createQueryMock([
      {
        id: "pack-1",
        owner_user_id: "user-1",
        pack: {
          id: "pack-1",
          name: "acme/design-system",
          source: "github",
          tokens: {
            colors: {
              primary: "#0f172a"
            },
            typography: {}
          },
          components: [],
          motifs: [],
          provenance: []
        },
        created_at: new Date("2026-04-19T09:00:00.000Z"),
        updated_at: new Date("2026-04-19T09:05:00.000Z")
      }
    ]);

    const repository = new PostgresDesignSystemRepository({ query });
    const pack = await repository.getById("pack-1", {
      ownerUserId: "user-1"
    });

    expect(pack).toEqual<DesignSystemPackRecord>({
      id: "pack-1",
      name: "acme/design-system",
      source: "github",
      tokens: {
        colors: {
          primary: "#0f172a"
        },
        typography: {}
      },
      components: [],
      motifs: [],
      provenance: [],
      ownerUserId: "user-1",
      createdAt: "2026-04-19T09:00:00.000Z",
      updatedAt: "2026-04-19T09:05:00.000Z"
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("where id = $1 and owner_user_id = $2"), [
      "pack-1",
      "user-1"
    ]);
  });
});

describe("PostgresShareTokenRepository", () => {
  it("maps and returns a created share token", async () => {
    const query = createQueryMock([
      {
        id: "share-1",
        token: "opaque123",
        resource_type: "artifact",
        role: "editor",
        resource_id: "artifact-1",
        project_id: "project-1",
        created_by_user_id: "user-1",
        created_at: new Date("2026-04-19T10:00:00.000Z"),
        expires_at: null
      }
    ]);

    const repository = new PostgresShareTokenRepository({ query });
    const share = await repository.create({
      resourceType: "artifact",
      role: "editor",
      resourceId: "artifact-1",
      projectId: "project-1",
      createdByUserId: "user-1"
    });

    expect(share).toEqual<ShareTokenRecord>({
      id: "share-1",
      token: "opaque123",
      resourceType: "artifact",
      role: "editor",
      resourceId: "artifact-1",
      projectId: "project-1",
      createdByUserId: "user-1",
      createdAt: "2026-04-19T10:00:00.000Z",
      expiresAt: null
    });
  });

  it("returns a resolved share token by opaque token", async () => {
    const query = createQueryMock([
      {
        id: "share-1",
        token: "opaque123",
        resource_type: "project",
        role: "viewer",
        resource_id: "project-1",
        project_id: "project-1",
        created_by_user_id: null,
        created_at: new Date("2026-04-19T10:00:00.000Z"),
        expires_at: null
      }
    ]);

    const repository = new PostgresShareTokenRepository({ query });
    const share = await repository.getByToken("opaque123");

    expect(share).toEqual<ShareTokenRecord>({
      id: "share-1",
      token: "opaque123",
      resourceType: "project",
      role: "viewer",
      resourceId: "project-1",
      projectId: "project-1",
      createdByUserId: null,
      createdAt: "2026-04-19T10:00:00.000Z",
      expiresAt: null
    });
  });
});
