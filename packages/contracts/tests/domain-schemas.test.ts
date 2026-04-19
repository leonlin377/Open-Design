import { describe, expect, test } from "vitest";

import {
  ArtifactCommentSchema,
  ArtifactGenerateResponseSchema,
  ArtifactGenerateStreamEventSchema,
  ApiErrorSchema,
  ArtifactGenerationRunSchema,
  ArtifactGenerationPlanSchema,
  ArtifactKindSchema,
  ArtifactVersionDiffSummarySchema,
  ArtifactVersionSnapshotSchema,
  ArtifactWorkspaceSchema,
  CommentAnchorSchema,
  DesignSystemPackSchema,
  SceneTemplateKindSchema,
  SceneDocumentSchema
} from "../src/index";

describe("ArtifactKindSchema", () => {
  test("accepts the three supported artifact kinds", () => {
    expect(ArtifactKindSchema.parse("website")).toBe("website");
    expect(ArtifactKindSchema.parse("prototype")).toBe("prototype");
    expect(ArtifactKindSchema.parse("slides")).toBe("slides");
  });

  test("rejects unsupported artifact kinds", () => {
    expect(() => ArtifactKindSchema.parse("figma")).toThrowError();
  });
});

describe("SceneTemplateKindSchema", () => {
  test("accepts supported section templates", () => {
    expect(SceneTemplateKindSchema.parse("hero")).toBe("hero");
    expect(SceneTemplateKindSchema.parse("feature-grid")).toBe("feature-grid");
    expect(SceneTemplateKindSchema.parse("cta")).toBe("cta");
  });
});

describe("SceneDocumentSchema", () => {
  test("accepts a nested scene document with metadata", () => {
    const scene = SceneDocumentSchema.parse({
      id: "scene_1",
      artifactId: "artifact_1",
      kind: "website",
      version: 3,
      nodes: [
        {
          id: "root",
          type: "frame",
          name: "Root Frame",
          props: {
            direction: "vertical"
          },
          children: [
            {
              id: "hero",
              type: "section",
              name: "Hero",
              props: {
                headline: "OpenDesign"
              },
              children: []
            }
          ]
        }
      ],
      metadata: {
        themeId: "theme_default",
        designSystemPackId: "dsp_1"
      }
    });

    expect(scene.nodes[0]?.children[0]?.id).toBe("hero");
    expect(scene.metadata.designSystemPackId).toBe("dsp_1");
  });
});

describe("CommentAnchorSchema", () => {
  test("requires at least one anchoring strategy", () => {
    expect(() =>
      CommentAnchorSchema.parse({
        selectionPath: [],
        viewport: null
      })
    ).toThrowError(/anchor/i);
  });

  test("accepts element and viewport anchors together", () => {
    const anchor = CommentAnchorSchema.parse({
      elementId: "hero",
      selectionPath: ["root", "hero"],
      viewport: {
        x: 20,
        y: 40,
        width: 320,
        height: 200
      }
    });

    expect(anchor.elementId).toBe("hero");
  });
});

describe("DesignSystemPackSchema", () => {
  test("keeps provenance for inferred tokens and motifs", () => {
    const pack = DesignSystemPackSchema.parse({
      id: "dsp_1",
      name: "Acme Brand",
      source: "github",
      tokens: {
        colors: {
          primary: "#101828"
        },
        typography: {
          display: "Sora"
        }
      },
      components: [
        {
          id: "button-primary",
          name: "Primary Button",
          category: "button",
          signature: "rounded filled"
        }
      ],
      motifs: [
        {
          id: "motif_1",
          label: "Dense hero layering",
          description: "Layered typography over gradients"
        }
      ],
      provenance: [
        {
          id: "prov_1",
          type: "screenshot",
          sourceRef: "https://example.com",
          targets: ["tokens.colors.primary", "motifs.motif_1"]
        }
      ]
    });

    expect(pack.provenance[0]?.targets).toContain("tokens.colors.primary");
  });
});

describe("ArtifactVersionSnapshotSchema", () => {
  test("accepts persisted version metadata", () => {
    const version = ArtifactVersionSnapshotSchema.parse({
      id: "version_1",
      artifactId: "artifact_1",
      label: "V1 Seed",
      summary: "Initial seeded workspace snapshot",
      source: "seed",
      sceneVersion: 1,
      hasCodeWorkspaceSnapshot: true,
      createdAt: "2026-04-18T09:00:00.000Z"
    });

    expect(version.source).toBe("seed");
    expect(version.sceneVersion).toBe(1);
    expect(version.hasCodeWorkspaceSnapshot).toBe(true);
  });
});

describe("ArtifactCommentSchema", () => {
  test("accepts anchored open comments", () => {
    const comment = ArtifactCommentSchema.parse({
      id: "comment_1",
      artifactId: "artifact_1",
      body: "Tighten the left rail spacing and push the eyebrow upward.",
      status: "open",
      anchor: {
        elementId: "hero",
        selectionPath: ["root", "hero"]
      },
      createdAt: "2026-04-18T09:10:00.000Z",
      updatedAt: "2026-04-18T09:10:00.000Z"
    });

    expect(comment.anchor.elementId).toBe("hero");
    expect(comment.status).toBe("open");
  });
});

describe("ArtifactGenerationPlanSchema", () => {
  test("accepts validated generation plans", () => {
    const plan = ArtifactGenerationPlanSchema.parse({
      prompt: "Create a cinematic landing page for Atlas Commerce.",
      intent: "Build a cinematic launch surface for Atlas Commerce.",
      rationale: "The page needs a hero, supporting features, and a CTA to close the story.",
      sections: ["hero", "feature-grid", "cta"],
      provider: "heuristic",
      designSystem: {
        id: "dsp_1",
        name: "Atlas System",
        source: "github",
        motifLabels: ["Cinematic Layers"],
        colorTokenCount: 8,
        typographyTokenCount: 4,
        componentCount: 12
      }
    });

    expect(plan.sections).toHaveLength(3);
    expect(plan.provider).toBe("heuristic");
    expect(plan.designSystem?.name).toBe("Atlas System");
  });
});

describe("ArtifactGenerationRunSchema", () => {
  test("accepts a structured generation payload with scene and code patch metadata", () => {
    const run = ArtifactGenerationRunSchema.parse({
      plan: {
        prompt: "Create a cinematic landing page for Atlas Commerce.",
        intent: "Build a cinematic launch surface for Atlas Commerce.",
        rationale:
          "The page needs a hero, supporting features, and a CTA to close the story.",
        sections: ["hero", "feature-grid", "cta"],
        provider: "litellm"
      },
      diagnostics: {
        provider: "litellm",
        transport: "stream",
        warning: null
      },
      scenePatch: {
        mode: "append-root-sections",
        rationale: "Append the generated section stack to the root scene.",
        appendedNodes: [
          {
            id: "hero_1",
            type: "section",
            name: "Hero Section",
            template: "hero"
          }
        ]
      },
      codePatch: {
        mode: "synced",
        rationale: "Saved code workspace was regenerated from the latest scene-derived scaffold.",
        filesTouched: ["/App.tsx"]
      },
      commentResolution: {
        mode: "none",
        rationale: "Prompt generation does not resolve open review comments yet.",
        resolvedCommentIds: []
      }
    });

    expect(run.scenePatch.appendedNodes[0]?.template).toBe("hero");
    expect(run.codePatch.mode).toBe("synced");
  });
});

describe("ArtifactGenerateResponseSchema", () => {
  test("accepts the persisted generation response envelope", () => {
    const response = ArtifactGenerateResponseSchema.parse({
      generation: {
        plan: {
          prompt: "Create a cinematic landing page for Atlas Commerce.",
          intent: "Build a cinematic launch surface for Atlas Commerce.",
          rationale:
            "The page needs a hero, supporting features, and a CTA to close the story.",
          sections: ["hero", "feature-grid", "cta"],
          provider: "heuristic"
        },
        diagnostics: {
          provider: "heuristic",
          transport: "fallback",
          warning: "LiteLLM gateway is not configured."
        },
        scenePatch: {
          mode: "append-root-sections",
          rationale: "Append the generated section stack to the root scene.",
          appendedNodes: []
        },
        codePatch: {
          mode: "synced",
          rationale: "Saved code workspace was regenerated from the latest scene-derived scaffold.",
          filesTouched: ["/App.tsx"]
        },
        commentResolution: {
          mode: "none",
          rationale: "Prompt generation does not resolve open review comments yet.",
          resolvedCommentIds: []
        }
      },
      version: {
        id: "version_1",
        artifactId: "artifact_1",
        label: "Prompt 1",
        summary: "Generated from prompt",
        source: "prompt",
        sceneVersion: 4,
        hasCodeWorkspaceSnapshot: false,
        createdAt: "2026-04-19T12:00:00.000Z"
      },
      workspace: {
        artifactId: "artifact_1",
        intent: "Build a cinematic launch surface for Atlas Commerce.",
        activeVersionId: "version_1",
        sceneDocument: {
          id: "scene_1",
          artifactId: "artifact_1",
          kind: "website",
          version: 4,
          nodes: [],
          metadata: {}
        },
        codeWorkspace: null,
        syncPlan: {
          mode: "full",
          reason: "Scene remains the source of truth.",
          sourceMode: "scene",
          targetMode: "code-supported",
          changeScope: "document"
        },
        versionCount: 2,
        openCommentCount: 0,
        updatedAt: "2026-04-19T12:00:00.000Z"
      }
    });

    expect(response.generation.diagnostics.transport).toBe("fallback");
    expect(response.version.source).toBe("prompt");
  });
});

describe("ArtifactGenerateStreamEventSchema", () => {
  test("accepts generation progress and completion events", () => {
    const event = ArtifactGenerateStreamEventSchema.parse({
      type: "completed",
      message: "Generation pass completed.",
      result: {
        generation: {
          plan: {
            prompt: "Create a cinematic landing page for Atlas Commerce.",
            intent: "Build a cinematic launch surface for Atlas Commerce.",
            rationale:
              "The page needs a hero, supporting features, and a CTA to close the story.",
            sections: ["hero", "feature-grid", "cta"],
            provider: "heuristic"
          },
          diagnostics: {
            provider: "heuristic",
            transport: "fallback",
            warning: null
          },
          scenePatch: {
            mode: "append-root-sections",
            rationale: "Append the generated section stack to the root scene.",
            appendedNodes: []
          },
          codePatch: {
            mode: "synced",
            rationale: "Saved code workspace was regenerated from the latest scene-derived scaffold.",
            filesTouched: ["/App.tsx"]
          },
          commentResolution: {
            mode: "none",
            rationale: "Prompt generation does not resolve comments yet.",
            resolvedCommentIds: []
          }
        },
        version: {
          id: "version_1",
          artifactId: "artifact_1",
          label: "Prompt 1",
          summary: "Generated from prompt",
          source: "prompt",
          sceneVersion: 2,
          hasCodeWorkspaceSnapshot: false,
          createdAt: "2026-04-19T12:00:00.000Z"
        },
        workspace: {
          artifactId: "artifact_1",
          intent: "Build a cinematic launch surface for Atlas Commerce.",
          activeVersionId: "version_1",
          sceneDocument: {
            id: "scene_1",
            artifactId: "artifact_1",
            kind: "website",
            version: 2,
            nodes: [],
            metadata: {}
          },
          codeWorkspace: null,
          syncPlan: {
            mode: "full",
            reason: "Scene remains the source of truth.",
            sourceMode: "scene",
            targetMode: "code-supported",
            changeScope: "document"
          },
          versionCount: 2,
          openCommentCount: 0,
          updatedAt: "2026-04-19T12:00:00.000Z"
        }
      }
    });

    expect(event.type).toBe("completed");
    if (event.type !== "completed") {
      throw new Error("expected a completed event");
    }

    expect(event.result.generation.plan.sections).toHaveLength(3);
  });
});

describe("ApiErrorSchema", () => {
  test("accepts structured api errors with recovery hints", () => {
    const error = ApiErrorSchema.parse({
      error: "Workspace update failed",
      code: "WORKSPACE_UPDATE_FAILED",
      recoverable: true,
      details: {
        retryable: true
      }
    });

    expect(error.code).toBe("WORKSPACE_UPDATE_FAILED");
    expect(error.recoverable).toBe(true);
  });

  test("accepts validation errors with issue details", () => {
    const error = ApiErrorSchema.parse({
      error: "Request validation failed",
      code: "VALIDATION_ERROR",
      recoverable: true,
      details: {
        issues: [
          {
            path: "name",
            message: "Invalid input"
          }
        ]
      }
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.issues).toHaveLength(1);
  });

  test("accepts provider-specific generation failures", () => {
    const error = ApiErrorSchema.parse({
      error: "Generation provider returned an unsuccessful response.",
      code: "GENERATION_PROVIDER_FAILURE",
      recoverable: true,
      details: {
        provider: "litellm",
        status: 502
      }
    });

    expect(error.code).toBe("GENERATION_PROVIDER_FAILURE");
    expect(error.details?.provider).toBe("litellm");
  });

  test("accepts invalid scene patch failures", () => {
    const error = ApiErrorSchema.parse({
      error: "Generation produced an invalid scene patch.",
      code: "INVALID_SCENE_PATCH",
      recoverable: true,
      details: {
        stage: "apply-scene",
        reason: "Duplicate scene node id: hero_duplicate-node"
      }
    });

    expect(error.code).toBe("INVALID_SCENE_PATCH");
    expect(error.details?.stage).toBe("apply-scene");
  });

  test("accepts artifact-kind-specific export failures", () => {
    const error = ApiErrorSchema.parse({
      error: "Prototype flow export is only available for prototype artifacts",
      code: "EXPORT_NOT_SUPPORTED",
      recoverable: true
    });

    expect(error.code).toBe("EXPORT_NOT_SUPPORTED");
    expect(error.recoverable).toBe(true);
  });
});

describe("ArtifactVersionDiffSummarySchema", () => {
  test("accepts summarized scene and code diff payloads", () => {
    const diff = ArtifactVersionDiffSummarySchema.parse({
      versionId: "version_1",
      againstVersionId: "version_2",
      scene: {
        addedNodeCount: 1,
        removedNodeCount: 0,
        changedNodeCount: 2,
        currentVersion: 5,
        comparedVersion: 3
      },
      code: {
        changedFileCount: 2,
        comparedHasCodeWorkspace: true,
        currentHasCodeWorkspace: false
      }
    });

    expect(diff.scene.changedNodeCount).toBe(2);
    expect(diff.code.changedFileCount).toBe(2);
  });
});

describe("ArtifactWorkspaceSchema", () => {
  test("accepts workspace overview payloads", () => {
    const workspace = ArtifactWorkspaceSchema.parse({
      artifactId: "artifact_1",
      intent: "Build a cinematic artifact shell with bold type and an export-ready inspector.",
      activeVersionId: "version_2",
      sceneDocument: {
        id: "scene_1",
        artifactId: "artifact_1",
        kind: "website",
        version: 2,
        nodes: [],
        metadata: {}
      },
      syncPlan: {
        mode: "full",
        reason: "Scene edits can still round-trip into supported code.",
        sourceMode: "scene",
        targetMode: "code-supported",
        changeScope: "document"
      },
      versionCount: 2,
      openCommentCount: 1,
      updatedAt: "2026-04-18T09:15:00.000Z"
    });

    expect(workspace.syncPlan.mode).toBe("full");
    expect(workspace.versionCount).toBe(2);
  });
});
