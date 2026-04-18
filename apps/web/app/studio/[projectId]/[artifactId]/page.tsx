import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import {
  StudioInspector,
  type StudioInspectorTab
} from "../../../../components/studio-inspector";
import {
  getArtifactWorkspace,
  getProject,
  getSession,
  listArtifacts
} from "../../../../lib/opendesign-api";
import {
  appendSceneTemplateAction,
  createArtifactCommentAction,
  createArtifactVersionAction,
  resolveArtifactCommentAction,
  updateSceneNodeAction
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
  searchParams: Promise<{
    tab?: string | string[];
  }>;
};

function readInspectorTab(value: string | string[] | undefined): StudioInspectorTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  const supportedTabs: StudioInspectorTab[] = [
    "preview",
    "code",
    "inspector",
    "versions",
    "export"
  ];

  return supportedTabs.includes(candidate as StudioInspectorTab)
    ? (candidate as StudioInspectorTab)
    : "preview";
}

function readFeatureGridItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
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

const defaultFeatureGridItems = [
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

export default async function StudioPage({ params, searchParams }: StudioPageProps) {
  const resolvedSearchParams = await searchParams;
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
  const sceneNodes = workspace.sceneDocument.nodes;
  const activeTab = readInspectorTab(resolvedSearchParams.tab);
  const sourceBundle = buildArtifactSourceBundle({
    artifactKind,
    artifactName: artifact.name,
    prompt: workspace.intent,
    sceneNodes
  });
  const sceneTemplates = [
    { template: "hero" as const, label: "Add Hero" },
    { template: "feature-grid" as const, label: "Add Feature Grid" },
    { template: "cta" as const, label: "Add CTA" }
  ];

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
          <Link
            href={`/studio/${project.id}/${artifact.id}/export/source-bundle`}
            className="button-link ghost"
          >
            Export ZIP
          </Link>
          <Link
            href={`/studio/${project.id}/${artifact.id}/export/html`}
            className="button-link primary"
          >
            Export HTML
          </Link>
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
          <Surface className="project-card" as="section">
            <div>
              <h3>Scene Sections</h3>
              <p className="footer-note">
                Append a root section template to the current scene document.
              </p>
            </div>
            <div className="artifact-action-grid">
              {sceneTemplates.map((entry) => (
                <form key={entry.template} action={appendSceneTemplateAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="artifactId" value={artifact.id} />
                  <input type="hidden" name="template" value={entry.template} />
                  <Button variant="outline" size="sm" type="submit">
                    {entry.label}
                  </Button>
                </form>
              ))}
            </div>
            <div className="scene-node-list">
              {sceneNodes.length === 0 ? (
                <div className="footer-note">No scene sections yet.</div>
              ) : null}
              {sceneNodes.map((node) => (
                (() => {
                  const featureItems = readFeatureGridItems(node.props.items);
                  const template = String(node.props.template ?? node.type);
                  const featureItemsTail =
                    template === "feature-grid" && featureItems.length > 3
                      ? featureItems.slice(3)
                      : [];
                  const editableFeatureItems =
                    template === "feature-grid"
                      ? [0, 1, 2].map((index) => ({
                          label:
                            featureItems[index]?.label ?? defaultFeatureGridItems[index]!.label,
                          body:
                            featureItems[index]?.body ?? defaultFeatureGridItems[index]!.body
                        }))
                      : [];

                  return (
                    <Surface key={node.id} className="project-card" as="section">
                      <div>
                        <h3>{node.name}</h3>
                        <p className="footer-note">
                          {template} · {node.id.slice(-8)}
                        </p>
                      </div>
                      <form action={updateSceneNodeAction} className="stack-form">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="artifactId" value={artifact.id} />
                        <input type="hidden" name="nodeId" value={node.id} />
                        {featureItemsTail.length > 0 ? (
                          <input
                            type="hidden"
                            name="itemsTailJson"
                            value={JSON.stringify(featureItemsTail)}
                          />
                        ) : null}
                        <label className="field">
                          <span>Section Name</span>
                          <input name="name" defaultValue={node.name} />
                        </label>
                        {typeof node.props.eyebrow === "string" ? (
                          <label className="field">
                            <span>Eyebrow</span>
                            <input name="eyebrow" defaultValue={node.props.eyebrow} />
                          </label>
                        ) : null}
                        {typeof node.props.title === "string" ? (
                          <label className="field">
                            <span>Title</span>
                            <input name="title" defaultValue={node.props.title} />
                          </label>
                        ) : null}
                        {template === "feature-grid" ? (
                          <div className="scene-item-grid">
                            {[0, 1, 2].map((index) => (
                              <Surface
                                key={`${node.id}-item-${index}`}
                                className="kv"
                                as="section"
                              >
                                <span>Item {index + 1}</span>
                                <label className="field">
                                  <span>Label</span>
                                  <input
                                    name={`item${index}Label`}
                                    defaultValue={editableFeatureItems[index]?.label ?? ""}
                                    required
                                  />
                                </label>
                                <label className="field">
                                  <span>Body</span>
                                  <textarea
                                    name={`item${index}Body`}
                                    defaultValue={editableFeatureItems[index]?.body ?? ""}
                                    rows={3}
                                    required
                                  />
                                </label>
                              </Surface>
                            ))}
                          </div>
                        ) : null}
                        {typeof node.props.headline === "string" ? (
                          <label className="field">
                            <span>Headline</span>
                            <input name="headline" defaultValue={node.props.headline} />
                          </label>
                        ) : null}
                        {typeof node.props.body === "string" ? (
                          <label className="field">
                            <span>Body</span>
                            <textarea name="body" defaultValue={node.props.body} rows={4} />
                          </label>
                        ) : null}
                        {typeof node.props.primaryAction === "string" ? (
                          <label className="field">
                            <span>Primary Action</span>
                            <input
                              name="primaryAction"
                              defaultValue={node.props.primaryAction}
                            />
                          </label>
                        ) : null}
                        {typeof node.props.secondaryAction === "string" ? (
                          <label className="field">
                            <span>Secondary Action</span>
                            <input
                              name="secondaryAction"
                              defaultValue={node.props.secondaryAction}
                            />
                          </label>
                        ) : null}
                        <Button variant="ghost" size="sm" type="submit">
                          Update Section
                        </Button>
                      </form>
                    </Surface>
                  );
                })()
              ))}
            </div>
          </Surface>
          <div className="project-meta">
            <span>Sync: {workspace.syncPlan.mode}</span>
            <span>Scope: {workspace.syncPlan.changeScope}</span>
            <span>Theme: {workspace.sceneDocument.metadata.themeId ?? "Default"}</span>
          </div>
        </section>

        <StudioInspector
          initialTab={activeTab}
          sourceBundle={sourceBundle}
          frameLabel={frameLabel}
          syncStrategy={`${workspace.syncPlan.mode} · ${workspace.syncPlan.targetMode}`}
          versionLane={
            latestVersion
              ? `${latestVersion.label} · ${latestVersion.source} · ${versions.length} snapshots`
              : "No snapshots yet"
          }
          inspectorPanel={
            <>
              <Surface className="kv">
                <span>Artifact Intent</span>
                {workspace.intent}
              </Surface>
              <Surface className="kv">
                <span>Active Frame</span>
                {frameLabel}
              </Surface>
              <Surface className="kv">
                <span>Sync Strategy</span>
                {workspace.syncPlan.mode} · {workspace.syncPlan.targetMode}
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
            </>
          }
          versionsPanel={
            <>
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
            </>
          }
          exportPanel={
            <>
              <Surface className="project-card" as="section">
                <div>
                  <h3>Export Surface</h3>
                  <p className="footer-note">
                    Download a runnable source scaffold or a standalone HTML render.
                  </p>
                </div>
                <div className="artifact-action-grid">
                  <Link
                    href={`/studio/${project.id}/${artifact.id}/export/source-bundle`}
                    className="button-link ghost"
                  >
                    Download ZIP
                  </Link>
                  <Link
                    href={`/studio/${project.id}/${artifact.id}/export/html`}
                    className="button-link primary"
                  >
                    Download HTML
                  </Link>
                </div>
              </Surface>
              <Surface className="project-card" as="section">
                <div>
                  <h3>Bundle Manifest</h3>
                  <p className="footer-note">
                    Current scaffold is generated directly from the live scene document.
                  </p>
                </div>
                <div className="stack-form">
                  {Object.entries(sourceBundle.files).map(([filePath, content]) => (
                    <Surface key={filePath} className="kv">
                      <span>{filePath}</span>
                      {content.split("\n").length} lines
                    </Surface>
                  ))}
                </div>
              </Surface>
            </>
          }
          artifactSwitcher={artifacts.map((entry) => (
            <Link key={entry.id} href={`/studio/${project.id}/${entry.id}`}>
              <Badge tone={entry.id === artifact.id ? "accent" : "outline"}>
                {entry.kind}
              </Badge>
            </Link>
          ))}
        />
      </section>
    </main>
  );
}
