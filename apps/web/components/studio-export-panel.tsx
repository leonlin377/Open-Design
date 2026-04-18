import Link from "next/link";
import { Surface } from "@opendesign/ui";

type StudioExportPanelProps = {
  projectId: string;
  artifactId: string;
  sourceBundleFiles: Record<string, string>;
};

export function StudioExportPanel({
  projectId,
  artifactId,
  sourceBundleFiles
}: StudioExportPanelProps) {
  return (
    <>
      <Surface className="project-card" as="section">
        <div>
          <h3>Export Surface</h3>
          <p className="footer-note">
            Download a runnable source scaffold or a standalone HTML render. ZIP follows
            the saved code workspace when present; HTML stays scene-based.
          </p>
        </div>
        <div className="artifact-action-grid">
          <Link
            href={`/studio/${projectId}/${artifactId}/export/source-bundle`}
            className="button-link ghost"
          >
            Download ZIP
          </Link>
          <Link
            href={`/studio/${projectId}/${artifactId}/export/html`}
            className="button-link primary"
          >
            Download HTML
          </Link>
        </div>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Bundle Manifest</h3>
          <p className="footer-note">
            Current scaffold is generated directly from the live scene document.
          </p>
        </div>
        <div className="stack-form">
          {Object.entries(sourceBundleFiles).map(([filePath, content]) => (
            <Surface key={filePath} className="kv">
              <span>{filePath}</span>
              {content.split("\n").length} lines
            </Surface>
          ))}
        </div>
      </Surface>
    </>
  );
}
