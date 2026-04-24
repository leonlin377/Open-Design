import Link from "next/link";
import {
  ARTIFACT_THEME_PRESET_NAMES,
  ARTIFACT_THEME_PRESETS,
  DEFAULT_ARTIFACT_THEME
} from "@opendesign/contracts";
import { Badge, Button } from "@opendesign/ui";
import { buildArtifactSourceBundle } from "@opendesign/exporters";
import { CanvasStage } from "../../../../components/canvas";
import { StudioCommentsPanel } from "../../../../components/studio-comments-panel";
import { StudioExportPanel } from "../../../../components/studio-export-panel";
import { StudioDesignSystemPanel } from "../../../../components/studio-design-system-panel";
import { StudioGeneratePanel } from "../../../../components/studio-generate-panel";
import { getArtifactEditorAffordance } from "../../../../components/studio-artifact-affordances";
import { StudioSceneSectionsPanel } from "../../../../components/studio-scene-sections-panel";
import { StudioVersionsPanel } from "../../../../components/studio-versions-panel";
import { StudioChatPanel } from "../../../../components/studio-chat-panel";
import { StudioPalettePanel } from "../../../../components/studio-palette-panel";
import { StudioVariationsPanel } from "../../../../components/studio-variations-panel";
import { StudioRemixButton } from "../../../../components/studio-remix-button";
import { StudioExportExtrasButtons } from "../../../../components/studio-export-extras-buttons";
import { fetchArtifactTheme } from "../../../../lib/opendesign-theme";
import { RefineTrigger } from "./studio-panels-client";
import { StudioShell } from "./studio-shell";
import {
  type ApiArtifactVersionDiff,
  getArtifactWorkspace,
  getArtifactVersionDiff,
  listArtifactExportJobs,
  getProject,
  getSession,
  listArtifacts,
  listDesignSystems,
  listProjects
} from "../../../../lib/opendesign-api";
import {
  attachArtifactDesignSystemAction,
  appendSceneTemplateAction,
  createArtifactCommentAction,
  createArtifactVersionAction,
  createArtifactShareTokenAction,
  resolveArtifactCommentAction,
  restoreArtifactVersionAction,
  uploadArtifactAssetAction,
  updateSceneNodeAction
} from "./actions";

// Presets mounted into `StudioPalettePanel`. Sourced from contracts so
// adding a preset there surfaces it in Studio automatically.
const paletteThemePresets = ARTIFACT_THEME_PRESET_NAMES.map((name) => ({
  name,
  theme: ARTIFACT_THEME_PRESETS[name]
}));

// Font-pair catalogue shipped to `StudioPalettePanel`.
const fontPairCatalogue = [
  {
    id: "inter-sans",
    label: "Inter / Inter",
    display:
      '"Inter", "SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif',
    body: '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif'
  },
  {
    id: "display-serif",
    label: "Display / Serif",
    display:
      '"Manrope", "SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif',
    body: 'ui-serif, Georgia, "Times New Roman", Times, serif'
  },
  {
    id: "serif-sans",
    label: "Serif / Sans",
    display: 'ui-serif, Georgia, "Times New Roman", Times, serif',
    body: '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif'
  }
];

type StudioPageProps = {
  params: Promise<{
    projectId: string;
    artifactId: string;
  }>;
  searchParams: Promise<{
    tab?: string | string[];
  }>;
};

export default async function StudioPage({ params }: StudioPageProps) {
  const resolvedParams = await params;
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
  const initialTheme = workspacePayload
    ? await fetchArtifactTheme({
        projectId: resolvedParams.projectId,
        artifactId: resolvedParams.artifactId
      }).catch(() => null)
    : null;
  const allProjects = await listProjects().catch(() => [] as Awaited<
    ReturnType<typeof listProjects>
  >);

  if (!project || !workspacePayload) {
    return (
      <main className="page">
        <section className="hero">
          <Badge tone="outline">Studio</Badge>
          <h1>Artifact not found.</h1>
          <p>
            This project or artifact is not in the current workspace snapshot. Return
            to projects and create a new one.
          </p>
          <div className="hero-actions">
            <Link href="/projects" className="button-link primary">
              Back to projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const artifact = workspacePayload.artifact;
  const workspace = workspacePayload.workspace;
  const versions = workspacePayload.versions;
  const comments = workspacePayload.comments;
  const artifactKind = artifact.kind;
  const sceneNodes = workspace.sceneDocument.nodes;
  const rootNode = workspace.sceneDocument.nodes[0];
  const frameLabel =
    rootNode?.name ??
    (artifactKind === "prototype"
      ? "Start screen"
      : artifactKind === "slides"
        ? "Title slide"
        : "Empty canvas");
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

  // Per-user storage key when we have a session, otherwise per-artifact so
  // rail preferences don't bleed across artifacts for signed-out users.
  const shellStorageKey = session?.user.id
    ? `u:${session.user.id}`
    : `a:${artifact.id}`;

  // ---------------------------------------------------------------------
  // Panel renders — the shell receives each as a ReactNode so panel
  // internals stay as-is. This file only recomposes them.
  // ---------------------------------------------------------------------

  // Scene-mode canvas (fallback when user flips the topbar view toggle).
  const sceneCanvas = (
    <div
      className={`canvas-stage studio-canvas-stage ${artifactKind}-canvas-stage`}
    >
      <CanvasStage
        projectId={project.id}
        artifactId={artifact.id}
        artifactKind={artifactKind}
        sceneNodes={sceneNodes}
        updateSceneNodeAction={updateSceneNodeAction}
        emptyStateTitle={editorAffordance.canvasTitle}
        emptyStateDescription={`${editorAffordance.canvasDescription} ${editorAffordance.canvasFrameTone}.`}
        unitLabel={editorAffordance.unitLabel}
        frameLabel={frameLabel}
        themeLabel={workspace.sceneDocument.metadata.themeId ?? "Default theme"}
      />
    </div>
  );

  const layersPanel = (
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
  );

  const commentsPanel = (
    <StudioCommentsPanel
      projectId={project.id}
      artifactId={artifact.id}
      workspaceIntent={workspace.intent}
      frameLabel={frameLabel}
      syncStrategy={`${workspace.syncPlan.mode} / ${workspace.syncPlan.targetMode}`}
      sceneNodes={sceneNodes}
      comments={comments}
      createArtifactCommentAction={createArtifactCommentAction}
      resolveArtifactCommentAction={resolveArtifactCommentAction}
    />
  );

  const versionsPanel = (
    <StudioVersionsPanel
      projectId={project.id}
      artifactId={artifact.id}
      activeVersionId={workspace.activeVersionId}
      versions={versions}
      versionDiffById={versionDiffById}
      createArtifactVersionAction={createArtifactVersionAction}
      restoreArtifactVersionAction={restoreArtifactVersionAction}
    />
  );

  const exportPanel = (
    <>
      <StudioExportPanel
        projectId={project.id}
        artifactId={artifact.id}
        artifactKind={artifactKind}
        sourceBundleFiles={sourceBundle.files}
        exportJobs={exportJobsPayload?.jobs ?? []}
      />
      <StudioExportExtrasButtons projectId={project.id} artifactId={artifact.id} />
    </>
  );

  const chatPanel = (
    <StudioChatPanel
      projectId={project.id}
      artifactId={artifact.id}
      artifactName={artifact.name}
      selectedNode={null}
    />
  );

  const designSystemPanel = (
    <StudioDesignSystemPanel
      projectId={project.id}
      artifactId={artifact.id}
      designSystems={designSystems}
      selectedDesignSystemPackId={
        workspace.sceneDocument.metadata.designSystemPackId ?? null
      }
      attachArtifactDesignSystemAction={attachArtifactDesignSystemAction}
    />
  );

  const palettePanel = (
    <StudioPalettePanel
      projectId={project.id}
      artifactId={artifact.id}
      initialTheme={initialTheme?.theme ?? DEFAULT_ARTIFACT_THEME}
      presets={paletteThemePresets}
      fontPairs={fontPairCatalogue}
    />
  );

  const promptPanel = (
    <StudioGeneratePanel
      projectId={project.id}
      artifactId={artifact.id}
      artifactKind={artifactKind}
      initialPrompt={workspace.intent}
    />
  );

  const variationsPanel = (
    <StudioVariationsPanel
      projectId={project.id}
      artifactId={artifact.id}
      initialPrompt={workspace.intent}
    />
  );

  // Refine trigger now pulls the active node from `SelectionProvider` — no
  // more pinning to the first root node. The trigger renders a disabled
  // "Select an element to refine" hint when nothing is selected.
  const refinePanel = rootNode ? (
    <RefineTrigger projectId={project.id} artifactId={artifact.id} />
  ) : null;

  const topbarExtraMenu = (
    <div className="studio-topbar-menu-items">
      <StudioRemixButton
        projectId={project.id}
        artifactId={artifact.id}
        artifactName={artifact.name}
        availableProjects={allProjects.map((entry) => ({
          id: entry.id,
          name: entry.name
        }))}
      />
      <Link
        href={`/studio/${project.id}/${artifact.id}/export/handoff-bundle`}
        className="button-link ghost"
      >
        Export handoff
      </Link>
      <Link
        href={`/studio/${project.id}/${artifact.id}/export/source-bundle`}
        className="button-link ghost"
      >
        Export ZIP
      </Link>
      <Link
        href={`/studio/${project.id}/${artifact.id}/export/html`}
        className="button-link ghost"
      >
        Export HTML
      </Link>
      <form action={createArtifactShareTokenAction} className="studio-topbar-share">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="artifactId" value={artifact.id} />
        <select name="role" defaultValue="viewer" aria-label="Share role">
          <option value="viewer">Viewer</option>
          <option value="commenter">Commenter</option>
          <option value="editor">Editor</option>
        </select>
        <Button variant="outline" size="sm" type="submit">
          Share
        </Button>
      </form>
    </div>
  );

  // Artifacts sibling strip currently deprecated — remix lives in the
  // overflow menu and versions land in the resource popover. Reference it
  // here so the list isn't silently unused.
  void artifacts;

  const publishHref = `/studio/${project.id}/${artifact.id}/export/source-bundle`;
  const canvasBreadcrumb = `opendesign.live/${project.id}/${artifact.id}`;

  return (
    <StudioShell
      storageKey={shellStorageKey}
      projectId={project.id}
      artifactId={artifact.id}
      artifactKind={artifactKind}
      artifactName={artifact.name}
      canvasBreadcrumb={canvasBreadcrumb}
      codeWorkspaceFiles={sourceBundle.files}
      sceneCanvas={sceneCanvas}
      chatPanel={chatPanel}
      composePanels={{
        promptPanel,
        variationsPanel,
        refinePanel
      }}
      resourcePanels={{
        layersPanel,
        designSystemPanel,
        palettePanel,
        versionsPanel,
        exportPanel,
        commentsPanel
      }}
      topbarExtraMenu={topbarExtraMenu}
      publishHref={publishHref}
    />
  );
}
