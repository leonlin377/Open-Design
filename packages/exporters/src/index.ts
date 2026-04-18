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

function renderSceneNode(node: SceneNode) {
  const template =
    typeof node.props.template === "string" ? node.props.template : node.type;

  if (template === "hero") {
    const eyebrow =
      typeof node.props.eyebrow === "string" ? node.props.eyebrow : "Launch Surface";
    const headline =
      typeof node.props.headline === "string" ? node.props.headline : node.name;
    const body =
      typeof node.props.body === "string"
        ? node.props.body
        : "OpenDesign scene section";

    return `<section class="hero">
  <span class="eyebrow">${escapeHtml(eyebrow)}</span>
  <h1>${escapeHtml(headline)}</h1>
  <p>${escapeHtml(body)}</p>
</section>`;
  }

  if (template === "feature-grid") {
    const title =
      typeof node.props.title === "string" ? node.props.title : node.name;
    const items = readFeatureItems(node);
    const renderedItems = items
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
    <h2>${escapeHtml(title)}</h2>
  </div>
  <div class="grid">${renderedItems}</div>
</section>`;
  }

  if (template === "cta") {
    const headline =
      typeof node.props.headline === "string"
        ? node.props.headline
        : "Ready for the next review pass?";
    const body =
      typeof node.props.body === "string"
        ? node.props.body
        : "Promote the artifact into a snapshot and push it toward export.";
    const primaryAction =
      typeof node.props.primaryAction === "string"
        ? node.props.primaryAction
        : "Create Snapshot";
    const secondaryAction =
      typeof node.props.secondaryAction === "string"
        ? node.props.secondaryAction
        : "Export Handoff";

    return `<section class="cta">
  <div class="cta-copy">
    <span class="eyebrow">Action Lane</span>
    <h2>${escapeHtml(headline)}</h2>
    <p>${escapeHtml(body)}</p>
  </div>
  <div class="actions">
    <button>${escapeHtml(primaryAction)}</button>
    <button class="ghost">${escapeHtml(secondaryAction)}</button>
  </div>
</section>`;
  }

  const body =
    typeof node.props.body === "string" ? node.props.body : "OpenDesign section";

  return `<section class="panel generic">
  <span class="label">${escapeHtml(node.name)}</span>
  <strong>${escapeHtml(node.name)}</strong>
  <p>${escapeHtml(body)}</p>
</section>`;
}

export const buildArtifactHtmlExport = (input: {
  artifactName: string;
  sceneDocument: SceneDocument;
}): HtmlExportBundle => {
  const nodes = input.sceneDocument.nodes.map(renderSceneNode).join("\n");
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
      :root {
        color-scheme: light;
        font-family: "Avenir Next", "Trebuchet MS", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.16), transparent 26%),
          linear-gradient(180deg, #fbf5e8 0%, #efe6d7 100%);
        color: #111827;
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: #efe6d7; }
      main {
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
      h1, h2 { margin: 0; line-height: 1.02; }
      h1 {
        font-size: clamp(2.1rem, 5vw, 4rem);
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }
      h2 { font-size: clamp(1.8rem, 4vw, 3rem); }
      p { margin: 0; line-height: 1.6; color: rgba(17, 24, 39, 0.75); }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: #111827;
        color: #f8fafc;
        font: inherit;
      }
      button.ghost { background: rgba(17, 24, 39, 0.08); color: #111827; }
      .feature-grid-shell, .feature-grid-copy { display: grid; gap: 12px; }
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
      .featured .label { color: rgba(255, 255, 255, 0.68); }
      .panel strong { font-size: 1.1rem; line-height: 1.5; }
      .cta {
        border-radius: 24px;
        border: 1px solid rgba(17, 24, 39, 0.1);
        background: linear-gradient(135deg, #f1ebe0, #e4d7bf);
        padding: 24px 28px;
        display: grid;
        gap: 16px;
      }
      .cta-copy { display: grid; gap: 10px; }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr; }
        .masthead { flex-direction: column; align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="masthead">
        <span class="label">${escapeHtml(input.artifactName)}</span>
        <strong>${input.sceneDocument.nodes.length} live section${
          input.sceneDocument.nodes.length === 1 ? "" : "s"
        }</strong>
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
