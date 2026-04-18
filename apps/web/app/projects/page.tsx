import Link from "next/link";
import { Badge, Surface } from "@opendesign/ui";

const projects = [
  {
    id: "atlas",
    name: "Atlas Commerce",
    summary: "Global storefront refresh with dynamic merchandising.",
    artifacts: [
      { id: "website", label: "Website" },
      { id: "prototype", label: "Prototype" }
    ]
  },
  {
    id: "signal",
    name: "Signal Deck",
    summary: "Series A storytelling kit with branded motion.",
    artifacts: [{ id: "slides", label: "Slides" }]
  },
  {
    id: "harbor",
    name: "Harbor Mobile",
    summary: "High-fidelity mobile banking prototype.",
    artifacts: [
      { id: "prototype", label: "Prototype" },
      { id: "website", label: "Website" }
    ]
  }
];

export default function ProjectsPage() {
  return (
    <main className="page">
      <section className="hero">
        <Badge tone="outline">Projects</Badge>
        <h1>Your OpenDesign artifacts.</h1>
        <p>
          Jump into an artifact to steer the canvas, update structure, and ship
          the latest version.
        </p>
        <div className="hero-actions">
          <Link href="/studio/atlas/website" className="button-link primary">
            Resume Latest
          </Link>
          <Link href="/" className="button-link ghost">
            Back to Landing
          </Link>
        </div>
      </section>

      <h2 className="section-title">Active Projects</h2>
      <div className="projects-grid">
        {projects.map((project) => (
          <Surface key={project.id} className="project-card" as="article">
            <div>
              <h3>{project.name}</h3>
              <p className="footer-note">{project.summary}</p>
            </div>
            <div className="project-meta">
              {project.artifacts.map((artifact) => (
                <Badge key={artifact.id} tone="outline">
                  {artifact.label}
                </Badge>
              ))}
            </div>
            <div className="hero-actions">
              {project.artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/studio/${project.id}/${artifact.id}`}
                  className="button-link ghost"
                >
                  Open {artifact.label}
                </Link>
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </main>
  );
}
