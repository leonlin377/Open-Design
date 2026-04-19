import { z } from "zod";

export const ArtifactKindSchema = z.enum(["website", "prototype", "slides"]);
export const SceneTemplateKindSchema = z.enum(["hero", "feature-grid", "cta"]);

export const ViewportRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const CommentAnchorSchema = z
  .object({
    elementId: z.string().min(1).optional(),
    selectionPath: z.array(z.string().min(1)).default([]),
    viewport: ViewportRectSchema.nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.elementId && value.selectionPath.length === 0 && !value.viewport) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Comment anchor requires at least one anchor strategy."
      });
    }
  });

export interface SceneNodeShape {
  id: string;
  type: string;
  name: string;
  props: Record<string, unknown>;
  children: SceneNodeShape[];
}

export const SceneNodeSchema: z.ZodType<SceneNodeShape> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    name: z.string().min(1),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(SceneNodeSchema).default([])
  })
);

export const SceneDocumentSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  kind: ArtifactKindSchema,
  version: z.number().int().positive(),
  nodes: z.array(SceneNodeSchema),
  metadata: z.object({
    themeId: z.string().min(1).optional(),
    designSystemPackId: z.string().min(1).optional()
  })
});

export const ArtifactCommentStatusSchema = z.enum(["open", "resolved"]);

export const ArtifactVersionSourceSchema = z.enum([
  "seed",
  "prompt",
  "comment",
  "manual"
]);

export const SyncEndpointModeSchema = z.enum([
  "scene",
  "code-supported",
  "code-advanced"
]);

export const SyncChangeScopeSchema = z.enum(["node", "section", "document"]);
export const SyncModeSchema = z.enum(["full", "constrained"]);

export const ArtifactSyncPlanSchema = z.object({
  mode: SyncModeSchema,
  reason: z.string().min(1),
  sourceMode: SyncEndpointModeSchema,
  targetMode: z.union([SyncEndpointModeSchema, z.literal("scene")]),
  changeScope: SyncChangeScopeSchema
});

export const ArtifactVersionSnapshotSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
  source: ArtifactVersionSourceSchema,
  sceneVersion: z.number().int().positive(),
  hasCodeWorkspaceSnapshot: z.boolean().default(false),
  createdAt: z.string().min(1)
});

export const ArtifactCommentSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  body: z.string().min(1),
  status: ArtifactCommentStatusSchema,
  anchor: CommentAnchorSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const ProjectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerUserId: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const ArtifactSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  kind: ArtifactKindSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const ArtifactCodeWorkspaceSchema = z.object({
  files: z.record(z.string(), z.string()).default({}),
  baseSceneVersion: z.number().int().positive(),
  updatedAt: z.string().min(1)
});

export const ArtifactGenerationProviderSchema = z.enum(["litellm", "heuristic"]);
export const ArtifactGenerationTransportSchema = z.enum(["stream", "json", "fallback"]);

export const ArtifactGenerationDesignSystemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(["github", "local-directory", "site-capture", "manual"]),
  motifLabels: z.array(z.string().min(1)).max(6),
  colorTokenCount: z.number().int().nonnegative(),
  typographyTokenCount: z.number().int().nonnegative(),
  componentCount: z.number().int().nonnegative()
});

export const ArtifactGenerationPlanSchema = z.object({
  prompt: z.string().min(1),
  intent: z.string().min(1),
  rationale: z.string().min(1),
  sections: z.array(SceneTemplateKindSchema).min(1).max(6),
  provider: ArtifactGenerationProviderSchema,
  designSystem: ArtifactGenerationDesignSystemSchema.optional()
});

export const ArtifactGenerationDiagnosticsSchema = z.object({
  provider: ArtifactGenerationProviderSchema,
  transport: ArtifactGenerationTransportSchema,
  warning: z.string().min(1).nullable()
});

export const ArtifactScenePatchNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  template: SceneTemplateKindSchema
});

export const ArtifactScenePatchSchema = z.object({
  mode: z.enum(["append-root-sections", "no-op"]),
  rationale: z.string().min(1),
  appendedNodes: z.array(ArtifactScenePatchNodeSchema)
});

export const ArtifactCodePatchSchema = z.object({
  mode: z.enum(["unchanged", "pending-sync", "synced"]),
  rationale: z.string().min(1),
  filesTouched: z.array(z.string().min(1))
});

export const ArtifactCommentResolutionSchema = z.object({
  mode: z.enum(["none", "queued"]),
  rationale: z.string().min(1),
  resolvedCommentIds: z.array(z.string().min(1))
});

export const ArtifactGenerationRunSchema = z.object({
  plan: ArtifactGenerationPlanSchema,
  diagnostics: ArtifactGenerationDiagnosticsSchema,
  scenePatch: ArtifactScenePatchSchema,
  codePatch: ArtifactCodePatchSchema,
  commentResolution: ArtifactCommentResolutionSchema
});

export const ApiErrorCodeSchema = z.enum([
  "AUTH_HANDLER_FAILURE",
  "VALIDATION_ERROR",
  "PROJECT_NOT_FOUND",
  "ARTIFACT_NOT_FOUND",
  "SHARE_TOKEN_NOT_FOUND",
  "SHARE_ROLE_FORBIDDEN",
  "VERSION_NOT_FOUND",
  "COMMENT_NOT_FOUND",
  "SCENE_NODE_NOT_FOUND",
  "INVALID_SCENE_PATCH",
  "WORKSPACE_UPDATE_FAILED",
  "INVALID_CODE_WORKSPACE",
  "CODE_WORKSPACE_CONFLICT",
  "DESIGN_SYSTEM_IMPORT_FAILED",
  "EXPORT_NOT_SUPPORTED",
  "GENERATION_TIMEOUT",
  "GENERATION_PROVIDER_FAILURE",
  "INVALID_GENERATION_PLAN"
]);

export const ApiErrorSchema = z.object({
  error: z.string().min(1),
  code: ApiErrorCodeSchema,
  recoverable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional()
});

export const ArtifactVersionDiffSummarySchema = z.object({
  versionId: z.string().min(1),
  againstVersionId: z.string().min(1).nullable(),
  scene: z.object({
    addedNodeCount: z.number().int().nonnegative(),
    removedNodeCount: z.number().int().nonnegative(),
    changedNodeCount: z.number().int().nonnegative(),
    currentVersion: z.number().int().positive(),
    comparedVersion: z.number().int().positive()
  }),
  code: z.object({
    changedFileCount: z.number().int().nonnegative(),
    comparedHasCodeWorkspace: z.boolean(),
    currentHasCodeWorkspace: z.boolean()
  })
});

export const ShareResourceTypeSchema = z.enum(["project", "artifact"]);
export const ShareRoleSchema = z.enum(["viewer", "commenter", "editor"]);

export const ShareTokenSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  resourceType: ShareResourceTypeSchema,
  role: ShareRoleSchema,
  resourceId: z.string().min(1),
  projectId: z.string().min(1),
  createdByUserId: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1).nullable()
});

export const ShareReviewArtifactWorkspaceSchema = z.object({
  intent: z.string().min(1),
  sceneVersion: z.number().int().positive(),
  rootNodeCount: z.number().int().nonnegative(),
  activeVersionId: z.string().min(1).nullable(),
  openCommentCount: z.number().int().nonnegative(),
  versionCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1)
});

export const ShareReviewPayloadSchema = z.discriminatedUnion("resourceType", [
  z.object({
    resourceType: z.literal("project"),
    share: ShareTokenSchema,
    project: ProjectSummarySchema,
    artifacts: z.array(ArtifactSummarySchema)
  }),
  z.object({
    resourceType: z.literal("artifact"),
    share: ShareTokenSchema,
    project: ProjectSummarySchema,
    artifact: ArtifactSummarySchema,
    sceneNodes: z.array(SceneNodeSchema),
    comments: z.array(ArtifactCommentSchema),
    workspace: ShareReviewArtifactWorkspaceSchema,
    latestVersion: ArtifactVersionSnapshotSchema.nullable()
  })
]);

export const ArtifactWorkspaceSchema = z.object({
  artifactId: z.string().min(1),
  intent: z.string().min(1),
  activeVersionId: z.string().min(1).nullable(),
  sceneDocument: SceneDocumentSchema,
  codeWorkspace: ArtifactCodeWorkspaceSchema.nullable().default(null),
  syncPlan: ArtifactSyncPlanSchema,
  versionCount: z.number().int().nonnegative(),
  openCommentCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1)
});

export const ArtifactGenerateResponseSchema = z.object({
  generation: ArtifactGenerationRunSchema,
  version: ArtifactVersionSnapshotSchema,
  workspace: ArtifactWorkspaceSchema
});

export const ArtifactGenerateStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("planning"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("applying"),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("completed"),
    message: z.string().min(1),
    result: ArtifactGenerateResponseSchema
  }),
  z.object({
    type: z.literal("failed"),
    message: z.string().min(1),
    error: ApiErrorSchema
  })
]);

export const DesignSystemComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  signature: z.string().min(1)
});

export const DesignMotifSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1)
});

export const DesignSystemProvenanceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["screenshot", "dom", "token", "repository-file"]),
  sourceRef: z.string().min(1),
  assetId: z.string().min(1).optional(),
  targets: z.array(z.string().min(1)).min(1)
});

export const DesignSystemPackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(["github", "local-directory", "site-capture", "manual"]),
  tokens: z.object({
    colors: z.record(z.string(), z.string()).default({}),
    typography: z.record(z.string(), z.string()).default({})
  }),
  components: z.array(DesignSystemComponentSchema),
  motifs: z.array(DesignMotifSchema),
  provenance: z.array(DesignSystemProvenanceSchema)
});

export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export type SceneTemplateKind = z.infer<typeof SceneTemplateKindSchema>;
export type ArtifactCommentStatus = z.infer<typeof ArtifactCommentStatusSchema>;
export type ArtifactVersionSource = z.infer<typeof ArtifactVersionSourceSchema>;
export type ArtifactSyncPlan = z.infer<typeof ArtifactSyncPlanSchema>;
export type ArtifactVersionSnapshot = z.infer<typeof ArtifactVersionSnapshotSchema>;
export type ArtifactComment = z.infer<typeof ArtifactCommentSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ArtifactSummary = z.infer<typeof ArtifactSummarySchema>;
export type ArtifactCodeWorkspace = z.infer<typeof ArtifactCodeWorkspaceSchema>;
export type ArtifactGenerationProvider = z.infer<typeof ArtifactGenerationProviderSchema>;
export type ArtifactGenerationTransport = z.infer<typeof ArtifactGenerationTransportSchema>;
export type ArtifactGenerationDesignSystem = z.infer<
  typeof ArtifactGenerationDesignSystemSchema
>;
export type ArtifactGenerationPlan = z.infer<typeof ArtifactGenerationPlanSchema>;
export type ArtifactGenerationDiagnostics = z.infer<
  typeof ArtifactGenerationDiagnosticsSchema
>;
export type ArtifactScenePatch = z.infer<typeof ArtifactScenePatchSchema>;
export type ArtifactCodePatch = z.infer<typeof ArtifactCodePatchSchema>;
export type ArtifactCommentResolution = z.infer<
  typeof ArtifactCommentResolutionSchema
>;
export type ArtifactGenerationRun = z.infer<typeof ArtifactGenerationRunSchema>;
export type ArtifactGenerateResponse = z.infer<typeof ArtifactGenerateResponseSchema>;
export type ArtifactGenerateStreamEvent = z.infer<
  typeof ArtifactGenerateStreamEventSchema
>;
export type ArtifactVersionDiffSummary = z.infer<typeof ArtifactVersionDiffSummarySchema>;
export type ShareResourceType = z.infer<typeof ShareResourceTypeSchema>;
export type ShareRole = z.infer<typeof ShareRoleSchema>;
export type ShareToken = z.infer<typeof ShareTokenSchema>;
export type ShareReviewArtifactWorkspace = z.infer<
  typeof ShareReviewArtifactWorkspaceSchema
>;
export type ShareReviewPayload = z.infer<typeof ShareReviewPayloadSchema>;
export type ArtifactWorkspace = z.infer<typeof ArtifactWorkspaceSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type CommentAnchor = z.infer<typeof CommentAnchorSchema>;
export type SceneNode = z.infer<typeof SceneNodeSchema>;
export type SceneDocument = z.infer<typeof SceneDocumentSchema>;
export type DesignSystemPack = z.infer<typeof DesignSystemPackSchema>;
