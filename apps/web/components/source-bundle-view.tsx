import { Surface } from "@opendesign/ui";

type SourceBundleViewProps = {
  files: Record<string, string>;
};

export function SourceBundleView({ files }: SourceBundleViewProps) {
  return (
    <div className="source-bundle-stack">
      {Object.entries(files).map(([filePath, content]) => (
        <Surface key={filePath} className="project-card code-surface" as="section">
          <div className="code-file-head">
            <strong>{filePath.replace(/^\//, "")}</strong>
            <span>{content.split("\n").length} lines</span>
          </div>
          <pre className="code-pane">
            <code>{content}</code>
          </pre>
        </Surface>
      ))}
    </div>
  );
}
