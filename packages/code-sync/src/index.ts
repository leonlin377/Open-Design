import type {
  ArtifactCodeWorkspace,
  ArtifactKind,
  SceneNode,
  SceneDocument
} from "@opendesign/contracts";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { indexSceneNodesById } from "@opendesign/scene-engine";

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
        (input.previousFiles[filePath] ?? null) !== (input.nextFiles[filePath] ?? null)
    )
    .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
}

function extractSectionsLiteral(appCode: string) {
  const startMarker = "const sections = ";
  const endMarker = ";\n\n  return (";
  const startIndex = appCode.indexOf(startMarker);

  if (startIndex === -1) {
    return null;
  }

  const valueStart = startIndex + startMarker.length;
  const endIndex = appCode.indexOf(endMarker, valueStart);

  if (endIndex === -1) {
    return null;
  }

  return appCode.slice(valueStart, endIndex).trim();
}

function readStringRecord(
  value: unknown
): value is {
  id: string;
  template: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { template?: unknown }).template === "string"
  );
}

function readFeatureItems(
  value: unknown
): Array<{
  label: string;
  body: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is {
      label: string;
      body: string;
    } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { body?: unknown }).body === "string"
  );
}

function readOptionalString(
  value: unknown,
  key: string
): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function buildSceneNodesFromSections(sections: unknown): SceneNode[] | null {
  if (!Array.isArray(sections)) {
    return null;
  }

  const nodes: SceneNode[] = [];

  for (const section of sections) {
    if (!readStringRecord(section)) {
      return null;
    }

    const name =
      readOptionalString(section, "name") ??
      (section.template === "hero"
        ? "Hero Section"
        : section.template === "feature-grid"
          ? "Feature Grid"
          : section.template === "cta"
            ? "Call To Action"
            : "Section");

    if (section.template === "hero") {
      const eyebrow = readOptionalString(section, "eyebrow");
      const headline = readOptionalString(section, "headline");
      const body = readOptionalString(section, "body");

      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "hero",
          ...(eyebrow ? { eyebrow } : {}),
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {})
        },
        children: []
      });
      continue;
    }

    if (section.template === "feature-grid") {
      const title = readOptionalString(section, "title");
      const items = readFeatureItems(
        typeof section === "object" && section !== null
          ? (section as Record<string, unknown>).items
          : undefined
      );
      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "feature-grid",
          ...(title ? { title } : {}),
          ...(items.length > 0 ? { items } : {})
        },
        children: []
      });
      continue;
    }

    if (section.template === "cta") {
      const headline = readOptionalString(section, "headline");
      const body = readOptionalString(section, "body");
      const primaryAction = readOptionalString(section, "primaryAction");
      const secondaryAction = readOptionalString(section, "secondaryAction");

      nodes.push({
        id: section.id,
        type: "section",
        name,
        props: {
          template: "cta",
          ...(headline ? { headline } : {}),
          ...(body ? { body } : {}),
          ...(primaryAction ? { primaryAction } : {}),
          ...(secondaryAction ? { secondaryAction } : {})
        },
        children: []
      });
      continue;
    }

    return null;
  }

  return nodes;
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
  if (input.artifactKind !== "website") {
    return {
      applied: false,
      filesTouched: [],
      reason: "Automatic scene-to-code sync currently supports website artifacts only.",
      codeWorkspace: null
    };
  }

  const previousBundle = buildArtifactSourceBundle({
    artifactKind: input.artifactKind,
    artifactName: input.artifactName,
    prompt: input.previousIntent,
    sceneNodes: input.previousSceneDocument.nodes
  });
  const nextBundle = buildArtifactSourceBundle({
    artifactKind: input.artifactKind,
    artifactName: input.artifactName,
    prompt: input.nextIntent,
    sceneNodes: input.nextSceneDocument.nodes
  });

  if (!input.currentCodeWorkspace) {
    return {
      applied: true,
      filesTouched: Object.keys(nextBundle.files).sort((leftPath, rightPath) =>
        leftPath.localeCompare(rightPath)
      ),
      reason: "No saved code workspace exists yet, so the latest scene-derived scaffold is seeded automatically.",
      codeWorkspace: {
        files: nextBundle.files,
        baseSceneVersion: input.nextSceneDocument.version
      }
    };
  }

  if (input.currentCodeWorkspace.baseSceneVersion !== input.previousSceneDocument.version) {
    return {
      applied: false,
      filesTouched: [],
      reason:
        "Saved code workspace is already based on a different scene version and is preserved.",
      codeWorkspace: null
    };
  }

  if (
    normalizeFiles(input.currentCodeWorkspace.files) !== normalizeFiles(previousBundle.files)
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
      nextFiles: nextBundle.files
    }),
    reason:
      "Saved code workspace still matches the previous scene-derived scaffold, so it is regenerated from the latest scene document.",
    codeWorkspace: {
      files: nextBundle.files,
      baseSceneVersion: input.nextSceneDocument.version
    }
  };
};

export const syncCodeToSceneDocument = (input: {
  artifactKind: ArtifactKind;
  currentSceneDocument: SceneDocument;
  files: Record<string, string>;
}): CodeToSceneSyncDecision => {
  if (input.artifactKind !== "website") {
    return {
      applied: false,
      reason: "Code-to-scene sync currently supports website artifacts only.",
      sceneDocument: null
    };
  }

  const appCode = input.files["/App.tsx"];

  if (typeof appCode !== "string" || appCode.trim().length === 0) {
    return {
      applied: false,
      reason: "Code workspace is missing /App.tsx, so scene sync is unsupported.",
      sceneDocument: null
    };
  }

  const sectionsLiteral = extractSectionsLiteral(appCode);

  if (!sectionsLiteral) {
    return {
      applied: false,
      reason:
        "App.tsx no longer matches the supported scaffold pattern, so scene sync is unsupported.",
      sceneDocument: null
    };
  }

  let parsedSections: unknown;

  try {
    parsedSections = JSON.parse(sectionsLiteral);
  } catch {
    return {
      applied: false,
      reason:
        "App.tsx sections data is no longer valid JSON, so scene sync is unsupported.",
      sceneDocument: null
    };
  }

  const nodes = buildSceneNodesFromSections(parsedSections);

  if (!nodes) {
    return {
      applied: false,
      reason:
        "App.tsx contains unsupported section data, so scene sync is limited to the saved code workspace only.",
      sceneDocument: null
    };
  }

  try {
    indexSceneNodesById(nodes);
  } catch {
    return {
      applied: false,
      reason: "App.tsx produced duplicate section ids, so scene sync is unsupported.",
      sceneDocument: null
    };
  }

  if (JSON.stringify(nodes) === JSON.stringify(input.currentSceneDocument.nodes)) {
    return {
      applied: false,
      reason: "Supported App.tsx section data already matches the current scene.",
      sceneDocument: null
    };
  }

  return {
    applied: true,
    reason:
      "Saved App.tsx still matches the supported scaffold pattern, so section data synced back into the scene document.",
    sceneDocument: {
      ...input.currentSceneDocument,
      version: input.currentSceneDocument.version + 1,
      nodes
    }
  };
};
