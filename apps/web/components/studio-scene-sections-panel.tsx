import { Button, Surface } from "@opendesign/ui";
import type { SceneNode } from "@opendesign/contracts";
import type { ApiArtifact } from "../lib/opendesign-api";

const sceneTemplates = [
  { template: "hero" as const, label: "Add Hero" },
  { template: "feature-grid" as const, label: "Add Feature Grid" },
  { template: "cta" as const, label: "Add CTA" }
];

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
  artifactKind: ApiArtifact["kind"];
  sceneNodes: SceneNode[];
  appendSceneTemplateAction: (formData: FormData) => Promise<void>;
  updateSceneNodeAction: (formData: FormData) => Promise<void>;
};

export function StudioSceneSectionsPanel({
  projectId,
  artifactId,
  artifactKind,
  sceneNodes,
  appendSceneTemplateAction,
  updateSceneNodeAction
}: StudioSceneSectionsPanelProps) {
  const sceneUnitLabel = artifactKind === "prototype" ? "screen" : "section";
  const panelTitle = artifactKind === "prototype" ? "Prototype Screens" : "Scene Sections";
  const emptyStateLabel =
    artifactKind === "prototype" ? "No prototype screens yet." : "No scene sections yet.";

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>{panelTitle}</h3>
        <p className="footer-note">
          Append a root {sceneUnitLabel} template to the current scene document.
        </p>
      </div>
      <div className="artifact-action-grid">
        {sceneTemplates.map((entry) => (
          <form key={entry.template} action={appendSceneTemplateAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="artifactId" value={artifactId} />
            <input type="hidden" name="template" value={entry.template} />
            <Button variant="outline" size="sm" type="submit">
              {artifactKind === "prototype"
                ? entry.template === "hero"
                  ? "Add Hero Screen"
                  : entry.template === "feature-grid"
                    ? "Add Feature Screen"
                    : "Add Action Screen"
                : entry.label}
            </Button>
          </form>
        ))}
      </div>
      <div className="scene-node-list">
        {sceneNodes.length === 0 ? <div className="footer-note">{emptyStateLabel}</div> : null}
        {sceneNodes.map((node) => {
          const featureItems = readFeatureGridItems(node.props.items);
          const template = String(node.props.template ?? node.type);
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
              </div>
              <form action={updateSceneNodeAction} className="stack-form">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="artifactId" value={artifactId} />
                <input type="hidden" name="nodeId" value={node.id} />
                {featureItemsTail.length > 0 ? (
                  <input
                    type="hidden"
                    name="itemsTailJson"
                    value={JSON.stringify(featureItemsTail)}
                  />
                ) : null}
                <label className="field">
                  <span>Section Name</span>
                  <input name="name" defaultValue={node.name} />
                </label>
                {typeof node.props.eyebrow === "string" ? (
                  <label className="field">
                    <span>Eyebrow</span>
                    <input name="eyebrow" defaultValue={node.props.eyebrow} />
                  </label>
                ) : null}
                {typeof node.props.title === "string" ? (
                  <label className="field">
                    <span>Title</span>
                    <input name="title" defaultValue={node.props.title} />
                  </label>
                ) : null}
                {template === "feature-grid" ? (
                  <div className="scene-item-grid">
                    {[0, 1, 2].map((index) => (
                      <Surface key={`${node.id}-item-${index}`} className="kv" as="section">
                        <span>Item {index + 1}</span>
                        <label className="field">
                          <span>Label</span>
                          <input
                            name={`item${index}Label`}
                            defaultValue={editableFeatureItems[index]?.label ?? ""}
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Body</span>
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
                    <span>Headline</span>
                    <input name="headline" defaultValue={node.props.headline} />
                  </label>
                ) : null}
                {typeof node.props.body === "string" ? (
                  <label className="field">
                    <span>Body</span>
                    <textarea name="body" defaultValue={node.props.body} rows={4} />
                  </label>
                ) : null}
                {typeof node.props.primaryAction === "string" ? (
                  <label className="field">
                    <span>Primary Action</span>
                    <input name="primaryAction" defaultValue={node.props.primaryAction} />
                  </label>
                ) : null}
                {typeof node.props.secondaryAction === "string" ? (
                  <label className="field">
                    <span>Secondary Action</span>
                    <input name="secondaryAction" defaultValue={node.props.secondaryAction} />
                  </label>
                ) : null}
                <Button variant="ghost" size="sm" type="submit">
                  Update {sceneUnitLabel === "screen" ? "Screen" : "Section"}
                </Button>
              </form>
            </Surface>
          );
        })}
      </div>
    </Surface>
  );
}
