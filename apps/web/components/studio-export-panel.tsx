import Link from "next/link";
import { Surface } from "@opendesign/ui";
import type { ApiArtifact } from "../lib/opendesign-api";

type StudioExportPanelProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  sourceBundleFiles: Record<string, string>;
};

export function StudioExportPanel({
  projectId,
  artifactId,
  artifactKind,
  sourceBundleFiles
}: StudioExportPanelProps) {
  return (
    <>
      <Surface className="project-card" as="section">
        <div>
          <h3>Export Surface</h3>
          <p className="footer-note">
            Download a handoff bundle, runnable source scaffold, or standalone HTML
            render. ZIP follows the saved code workspace when present; HTML stays
            scene-based.
          </p>
        </div>
        <div className="artifact-action-grid">
          <Link
            href={`/studio/${projectId}/${artifactId}/export/handoff-bundle`}
            className="button-link ghost"
          >
            Download Handoff ZIP
          </Link>
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
          {artifactKind === "prototype" ? (
            <Link
              href={`/studio/${projectId}/${artifactId}/export/prototype-flow`}
              className="button-link ghost"
            >
              Download Flow JSON
            </Link>
          ) : null}
          {artifactKind === "slides" ? (
            <Link
              href={`/studio/${projectId}/${artifactId}/export/slides-deck`}
              className="button-link ghost"
            >
              Download Deck JSON
            </Link>
          ) : null}
        </div>
      </Surface>
      <Surface className="project-card" as="section">
        <div>
          <h3>Bundle Manifest</h3>
          <p className="footer-note">
            Handoff ZIP packages workspace metadata, comments, versions, and exports;
            the source scaffold below is generated directly from the current workspace.
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
