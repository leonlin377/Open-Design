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
  getArtifactAssetUrl,
  getArtifactWorkspace,
  getArtifactVersionDiff,
  listArtifactExportJobs,
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
  uploadArtifactAssetAction,
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
  const exportJobsPayload = workspacePayload
    ? await listArtifactExportJobs(resolvedParams.projectId, resolvedParams.artifactId)
    : null;
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
  const rootImageAssetId =
    typeof rootNode?.props.imageAssetId === "string" ? rootNode.props.imageAssetId : null;
  const rootImageAlt =
    typeof rootNode?.props.imageAlt === "string" ? rootNode.props.imageAlt : artifact.name;
  const rootImageAsset =
    rootImageAssetId
      ? workspacePayload.assets.find((asset) => asset.id === rootImageAssetId) ?? null
      : null;
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
  const canvasLead =
    typeof rootNode?.props.headline === "string"
      ? rootNode.props.headline
      : typeof rootNode?.props.title === "string"
        ? rootNode.props.title
        : `${artifact.name} is ready for the next review pass.`;
  const canvasBody =
    typeof rootNode?.props.body === "string" ? rootNode.props.body : workspace.intent;
  const canvasMetricValues =
    artifactKind === "prototype"
      ? [
          `${sceneNodes.length} ${sceneNodes.length === 1 ? "screen" : "screens"}`,
          rootNode?.name ?? "Start screen",
          workspace.syncPlan.targetMode
        ]
      : artifactKind === "slides"
        ? [
            `${sceneNodes.length} ${sceneNodes.length === 1 ? "slide" : "slides"}`,
            rootNode?.name ?? "Title slide",
            workspace.syncPlan.targetMode
          ]
        : [
            `${sceneNodes.length} ${sceneNodes.length === 1 ? "section" : "sections"}`,
            workspace.codeWorkspace ? "Saved code workspace" : "Scene scaffold",
            workspace.syncPlan.targetMode
          ];
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
          <div className="canvas-panel-head">
            <div>
              <div className="hero-actions">
                <Badge tone="outline">{editorAffordance.canvasTitle}</Badge>
                <Badge>{artifactLabel}</Badge>
                <Badge tone={activeCommentCount > 0 ? "outline" : "accent"}>
                  {activeCommentCount} open comments
                </Badge>
              </div>
              <h3 className="canvas-panel-title">{artifact.name}</h3>
              <p className="canvas-panel-copy">
                {editorAffordance.canvasDescription} {editorAffordance.canvasFrameTone}.
              </p>
            </div>
            <div className="canvas-panel-meta">
              <span>Scene v{workspace.sceneDocument.version}</span>
              <span>{workspace.syncPlan.mode} sync</span>
              <span>{versions.length} snapshots</span>
            </div>
          </div>
          <div
            className={`canvas-stage ${artifactKind}-canvas-stage`}
            id="artifact-canvas"
          >
            <div className="canvas-stage-shell">
              <div className="canvas-stage-topline">
                <span>{editorAffordance.canvasEyebrow}</span>
                <strong>{frameLabel}</strong>
              </div>
              <div className="canvas-stage-frame">
                <div className="canvas-stage-frame-head">
                  <span>{artifactLabel}</span>
                  <span>{workspace.sceneDocument.metadata.themeId ?? "Default theme"}</span>
                </div>
                <div className="canvas-stage-feature">
                  {rootImageAsset ? (
                    <div className="canvas-stage-hero-media">
                      <img
                        src={getArtifactAssetUrl(project.id, artifact.id, rootImageAsset.id)}
                        alt={rootImageAlt}
                        className="canvas-stage-hero-image"
                      />
                    </div>
                  ) : null}
                  <p className="canvas-stage-lead">
                    {canvasLead}
                  </p>
                  <p className="canvas-stage-body">
                    {canvasBody}
                  </p>
                </div>
                <div className="canvas-stage-grid">
                  {editorAffordance.canvasMetricLabels.map((label, index) => (
                    <Surface key={label} className="kv">
                      <span>{label}</span>
                      {canvasMetricValues[index]}
                    </Surface>
                  ))}
                </div>
                {sceneNodes.length > 0 ? (
                  <div className="canvas-stage-sequence">
                    {sceneNodes.map((node, index) => (
                      <div key={node.id} className="canvas-stage-sequence-card">
                        <span>{index + 1}</span>
                        <strong>{node.name}</strong>
                        <p>
                          {String(node.props.headline ?? node.props.title ?? node.type)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="canvas-stage-empty">
                    No scene nodes yet. Add the first {editorAffordance.unitLabel} to start
                    shaping this artifact.
                  </div>
                )}
              </div>
            </div>
          </div>
          <StudioSceneSectionsPanel
            projectId={project.id}
            artifactId={artifact.id}
            artifactKind={artifactKind}
            assets={workspacePayload.assets}
            sceneNodes={sceneNodes}
            appendSceneTemplateAction={appendSceneTemplateAction}
            updateSceneNodeAction={updateSceneNodeAction}
            uploadArtifactAssetAction={uploadArtifactAssetAction}
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
              sceneNodes={sceneNodes}
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
              exportJobs={exportJobsPayload?.jobs ?? []}
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
