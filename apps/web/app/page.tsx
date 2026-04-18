import Link from "next/link";
import { Badge, Surface } from "@opendesign/ui";

const artifacts = ["Website", "Prototype", "Slides"];

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <Badge>OpenDesign Studio</Badge>
        <h1>Artifact-first AI workspace for shipping visual systems.</h1>
        <p>
          OpenDesign keeps the artifact at the center. Chat drives intent, the
          canvas commits decisions, and the inspector turns every stroke into
          reusable structure.
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="button-link primary">
            Enter Studio
          </Link>
          <Link href="/projects" className="button-link ghost">
            Open Live Projects
          </Link>
        </div>
        <div className="project-meta">
          {artifacts.map((artifact) => (
            <Badge key={artifact} tone="outline">
              {artifact}
            </Badge>
          ))}
        </div>
      </section>

      <h2 className="section-title">Why OpenDesign</h2>
      <div className="feature-grid">
        <Surface as="article" className="feature-card">
          <h3>Artifact-First</h3>
          <p>
            Every interaction resolves into a tangible artifact. The canvas is
            the source of truth, not the chat log.
          </p>
        </Surface>
        <Surface as="article" className="feature-card">
          <h3>Triple Focus</h3>
          <p>
            Navigate fluidly between intent, structure, and delivery. Chat,
            canvas, and inspector stay visible at all times.
          </p>
        </Surface>
        <Surface as="article" className="feature-card">
          <h3>Versioned Output</h3>
          <p>
            Track every iteration with version lanes that tie design decisions
            to deployable assets.
          </p>
        </Surface>
      </div>
    </main>
  );
}
