import type { SceneNode } from "@opendesign/contracts";

// ---------------------------------------------------------------------------
// Scaffold emitters (scene → code)
//
// SYNC-005 extends syncSceneToCodeWorkspace beyond website artifacts. The
// website path still piggybacks on @opendesign/exporters' buildArtifactSourceBundle
// because the whole scene sync payload (opendesign.sync.json) is authored
// there. Prototype and slides scenes, however, need App.tsx scaffolds whose
// literals round-trip cleanly through the code→scene parser in scaffolds.ts.
// To keep the round-trip contract symmetrical we own the emitter here — the
// parser and the emitter live next to each other and agree byte-for-byte on
// the typed vocabulary (`type: "screen" | "screen-link" | "screen-cta"` and
// `role: "slide-title" | "slide-content" | "slide-closing"`).
//
// The emitter is deliberately small and template-stable — it generates a
// fresh App.tsx every call so there is no diffing concern beyond string
// equality. The literal is produced with JSON.stringify(nodes, null, 2), so
// emitted files are deterministic for identical inputs.
// ---------------------------------------------------------------------------

export type PrototypeEmitResult =
  | { ok: true; files: Record<string, string>; droppedReasons: string[] }
  | { ok: false; reason: string };

export type SlidesEmitResult =
  | { ok: true; files: Record<string, string>; droppedReasons: string[] }
  | { ok: false; reason: string };

// Property bag shapes that we allow to serialize losslessly. Any other key
// on a node's `props` is rejected — the sync result then fails closed so we
// never emit half-baked code for node variants we cannot parse back.
const SCREEN_ALLOWED_PROPS = new Set(["headline", "body", "eyebrow"]);
const SCREEN_LINK_ALLOWED_PROPS = new Set(["from", "to", "trigger"]);
const SCREEN_CTA_ALLOWED_PROPS = new Set([
  "headline",
  "body",
  "primaryAction",
  "secondaryAction"
]);
const SLIDE_TITLE_ALLOWED_PROPS = new Set(["headline", "body", "eyebrow"]);
// `bullets` is validated separately (see buildSlidesScaffoldFiles) because
// it is the only non-string allowed prop; the string-only pickStringProps
// helper below would otherwise reject it as disallowed.
const SLIDE_CONTENT_ALLOWED_STRING_PROPS = new Set(["headline", "body"]);
const SLIDE_CLOSING_ALLOWED_PROPS = new Set(["headline", "body"]);

const SCREEN_LINK_TRIGGERS = new Set(["tap", "swipe", "auto"]);

function pickStringProps(
  props: Record<string, unknown>,
  allowed: Set<string>
): { values: Record<string, string>; disallowed: string[] } {
  const values: Record<string, string> = {};
  const disallowed: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (!allowed.has(key)) {
      disallowed.push(key);
      continue;
    }
    if (typeof value !== "string") {
      disallowed.push(key);
      continue;
    }
    values[key] = value;
  }

  return { values, disallowed };
}

// ---------------------------------------------------------------------------
// Prototype emitter
// ---------------------------------------------------------------------------

type ScreenLiteral =
  | {
      id: string;
      name: string;
      headline?: string;
      body?: string;
      eyebrow?: string;
    }
  | {
      type: "screen-link";
      id: string;
      name?: string;
      from: string;
      to: string;
      trigger?: "tap" | "swipe" | "auto";
    }
  | {
      type: "screen-cta";
      id: string;
      name?: string;
      headline?: string;
      body?: string;
      primaryAction?: string;
      secondaryAction?: string;
    };

export function buildPrototypeScaffoldFiles(input: {
  artifactName: string;
  sceneNodes: SceneNode[];
}): PrototypeEmitResult {
  const literals: ScreenLiteral[] = [];
  const droppedReasons: string[] = [];

  for (const node of input.sceneNodes) {
    if (node.children && node.children.length > 0) {
      return {
        ok: false,
        reason: `Prototype node "${node.id}" has children, which the code scaffold cannot serialize losslessly.`
      };
    }

    if (node.type === "screen") {
      const { values, disallowed } = pickStringProps(
        node.props,
        SCREEN_ALLOWED_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Prototype screen "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        id: node.id,
        name: node.name,
        ...(values.headline !== undefined ? { headline: values.headline } : {}),
        ...(values.body !== undefined ? { body: values.body } : {}),
        ...(values.eyebrow !== undefined ? { eyebrow: values.eyebrow } : {})
      });
      continue;
    }

    if (node.type === "screen-link") {
      const from = node.props.from;
      const to = node.props.to;
      if (typeof from !== "string" || typeof to !== "string") {
        return {
          ok: false,
          reason: `Prototype screen-link "${node.id}" requires string \`from\` and \`to\` props.`
        };
      }
      const trigger = node.props.trigger;
      if (
        trigger !== undefined &&
        (typeof trigger !== "string" || !SCREEN_LINK_TRIGGERS.has(trigger))
      ) {
        return {
          ok: false,
          reason: `Prototype screen-link "${node.id}" has unsupported trigger "${String(trigger)}"; expected "tap" | "swipe" | "auto".`
        };
      }
      const { disallowed } = pickStringProps(
        node.props,
        SCREEN_LINK_ALLOWED_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Prototype screen-link "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        type: "screen-link",
        id: node.id,
        ...(node.name ? { name: node.name } : {}),
        from,
        to,
        ...(trigger ? { trigger: trigger as "tap" | "swipe" | "auto" } : {})
      });
      continue;
    }

    if (node.type === "screen-cta") {
      const { values, disallowed } = pickStringProps(
        node.props,
        SCREEN_CTA_ALLOWED_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Prototype screen-cta "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        type: "screen-cta",
        id: node.id,
        ...(node.name ? { name: node.name } : {}),
        ...(values.headline !== undefined ? { headline: values.headline } : {}),
        ...(values.body !== undefined ? { body: values.body } : {}),
        ...(values.primaryAction !== undefined
          ? { primaryAction: values.primaryAction }
          : {}),
        ...(values.secondaryAction !== undefined
          ? { secondaryAction: values.secondaryAction }
          : {})
      });
      continue;
    }

    return {
      ok: false,
      reason: `Prototype node "${node.id}" has unsupported type "${node.type}"; expected "screen" | "screen-link" | "screen-cta".`
    };
  }

  const screensLiteral = JSON.stringify(literals, null, 2);
  const appCode = buildPrototypeAppTsx({
    artifactName: input.artifactName,
    screensLiteral
  });

  return {
    ok: true,
    files: buildBundleFiles({ artifactName: input.artifactName, appCode }),
    droppedReasons
  };
}

function buildPrototypeAppTsx(input: {
  artifactName: string;
  screensLiteral: string;
}) {
  return `import { useState } from "react";
import "./styles.css";

const screens = ${input.screensLiteral};

export default function App() {
  const navigableScreens = screens.filter((entry) => entry.type !== "screen-link");
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const activeScreen = navigableScreens[activeScreenIndex] ?? navigableScreens[0];
  const canGoBack = activeScreenIndex > 0;
  const canGoNext = activeScreenIndex < navigableScreens.length - 1;

  return (
    <main className="shell prototype-shell">
      <header className="masthead">
        <span className="label">${input.artifactName}</span>
        <strong>Prototype Flow · {navigableScreens.length} screen{navigableScreens.length === 1 ? "" : "s"}</strong>
      </header>

      <nav className="prototype-rail">
        {navigableScreens.map((screen, index) => (
          <button
            key={screen.id}
            type="button"
            className={index === activeScreenIndex ? "active" : undefined}
            onClick={() => setActiveScreenIndex(index)}
          >
            {index + 1}. {screen.name ?? screen.id}
          </button>
        ))}
      </nav>

      <section className="prototype-stage">
        {activeScreen ? (
          activeScreen.type === "screen-cta" ? (
            <section className="cta">
              <h2>{activeScreen.headline}</h2>
              <p>{activeScreen.body}</p>
              <div className="actions">
                {activeScreen.primaryAction ? (
                  <button>{activeScreen.primaryAction}</button>
                ) : null}
                {activeScreen.secondaryAction ? (
                  <button className="ghost">{activeScreen.secondaryAction}</button>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="hero">
              {activeScreen.eyebrow ? (
                <span className="eyebrow">{activeScreen.eyebrow}</span>
              ) : null}
              <h1>{activeScreen.headline}</h1>
              <p>{activeScreen.body}</p>
            </section>
          )
        ) : (
          <section className="panel generic">
            <strong>No screens yet.</strong>
          </section>
        )}
      </section>

      <footer className="actions prototype-nav">
        <button
          type="button"
          className="ghost"
          onClick={() => setActiveScreenIndex((current) => Math.max(current - 1, 0))}
          disabled={!canGoBack}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveScreenIndex((current) =>
              Math.min(current + 1, navigableScreens.length - 1)
            )
          }
          disabled={!canGoNext}
        >
          Next Screen
        </button>
      </footer>

      <aside className="prototype-links">
        <strong>Transitions</strong>
        <ul>
          {screens
            .filter((entry) => entry.type === "screen-link")
            .map((link) => (
              <li key={link.id}>
                {link.from} → {link.to}
                {link.trigger ? \` · \${link.trigger}\` : ""}
              </li>
            ))}
        </ul>
      </aside>
    </main>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Slides emitter
// ---------------------------------------------------------------------------

type SlideLiteral =
  | {
      id: string;
      role: "slide-title" | "slide-closing";
      name: string;
      headline?: string;
      body?: string;
      eyebrow?: string;
    }
  | {
      id: string;
      role: "slide-content";
      name: string;
      headline?: string;
      body?: string;
      bullets?: string[];
    };

export function buildSlidesScaffoldFiles(input: {
  artifactName: string;
  sceneNodes: SceneNode[];
}): SlidesEmitResult {
  const literals: SlideLiteral[] = [];
  const droppedReasons: string[] = [];

  for (const node of input.sceneNodes) {
    if (node.children && node.children.length > 0) {
      return {
        ok: false,
        reason: `Slide node "${node.id}" has children, which the code scaffold cannot serialize losslessly.`
      };
    }

    if (node.type === "slide-title") {
      const { values, disallowed } = pickStringProps(
        node.props,
        SLIDE_TITLE_ALLOWED_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Slide "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        id: node.id,
        role: "slide-title",
        name: node.name,
        ...(values.headline !== undefined ? { headline: values.headline } : {}),
        ...(values.body !== undefined ? { body: values.body } : {}),
        ...(values.eyebrow !== undefined ? { eyebrow: values.eyebrow } : {})
      });
      continue;
    }

    if (node.type === "slide-content") {
      const bulletsRaw = node.props.bullets;
      let bullets: string[] | undefined;
      if (bulletsRaw !== undefined) {
        if (
          !Array.isArray(bulletsRaw) ||
          !bulletsRaw.every((entry) => typeof entry === "string")
        ) {
          return {
            ok: false,
            reason: `Slide "${node.id}" has a non-string "bullets" array that the code scaffold cannot serialize losslessly.`
          };
        }
        bullets = bulletsRaw;
      }
      // Screen out bullets from the string-prop check — it's validated above.
      const propsWithoutBullets: Record<string, unknown> = { ...node.props };
      delete propsWithoutBullets.bullets;
      const { values, disallowed } = pickStringProps(
        propsWithoutBullets,
        SLIDE_CONTENT_ALLOWED_STRING_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Slide "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        id: node.id,
        role: "slide-content",
        name: node.name,
        ...(values.headline !== undefined ? { headline: values.headline } : {}),
        ...(values.body !== undefined ? { body: values.body } : {}),
        ...(bullets !== undefined && bullets.length > 0 ? { bullets } : {})
      });
      continue;
    }

    if (node.type === "slide-closing") {
      const { values, disallowed } = pickStringProps(
        node.props,
        SLIDE_CLOSING_ALLOWED_PROPS
      );
      if (disallowed.length > 0) {
        return {
          ok: false,
          reason: `Slide "${node.id}" has props (${disallowed.join(", ")}) that the code scaffold cannot serialize losslessly.`
        };
      }
      literals.push({
        id: node.id,
        role: "slide-closing",
        name: node.name,
        ...(values.headline !== undefined ? { headline: values.headline } : {}),
        ...(values.body !== undefined ? { body: values.body } : {})
      });
      continue;
    }

    return {
      ok: false,
      reason: `Slide node "${node.id}" has unsupported type "${node.type}"; expected "slide-title" | "slide-content" | "slide-closing".`
    };
  }

  const slidesLiteral = JSON.stringify(literals, null, 2);
  const appCode = buildSlidesAppTsx({
    artifactName: input.artifactName,
    slidesLiteral
  });

  return {
    ok: true,
    files: buildBundleFiles({ artifactName: input.artifactName, appCode }),
    droppedReasons
  };
}

function buildSlidesAppTsx(input: {
  artifactName: string;
  slidesLiteral: string;
}) {
  return `import { useState } from "react";
import "./styles.css";

const slides = ${input.slidesLiteral};

export default function App() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] ?? slides[0];
  const canGoBack = activeSlideIndex > 0;
  const canGoNext = activeSlideIndex < slides.length - 1;

  return (
    <main className="shell slides-shell">
      <header className="masthead">
        <span className="label">${input.artifactName}</span>
        <strong>Slides Deck · {slides.length} slide{slides.length === 1 ? "" : "s"}</strong>
      </header>

      <nav className="slides-rail">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={index === activeSlideIndex ? "active" : undefined}
            onClick={() => setActiveSlideIndex(index)}
          >
            {index + 1}. {slide.name}
          </button>
        ))}
      </nav>

      <section className="slides-canvas">
        {activeSlide ? (
          <article className="slides-card">
            <span className="eyebrow">
              Slide {activeSlideIndex + 1} of {slides.length} · {activeSlide.role}
            </span>
            {activeSlide.headline ? <h1>{activeSlide.headline}</h1> : null}
            {activeSlide.body ? <p>{activeSlide.body}</p> : null}
            {activeSlide.role === "slide-content" && Array.isArray(activeSlide.bullets) ? (
              <ul>
                {activeSlide.bullets.map((bullet, index) => (
                  <li key={\`\${activeSlide.id}-\${index}\`}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : (
          <article className="slides-card">
            <strong>No slides yet.</strong>
          </article>
        )}
      </section>

      <footer className="actions slides-nav">
        <button
          type="button"
          className="ghost"
          onClick={() => setActiveSlideIndex((current) => Math.max(current - 1, 0))}
          disabled={!canGoBack}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveSlideIndex((current) =>
              Math.min(current + 1, slides.length - 1)
            )
          }
          disabled={!canGoNext}
        >
          Next Slide
        </button>
      </footer>
    </main>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Bundle scaffolding — the companion files (index.html, main.tsx, styles.css,
// etc.) mirror the website bundle so preview/run workflows do not regress.
// ---------------------------------------------------------------------------

function buildBundleFiles(input: {
  artifactName: string;
  appCode: string;
}): Record<string, string> {
  const safeName = toSafeFilenameBase(input.artifactName);

  return {
    "/package.json": JSON.stringify(
      {
        name: safeName,
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview"
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        },
        devDependencies: {
          "@types/react": "^18.3.0",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.4",
          typescript: "^4.9.5",
          vite: "4.2.0",
          "esbuild-wasm": "^0.17.12"
        }
      },
      null,
      2
    ),
    "/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${input.artifactName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`,
    "/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    "/App.tsx": input.appCode,
    "/styles.css": SCAFFOLD_STYLES
  };
}

function toSafeFilenameBase(value: string) {
  const trimmed = value.trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "opendesign-artifact";
}

// Deliberately minimal — presentation parity is not required for the
// round-trip contract, but the file must exist so the scaffold boots cleanly.
const SCAFFOLD_STYLES = `:root {
  color-scheme: light;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #0f172a;
  background: #f8fafc;
}
body {
  margin: 0;
  padding: 24px;
}
.shell {
  display: grid;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
}
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.eyebrow,
.label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: #0f766e;
}
h1,
h2 {
  margin: 0;
}
p {
  margin: 0;
  line-height: 1.6;
  color: rgba(17, 24, 39, 0.75);
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
button {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  background: #111827;
  color: #f8fafc;
  font: inherit;
}
button.ghost {
  background: rgba(17, 24, 39, 0.08);
  color: #111827;
}
.prototype-rail,
.slides-rail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.prototype-rail button.active,
.slides-rail button.active {
  outline: 2px solid #0f766e;
}
.prototype-stage,
.slides-canvas {
  padding: 24px;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 16px;
}
.prototype-links {
  padding: 16px;
  border-radius: 16px;
  background: rgba(15, 118, 110, 0.08);
}
.prototype-links ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.slides-card {
  display: grid;
  gap: 12px;
}
`;
