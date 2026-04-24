"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from "@codesandbox/sandpack-react";
import { Surface } from "@opendesign/ui";
import type { ApiArtifact } from "../lib/opendesign-api";

const inspectorTabs = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
  { id: "inspector", label: "Inspector" },
  { id: "versions", label: "Versions" },
  { id: "export", label: "Export" }
] as const;

export type StudioInspectorTab = (typeof inspectorTabs)[number]["id"];

type StudioInspectorProps = {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  initialTab: StudioInspectorTab;
  sourceBundle: {
    filenameBase: string;
    files: Record<string, string>;
  };
  sceneVersion: number;
  codeWorkspaceBaseSceneVersion: number | null;
  codeWorkspaceUpdatedAt: string | null;
  frameLabel: string;
  syncStrategy: string;
  versionLane: string;
  saveCodeWorkspaceAction: (
    formData: FormData
  ) => Promise<
    | {
        status: "saved";
        workspace: unknown;
        previousCodeWorkspaceUpdatedAt: string | null;
        sceneSync: {
          status: "synced" | "unchanged";
          reason: string;
        };
      }
    | {
        status: "conflict";
        message: string;
        currentUpdatedAt: string | null;
      }
    | void
  >;
  inspectorPanel: ReactNode;
  versionsPanel: ReactNode;
  exportPanel: ReactNode;
  artifactSwitcher: ReactNode;
};

function normalizeFiles(files: Record<string, string>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(files)
        .map(([filePath, value]) => [filePath, value])
        .sort(([left], [right]) => left.localeCompare(right))
    )
  );
}

function SaveCodeWorkspaceForm(props: {
  projectId: string;
  artifactId: string;
  artifactKind: ApiArtifact["kind"];
  sourceBundleFiles: Record<string, string>;
  sceneVersion: number;
  codeWorkspaceBaseSceneVersion: number | null;
  codeWorkspaceUpdatedAt: string | null;
  saveCodeWorkspaceAction: StudioInspectorProps["saveCodeWorkspaceAction"];
}) {
  const { sandpack } = useSandpack();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const files = Object.fromEntries(
    Object.entries(sandpack.files).map(([filePath, value]) => [
      filePath,
      typeof value === "string" ? value : value.code
    ])
  );
  const normalizedSavedFiles = normalizeFiles(props.sourceBundleFiles);
  const hasSceneDrift =
    props.codeWorkspaceBaseSceneVersion !== null &&
    props.codeWorkspaceBaseSceneVersion !== props.sceneVersion;
  const hasUnsavedDraft = sandpack.editorState === "dirty";

  useEffect(() => {
    setFeedback(
      props.codeWorkspaceUpdatedAt
        ? {
            tone: "success",
            message: "Loaded the latest saved code workspace into the Studio session."
          }
        : null
    );
  }, [normalizedSavedFiles]);

  function handleSave() {
    const formData = new FormData();
    formData.set("projectId", props.projectId);
    formData.set("artifactId", props.artifactId);
    formData.set("filesJson", JSON.stringify(files));
    formData.set("expectedUpdatedAt", props.codeWorkspaceUpdatedAt ?? "");

    startTransition(async () => {
      const result = await props.saveCodeWorkspaceAction(formData);

      if (result && result.status === "conflict") {
        setFeedback({
          tone: "warning",
          message: result.message
        });
        return;
      }

      setFeedback({
        tone: result?.sceneSync.status === "unchanged" ? "warning" : "success",
        message:
          result?.sceneSync.status === "synced"
            ? `Saved code workspace and synced supported ${props.artifactKind === "website" ? "section" : props.artifactKind === "prototype" ? "screen" : "slide"} fields back into the scene.`
            : `Saved code workspace. Preview and ZIP export now use this scaffold. ${result?.sceneSync.reason ?? "Scene stayed unchanged."}`
      });
    });
  }

  function handleReset() {
    setFeedback({
      tone: "success",
      message: "Reset the session draft back to the saved code workspace."
    });
    sandpack.resetAllFiles();
  }

  return (
    <div className="stack-form">
      <div className="project-meta">
        <span>
          {props.codeWorkspaceUpdatedAt
            ? `Saved from scene v${props.codeWorkspaceBaseSceneVersion} at ${new Date(props.codeWorkspaceUpdatedAt).toLocaleString("zh-CN")}`
            : "No saved code workspace yet"}
        </span>
        <span>
          {hasSceneDrift
            ? `Scene is now v${props.sceneVersion}; save again to rebase the saved code workspace on the latest scene baseline`
            : "ZIP export follows the saved code workspace when present"}
        </span>
      </div>
      <div className="footer-note">
        {props.artifactKind === "website"
          ? "Save Code Workspace persists the current scaffold for preview and ZIP export. Supported website fields can sync back into the scene; unsupported edits stay code-only."
          : `Save Code Workspace persists the current ${props.artifactKind} scaffold for preview and ZIP export. Scene sync stays conservative, so unsupported edits remain code-only.`}
      </div>
      <div className="studio-status-row">
        <span className={hasUnsavedDraft ? "status-pill warning" : "status-pill success"}>
          {hasUnsavedDraft ? "Unsaved draft" : "Draft saved"}
        </span>
        <span className="footer-note">
          {hasUnsavedDraft
            ? "The current Sandpack session differs from the saved code workspace."
            : "The current Sandpack session matches the saved code workspace."}{" "}
          This compares code only, not the scene document.
        </span>
      </div>
      {feedback ? (
        <div className={`studio-feedback ${feedback.tone}`}>{feedback.message}</div>
      ) : null}
      <div className="artifact-action-grid">
        <button
          type="button"
          className="button-link ghost studio-inline-button"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save Code Workspace"}
        </button>
        <button
          type="button"
          className="button-link ghost studio-inline-button"
          onClick={handleReset}
          disabled={isPending || !hasUnsavedDraft}
        >
          Reset to saved
        </button>
      </div>
      <SandpackLayout className="studio-code-layout">
        <SandpackFileExplorer autoHiddenFiles={false} />
        <div className="studio-code-column">
          <SandpackCodeEditor showTabs showLineNumbers showInlineErrors wrapContent />
        </div>
      </SandpackLayout>
    </div>
  );
}

export function StudioInspector({
  projectId,
  artifactId,
  artifactKind,
  initialTab,
  sourceBundle,
  sceneVersion,
  codeWorkspaceBaseSceneVersion,
  codeWorkspaceUpdatedAt,
  frameLabel,
  syncStrategy,
  versionLane,
  saveCodeWorkspaceAction,
  inspectorPanel,
  versionsPanel,
  exportPanel,
  artifactSwitcher
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<StudioInspectorTab>(initialTab);

  return (
    <aside className="inspector">
      <div className="tab-row">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-section">
        <SandpackProvider
          template="react-ts"
          files={{
            "/App.tsx": sourceBundle.files["/App.tsx"] ?? "",
            ...(sourceBundle.files["/styles.css"] ? { "/styles.css": sourceBundle.files["/styles.css"] } : {})
          }}
          options={{
            activeFile: "/App.tsx",
            visibleFiles: ["/App.tsx", ...(sourceBundle.files["/styles.css"] ? ["/styles.css"] : [])],
            externalResources: ["https://cdn.tailwindcss.com"]
          }}
        >
          <div className={activeTab === "preview" ? "studio-tab-panel active" : "studio-tab-panel"}>
            <div className="footer-note">
              Preview runs from the live session bundle. Saved code workspaces seed this
              bundle when present, while snapshots and HTML export stay scene-based unless
              supported section fields sync back.
            </div>
            <div className="studio-sandpack-shell">
              <SandpackPreview
                className="studio-preview-shell"
                showNavigator={false}
                showRefreshButton
                showRestartButton
              />
            </div>
            <Surface className="kv">
              <span>Active frame</span>
              {frameLabel}
            </Surface>
            <Surface className="kv">
              <span>Sync strategy</span>
              {syncStrategy}
            </Surface>
            <Surface className="kv">
              <span>Version lane</span>
              {versionLane}
            </Surface>
          </div>

          <div className={activeTab === "code" ? "studio-tab-panel active" : "studio-tab-panel"}>
            <Surface className="project-card" as="section">
              <div>
                <h3>Session Code Workspace</h3>
                <p className="footer-note">
                  Edit the scaffold locally, then save it as a persisted code workspace.
                  Scene snapshots and HTML export still follow the scene document unless
                  supported section fields sync back.
                </p>
              </div>
              <div className="project-meta">
                <span>{sourceBundle.filenameBase}</span>
                <span>{Object.keys(sourceBundle.files).length} files</span>
              </div>
              <SaveCodeWorkspaceForm
              projectId={projectId}
              artifactId={artifactId}
              artifactKind={artifactKind}
              sourceBundleFiles={sourceBundle.files}
                sceneVersion={sceneVersion}
                codeWorkspaceBaseSceneVersion={codeWorkspaceBaseSceneVersion}
                codeWorkspaceUpdatedAt={codeWorkspaceUpdatedAt}
                saveCodeWorkspaceAction={saveCodeWorkspaceAction}
              />
            </Surface>
            <div className="studio-sandpack-shell">
              <div className="footer-note">
                Reset always returns to the saved code workspace currently loaded into
                Studio. Restore Version swaps that saved baseline for the selected snapshot.
              </div>
            </div>
          </div>
        </SandpackProvider>

        <div className={activeTab === "inspector" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {inspectorPanel}
        </div>

        <div className={activeTab === "versions" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {versionsPanel}
        </div>

        <div className={activeTab === "export" ? "studio-tab-panel active" : "studio-tab-panel"}>
          {exportPanel}
        </div>

        <div className="project-meta">{artifactSwitcher}</div>
      </div>
    </aside>
  );
}
