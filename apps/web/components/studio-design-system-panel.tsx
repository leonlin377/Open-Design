import { Button, Surface } from "@opendesign/ui";
import {
  getDesignSystemAssetUrl,
  type ApiDesignSystemPack
} from "../lib/opendesign-api";

type StudioDesignSystemPanelProps = {
  projectId: string;
  artifactId: string;
  designSystems: ApiDesignSystemPack[];
  selectedDesignSystemPackId: string | null;
  attachArtifactDesignSystemAction: (formData: FormData) => Promise<void>;
};

export function StudioDesignSystemPanel({
  projectId,
  artifactId,
  designSystems,
  selectedDesignSystemPackId,
  attachArtifactDesignSystemAction
}: StudioDesignSystemPanelProps) {
  const selectedDesignSystem = designSystems.find(
    (pack) => pack.id === selectedDesignSystemPackId
  );
  const screenshotAssets =
    selectedDesignSystem?.provenance.filter(
      (entry) => entry.type === "screenshot" && typeof entry.assetId === "string"
    ) ?? [];

  return (
    <Surface className="project-card" as="section">
      <div>
        <h3>Design System</h3>
        <p className="footer-note">
          Attach one imported pack to ground the next generation pass. The current
          selection is stored on the artifact workspace.
        </p>
      </div>
      <div className="studio-status-row">
        <span className={selectedDesignSystem ? "status-pill success" : "status-pill"}>
          {selectedDesignSystem ? "Attached" : "Not attached"}
        </span>
        <span className="footer-note">
          {selectedDesignSystem
            ? `${selectedDesignSystem.name} · ${selectedDesignSystem.source}`
            : "Generation runs without imported pack grounding."}
        </span>
      </div>
      <form action={attachArtifactDesignSystemAction} className="stack-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="artifactId" value={artifactId} />
        <label className="field">
          <span>Selected Pack</span>
          <select
            name="designSystemPackId"
            defaultValue={selectedDesignSystemPackId ?? ""}
          >
            <option value="">No design-system grounding</option>
            {designSystems.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name} · {pack.source}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" type="submit">
          Save Design System
        </Button>
      </form>
      {selectedDesignSystem ? (
        <>
          <Surface className="kv">
            <span>Pack Evidence</span>
            {selectedDesignSystem.components.length} components ·{" "}
            {selectedDesignSystem.motifs.length} motifs ·{" "}
            {selectedDesignSystem.provenance.length} provenance records
          </Surface>
          {screenshotAssets.length > 0 ? (
            <div className="asset-preview-grid">
              {screenshotAssets.map((entry) => (
                <a
                  key={entry.id}
                  href={getDesignSystemAssetUrl(entry.assetId!)}
                  target="_blank"
                  rel="noreferrer"
                  className="asset-preview-card"
                >
                  <img
                    src={getDesignSystemAssetUrl(entry.assetId!)}
                    alt={entry.sourceRef}
                    className="asset-preview-image"
                  />
                  <span>{entry.sourceRef}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="footer-note">
              No persisted screenshot assets are attached to the selected pack yet.
            </p>
          )}
        </>
      ) : null}
    </Surface>
  );
}
