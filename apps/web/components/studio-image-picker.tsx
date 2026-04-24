"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { Button, Surface } from "@opendesign/ui";
import type { ArtifactAsset } from "@opendesign/contracts";
import type {
  ImageGenerationResult,
  ImageGenerationStreamEvent
} from "@opendesign/contracts/image-generation";
import { useT } from "../lib/i18n";
import {
  generateArtifactImage,
  getArtifactImageAssetUrl
} from "../lib/opendesign-images";

/**
 * Modal image picker: user types a prompt, clicks "Generate", and sees a
 * preview alongside the existing persisted artifact assets. Clicking any
 * asset (generated or pre-existing) invokes `onSelect`, which the parent
 * wires to a scene-node update (e.g. setting `imageAssetId` on a hero).
 */
export type StudioImagePickerProps = {
  projectId: string;
  artifactId: string;
  /** Scene-node context so the parent can apply the asset to the correct node. */
  targetNodeId?: string | null;
  open: boolean;
  existingAssets: ArtifactAsset[];
  defaultPrompt?: string;
  onClose: () => void;
  onSelect: (asset: ArtifactAsset) => void | Promise<void>;
};

type GenerationState =
  | { kind: "idle" }
  | { kind: "generating"; messages: string[] }
  | { kind: "completed"; result: ImageGenerationResult }
  | { kind: "failed"; message: string };

export function StudioImagePicker({
  projectId,
  artifactId,
  targetNodeId,
  open,
  existingAssets,
  defaultPrompt,
  onClose,
  onSelect
}: StudioImagePickerProps) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [style, setStyle] = useState("");
  const [state, setState] = useState<GenerationState>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt ?? "");
      setStyle("");
      setState({ kind: "idle" });
    } else {
      controllerRef.current?.abort();
      controllerRef.current = null;
    }
  }, [open, defaultPrompt]);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setState({
        kind: "failed",
        message: "Enter a prompt before generating an image."
      });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({
      kind: "generating",
      messages: ["Starting image generation…"]
    });

    const handleEvent = (event: ImageGenerationStreamEvent) => {
      setState((previous) => {
        if (previous.kind !== "generating") {
          return previous;
        }
        return {
          kind: "generating",
          messages: [...previous.messages, event.message]
        };
      });
    };

    const outcome = await generateArtifactImage({
      projectId,
      artifactId,
      request: {
        prompt: trimmed,
        ...(style.trim() ? { style: style.trim() } : {})
      },
      signal: controller.signal,
      onEvent: handleEvent
    });

    if (outcome.kind === "completed") {
      setState({ kind: "completed", result: outcome.result });
    } else {
      setState({
        kind: "failed",
        message: outcome.error.error || "Image generation failed."
      });
    }
  }, [prompt, style, projectId, artifactId]);

  const generatedAsset = state.kind === "completed" ? state.result.asset : null;

  const galleryAssets = useMemo(() => {
    // Keep the freshly generated asset pinned to the front of the gallery so
    // users immediately see their new render. Existing assets follow in the
    // order the parent provided.
    if (!generatedAsset) {
      return existingAssets;
    }
    const deduped = existingAssets.filter((asset) => asset.id !== generatedAsset.id);
    return [generatedAsset, ...deduped];
  }, [generatedAsset, existingAssets]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Generate image"
      data-target-node={targetNodeId ?? ""}
    >
      <Surface className="studio-modal studio-image-picker" as="section">
        <header className="studio-modal-header">
          <h3>Generate or pick an image</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="studio-modal-body">
          <label className="field">
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              placeholder="Generate a hero image for…"
            />
          </label>
          <label className="field">
            <span>Style hint (optional)</span>
            <input
              type="text"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              placeholder="e.g. cinematic, flat-illustration"
            />
          </label>
          <div className="studio-modal-actions">
            <Button
              type="button"
              variant="primary"
              onClick={handleGenerate}
              disabled={state.kind === "generating"}
            >
              {state.kind === "generating" ? "Generating…" : "Generate"}
            </Button>
          </div>

          {state.kind === "generating" ? (
            <ul className="studio-stream-log" aria-live="polite">
              {state.messages.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          ) : null}
          {state.kind === "failed" ? (
            <p className="studio-inline-error" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="studio-image-picker-gallery">
            {galleryAssets.length === 0 ? (
              <p className="footer-note">
                No artifact images yet. Generate one above to attach it.
              </p>
            ) : (
              galleryAssets.map((asset) => {
                const isGenerated = generatedAsset?.id === asset.id;
                const url = getArtifactImageAssetUrl({
                  projectId,
                  artifactId,
                  assetId: asset.id
                });
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`asset-preview-card ${isGenerated ? "is-generated" : ""}`}
                    onClick={() => {
                      void onSelect(asset);
                    }}
                  >
                    <img
                      src={url}
                      alt={asset.filename ?? "Artifact image"}
                      className="asset-preview-image"
                    />
                    <span>
                      {asset.filename ?? asset.id}
                      {isGenerated ? " · new" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Surface>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StudioImagePickerButton — client mount used by the scene sections panel.
//
// Replaces the legacy `data-needs-image-picker` anchor on the hidden
// `imageAssetId` form input with a real control: a button that opens the
// picker modal, lets the user generate or pick an existing asset, and
// then invokes the passed `updateSceneNodeAction` server action with a
// fresh FormData carrying the chosen asset id. The current `imageAssetId`
// is also surfaced as a hidden input so the surrounding form still submits
// the existing selection if the user bypasses the picker.
// ---------------------------------------------------------------------------

type StudioImagePickerButtonProps = {
  projectId: string;
  artifactId: string;
  shareToken?: string;
  nodeId: string;
  currentImageAssetId: string | null;
  currentImageAlt: string;
  existingAssets: ArtifactAsset[];
  updateSceneNodeAction: (formData: FormData) => Promise<void>;
};

export function StudioImagePickerButton({
  projectId,
  artifactId,
  shareToken,
  nodeId,
  currentImageAssetId,
  currentImageAlt,
  existingAssets,
  updateSceneNodeAction
}: StudioImagePickerButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(currentImageAssetId);
  const [isPending, startTransition] = useTransition();

  const handleSelect = useCallback(
    async (asset: ArtifactAsset) => {
      setAssetId(asset.id);
      setOpen(false);
      startTransition(() => {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("artifactId", artifactId);
        if (shareToken) formData.set("shareToken", shareToken);
        formData.set("nodeId", nodeId);
        formData.set("imageAssetId", asset.id);
        if (currentImageAlt) formData.set("imageAlt", currentImageAlt);
        void updateSceneNodeAction(formData);
      });
    },
    [
      projectId,
      artifactId,
      shareToken,
      nodeId,
      currentImageAlt,
      updateSceneNodeAction
    ]
  );

  return (
    <>
      {assetId ? (
        <input type="hidden" name="imageAssetId" value={assetId} />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {t("studio.image.picker.open")}
      </Button>
      <StudioImagePicker
        projectId={projectId}
        artifactId={artifactId}
        targetNodeId={nodeId}
        open={open}
        existingAssets={existingAssets}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
