"use client";

import { Sandpack } from "@codesandbox/sandpack-react";
import type { SceneNode } from "@opendesign/contracts";

type ArtifactPreviewProps = {
  artifactKind: "website" | "prototype" | "slides";
  artifactName: string;
  prompt: string;
  sceneNodes: SceneNode[];
};

type PreviewSection = {
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

function buildPreviewSections({
  artifactKind,
  artifactName,
  prompt,
  sceneNodes
}: ArtifactPreviewProps): PreviewSection[] {
  const defaultHeroByKind = {
    website: "Design artifacts with a live bridge to code.",
    prototype: "Prototype flows without leaving the artifact workspace.",
    slides: "Turn design intent into a sharp narrative deck."
  } as const;

  const defaultEyebrowByKind = {
    website: "Launch Surface",
    prototype: "Flow Surface",
    slides: "Deck Surface"
  } as const;

  if (sceneNodes.length === 0) {
    return [
      {
        id: "seed-hero",
        template: "hero",
        name: "Seed Hero",
        eyebrow: defaultEyebrowByKind[artifactKind],
        headline: `${artifactName} is ready for the first scene section.`,
        body: prompt
      }
    ];
  }

  return sceneNodes.map((node) => {
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
            : defaultEyebrowByKind[artifactKind],
        headline:
          typeof props.headline === "string"
            ? props.headline
            : `${artifactName} leads with cinematic hierarchy.`,
        body: typeof props.body === "string" ? props.body : prompt
      };
    }

    if (template === "feature-grid") {
      const items = Array.isArray(props.items)
        ? props.items
            .filter((item): item is { label: string; body: string } => {
              return (
                typeof item === "object" &&
                item !== null &&
                typeof (item as { label?: unknown }).label === "string" &&
                typeof (item as { body?: unknown }).body === "string"
              );
            })
            .map((item) => ({
              label: item.label,
              body: item.body
            }))
        : [];

      return {
        id: node.id,
        template,
        name: node.name,
        title:
          typeof props.title === "string" ? props.title : `${artifactName} system lanes`,
        items
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
          typeof props.primaryAction === "string" ? props.primaryAction : "Create Snapshot",
        secondaryAction:
          typeof props.secondaryAction === "string" ? props.secondaryAction : "Export Handoff"
      };
    }

    return {
      id: node.id,
      template: "generic",
      name: node.name,
      headline: node.name,
      body: typeof props.body === "string" ? props.body : prompt
    };
  });
}

function buildAppCode(props: ArtifactPreviewProps) {
  const sections = JSON.stringify(buildPreviewSections(props));

  return `import "./styles.css";

export default function App() {
  const sections = ${sections};

  return (
    <main className="shell">
      <header className="masthead">
        <span className="label">${props.artifactName}</span>
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
            <section key={section.id} className="grid">
              {(section.items ?? []).map((item, index) => (
                <article
                  key={\`\${section.id}-\${index}\`}
                  className={index === 0 ? "panel featured" : "panel"}
                >
                  <span className="label">{item.label}</span>
                  <strong>{item.body}</strong>
                </article>
              ))}
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
.cta h2 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 3rem);
  line-height: 1;
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
