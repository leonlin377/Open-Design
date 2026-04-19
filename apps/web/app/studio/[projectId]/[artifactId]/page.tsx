import Link from "next/link";
import { Badge, Button, Surface } from "@opendesign/ui";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { StudioCommentsPanel } from "../../../../components/studio-comments-panel";
import { StudioExportPanel } from "../../../../components/studio-export-panel";
import {
  StudioInspector,
  type StudioInspectorTab
} from "../../../../components/studio-inspector";
import { StudioDesignSystemPanel } from "../../../../components/studio-design-system-panel";
import { StudioGeneratePanel } from "../../../../components/studio-generate-panel";
import { getArtifactEditorAffordance } from "../../../../components/studio-artifact-affordances";
import { StudioSceneSectionsPanel } from "../../../../components/studio-scene-sections-panel";
import { StudioVersionsPanel } from "../../../../components/studio-versions-panel";
import {
  type ApiArtifactVersionDiff,
  getArtifactWorkspace,
  getArtifactVersionDiff,
  getProject,
  getSession,
  listArtifacts,
  listDesignSystems
} from "../../../../lib/opendesign-api";
import {
  attachArtifactDesignSystemAction,
  appendSceneTemplateAction,
  createArtifactCommentAction,
  createArtifactVersionAction,
  createArtifactShareTokenAction,
  resolveArtifactCommentAction,
  restoreArtifactVersionAction,
  saveCodeWorkspaceAction,
  updateSceneNodeAction
} from "./actions";

const artifactLabels: Record<string, string> = {
  website: "Website",
  prototype: "Prototype",
  slides: "Slides"
};

type StudioPageProps = {
  params: Promise<{
    projectId: string;
    artifactId: string;
  }>;
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

export default async function StudioPage({ params, searchParams }: StudioPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const [session, project, workspacePayload, designSystems] = await Promise.all([
    getSession(),
    getProject(resolvedParams.projectId),
    getArtifactWorkspace(resolvedParams.projectId, resolvedParams.artifactId),
    listDesignSystems()
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
  const frameLabel =
    rootNode?.name ??
    (artifactKind === "prototype"
      ? "Start screen"
      : artifactKind === "slides"
        ? "Title slide"
        : "Empty canvas");
  const sceneNodes = workspace.sceneDocument.nodes;
  const activeTab = readInspectorTab(resolvedSearchParams.tab);
  const editorAffordance = getArtifactEditorAffordance(artifactKind);
  const generatedSourceBundle = buildArtifactSourceBundle({
    artifactKind,
    artifactName: artifact.name,
    prompt: workspace.intent,
    sceneNodes
  });
  const sourceBundle = workspace.codeWorkspace
    ? {
        ...generatedSourceBundle,
        files: workspace.codeWorkspace.files
      }
    : generatedSourceBundle;
  const versionDiffEntries = await Promise.all(
    versions.map(
      async (
        version
      ): Promise<[string, Awaited<ReturnType<typeof getArtifactVersionDiff>>]> => [
        version.id,
        await getArtifactVersionDiff({
          projectId: project.id,
          artifactId: artifact.id,
          versionId: version.id
        })
      ]
    )
  );
  const versionDiffById = Object.fromEntries(
    versionDiffEntries.map(([versionId, payload]) => [versionId, payload?.diff ?? null])
  ) as Record<string, ApiArtifactVersionDiff | null>;

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
          <form action={createArtifactShareTokenAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="artifactId" value={artifact.id} />
            <select name="role" defaultValue="viewer">
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
            </select>
            <Button variant="outline" size="sm" type="submit">
              Share Artifact
            </Button>
          </form>
          <Link
            href={`/studio/${project.id}/${artifact.id}/export/handoff-bundle`}
            className="button-link ghost"
          >
            Export Handoff
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
          <StudioDesignSystemPanel
            projectId={project.id}
            artifactId={artifact.id}
            designSystems={designSystems}
            selectedDesignSystemPackId={
              workspace.sceneDocument.metadata.designSystemPackId ?? null
            }
            attachArtifactDesignSystemAction={attachArtifactDesignSystemAction}
          />
          <StudioGeneratePanel
            projectId={project.id}
            artifactId={artifact.id}
            artifactKind={artifactKind}
            initialPrompt={workspace.intent}
          />
        </aside>

        <section className="canvas-panel">
          <div className="hero-actions">
            <Badge tone="outline">{editorAffordance.canvasTitle}</Badge>
            <Badge>{artifactLabel}</Badge>
          </div>
          <div className="canvas-stage" id="artifact-canvas">
            <div>
              <h3>{editorAffordance.canvasTitle}</h3>
              <p>
                {editorAffordance.canvasDescription} {frameLabel} · Scene v
                {workspace.sceneDocument.version} ·{" "}
                {workspace.sceneDocument.nodes.length} root{" "}
                {artifactKind === "prototype"
                  ? "screen"
                  : artifactKind === "slides"
                    ? "slide"
                    : "node"}
                {workspace.sceneDocument.nodes.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <StudioSceneSectionsPanel
            projectId={project.id}
            artifactId={artifact.id}
            artifactKind={artifactKind}
            sceneNodes={sceneNodes}
            appendSceneTemplateAction={appendSceneTemplateAction}
            updateSceneNodeAction={updateSceneNodeAction}
          />
          <div className="project-meta">
            <span>Sync: {workspace.syncPlan.mode}</span>
            <span>Scope: {workspace.syncPlan.changeScope}</span>
            <span>Theme: {workspace.sceneDocument.metadata.themeId ?? "Default"}</span>
          </div>
        </section>

        <StudioInspector
          projectId={project.id}
          artifactId={artifact.id}
          artifactKind={artifactKind}
          initialTab={activeTab}
          sourceBundle={sourceBundle}
          sceneVersion={workspace.sceneDocument.version}
          codeWorkspaceBaseSceneVersion={workspace.codeWorkspace?.baseSceneVersion ?? null}
          codeWorkspaceUpdatedAt={workspace.codeWorkspace?.updatedAt ?? null}
          frameLabel={frameLabel}
          syncStrategy={`${workspace.syncPlan.mode} · ${workspace.syncPlan.targetMode}`}
          versionLane={
            latestVersion
              ? `${latestVersion.label} · ${latestVersion.source} · ${versions.length} snapshots`
              : "No snapshots yet"
          }
          saveCodeWorkspaceAction={saveCodeWorkspaceAction}
          inspectorPanel={
            <StudioCommentsPanel
              projectId={project.id}
              artifactId={artifact.id}
              workspaceIntent={workspace.intent}
              frameLabel={frameLabel}
              syncStrategy={`${workspace.syncPlan.mode} · ${workspace.syncPlan.targetMode}`}
              comments={comments}
              createArtifactCommentAction={createArtifactCommentAction}
              resolveArtifactCommentAction={resolveArtifactCommentAction}
            />
          }
          versionsPanel={
            <StudioVersionsPanel
              projectId={project.id}
              artifactId={artifact.id}
              activeVersionId={workspace.activeVersionId}
              versions={versions}
              versionDiffById={versionDiffById}
              createArtifactVersionAction={createArtifactVersionAction}
              restoreArtifactVersionAction={restoreArtifactVersionAction}
            />
          }
          exportPanel={
            <StudioExportPanel
              projectId={project.id}
              artifactId={artifact.id}
              artifactKind={artifactKind}
              sourceBundleFiles={sourceBundle.files}
            />
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
