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
