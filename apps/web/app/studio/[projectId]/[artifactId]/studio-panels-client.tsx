"use client";

/**
 * Thin client-side wrappers that glue the Round-4 interactive panels
 * (component library, responsive preview) onto the server-rendered studio
 * page. These only exist because Next.js server components cannot host
 * event-based callbacks — everything below is either state-holding UI or
 * an adapter that translates a callback into a server action call.
 */

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveDeviceBar,
  ResponsivePreviewFrame,
  type ResponsiveVariant,
  type ResponsiveViewport
} from "../../../../components/responsive-preview-frame";
import { StudioComponentLibrary } from "../../../../components/studio-component-library";
import { StudioRefinePopover } from "../../../../components/studio-refine-popover";
import type { ComponentPreset } from "../../../../lib/component-presets";
import { prototypeFlowSteps } from "../../../../data/component-presets";
import type { ArtifactKind } from "@opendesign/contracts";
import { useT } from "../../../../lib/i18n";
import { useSelection } from "./selection-context";

// Defaults mirror a "laptop" preset — a safe default that fits most desktop
// browsers without scrolling. The frame persists per-artifact via localStorage
// so subsequent mounts rehydrate the last choice.
const DEFAULT_VARIANT: ResponsiveVariant = "laptop";
const DEFAULT_VIEWPORT: ResponsiveViewport = { width: 1280, height: 800 };

type ComponentLibraryWiredProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  appendSceneTemplateAction: (formData: FormData) => Promise<void> | void;
};

/**
 * Wires `StudioComponentLibrary.onAppend` onto the shared
 * `appendSceneTemplateAction` server action. For prototype flows we iterate
 * the preset's `flow` steps and call the action once per step so each screen
 * is appended in order.
 */
export function ComponentLibraryWired({
  projectId,
  artifactId,
  artifactKind,
  appendSceneTemplateAction
}: ComponentLibraryWiredProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleAppend = useCallback(
    async (preset: ComponentPreset) => {
      setPending(true);
      try {
        const steps =
          artifactKind === "prototype" && prototypeFlowSteps[preset.id]
            ? prototypeFlowSteps[preset.id]
            : [{ templateKind: preset.templateKind, props: preset.props }];
        for (const step of steps) {
          const formData = new FormData();
          formData.set("projectId", projectId);
          formData.set("artifactId", artifactId);
          formData.set("template", step.templateKind);
          await appendSceneTemplateAction(formData);
        }
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [projectId, artifactId, artifactKind, appendSceneTemplateAction, router]
  );

  return (
    <div aria-busy={pending ? "true" : undefined}>
      <StudioComponentLibrary artifactKind={artifactKind} onAppend={handleAppend} />
    </div>
  );
}

type ResponsivePreviewWiredProps = {
  artifactId: string;
  children: ReactNode;
};

/**
 * Controlled-state wrapper around `ResponsivePreviewFrame` + `ResponsiveDeviceBar`.
 * The server page cannot own `useState`, so the whole pair lives here. The
 * frame keeps the canvas mount point intact (`id="artifact-canvas"` on its
 * child) so comment anchoring continues to resolve against the same DOM node.
 */
export function ResponsivePreviewWired({
  artifactId,
  children
}: ResponsivePreviewWiredProps) {
  const [variant, setVariant] = useState<ResponsiveVariant>(DEFAULT_VARIANT);
  const [viewport, setViewport] = useState<ResponsiveViewport>(DEFAULT_VIEWPORT);

  const handleChange = useCallback(
    (next: { variant: ResponsiveVariant; viewport: ResponsiveViewport }) => {
      setVariant(next.variant);
      setViewport(next.viewport);
    },
    []
  );

  return (
    <>
      <ResponsiveDeviceBar
        variant={variant}
        viewport={viewport}
        onChange={handleChange}
      />
      <ResponsivePreviewFrame
        variant={variant}
        viewport={viewport}
        onChange={handleChange}
        artifactId={artifactId}
        ariaLabel="Artifact canvas preview"
      >
        {children}
      </ResponsivePreviewFrame>
    </>
  );
}

type RefineTriggerProps = {
  projectId: string;
  artifactId: string;
};

/**
 * Trigger for the refine popover — reads the current canvas selection from
 * `SelectionProvider`. When nothing is selected we render a disabled hint
 * ("Select an element to refine") instead of opening the popover against a
 * stale root node.
 */
export function RefineTrigger({ projectId, artifactId }: RefineTriggerProps) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const { selected } = useSelection();
  const nodeId = selected?.nodeId || "";
  const nodeName = selected?.textPreview || selected?.elementTag;

  if (!nodeId) {
    return (
      <div className="stack-form">
        <button
          type="button"
          className="button-link ghost"
          disabled
          aria-disabled="true"
        >
          {t("studio.compose.refine.empty")}
        </button>
      </div>
    );
  }
  return (
    <div className="stack-form">
      <button
        type="button"
        className="button-link ghost"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Close refine" : "Refine this section"}
      </button>
      {open ? (
        <StudioRefinePopover
          projectId={projectId}
          artifactId={artifactId}
          nodeId={nodeId}
          nodeName={nodeName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
