import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { ArtifactPreview } from "../../../../components/artifact-preview";
import {
  getArtifactWorkspace,
  getProject,
  getSession,
  listArtifacts
} from "../../../../lib/opendesign-api";
import {
  createArtifactCommentAction,
  createArtifactVersionAction,
  resolveArtifactCommentAction
} from "./actions";

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
  const [session, project, workspacePayload] = await Promise.all([
    getSession(),
    getProject(params.projectId),
    getArtifactWorkspace(params.projectId, params.artifactId)
  ]);
  const artifacts = project ? await listArtifacts(project.id) : [];

  if (!project || !workspacePayload) {
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
  const artifact = workspacePayload.artifact;
  const workspace = workspacePayload.workspace;
  const versions = workspacePayload.versions;
  const comments = workspacePayload.comments;
  const artifactKind = artifact.kind;
  const artifactLabel = artifactLabels[artifactKind] ?? "Artifact";
  const latestVersion = versions[0] ?? null;
  const activeCommentCount = comments.filter((comment) => comment.status === "open").length;
  const rootNode = workspace.sceneDocument.nodes[0];
  const frameLabel = rootNode?.name ?? "Empty canvas";

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
              {workspace.intent}
            </div>
            <div className="chat-bubble">
              {latestVersion
                ? `${latestVersion.label} is active. ${latestVersion.summary}`
                : "Workspace seeded. Create the first review snapshot when this artifact is ready."}
            </div>
          </div>
          <Surface className="kv">
            <span>Intent</span>
            {workspace.intent}
          </Surface>
          <Surface className="kv">
            <span>Artifact Record</span>
            {artifact.name}
          </Surface>
          <Surface className="kv">
            <span>Comment Queue</span>
            {activeCommentCount} open comment{activeCommentCount === 1 ? "" : "s"}
          </Surface>
        </aside>

        <section className="canvas-panel">
          <div className="hero-actions">
            <Badge tone="outline">Canvas</Badge>
            <Badge>{artifactLabel}</Badge>
          </div>
          <div className="canvas-stage" id="artifact-canvas">
            <div>
              <h3>Artifact Canvas</h3>
              <p>
                {frameLabel} · Scene v{workspace.sceneDocument.version} ·{" "}
                {workspace.sceneDocument.nodes.length} root node
                {workspace.sceneDocument.nodes.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="project-meta">
            <span>Sync: {workspace.syncPlan.mode}</span>
            <span>Scope: {workspace.syncPlan.changeScope}</span>
            <span>Theme: {workspace.sceneDocument.metadata.themeId ?? "Default"}</span>
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
              prompt={workspace.intent}
            />
            <Surface className="kv">
              <span>Active Frame</span>
              {frameLabel}
            </Surface>
            <Surface className="kv">
              <span>Sync Strategy</span>
              {workspace.syncPlan.mode} · {workspace.syncPlan.targetMode}
            </Surface>
            <Surface className="kv">
              <span>Version Lane</span>
              {latestVersion
                ? `${latestVersion.label} · ${latestVersion.source} · ${versions.length} snapshots`
                : "No snapshots yet"}
            </Surface>
            <Surface className="project-card" as="section">
              <div>
                <h3>Create Snapshot</h3>
                <p className="footer-note">
                  Capture the current workspace as a named version.
                </p>
              </div>
              <form action={createArtifactVersionAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="artifactId" value={artifact.id} />
                <label className="field">
                  <span>Label</span>
                  <input name="label" placeholder="V2 Review" required />
                </label>
                <label className="field">
                  <span>Summary</span>
                  <input name="summary" placeholder="Review-ready snapshot for export." />
                </label>
                <Button variant="primary" type="submit">
                  Save Snapshot
                </Button>
              </form>
            </Surface>
            <Surface className="project-card" as="section">
              <div>
                <h3>Add Comment</h3>
                <p className="footer-note">
                  Comments are anchored to the current canvas until direct element
                  selection lands.
                </p>
              </div>
              <form action={createArtifactCommentAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="artifactId" value={artifact.id} />
                <label className="field">
                  <span>Comment</span>
                  <textarea
                    name="body"
                    placeholder="Tighten the left rail spacing and raise the eyebrow."
                    rows={3}
                    required
                  />
                </label>
                <Button variant="outline" type="submit">
                  Add Comment
                </Button>
              </form>
            </Surface>
            <Surface className="project-card" as="section">
              <div>
                <h3>Version History</h3>
                <p className="footer-note">Newest snapshots stay at the top.</p>
              </div>
              <div className="stack-form">
                {versions.map((version) => (
                  <Surface key={version.id} className="kv">
                    <span>{version.label}</span>
                    {version.summary}
                  </Surface>
                ))}
              </div>
            </Surface>
            <Surface className="project-card" as="section">
              <div>
                <h3>Comment Threads</h3>
                <p className="footer-note">
                  Resolve feedback as the artifact converges.
                </p>
              </div>
              <div className="stack-form">
                {comments.length === 0 ? (
                  <div className="footer-note">No comments yet.</div>
                ) : null}
                {comments.map((comment) => (
                  <Surface key={comment.id} className="kv">
                    <span>
                      {comment.status} · {comment.anchor.elementId ?? "artifact-canvas"}
                    </span>
                    {comment.body}
                    {comment.status === "open" ? (
                      <form action={resolveArtifactCommentAction}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="artifactId" value={artifact.id} />
                        <input type="hidden" name="commentId" value={comment.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Resolve
                        </Button>
                      </form>
                    ) : null}
                  </Surface>
                ))}
              </div>
            </Surface>
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
