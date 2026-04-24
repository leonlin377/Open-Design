import { describe, expect, test } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type {
  ArtifactSummary,
  ArtifactWorkspace,
  SceneDocument
} from "@opendesign/contracts";
import { buildCodeSandboxExport } from "../src/codesandbox";

function makeInputs(
  kind: ArtifactSummary["kind"] = "website"
): {
  artifact: Pick<ArtifactSummary, "id" | "name" | "kind">;
  workspace: Pick<
    ArtifactWorkspace,
    "intent" | "sceneDocument" | "codeWorkspace"
  >;
} {
  const sceneDocument: SceneDocument = {
    id: "scene_1",
    artifactId: "artifact_1",
    kind,
    version: 2,
    nodes:
      kind === "prototype"
        ? [
            {
              id: "screen_a",
              type: "screen",
              name: "Welcome",
              props: {
                headline: "Hi",
                body: "Welcome"
              },
              children: []
            }
          ]
        : kind === "slides"
          ? [
              {
                id: "slide_a",
                type: "slide-title",
                name: "Opening",
                props: {
                  headline: "Opening",
                  body: "Begin"
                },
                children: []
              }
            ]
          : [
              {
                id: "hero_1",
                type: "section",
                name: "Hero",
                props: {
                  template: "hero",
                  headline: "Atlas leads",
                  body: "Cinematic."
                },
                children: []
              }
            ],
    metadata: {}
  };

  return {
    artifact: {
      id: "artifact_1",
      name: "Atlas Sandbox",
      kind
    },
    workspace: {
      intent: "Ship the sandbox bundle",
      sceneDocument,
      codeWorkspace: null
    }
  };
}

describe("buildCodeSandboxExport", () => {
  test("returns a ZIP containing the expected sandbox entries", () => {
    const bundle = buildCodeSandboxExport(makeInputs("website"));

    expect(bundle.filename).toMatch(/atlas-sandbox-codesandbox\.zip$/);
    expect(bundle.contentType).toBe("application/zip");

    const entries = unzipSync(bundle.bytes);
    const paths = Object.keys(entries).sort();

    expect(paths).toContain("package.json");
    expect(paths).toContain("vite.config.ts");
    expect(paths).toContain("src/main.tsx");
    expect(paths).toContain("src/App.tsx");
    expect(paths).toContain("src/styles.css");
    expect(paths).toContain("sandbox.config.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("index.html");
  });

  test("sandbox.config.json is valid JSON with a template", () => {
    const bundle = buildCodeSandboxExport(makeInputs("website"));
    const entries = unzipSync(bundle.bytes);
    const configText = strFromU8(entries["sandbox.config.json"]!);
    const parsed = JSON.parse(configText);

    expect(typeof parsed.template).toBe("string");
    expect(["node", "vite"]).toContain(parsed.template);
    // Sandbox config has the typical runtime hints.
    expect(typeof parsed.infiniteLoopProtection).toBe("boolean");
  });

  test("package.json carries dev and build scripts", () => {
    const bundle = buildCodeSandboxExport(makeInputs("slides"));
    const entries = unzipSync(bundle.bytes);
    const pkg = JSON.parse(strFromU8(entries["package.json"]!));
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    // CSB sometimes falls back to `start` — we alias it.
    expect(pkg.scripts.start).toBeDefined();
    expect(pkg.dependencies.react).toBeDefined();
  });

  test("index.html script tag points at the /src entry", () => {
    const bundle = buildCodeSandboxExport(makeInputs("website"));
    const entries = unzipSync(bundle.bytes);
    const html = strFromU8(entries["index.html"]!);
    expect(html).toContain('src="/src/main.tsx"');
  });

  test("prefers saved codeWorkspace files when present", () => {
    const base = makeInputs("website");
    const bundle = buildCodeSandboxExport({
      artifact: base.artifact,
      workspace: {
        ...base.workspace,
        codeWorkspace: {
          files: {
            "/App.tsx": "export default function App() { return <div>Custom</div>; }"
          },
          baseSceneVersion: 1,
          updatedAt: "2026-04-20T00:00:00.000Z"
        }
      }
    });
    const entries = unzipSync(bundle.bytes);
    const app = strFromU8(entries["src/App.tsx"]!);
    expect(app).toContain("Custom");
  });
});
