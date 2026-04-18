import type {
  ArtifactCodeWorkspace,
  ArtifactKind,
  SceneDocument
} from "@opendesign/contracts";
import { buildArtifactSourceBundle } from "@opendesign/exporters";

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
