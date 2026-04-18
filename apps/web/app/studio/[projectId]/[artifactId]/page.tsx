import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { ArtifactPreview } from "../../../../components/artifact-preview";
import { getSession, listArtifacts, listProjects } from "../../../../lib/opendesign-api";

const artifactLabels: Record<string, string> = {
  website: "Website",
  prototype: "Prototype",
  slides: "Slides"
};

type StudioPageProps = {
  params: {
    projectId: string;
    artifactId: string;
  };
};

export default async function StudioPage({ params }: StudioPageProps) {
  const [session, projects] = await Promise.all([getSession(), listProjects()]);
  const project = projects.find((entry) => entry.id === params.projectId) ?? null;
  const artifacts = project ? await listArtifacts(project.id) : [];
  const artifact = artifacts.find((entry) => entry.id === params.artifactId) ?? null;

  if (!project || !artifact) {
    return (
      <main className="page">
        <section className="hero">
          <Badge tone="outline">Studio</Badge>
          <h1>Artifact not found.</h1>
          <p>
            The requested project or artifact is not available in the current workspace
            snapshot. Return to projects and create a new artifact.
          </p>
          <div className="hero-actions">
            <Link href="/projects" className="button-link primary">
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const projectLabel = project.name;
  const artifactKind = artifact.kind;
  const artifactLabel = artifactLabels[artifactKind] ?? "Artifact";

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="studio-title">
          <h2>{projectLabel}</h2>
          <span>
            {artifactLabel} · Studio
            {session?.user.email ? ` · ${session.user.email}` : ""}
          </span>
        </div>
        <div className="hero-actions">
          <Link href="/projects" className="button-link ghost">
            All Projects
          </Link>
          <Button variant="primary">Publish Artifact</Button>
        </div>
      </header>

      <section className="studio-grid">
        <aside className="rail">
          <Badge tone="outline">Chat Rail</Badge>
          <div className="chat-thread">
            <div className="chat-bubble user">
              Build a cinematic hero for the {artifactLabel.toLowerCase()} with
              layered typography and a punchy tagline.
            </div>
            <div className="chat-bubble">
              Drafted three hero systems. Option B aligns with the current brand
              grids. Want it anchored to the left rail or centered?
            </div>
            <div className="chat-bubble user">
              Left rail, emphasize the artifact strip.
            </div>
          </div>
          <Surface className="kv">
            <span>Intent</span>
            Create a bold hero with layered typography, metallic accents, and a
            persistent artifact strip.
          </Surface>
          <Surface className="kv">
            <span>Artifact Record</span>
            {artifact.name}
          </Surface>
        </aside>

        <section className="canvas-panel">
          <div className="hero-actions">
            <Badge tone="outline">Canvas</Badge>
            <Badge>{artifactLabel}</Badge>
          </div>
          <div className="canvas-stage">
            <div>
              <h3>Artifact Canvas</h3>
              <p>Frame · Layout · Type hierarchy · Motion cues</p>
            </div>
          </div>
          <div className="project-meta">
            <span>Grid: 12 columns</span>
            <span>Surface: 1440 x 900</span>
            <span>Theme: Nocturne</span>
          </div>
        </section>

        <aside className="inspector">
          <div className="tab-row">
            <button className="tab active" type="button">
              Preview
            </button>
            <button className="tab" type="button">
              Code
            </button>
            <button className="tab" type="button">
              Inspector
            </button>
            <button className="tab" type="button">
              Versions
            </button>
            <button className="tab" type="button">
              Export
            </button>
          </div>

          <div className="inspector-section">
            <div className="footer-note">Preview powered by Sandpack</div>
            <ArtifactPreview
              artifactKind={artifactKind}
              artifactName={`${projectLabel} ${artifactLabel}`}
              prompt={`Build a cinematic ${artifactLabel.toLowerCase()} for ${projectLabel} with layered typography, intentional spacing, and a clear export path.`}
            />
            <Surface className="kv">
              <span>Active Frame</span>
              Hero · Layered Type · Variant B
            </Surface>
            <Surface className="kv">
              <span>Preview Target</span>
              Safari · 1280 px · Live data snapshot
            </Surface>
            <Surface className="kv">
              <span>Version Lane</span>
              V03 · Draft · Updated 4 minutes ago
            </Surface>
            <div className="footer-note">
              Inspector tools will surface layout, tokens, and export presets in
              this column.
            </div>
            <div className="project-meta">
              {artifacts.map((entry) => (
                <Link key={entry.id} href={`/studio/${project.id}/${entry.id}`}>
                  <Badge tone={entry.id === artifact.id ? "accent" : "outline"}>
                    {entry.kind}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
