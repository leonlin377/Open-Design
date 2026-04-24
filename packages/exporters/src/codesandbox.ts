import type {
  ArtifactSummary,
  ArtifactWorkspace
} from "@opendesign/contracts";
import { strToU8, zipSync } from "fflate";
import { buildArtifactSourceBundle } from "./index";

/**
 * CodeSandbox-ready ZIP.
 *
 * The archive mirrors a runnable Vite + React sandbox. CodeSandbox recognizes
 * archives dropped via "Import from ZIP" when they contain `package.json`
 * and a `sandbox.config.json` at the root. We ride on top of the existing
 * `buildArtifactSourceBundle` output so the runtime matches what our Studio
 * renders — the only CSB-specific additions are:
 *
 * - `/sandbox.config.json` declaring the Vite template and an `infiniteLoopProtection`.
 * - A CSB-specific README.md with a clickable "Open in CodeSandbox" instruction.
 * - A `package.json` that already has `dev`/`build`/`preview` scripts — the
 *   default source-bundle scripts satisfy this, we just ensure they are
 *   present + add `start` as an alias because CSB falls back to it.
 */

export type CodeSandboxArchiveBundle = {
  filename: string;
  contentType: "application/zip";
  bytes: Uint8Array;
};

export type CodeSandboxArtifactWorkspaceInput = {
  /** The artifact driving export (name/kind). */
  artifact: Pick<ArtifactSummary, "id" | "name" | "kind">;
  /** The workspace whose scene + code files seed the sandbox. */
  workspace: Pick<
    ArtifactWorkspace,
    "intent" | "sceneDocument" | "codeWorkspace"
  >;
};

function toSafeFilenameBase(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  );
}

function ensureRunnablePackageJson(pkgJson: string, filenameBase: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(pkgJson) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const scripts =
    typeof parsed.scripts === "object" && parsed.scripts !== null
      ? (parsed.scripts as Record<string, string>)
      : {};

  const merged = {
    name: (parsed.name as string) ?? filenameBase,
    private: true,
    version: (parsed.version as string) ?? "0.1.0",
    type: "module",
    scripts: {
      start: scripts.start ?? "vite",
      dev: scripts.dev ?? "vite",
      build: scripts.build ?? "vite build",
      preview: scripts.preview ?? "vite preview"
    },
    dependencies: (parsed.dependencies as Record<string, string>) ?? {
      react: "^18.3.1",
      "react-dom": "^18.3.1"
    },
    devDependencies: (parsed.devDependencies as Record<string, string>) ?? {
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.4",
      typescript: "^4.9.5",
      vite: "4.2.0",
      "esbuild-wasm": "^0.17.12"
    }
  };

  return JSON.stringify(merged, null, 2);
}

export const buildCodeSandboxExport = (
  input: CodeSandboxArtifactWorkspaceInput
): CodeSandboxArchiveBundle => {
  const filenameBase = toSafeFilenameBase(input.artifact.name);

  const generatedBundle = buildArtifactSourceBundle({
    artifactKind: input.artifact.kind,
    artifactName: input.artifact.name,
    prompt: input.workspace.intent,
    sceneNodes: input.workspace.sceneDocument.nodes
  });

  // Prefer the saved code workspace when present so the CSB output mirrors
  // what the author has been editing, not just the scene-derived scaffold.
  const sourceFiles = input.workspace.codeWorkspace
    ? { ...generatedBundle.files, ...input.workspace.codeWorkspace.files }
    : generatedBundle.files;

  // Required sandbox entries. CodeSandbox reads `sandbox.config.json` to
  // pick a template; "node" runs the project's `start` script in a
  // container and works for Vite-backed React apps.
  const sandboxConfig = {
    template: "node",
    container: {
      node: "20",
      port: 5173,
      startScript: "dev"
    },
    hardReloadOnChange: false,
    view: "browser",
    infiniteLoopProtection: true
  };

  const readme = `# ${input.artifact.name} — CodeSandbox bundle

Exported from OpenDesign. This ZIP is CodeSandbox-ready:

1. In CodeSandbox, choose **Create Sandbox → Import from ZIP** and upload this
   archive.
2. CodeSandbox reads \`sandbox.config.json\` to boot a Node container running
   \`npm run dev\` against the included Vite + React scaffold.

## Included files

- \`/package.json\` — Vite + React scripts (\`dev\`, \`build\`, \`preview\`, plus
  a \`start\` alias that CodeSandbox falls back to).
- \`/vite.config.ts\` — Vite configuration.
- \`/src/main.tsx\` — React mount point.
- \`/src/App.tsx\` — Generated from the current scene document.
- \`/sandbox.config.json\` — CodeSandbox runtime configuration.
`;

  // Flatten the source bundle into CodeSandbox's expected layout. The existing
  // bundle uses top-level filenames (e.g. `/App.tsx`); CSB is more forgiving
  // than Vite + React about layout, but we move the React entry points under
  // `/src/*` so the archive matches typical Vite templates — the README
  // promise above, and Vite's default `index.html` script tag, both point at
  // `/src/main.tsx`.
  const remappedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(sourceFiles)) {
    if (path === "/package.json") {
      remappedFiles[path] = ensureRunnablePackageJson(content, filenameBase);
    } else if (path === "/App.tsx" || path === "/main.tsx" || path === "/styles.css") {
      remappedFiles[`/src${path}`] = content;
    } else if (path === "/index.html") {
      remappedFiles[path] = content.replace(
        /src="\/main\.tsx"/g,
        'src="/src/main.tsx"'
      );
    } else {
      remappedFiles[path] = content;
    }
  }

  remappedFiles["/sandbox.config.json"] = JSON.stringify(sandboxConfig, null, 2);
  remappedFiles["/README.md"] = readme;

  const archiveEntries = Object.fromEntries(
    Object.entries(remappedFiles).map(([filePath, content]) => [
      // Drop leading slash — zip entries are relative paths.
      filePath.replace(/^\//, ""),
      strToU8(content)
    ])
  );

  const bytes = zipSync(archiveEntries, { level: 6 });

  return {
    filename: `${filenameBase}-codesandbox.zip`,
    contentType: "application/zip",
    bytes
  };
};
