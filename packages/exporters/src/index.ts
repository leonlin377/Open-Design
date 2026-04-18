import type { ArtifactKind, SceneDocument, SceneNode } from "@opendesign/contracts";

export type ExportArtifact = {
  id: string;
  kind: ArtifactKind;
  label: string;
  updatedAt: string;
  sizeBytes?: number;
};

export type ExportJob = {
  id: string;
  requestedAt: string;
  artifacts: ExportArtifact[];
  requestedBy?: string;
};

export type HandoffManifestSummary = {
  artifactCount: number;
  byKind: Record<ArtifactKind, number>;
  latestUpdatedAt: string | null;
  totalBytes: number;
};

export const buildHandoffManifestSummary = (
  artifacts: ExportArtifact[]
): HandoffManifestSummary => {
  const byKind: HandoffManifestSummary["byKind"] = {
    website: 0,
    prototype: 0,
    slides: 0
  };
  let latestUpdatedAt: string | null = null;
  let latestTimestamp = -Infinity;
  let totalBytes = 0;

  for (const artifact of artifacts) {
    byKind[artifact.kind] += 1;
    if (typeof artifact.sizeBytes === "number") {
      totalBytes += artifact.sizeBytes;
    }

    const timestamp = Date.parse(artifact.updatedAt);
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestUpdatedAt = artifact.updatedAt;
    }
  }

  return {
    artifactCount: artifacts.length,
    byKind,
    latestUpdatedAt,
    totalBytes
  };
};

export type HtmlExportBundle = {
  filename: string;
  html: string;
};

export type SourceBundleFileMap = Record<string, string>;

export type SourceExportBundle = {
  filenameBase: string;
  files: SourceBundleFileMap;
};

type RenderableSection = {
  id: string;
  template: string;
  name: string;
  eyebrow?: string;
  headline?: string;
  body?: string;
  title?: string;
  items?: Array<{
    label: string;
    body: string;
  }>;
  primaryAction?: string;
  secondaryAction?: string;
};

const DEFAULT_FEATURE_GRID_ITEMS = [
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

export const ARTIFACT_SOURCE_STYLES = `:root {
  color-scheme: light;
  font-family: "Avenir Next", "Trebuchet MS", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 26%),
    linear-gradient(180deg, #fbf5e8 0%, #efe6d7 100%);
  color: #111827;
}

* { box-sizing: border-box; }
body { margin: 0; }
.shell {
  min-height: 100vh;
  padding: 32px;
  display: grid;
  gap: 22px;
}
.masthead {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.hero, .panel {
  border-radius: 24px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: rgba(255, 251, 245, 0.9);
  box-shadow: 0 24px 60px rgba(17, 24, 39, 0.12);
}
.hero {
  padding: 28px;
  display: grid;
  gap: 14px;
}
.eyebrow, .label {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 12px;
  color: #0f766e;
}
h1, h2 {
  margin: 0;
  line-height: 1.02;
}
h1 {
  font-size: clamp(2.1rem, 5vw, 4rem);
  font-family: "Iowan Old Style", "Palatino Linotype", serif;
}
h2 {
  font-size: clamp(1.8rem, 4vw, 3rem);
}
p {
  margin: 0;
  line-height: 1.6;
  color: rgba(17, 24, 39, 0.75);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: #111827;
  color: #f8fafc;
  font: inherit;
}
button.ghost {
  background: rgba(17, 24, 39, 0.08);
  color: #111827;
}
.feature-grid-shell, .feature-grid-copy {
  display: grid;
  gap: 12px;
}
.feature-grid-copy h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1.05;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.panel {
  min-height: 180px;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 10px;
}
.featured {
  background: linear-gradient(180deg, #10231f, #18352f);
  color: #f8fafc;
}
.featured .label {
  color: rgba(255, 255, 255, 0.68);
}
.panel strong {
  font-size: 1.1rem;
  line-height: 1.5;
}
.cta {
  border-radius: 24px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: linear-gradient(135deg, #f1ebe0, #e4d7bf);
  padding: 24px 28px;
  display: grid;
  gap: 16px;
}
.cta-copy {
  display: grid;
  gap: 10px;
}
.generic p {
  margin-top: 6px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .masthead {
    flex-direction: column;
    align-items: flex-start;
  }
}`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readFeatureItems(node: SceneNode) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];

  return items.filter(
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

export const buildRenderableSections = (input: {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  sceneNodes: SceneNode[];
}): RenderableSection[] => {
  const defaultEyebrowByKind = {
    website: "Launch Surface",
    prototype: "Flow Surface",
    slides: "Deck Surface"
  } as const;

  if (input.sceneNodes.length === 0) {
    return [
      {
        id: "seed-hero",
        template: "hero",
        name: "Seed Hero",
        eyebrow: defaultEyebrowByKind[input.artifactKind],
        headline: `${input.artifactName} is ready for the first scene section.`,
        body: input.prompt
      }
    ];
  }

  return input.sceneNodes.map((node) => {
    const props = node.props as Record<string, unknown>;
    const template = typeof props.template === "string" ? props.template : node.type;

    if (template === "hero") {
      return {
        id: node.id,
        template,
        name: node.name,
        eyebrow:
          typeof props.eyebrow === "string"
            ? props.eyebrow
            : defaultEyebrowByKind[input.artifactKind],
        headline:
          typeof props.headline === "string"
            ? props.headline
            : `${input.artifactName} leads with cinematic hierarchy.`,
        body: typeof props.body === "string" ? props.body : input.prompt
      };
    }

    if (template === "feature-grid") {
      const items = readFeatureItems(node);

      return {
        id: node.id,
        template,
        name: node.name,
        title:
          typeof props.title === "string"
            ? props.title
            : `${input.artifactName} system lanes`,
        items: items.length > 0 ? items : DEFAULT_FEATURE_GRID_ITEMS
      };
    }

    if (template === "cta") {
      return {
        id: node.id,
        template,
        name: node.name,
        headline:
          typeof props.headline === "string"
            ? props.headline
            : "Ready for the next review pass?",
        body:
          typeof props.body === "string"
            ? props.body
            : "Promote the artifact into a snapshot and push it toward export.",
        primaryAction:
          typeof props.primaryAction === "string"
            ? props.primaryAction
            : "Create Snapshot",
        secondaryAction:
          typeof props.secondaryAction === "string"
            ? props.secondaryAction
            : "Export Handoff"
      };
    }

    return {
      id: node.id,
      template: "generic",
      name: node.name,
      headline: node.name,
      body: typeof props.body === "string" ? props.body : input.prompt
    };
  });
};

export const buildArtifactSourceBundle = (input: {
  artifactKind: ArtifactKind;
  artifactName: string;
  prompt: string;
  sceneNodes: SceneNode[];
}): SourceExportBundle => {
  const safeName = input.artifactName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filenameBase = safeName || "artifact";
  const sections = JSON.stringify(buildRenderableSections(input));

  const appCode = `import "./styles.css";

export default function App() {
  const sections = ${sections};

  return (
    <main className="shell">
      <header className="masthead">
        <span className="label">${input.artifactName}</span>
        <strong>{sections.length} live section{sections.length === 1 ? "" : "s"}</strong>
      </header>

      {sections.map((section) => {
        if (section.template === "hero") {
          return (
            <section key={section.id} className="hero">
              <span className="eyebrow">{section.eyebrow}</span>
              <h1>{section.headline}</h1>
              <p>{section.body}</p>
              <div className="actions">
                <button>Refine artifact</button>
                <button className="ghost">Export handoff</button>
              </div>
            </section>
          );
        }

        if (section.template === "feature-grid") {
          return (
            <section key={section.id} className="feature-grid-shell">
              <div className="feature-grid-copy">
                <span className="eyebrow">System Grid</span>
                <h2>{section.title}</h2>
              </div>
              <div className="grid">
                {(section.items ?? []).map((item, index) => (
                  <article
                    key={\`\${section.id}-\${index}\`}
                    className={index === 0 ? "panel featured" : "panel"}
                  >
                    <span className="label">{item.label}</span>
                    <strong>{item.body}</strong>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.template === "cta") {
          return (
            <section key={section.id} className="cta">
              <div className="cta-copy">
                <span className="eyebrow">Action Lane</span>
                <h2>{section.headline}</h2>
                <p>{section.body}</p>
              </div>
              <div className="actions">
                <button>{section.primaryAction}</button>
                <button className="ghost">{section.secondaryAction}</button>
              </div>
            </section>
          );
        }

        return (
          <section key={section.id} className="panel generic">
            <span className="label">{section.name}</span>
            <strong>{section.headline}</strong>
            <p>{section.body}</p>
          </section>
        );
      })}
    </main>
  );
}`;

  return {
    filenameBase,
    files: {
      "/App.tsx": appCode,
      "/styles.css": ARTIFACT_SOURCE_STYLES
    }
  };
};

function renderHtmlSection(section: RenderableSection) {
  if (section.template === "hero") {
    return `<section class="hero">
  <span class="eyebrow">${escapeHtml(section.eyebrow ?? "Launch Surface")}</span>
  <h1>${escapeHtml(section.headline ?? section.name)}</h1>
  <p>${escapeHtml(section.body ?? "OpenDesign scene section")}</p>
  <div class="actions">
    <button>Refine artifact</button>
    <button class="ghost">Export handoff</button>
  </div>
</section>`;
  }

  if (section.template === "feature-grid") {
    const renderedItems = (section.items ?? DEFAULT_FEATURE_GRID_ITEMS)
      .map(
        (item, index) => `<article class="panel${index === 0 ? " featured" : ""}">
  <span class="label">${escapeHtml(item.label)}</span>
  <strong>${escapeHtml(item.body)}</strong>
</article>`
      )
      .join("");

    return `<section class="feature-grid-shell">
  <div class="feature-grid-copy">
    <span class="eyebrow">System Grid</span>
    <h2>${escapeHtml(section.title ?? section.name)}</h2>
  </div>
  <div class="grid">${renderedItems}</div>
</section>`;
  }

  if (section.template === "cta") {
    return `<section class="cta">
  <div class="cta-copy">
    <span class="eyebrow">Action Lane</span>
    <h2>${escapeHtml(section.headline ?? "Ready for the next review pass?")}</h2>
    <p>${escapeHtml(
      section.body ?? "Promote the artifact into a snapshot and push it toward export."
    )}</p>
  </div>
  <div class="actions">
    <button>${escapeHtml(section.primaryAction ?? "Create Snapshot")}</button>
    <button class="ghost">${escapeHtml(section.secondaryAction ?? "Export Handoff")}</button>
  </div>
</section>`;
  }

  return `<section class="panel generic">
  <span class="label">${escapeHtml(section.name)}</span>
  <strong>${escapeHtml(section.headline ?? section.name)}</strong>
  <p>${escapeHtml(section.body ?? "OpenDesign section")}</p>
</section>`;
}

export const buildArtifactHtmlExport = (input: {
  artifactName: string;
  sceneDocument: SceneDocument;
  prompt?: string;
}): HtmlExportBundle => {
  const sections = buildRenderableSections({
    artifactKind: input.sceneDocument.kind,
    artifactName: input.artifactName,
    prompt: input.prompt ?? "OpenDesign artifact workspace",
    sceneNodes: input.sceneDocument.nodes
  });
  const nodes = sections.map(renderHtmlSection).join("\n");
  const safeName = input.artifactName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${safeName || "artifact"}.html`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.artifactName)}</title>
    <style>
      ${ARTIFACT_SOURCE_STYLES}
      body { background: #efe6d7; }
    </style>
  </head>
  <body>
    <main>
      <header class="masthead">
        <span class="label">${escapeHtml(input.artifactName)}</span>
        <strong>${sections.length} live section${sections.length === 1 ? "" : "s"}</strong>
      </header>
      ${nodes}
    </main>
  </body>
</html>`;

  return {
    filename,
    html
  };
};
