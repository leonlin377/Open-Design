import type {
  ArtifactCodeWorkspace,
  ArtifactKind,
  SceneNode,
  SceneDocument
} from "@opendesign/contracts";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { indexSceneNodesById } from "@opendesign/scene-engine";

import {
  buildPrototypeSceneNodesFromScreens,
  buildSlidesSceneNodesFromSlides,
  buildWebsiteSceneNodesFromSections,
  extractModuleArrayLiteral
} from "./scaffolds";
import {
  buildPrototypeScaffoldFiles,
  buildSlidesScaffoldFiles
} from "./scaffold-emit";

export type SyncEndpointMode = "scene" | "code-supported" | "code-advanced";
export type SyncChangeScope = "node" | "section" | "document";
export type SyncMode = "full" | "constrained";

export type SyncPlan = {
  mode: SyncMode;
  reason: string;
  sourceMode: SyncEndpointMode;
  targetMode: SyncEndpointMode | "scene";
  changeScope: SyncChangeScope;
};

export type SyncResult = {
  plan: SyncPlan;
  applied: boolean;
  warnings: string[];
};

export type SceneToCodeSyncDecision = {
  applied: boolean;
  filesTouched: string[];
  reason: string;
  codeWorkspace:
    | {
        files: Record<string, string>;
        baseSceneVersion: number;
      }
    | null;
};

export type CodeToSceneSyncDecision = {
  applied: boolean;
  reason: string;
  sceneDocument: SceneDocument | null;
};

// Human readable surface descriptor used in fail-closed messages. Keeping
// this as a named constant means API consumers get a single, stable string to
// grep for when diagnosing "why did my edit not sync back?".
const UNSUPPORTED_SCAFFOLD_HINT =
  "unsupported scaffold: expected `const sections = [...]`, `export const sections = [...]`, `const screens = [...]`, or `const slides = [...]` at module scope.";

export const planSyncPatch = (input: {
  sourceMode: SyncEndpointMode;
  targetMode: SyncEndpointMode | "scene";
  changeScope: SyncChangeScope;
}): SyncPlan => {
  const { sourceMode, targetMode, changeScope } = input;

  if (sourceMode === "code-supported" && targetMode === "scene") {
    return {
      mode: "full",
      reason: "Supported code can round-trip into scene structures.",
      sourceMode,
      targetMode,
      changeScope
    };
  }

  if (sourceMode === "scene" && targetMode === "code-supported") {
    return {
      mode: "full",
      reason: "Scene changes can fully drive supported code output.",
      sourceMode,
      targetMode,
      changeScope
    };
  }

  return {
    mode: "constrained",
    reason: "Advanced code can only safely sync at section granularity.",
    sourceMode,
    targetMode,
    changeScope
  };
};

function normalizeFiles(files: Record<string, string>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(files).sort(([leftPath], [rightPath]) =>
        leftPath.localeCompare(rightPath)
      )
    )
  );
}

function omitSyncPayloadFile(files: Record<string, string>) {
  const nextFiles = { ...files };
  delete nextFiles["/opendesign.sync.json"];
  return nextFiles;
}

function diffFilePaths(input: {
  previousFiles: Record<string, string>;
  nextFiles: Record<string, string>;
}) {
  const filePaths = new Set([
    ...Object.keys(input.previousFiles),
    ...Object.keys(input.nextFiles)
  ]);

  return [...filePaths]
    .filter(
      (filePath) =>
        (input.previousFiles[filePath] ?? null) !==
        (input.nextFiles[filePath] ?? null)
    )
    .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
}

function matchesGeneratedScaffold(input: {
  currentFiles: Record<string, string>;
  previousBundleFiles: Record<string, string>;
}) {
  const normalizedCurrentFiles = normalizeFiles(input.currentFiles);
  const normalizedPreviousBundle = normalizeFiles(input.previousBundleFiles);

  if (normalizedCurrentFiles === normalizedPreviousBundle) {
    return true;
  }

  return (
    normalizedCurrentFiles ===
    normalizeFiles(omitSyncPayloadFile(input.previousBundleFiles))
  );
}

function readSyncPayloadSections(files: Record<string, string>) {
  const syncPayloadRaw = files["/opendesign.sync.json"];

  if (typeof syncPayloadRaw !== "string" || syncPayloadRaw.trim().length === 0) {
    return {
      status: "missing" as const,
      sections: null
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(syncPayloadRaw);
  } catch {
    return {
      status: "invalid-json" as const,
      sections: null
    };
  }

  if (
    typeof parsedPayload !== "object" ||
    parsedPayload === null ||
    (parsedPayload as { version?: unknown }).version !== 1 ||
    !Array.isArray((parsedPayload as { sections?: unknown }).sections)
  ) {
    return {
      status: "invalid-shape" as const,
      sections: null
    };
  }

  return {
    status: "valid" as const,
    sections: (parsedPayload as { sections: unknown[] }).sections
  };
}

type PreparedScaffoldFiles =
  | { ok: true; files: Record<string, string> }
  | { ok: false; reason: string };

function prepareScaffoldFiles(input: {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  sceneNodes: SceneNode[];
}): PreparedScaffoldFiles {
  if (input.artifactKind === "website") {
    const bundle = buildArtifactSourceBundle({
      artifactKind: "website",
      artifactName: input.artifactName,
      prompt: input.prompt,
      sceneNodes: input.sceneNodes
    });
    return { ok: true, files: bundle.files };
  }

  if (input.artifactKind === "prototype") {
    const result = buildPrototypeScaffoldFiles({
      artifactName: input.artifactName,
      sceneNodes: input.sceneNodes
    });
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    return { ok: true, files: result.files };
  }

  const result = buildSlidesScaffoldFiles({
    artifactName: input.artifactName,
    sceneNodes: input.sceneNodes
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, files: result.files };
}

function toSafeFilenameBase(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  );
}

export function buildFreeformCodeWorkspace(input: {
  artifactName: string;
  freeformFiles: Record<string, string>;
  sceneVersion: number;
}): { files: Record<string, string>; baseSceneVersion: number } {
  const filenameBase = toSafeFilenameBase(input.artifactName);

  const skeletonFiles: Record<string, string> = {
    "/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${input.artifactName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`,
    "/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    "/package.json": JSON.stringify(
      {
        name: filenameBase,
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview"
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        },
        devDependencies: {
          "@types/react": "^18.3.0",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.4",
          typescript: "^4.9.5",
          vite: "4.2.0",
          "esbuild-wasm": "^0.17.12"
        }
      },
      null,
      2
    ),
    "/vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()]
});
`,
    "/tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["DOM", "DOM.Iterable", "ES2020"],
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: "ESNext",
          moduleResolution: "Node",
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx"
        },
        include: ["./*.ts", "./*.tsx"]
      },
      null,
      2
    )
  };

  const mergedFiles: Record<string, string> = {
    ...skeletonFiles,
    ...input.freeformFiles
  };

  return {
    files: mergedFiles,
    baseSceneVersion: input.sceneVersion
  };
}

export const syncSceneToCodeWorkspace = (input: {
  artifactKind: ArtifactKind;
  artifactName: string;
  previousIntent: string;
  nextIntent: string;
  previousSceneDocument: SceneDocument;
  nextSceneDocument: SceneDocument;
  currentCodeWorkspace: ArtifactCodeWorkspace | null;
}): SceneToCodeSyncDecision => {
  // Freeform scenes bypass template scaffold generation entirely.
  const hasFreeformNode = input.nextSceneDocument.nodes.some(
    (node) => node.type === "freeform"
  );
  if (hasFreeformNode) {
    if (input.currentCodeWorkspace) {
      return {
        applied: false,
        filesTouched: [],
        reason:
          "Freeform artifact code workspace is preserved — scene-to-code sync is not applicable for freeform generation.",
        codeWorkspace: null
      };
    }
    return {
      applied: false,
      filesTouched: [],
      reason:
        "Freeform artifact has no code workspace yet — freeform code is injected directly, not derived from scene nodes.",
      codeWorkspace: null
    };
  }

  const nextScaffold = prepareScaffoldFiles({
    artifactKind: input.artifactKind,
    artifactName: input.artifactName,
    prompt: input.nextIntent,
    sceneNodes: input.nextSceneDocument.nodes
  });

  if (!nextScaffold.ok) {
    return {
      applied: false,
      filesTouched: [],
      reason: nextScaffold.reason,
      codeWorkspace: null
    };
  }

  const nextFiles = nextScaffold.files;

  if (!input.currentCodeWorkspace) {
    return {
      applied: true,
      filesTouched: Object.keys(nextFiles).sort((leftPath, rightPath) =>
        leftPath.localeCompare(rightPath)
      ),
      reason:
        "No saved code workspace exists yet, so the latest scene-derived scaffold is seeded automatically.",
      codeWorkspace: {
        files: nextFiles,
        baseSceneVersion: input.nextSceneDocument.version
      }
    };
  }

  if (
    input.currentCodeWorkspace.baseSceneVersion !==
    input.previousSceneDocument.version
  ) {
    return {
      applied: false,
      filesTouched: [],
      reason:
        "Saved code workspace is already based on a different scene version and is preserved.",
      codeWorkspace: null
    };
  }

  const previousScaffold = prepareScaffoldFiles({
    artifactKind: input.artifactKind,
    artifactName: input.artifactName,
    prompt: input.previousIntent,
    sceneNodes: input.previousSceneDocument.nodes
  });

  if (!previousScaffold.ok) {
    // The previous scene itself cannot be re-serialized losslessly, so we
    // cannot verify the saved scaffold matches it. Preserve the saved code
    // workspace rather than overwriting from an unverifiable baseline.
    return {
      applied: false,
      filesTouched: [],
      reason: `Cannot verify saved code workspace against previous scene: ${previousScaffold.reason}`,
      codeWorkspace: null
    };
  }

  if (
    !matchesGeneratedScaffold({
      currentFiles: input.currentCodeWorkspace.files,
      previousBundleFiles: previousScaffold.files
    })
  ) {
    return {
      applied: false,
      filesTouched: [],
      reason:
        "Saved code workspace has diverged from the previous scene-derived scaffold and is preserved.",
      codeWorkspace: null
    };
  }

  return {
    applied: true,
    filesTouched: diffFilePaths({
      previousFiles: input.currentCodeWorkspace.files,
      nextFiles
    }),
    reason:
      "Saved code workspace still matches the previous scene-derived scaffold, so it is regenerated from the latest scene document.",
    codeWorkspace: {
      files: nextFiles,
      baseSceneVersion: input.nextSceneDocument.version
    }
  };
};

// ---------------------------------------------------------------------------
// Code → Scene back-sync. Each branch either produces a valid SceneNode[]
// (success path), or returns a decision with applied=false and a specific
// human readable `reason` so the scene stays untouched (fail-closed).
// ---------------------------------------------------------------------------

type AppCodeParseResult =
  | { status: "parsed"; nodes: SceneNode[]; reasonPrefix: string }
  | { status: "failed"; decision: CodeToSceneSyncDecision };

function failClosed(reason: string): CodeToSceneSyncDecision {
  return { applied: false, reason, sceneDocument: null };
}

function parseWebsiteAppCode(appCode: string): AppCodeParseResult {
  const extracted = extractModuleArrayLiteral(appCode, "sections");

  if (!extracted) {
    return {
      status: "failed",
      decision: failClosed(
        `App.tsx no longer matches a supported website scaffold. ${UNSUPPORTED_SCAFFOLD_HINT}`
      )
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.literal);
  } catch {
    return {
      status: "failed",
      decision: failClosed(
        "App.tsx sections data is no longer valid JSON, so scene sync is unsupported."
      )
    };
  }

  const nodes = buildWebsiteSceneNodesFromSections(parsed);
  if (!nodes) {
    return {
      status: "failed",
      decision: failClosed(
        "App.tsx contains unsupported section data, so scene sync is limited to the saved code workspace only."
      )
    };
  }

  return {
    status: "parsed",
    nodes,
    reasonPrefix:
      "Saved App.tsx still matches a supported legacy website scaffold pattern, so section data synced back into the scene document."
  };
}

function parsePrototypeAppCode(appCode: string): AppCodeParseResult {
  const extracted = extractModuleArrayLiteral(appCode, "screens");

  if (!extracted) {
    return {
      status: "failed",
      decision: failClosed(
        `App.tsx no longer matches a supported prototype scaffold. ${UNSUPPORTED_SCAFFOLD_HINT}`
      )
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.literal);
  } catch {
    return {
      status: "failed",
      decision: failClosed(
        "App.tsx screens data is no longer valid JSON, so scene sync is unsupported."
      )
    };
  }

  const result = buildPrototypeSceneNodesFromScreens(parsed);
  if (!result.ok) {
    return {
      status: "failed",
      decision: failClosed(
        `App.tsx prototype screens data is unsupported: ${result.error.message}`
      )
    };
  }

  return {
    status: "parsed",
    nodes: result.nodes,
    reasonPrefix:
      "Saved App.tsx still matches the supported prototype scaffold, so screen data synced back into the scene document."
  };
}

function parseSlidesAppCode(appCode: string): AppCodeParseResult {
  const extracted = extractModuleArrayLiteral(appCode, "slides");

  if (!extracted) {
    return {
      status: "failed",
      decision: failClosed(
        `App.tsx no longer matches a supported slides scaffold. ${UNSUPPORTED_SCAFFOLD_HINT}`
      )
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.literal);
  } catch {
    return {
      status: "failed",
      decision: failClosed(
        "App.tsx slides data is no longer valid JSON, so scene sync is unsupported."
      )
    };
  }

  const result = buildSlidesSceneNodesFromSlides(parsed);
  if (!result.ok) {
    return {
      status: "failed",
      decision: failClosed(
        `App.tsx slides data is unsupported: ${result.error.message}`
      )
    };
  }

  return {
    status: "parsed",
    nodes: result.nodes,
    reasonPrefix:
      "Saved App.tsx still matches the supported slides scaffold, so slide data synced back into the scene document."
  };
}

function parseAppCodeForArtifactKind(input: {
  artifactKind: ArtifactKind;
  appCode: string;
}): AppCodeParseResult {
  if (input.artifactKind === "website") {
    return parseWebsiteAppCode(input.appCode);
  }
  if (input.artifactKind === "prototype") {
    return parsePrototypeAppCode(input.appCode);
  }
  return parseSlidesAppCode(input.appCode);
}

export const syncCodeToSceneDocument = (input: {
  artifactKind: ArtifactKind;
  currentSceneDocument: SceneDocument;
  files: Record<string, string>;
}): CodeToSceneSyncDecision => {
  const appCode = input.files["/App.tsx"];
  const syncPayloadDecision = readSyncPayloadSections(input.files);

  // The stable sync payload is the preferred round-trip channel for every
  // artifact kind — it is produced by the same exporter that consumes the
  // scene so it has no ambiguity. It only applies to website artifacts today
  // because only the website scaffold uses the legacy
  // `{ template: "hero" | "feature-grid" | "cta" }` vocabulary that
  // buildWebsiteSceneNodesFromSections understands.
  if (
    input.artifactKind === "website" &&
    syncPayloadDecision.status === "valid"
  ) {
    const nodes = buildWebsiteSceneNodesFromSections(
      syncPayloadDecision.sections
    );

    if (!nodes) {
      return failClosed(
        "opendesign.sync.json contains unsupported section data, so scene sync is limited to the saved code workspace only."
      );
    }

    try {
      indexSceneNodesById(nodes);
    } catch {
      return failClosed(
        "opendesign.sync.json produced duplicate section ids, so scene sync is unsupported."
      );
    }

    if (
      JSON.stringify(nodes) === JSON.stringify(input.currentSceneDocument.nodes)
    ) {
      return failClosed(
        "Supported opendesign.sync.json section data already matches the current scene."
      );
    }

    return {
      applied: true,
      reason:
        "Saved code workspace still matches the supported stable sync payload, so section data synced back into the scene document.",
      sceneDocument: {
        ...input.currentSceneDocument,
        version: input.currentSceneDocument.version + 1,
        nodes
      }
    };
  }

  if (
    input.artifactKind === "website" &&
    syncPayloadDecision.status !== "missing"
  ) {
    return failClosed(
      "opendesign.sync.json is present but invalid, so scene sync is limited to the saved code workspace only."
    );
  }

  if (typeof appCode !== "string" || appCode.trim().length === 0) {
    return failClosed(
      `Code workspace is missing /App.tsx, so scene sync is unsupported. ${UNSUPPORTED_SCAFFOLD_HINT}`
    );
  }

  const parsed = parseAppCodeForArtifactKind({
    artifactKind: input.artifactKind,
    appCode
  });

  if (parsed.status === "failed") {
    return parsed.decision;
  }

  try {
    indexSceneNodesById(parsed.nodes);
  } catch {
    return failClosed(
      "App.tsx produced duplicate scene node ids, so scene sync is unsupported."
    );
  }

  if (
    JSON.stringify(parsed.nodes) ===
    JSON.stringify(input.currentSceneDocument.nodes)
  ) {
    return failClosed(
      "Supported App.tsx scene data already matches the current scene."
    );
  }

  return {
    applied: true,
    reason: parsed.reasonPrefix,
    sceneDocument: {
      ...input.currentSceneDocument,
      version: input.currentSceneDocument.version + 1,
      nodes: parsed.nodes
    }
  };
};
