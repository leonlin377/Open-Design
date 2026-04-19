import Link from "next/link";
import { Badge, Surface } from "@opendesign/ui";

const artifacts = ["Website", "Prototype", "Slides"];
const launchSteps = [
  "Create or open a project.",
  "Choose the artifact type that fits the outcome.",
  "Generate a first pass or shape the scene manually."
] as const;
const starterTracks = [
  {
    title: "Website",
    body: "Best when you need a launch-ready marketing surface, hierarchy, proof, and exportable HTML."
  },
  {
    title: "Prototype",
    body: "Best when you need a stateful flow, branching screens, or reviewable interaction structure."
  },
  {
    title: "Slides",
    body: "Best when you need a narrative deck with paced beats and a handoff-ready structure."
  }
] as const;

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
        <Surface className="onboarding-card" as="section">
          <div className="onboarding-card-head">
            <Badge tone="outline">Three-step launch path</Badge>
            <strong>OpenDesign gets useful once the artifact starts moving.</strong>
          </div>
          <div className="onboarding-steps">
            {launchSteps.map((step, index) => (
              <div key={step} className="onboarding-step">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      <h2 className="section-title">Choose The First Artifact</h2>
      <div className="feature-grid">
        {starterTracks.map((track) => (
          <Surface key={track.title} as="article" className="feature-card">
            <h3>{track.title}</h3>
            <p>{track.body}</p>
          </Surface>
        ))}
      </div>
    </main>
  );
}
