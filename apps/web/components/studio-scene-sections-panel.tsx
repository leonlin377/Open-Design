import { Button, Surface } from "@opendesign/ui";
import type { SceneNode } from "@opendesign/contracts";
import {
  getArtifactAssetUrl,
  type ApiArtifact,
  type ApiArtifactAsset
} from "../lib/opendesign-api";
import { getArtifactEditorAffordance } from "./studio-artifact-affordances";

const sceneTemplates = ["hero", "feature-grid", "cta"] as const;

const defaultFeatureGridItems = [
  {
    label: "Scene",
    body: "Sections stay versioned and ready for review snapshots."
  },
  {
    label: "Design",
    body: "Brand rhythm and layout motifs stay attached to the workspace."
  },
  {
    label: "Export",
    body: "Preview, handoff, and export flows derive from one source of truth."
  }
];

function readFeatureGridItems(value: unknown) {
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

type StudioSceneSectionsPanelProps = {
  projectId: string;
  artifactId: string;
  shareToken?: string;
  artifactKind: ApiArtifact["kind"];
  assets: ApiArtifactAsset[];
  sceneNodes: SceneNode[];
  appendSceneTemplateAction: (formData: FormData) => Promise<void>;
  updateSceneNodeAction: (formData: FormData) => Promise<void>;
  uploadArtifactAssetAction: (formData: FormData) => Promise<void>;
};

export function StudioSceneSectionsPanel({
  projectId,
  artifactId,
  shareToken,
  artifactKind,
  assets,
  sceneNodes,
  appendSceneTemplateAction,
  updateSceneNodeAction,
  uploadArtifactAssetAction
}: StudioSceneSectionsPanelProps) {
  const affordance = getArtifactEditorAffordance(artifactKind);

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>{affordance.panelTitle}</h3>
        <p className="footer-note">{affordance.panelDescription}</p>
      </div>
      <div className="artifact-action-grid">
        {sceneTemplates.map((template) => (
          <form key={template} action={appendSceneTemplateAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="artifactId" value={artifactId} />
            {shareToken ? <input type="hidden" name="shareToken" value={shareToken} /> : null}
            <input type="hidden" name="template" value={template} />
            <Button variant="outline" size="sm" type="submit">
              {affordance.templateButtonLabels[template]}
            </Button>
          </form>
        ))}
      </div>
      <div className="scene-node-list">
        {sceneNodes.length === 0 ? (
          <div className="footer-note">{affordance.emptyStateLabel}</div>
        ) : null}
        {sceneNodes.map((node) => {
          const featureItems = readFeatureGridItems(node.props.items);
          const template = String(node.props.template ?? node.type);
          const imageAssetId =
            typeof node.props.imageAssetId === "string" ? node.props.imageAssetId : null;
          const imageAlt =
            typeof node.props.imageAlt === "string" ? node.props.imageAlt : "";
          const imageAsset =
            imageAssetId ? assets.find((asset) => asset.id === imageAssetId) ?? null : null;
          const featureItemsTail =
            template === "feature-grid" && featureItems.length > 3
              ? featureItems.slice(3)
              : [];
          const editableFeatureItems =
            template === "feature-grid"
              ? [0, 1, 2].map((index) => ({
                  label: featureItems[index]?.label ?? defaultFeatureGridItems[index]!.label,
                  body: featureItems[index]?.body ?? defaultFeatureGridItems[index]!.body
                }))
              : [];

          return (
            <Surface key={node.id} className="project-card" as="section">
              <div>
                <h3>{node.name}</h3>
                <p className="footer-note">
                  {template} · {node.id.slice(-8)}
                </p>
                <p className="footer-note">
                  {
                    affordance.templateDescriptions[
                      (template === "hero" ||
                      template === "feature-grid" ||
                      template === "cta"
                        ? template
                        : "hero") as (typeof sceneTemplates)[number]
                    ]
                  }
                </p>
              </div>
              <form action={updateSceneNodeAction} className="stack-form">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="artifactId" value={artifactId} />
                {shareToken ? (
                  <input type="hidden" name="shareToken" value={shareToken} />
                ) : null}
                <input type="hidden" name="nodeId" value={node.id} />
                {featureItemsTail.length > 0 ? (
                  <input
                    type="hidden"
                    name="itemsTailJson"
                    value={JSON.stringify(featureItemsTail)}
                  />
                ) : null}
                <label className="field">
                  <span>{affordance.fieldLabels.name}</span>
                  <input name="name" defaultValue={node.name} />
                </label>
                {typeof node.props.eyebrow === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.eyebrow}</span>
                    <input name="eyebrow" defaultValue={node.props.eyebrow} />
                  </label>
                ) : null}
                {typeof node.props.title === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.title}</span>
                    <input name="title" defaultValue={node.props.title} />
                  </label>
                ) : null}
                {template === "feature-grid" ? (
                  <div className="scene-item-grid">
                    {[0, 1, 2].map((index) => (
                      <Surface key={`${node.id}-item-${index}`} className="kv" as="section">
                        <span>Item {index + 1}</span>
                        <label className="field">
                          <span>{affordance.fieldLabels.itemLabel}</span>
                          <input
                            name={`item${index}Label`}
                            defaultValue={editableFeatureItems[index]?.label ?? ""}
                            required
                          />
                        </label>
                        <label className="field">
                          <span>{affordance.fieldLabels.itemBody}</span>
                          <textarea
                            name={`item${index}Body`}
                            defaultValue={editableFeatureItems[index]?.body ?? ""}
                            rows={3}
                            required
                          />
                        </label>
                      </Surface>
                    ))}
                  </div>
                ) : null}
                {typeof node.props.headline === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.headline}</span>
                    <input name="headline" defaultValue={node.props.headline} />
                  </label>
                ) : null}
                {typeof node.props.body === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.body}</span>
                    <textarea name="body" defaultValue={node.props.body} rows={4} />
                  </label>
                ) : null}
                {typeof node.props.primaryAction === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.primaryAction}</span>
                    <input name="primaryAction" defaultValue={node.props.primaryAction} />
                  </label>
                ) : null}
                {typeof node.props.secondaryAction === "string" ? (
                  <label className="field">
                    <span>{affordance.fieldLabels.secondaryAction}</span>
                    <input name="secondaryAction" defaultValue={node.props.secondaryAction} />
                  </label>
                ) : null}
                {template === "hero" ? (
                  <div className="asset-reference-panel">
                    <div>
                      <span className="asset-reference-title">Hero Asset</span>
                      <p className="footer-note">
                        Attach one persisted image to ground the lead section inside the
                        Studio canvas.
                      </p>
                    </div>
                    {imageAsset ? (
                      <a
                        href={getArtifactAssetUrl(projectId, artifactId, imageAsset.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="asset-preview-card"
                      >
                        <img
                          src={getArtifactAssetUrl(projectId, artifactId, imageAsset.id)}
                          alt={imageAlt || imageAsset.filename || node.name}
                          className="asset-preview-image"
                        />
                        <span>{imageAsset.filename ?? imageAsset.id}</span>
                      </a>
                    ) : (
                      <p className="footer-note">
                        No persisted hero asset is attached to this section yet.
                      </p>
                    )}
                    <label className="field">
                      <span>Alt Text</span>
                      <input
                        name="imageAlt"
                        defaultValue={imageAlt}
                        placeholder="Describe the attached hero asset"
                      />
                    </label>
                    {imageAsset ? (
                      <input type="hidden" name="imageAssetId" value={imageAsset.id} />
                    ) : null}
                  </div>
                ) : null}
                <Button variant="ghost" size="sm" type="submit">
                  {affordance.updateButtonLabel}
                </Button>
              </form>
              {template === "hero" ? (
                <form action={uploadArtifactAssetAction} className="stack-form">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="artifactId" value={artifactId} />
                  <input type="hidden" name="nodeId" value={node.id} />
                  <label className="field">
                    <span>Upload Asset</span>
                    <input type="file" name="asset" accept="image/png,image/jpeg,image/webp" />
                  </label>
                  <label className="field">
                    <span>Initial Alt Text</span>
                    <input
                      name="imageAlt"
                      defaultValue={imageAlt}
                      placeholder="Hero screenshot, product mock, or illustration"
                    />
                  </label>
                  <Button variant="outline" size="sm" type="submit">
                    Upload Hero Asset
                  </Button>
                </form>
              ) : null}
            </Surface>
          );
        })}
      </div>
    </Surface>
  );
}
