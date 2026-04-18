import { z } from "zod";

export const ArtifactKindSchema = z.enum(["website", "prototype", "slides"]);

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
export type CommentAnchor = z.infer<typeof CommentAnchorSchema>;
export type SceneNode = z.infer<typeof SceneNodeSchema>;
export type SceneDocument = z.infer<typeof SceneDocumentSchema>;
export type DesignSystemPack = z.infer<typeof DesignSystemPackSchema>;
