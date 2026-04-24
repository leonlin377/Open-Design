import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  ARTIFACT_THEME_PRESETS,
  DEFAULT_ARTIFACT_THEME
} from "@opendesign/contracts/src/artifact-theme";
import { createAuth } from "../src/auth/session";
import { InMemoryArtifactRepository } from "../src/repositories/artifacts";
import { InMemoryArtifactThemeRepository } from "../src/repositories/artifact-themes";
import { InMemoryArtifactWorkspaceRepository } from "../src/repositories/artifact-workspaces";
import { InMemoryProjectRepository } from "../src/repositories/projects";
import { registerArtifactThemeRoutes } from "../src/routes/artifact-theme";
import { sendApiError } from "../src/lib/api-errors";

interface Harness {
  app: FastifyInstance;
  projectId: string;
  artifactA: string;
  artifactB: string;
}

async function buildHarness(): Promise<Harness> {
  const projects = new InMemoryProjectRepository();
  const artifacts = new InMemoryArtifactRepository();
  const workspaces = new InMemoryArtifactWorkspaceRepository();
  const themes = new InMemoryArtifactThemeRepository();
  const { auth } = createAuth({ env: { ...process.env, NODE_ENV: "test" } });

  const projectA = await projects.create({ name: "Theme Project" });
  const artifactA = await artifacts.create({
    projectId: projectA.id,
    name: "Homepage",
    kind: "website"
  });
  const artifactB = await artifacts.create({
    projectId: projectA.id,
    name: "Deck",
    kind: "slides"
  });

  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendApiError(reply, 400, {
        error: "Request validation failed",
        code: "VALIDATION_ERROR",
        recoverable: true,
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      });
    }
    throw error;
  });

  await app.register(registerArtifactThemeRoutes, {
    prefix: "/api",
    workspaces,
    artifacts,
    themes,
    projects,
    auth
  });

  return {
    app,
    projectId: projectA.id,
    artifactA: artifactA.id,
    artifactB: artifactB.id
  };
}

let harness: Harness;

beforeEach(async () => {
  harness = await buildHarness();
});

afterEach(async () => {
  await harness.app.close();
});

describe("Artifact theme routes", () => {
  it("returns the default theme for an artifact that has never been themed", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      artifactId: harness.artifactA,
      isDefault: true,
      updatedAt: null
    });
    expect(body.theme).toEqual(DEFAULT_ARTIFACT_THEME);
  });

  it("persists a posted theme and returns it on subsequent GETs", async () => {
    const teal = ARTIFACT_THEME_PRESETS.Teal;
    const postResponse = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`,
      payload: { theme: teal }
    });

    expect(postResponse.statusCode).toBe(200);
    const postBody = postResponse.json();
    expect(postBody).toMatchObject({
      artifactId: harness.artifactA,
      isDefault: false
    });
    expect(postBody.theme).toEqual(teal);
    expect(typeof postBody.updatedAt).toBe("string");

    const getResponse = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`
    });

    expect(getResponse.statusCode).toBe(200);
    const getBody = getResponse.json();
    expect(getBody.isDefault).toBe(false);
    expect(getBody.theme).toEqual(teal);
    expect(getBody.updatedAt).toBe(postBody.updatedAt);
  });

  it("replaces (does not merge) an existing theme when POSTed a second time", async () => {
    await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`,
      payload: { theme: ARTIFACT_THEME_PRESETS.Ink }
    });

    const sunset = ARTIFACT_THEME_PRESETS.Sunset;
    const replace = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`,
      payload: { theme: sunset }
    });

    expect(replace.statusCode).toBe(200);
    expect(replace.json().theme).toEqual(sunset);

    const getResponse = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`
    });
    expect(getResponse.json().theme.palette.accent).toBe(
      sunset.palette.accent
    );
  });

  it("keeps themes isolated between artifacts in the same project", async () => {
    await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`,
      payload: { theme: ARTIFACT_THEME_PRESETS.Forest }
    });

    const aResponse = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`
    });
    const bResponse = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactB}/theme`
    });

    expect(aResponse.json().theme).toEqual(ARTIFACT_THEME_PRESETS.Forest);
    expect(bResponse.json().isDefault).toBe(true);
    expect(bResponse.json().theme).toEqual(DEFAULT_ARTIFACT_THEME);
  });

  it("returns 404 when the artifact or project cannot be found", async () => {
    const missingProject = await harness.app.inject({
      method: "GET",
      url: `/api/projects/missing/artifacts/${harness.artifactA}/theme`
    });
    expect(missingProject.statusCode).toBe(404);
    expect(missingProject.json().code).toBe("PROJECT_NOT_FOUND");

    const missingArtifact = await harness.app.inject({
      method: "GET",
      url: `/api/projects/${harness.projectId}/artifacts/missing/theme`
    });
    expect(missingArtifact.statusCode).toBe(404);
    expect(missingArtifact.json().code).toBe("ARTIFACT_NOT_FOUND");
  });

  it("rejects a POST with a malformed theme payload", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: `/api/projects/${harness.projectId}/artifacts/${harness.artifactA}/theme`,
      payload: {
        theme: {
          ...ARTIFACT_THEME_PRESETS.Paper,
          palette: {
            ...ARTIFACT_THEME_PRESETS.Paper.palette,
            surface: "not-a-hex"
          }
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });
});
