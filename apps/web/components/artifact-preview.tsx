"use client";

import { Sandpack } from "@codesandbox/sandpack-react";

type ArtifactPreviewProps = {
  artifactKind: "website" | "prototype" | "slides";
  artifactName: string;
  prompt: string;
};

function buildAppCode({ artifactKind, artifactName, prompt }: ArtifactPreviewProps) {
  const headlineByKind = {
    website: "Design artifacts with a live bridge to code.",
    prototype: "Prototype flows without leaving the artifact workspace.",
    slides: "Turn design intent into a sharp narrative deck."
  } as const;

  const eyebrowByKind = {
    website: "Launch Surface",
    prototype: "Flow Surface",
    slides: "Deck Surface"
  } as const;

  return `import "./styles.css";

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">${eyebrowByKind[artifactKind]}</span>
        <h1>${headlineByKind[artifactKind]}</h1>
        <p>${prompt.replace(/"/g, '\\"')}</p>
        <div className="actions">
          <button>Refine artifact</button>
          <button className="ghost">Export handoff</button>
        </div>
      </section>

      <section className="grid">
        <article className="panel featured">
          <span className="label">${artifactName}</span>
          <strong>Scene and code stay aligned while the artifact evolves.</strong>
        </article>
        <article className="panel">
          <span className="label">Design system</span>
          <strong>Brand rhythm, typography, and layout motifs are reused automatically.</strong>
        </article>
        <article className="panel">
          <span className="label">Export</span>
          <strong>HTML, ZIP, PDF, and handoff bundles are generated from the same source of truth.</strong>
        </article>
      </section>
    </main>
  );
}`;
}

const stylesCode = `:root {
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
h1 {
  margin: 0;
  font-size: clamp(2.1rem, 5vw, 4rem);
  line-height: 0.98;
  font-family: "Iowan Old Style", "Palatino Linotype", serif;
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
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}`;

export function ArtifactPreview(props: ArtifactPreviewProps) {
  return (
    <div
      style={{
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(42, 49, 66, 0.8)"
      }}
    >
      <Sandpack
        template="react-ts"
        files={{
          "/App.tsx": buildAppCode(props),
          "/styles.css": stylesCode
        }}
        options={{
          showTabs: true,
          showLineNumbers: true,
          showNavigator: false,
          editorHeight: 520,
          editorWidthPercentage: 58,
          resizablePanels: true
        }}
      />
    </div>
  );
}
