import { Button, Surface } from "@opendesign/ui";
import type { ApiArtifactVersion, ApiArtifactVersionDiff } from "../lib/opendesign-api";

type StudioVersionsPanelProps = {
  projectId: string;
  artifactId: string;
  activeVersionId: string | null;
  versions: ApiArtifactVersion[];
  versionDiffById: Record<string, ApiArtifactVersionDiff | null>;
  createArtifactVersionAction: (formData: FormData) => Promise<void>;
  restoreArtifactVersionAction: (formData: FormData) => Promise<void>;
};

export function StudioVersionsPanel({
  projectId,
  artifactId,
  activeVersionId,
  versions,
  versionDiffById,
  createArtifactVersionAction,
  restoreArtifactVersionAction
}: StudioVersionsPanelProps) {
  return (
    <>
      <Surface className="project-card" as="section">
        <div>
          <h3>Create Snapshot</h3>
          <p className="footer-note">
            Capture the current scene and saved code workspace as a named version.
          </p>
        </div>
        <form action={createArtifactVersionAction} className="stack-form">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="artifactId" value={artifactId} />
          <label className="field">
            <span>Label</span>
            <input name="label" placeholder="V2 Review" required />
          </label>
          <label className="field">
            <span>Summary</span>
            <input name="summary" placeholder="Review-ready snapshot for export." />
          </label>
          <Button variant="primary" type="submit">
            Save Snapshot
          </Button>
        </form>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Version History</h3>
          <p className="footer-note">
            Newest snapshots stay at the top. Restore rewinds scene and saved code
            workspace together.
          </p>
        </div>
        <div className="stack-form">
          {versions.map((version) => {
            const diffSummary = versionDiffById[version.id];

            return (
              <Surface key={version.id} className="kv">
                <span>
                  {version.label}
                  {version.id === activeVersionId ? " · active" : ""}
                </span>
                {version.summary}
                <span className="footer-note">
                  Scene v{version.sceneVersion} ·{" "}
                  {version.hasCodeWorkspaceSnapshot ? "Code Snapshot" : "Scene Only"}
                </span>
                {diffSummary ? (
                  <div className="version-diff-grid">
                    <div className="version-diff-card">
                      <strong>Scene Diff</strong>
                      <span>
                        +{diffSummary.scene.addedNodeCount} / -
                        {diffSummary.scene.removedNodeCount} / ~
                        {diffSummary.scene.changedNodeCount}
                      </span>
                    </div>
                    <div className="version-diff-card">
                      <strong>Code Diff</strong>
                      <span>
                        {diffSummary.code.changedFileCount} file
                        {diffSummary.code.changedFileCount === 1 ? "" : "s"} changed
                      </span>
                    </div>
                  </div>
                ) : null}
                {version.id !== activeVersionId ? (
                  <form action={restoreArtifactVersionAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="artifactId" value={artifactId} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      Restore Version
                    </Button>
                  </form>
                ) : null}
              </Surface>
            );
          })}
        </div>
      </Surface>
    </>
  );
}
